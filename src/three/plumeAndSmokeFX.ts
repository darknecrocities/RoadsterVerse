import * as THREE from 'three';
import type { RigidBodyState, ThrusterActivation, VehicleId } from '../types/simulation.ts';
import type { NozzleEmitterDescriptor } from './roadsterModel.ts';

interface PlumeParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  baseScale: number;
  kind: 'white-smoke' | 'fire-plume';
}

/**
 * Physics-based Particle Simulation for:
 * 1) Roadster Per-Nozzle Pure White Cold-Gas Smoke (with ground/wall collision vortex, drag, curl turbulence & buoyancy)
 * 2) Starship Physics-Based Raptor Fire Thruster (combustion temperature gradient + Launch Paddock flame trench deflection)
 */
export class VolumetricPlumeSmokeSystem {
  public readonly group = new THREE.Group();
  private readonly particles: PlumeParticle[] = [];
  private spawnAccumulator = 0;

  constructor(poolSize = 220) {
    const geo = new THREE.DodecahedronGeometry(0.42, 1);

    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.88,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 999,
        maxAge: 1.4,
        baseScale: 0.55,
        kind: 'white-smoke',
      });
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    baseScale: number,
    maxAge: number,
    kind: 'white-smoke' | 'fire-plume'
  ): void {
    const slot = this.particles.find((p) => p.age >= p.maxAge);
    if (!slot) return;

    slot.mesh.position.set(x, y, z);
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.age = 0;
    slot.maxAge = maxAge;
    slot.baseScale = baseScale;
    slot.kind = kind;
    slot.mesh.visible = true;

    const mat = slot.mesh.material as THREE.MeshStandardMaterial;
    if (kind === 'white-smoke') {
      mat.color.setHex(0xffffff);
      mat.emissive.setHex(0xd4d4d4);
      mat.emissiveIntensity = 0.28;
      mat.opacity = 0.78;
    } else {
      // Initial white-hot combustion core
      mat.color.setHex(0xfffbeb);
      mat.emissive.setHex(0xf97316);
      mat.emissiveIntensity = 0.95;
      mat.opacity = 0.92;
    }
  }

  public update(
    dt: number,
    vehicle: VehicleId,
    state: RigidBodyState,
    thrusters: ThrusterActivation,
    roadsterNozzles: NozzleEmitterDescriptor[] = []
  ): void {
    this.spawnAccumulator += dt;

    if (this.spawnAccumulator >= 0.018 && !state.crashed) {
      this.spawnAccumulator = 0;

      if (vehicle === 'roadster') {
        // Rotate each Roadster nozzle's local offset and jet direction into world space
        const euler = new THREE.Euler(
          state.attitude.roll,
          state.attitude.yaw,
          state.attitude.pitch,
          'XYZ'
        );

        for (const nozzle of roadsterNozzles) {
          if (nozzle.intensity <= 0.05) continue;

          const worldPos = nozzle.localOffset.clone().applyEuler(euler);
          worldPos.x += state.position.x;
          worldPos.y += state.position.y;
          worldPos.z += state.position.z;

          const worldDir = nozzle.localDirection.clone().applyEuler(euler).normalize();
          const jetSpeed = (9.5 + nozzle.intensity * 11.5);

          // Spawn pure white physics smoke directly from this specific thruster nozzle!
          this.spawnParticle(
            worldPos.x + (Math.random() - 0.5) * 0.14,
            Math.max(0.14, worldPos.y),
            worldPos.z + (Math.random() - 0.5) * 0.14,
            state.velocity.x * 0.35 + worldDir.x * jetSpeed + (Math.random() - 0.5) * 2.2,
            worldDir.y * jetSpeed + (Math.random() - 0.5) * 1.4,
            worldDir.z * jetSpeed + (Math.random() - 0.5) * 2.2,
            0.34 + nozzle.intensity * 0.45,
            0.75 + Math.random() * 0.45,
            'white-smoke'
          );
        }
      } else {
        // Starship Physics-Based Fire Thruster Plume
        if (thrusters.raptorThrottle > 0.06) {
          const isFullStack = !thrusters.hotStageSeparated && state.position.y < 17.5;
          const engineBellOffsetY = isFullStack ? -4.7 : -0.1;
          const euler = new THREE.Euler(
            state.attitude.roll,
            state.attitude.yaw,
            state.attitude.pitch,
            'XYZ'
          );
          const nozzleWorld = new THREE.Vector3(0, engineBellOffsetY, 0).applyEuler(euler);
          nozzleWorld.x += state.position.x;
          nozzleWorld.y += state.position.y;
          nozzleWorld.z += state.position.z;

          const jetDir = new THREE.Vector3(
            Math.sin(thrusters.gimbalPitch * 0.25),
            -1,
            Math.sin(thrusters.gimbalYaw * 0.25)
          )
            .applyEuler(euler)
            .normalize();

          const fireJetSpeed = 14.0 + thrusters.raptorThrottle * 16.0;

          for (let k = 0; k < 4; k++) {
            this.spawnParticle(
              nozzleWorld.x + (Math.random() - 0.5) * 0.65,
              Math.max(0.2, nozzleWorld.y),
              nozzleWorld.z + (Math.random() - 0.5) * 0.65,
              jetDir.x * fireJetSpeed + (Math.random() - 0.5) * 3.8,
              jetDir.y * fireJetSpeed + (Math.random() - 0.5) * 2.4,
              jetDir.z * fireJetSpeed + (Math.random() - 0.5) * 3.8,
              0.58 + thrusters.raptorThrottle * 0.65,
              0.7 + Math.random() * 0.4,
              'fire-plume'
            );
          }
        }
      }
    }

    // Step 6-DoF Fluid/Rigid Collision Physics for all active particles
    for (const p of this.particles) {
      if (p.age >= p.maxAge) continue;
      p.age += dt;
      const progress = p.age / p.maxAge;
      if (progress >= 1) {
        p.mesh.visible = false;
        continue;
      }

      // Integrate velocity
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Ground plane collision & radial ground-vortex deflection (y <= 0.18m)
      if (p.mesh.position.y <= 0.18 && p.vy < 0) {
        p.mesh.position.y = 0.18;
        const impactSpeed = Math.abs(p.vy);
        p.vy = impactSpeed * 0.22 + 0.9; // Upward turbulent curl bounce
        const radialAngle = Math.atan2(p.vz, p.vx) + (Math.random() - 0.5) * 0.6;
        const vortexBurst = impactSpeed * 0.68;
        p.vx += Math.cos(radialAngle) * vortexBurst;
        p.vz += Math.sin(radialAngle) * vortexBurst;
      }

      // 90-Degree Vertical Concrete Wall collision & deflection (x >= 11.2m)
      if (p.mesh.position.x >= 11.2 && p.vx > 0) {
        p.mesh.position.x = 11.2;
        p.vx = -Math.abs(p.vx) * 0.35;
        p.vy += (Math.random() - 0.3) * 3.5;
      }

      // Aerodynamic drag & thermal buoyancy
      const drag = Math.max(0.82, 1 - 2.6 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + 1.8 * dt; // Buoyancy lift as plume expands

      const scale = p.baseScale * (1 + progress * 2.75);
      p.mesh.scale.set(scale, scale * 0.82, scale);
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.rotation.z += dt * 1.2;

      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      if (p.kind === 'white-smoke') {
        mat.opacity = Math.max(0, (1 - progress * progress) * 0.72);
      } else {
        // Starship Fire Thruster thermal cooling curve: White -> Yellow -> Orange -> Red -> Smoke
        if (progress < 0.22) {
          mat.color.setHex(0xfef08a);
          mat.emissive.setHex(0xfacc15);
          mat.emissiveIntensity = 1.1;
        } else if (progress < 0.52) {
          mat.color.setHex(0xf97316);
          mat.emissive.setHex(0xea580c);
          mat.emissiveIntensity = 0.85;
        } else if (progress < 0.78) {
          mat.color.setHex(0xdc2626);
          mat.emissive.setHex(0x991b1b);
          mat.emissiveIntensity = 0.5;
        } else {
          mat.color.setHex(0xd4d4d4);
          mat.emissive.setHex(0x404040);
          mat.emissiveIntensity = 0.2;
        }
        mat.opacity = Math.max(0, (1 - progress) * 0.88);
      }
    }
  }

  public getActiveParticleStats(): {
    activeWhiteSmokeCount: number;
    activeFirePlumeCount: number;
  } {
    let activeWhiteSmokeCount = 0;
    let activeFirePlumeCount = 0;
    for (const p of this.particles) {
      if (p.age < p.maxAge && p.mesh.visible) {
        if (p.kind === 'white-smoke') {
          activeWhiteSmokeCount++;
        } else {
          activeFirePlumeCount++;
        }
      }
    }
    return { activeWhiteSmokeCount, activeFirePlumeCount };
  }
}
