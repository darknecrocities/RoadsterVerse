import * as THREE from 'three';
import type { RigidBodyState, ThrusterActivation, VehicleId } from '../types/simulation.ts';

interface SmokeParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  baseScale: number;
}

export class VolumetricPlumeSmokeSystem {
  public readonly group = new THREE.Group();
  private readonly particles: SmokeParticle[] = [];
  private spawnAccumulator = 0;

  constructor(poolSize = 110) {
    const geo = new THREE.DodecahedronGeometry(0.48, 1);

    for (let i = 0; i < poolSize; i++) {
      const isWarmTinted = i % 3 === 0;
      const mat = new THREE.MeshStandardMaterial({
        color: isWarmTinted ? 0xfda4af : 0xe2e8f0,
        emissive: isWarmTinted ? 0x881337 : 0x0c4a6e,
        emissiveIntensity: 0.38,
        roughness: 0.9,
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
        baseScale: 0.65,
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
    tintHex: number,
    emissiveHex: number
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
    slot.mesh.visible = true;

    const mat = slot.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(tintHex);
    mat.emissive.setHex(emissiveHex);
    mat.opacity = 0.72;
  }

  public update(
    dt: number,
    vehicle: VehicleId,
    state: RigidBodyState,
    thrusters: ThrusterActivation
  ): void {
    this.spawnAccumulator += dt;

    if (this.spawnAccumulator >= 0.025 && !state.crashed) {
      this.spawnAccumulator = 0;

      if (vehicle === 'roadster') {
        const liftIntensity =
          (thrusters.frontLeftLift +
            thrusters.frontRightLift +
            thrusters.rearLeftLift +
            thrusters.rearRightLift) /
          4;

        // Ground-effect billowing smoke cloud under hovering Roadster (Images 2 & 3)
        if (liftIntensity > 0.08 && state.position.y < 8.5) {
          for (let k = 0; k < 3; k++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (2.2 + Math.random() * 4.5) * liftIntensity;
            const isPinkLit = Math.random() < 0.42;
            this.spawnParticle(
              state.position.x + (Math.random() - 0.5) * 1.8,
              Math.max(0.18, state.position.y - 1.9),
              state.position.z + (Math.random() - 0.5) * 1.4,
              Math.cos(angle) * speed,
              0.4 + Math.random() * 1.2,
              Math.sin(angle) * speed,
              0.7 + liftIntensity * 0.9,
              1.1 + Math.random() * 0.5,
              isPinkLit ? 0xfecdd3 : 0xf1f5f9,
              isPinkLit ? 0x9f1239 : 0x0369a1
            );
          }
        }

        // Lateral side cold-gas jet trail (Image 3 horizontal plume!)
        if (thrusters.lateralRight > 0.12 || thrusters.lateralLeft > 0.12) {
          const dir = thrusters.lateralRight > thrusters.lateralLeft ? -1 : 1;
          this.spawnParticle(
            state.position.x - 0.6,
            state.position.y + 0.3,
            state.position.z + dir * 1.1,
            -4.5 + (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.2,
            dir * (4.0 + Math.random() * 2.5),
            0.48,
            0.65,
            0xe0f2fe,
            0x0284c7
          );
        }
      } else {
        // Starship cryo-condensation hull vapor & Raptor exhaust cloud (Image 4)
        if (thrusters.raptorThrottle > 0.08) {
          for (let k = 0; k < 3; k++) {
            const angle = Math.random() * Math.PI * 2;
            this.spawnParticle(
              state.position.x + (Math.random() - 0.5) * 0.9,
              Math.max(0.3, state.position.y - 3.2),
              state.position.z + (Math.random() - 0.5) * 0.9,
              Math.cos(angle) * 2.8,
              -3.5 - Math.random() * 2.5,
              Math.sin(angle) * 2.8,
              0.85 + thrusters.raptorThrottle * 0.8,
              0.95,
              0xfbcfe8,
              0xdb2777
            );
          }
        }
      }
    }

    // Integrate active particles
    for (const p of this.particles) {
      if (p.age >= p.maxAge) continue;
      p.age += dt;
      const progress = p.age / p.maxAge;
      if (progress >= 1) {
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vx *= 0.96;
      p.vz *= 0.96;

      const scale = p.baseScale * (1 + progress * 2.4);
      p.mesh.scale.set(scale, scale * 0.78, scale);
      p.mesh.rotation.y += dt * 1.2;

      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, (1 - progress) * 0.62);
    }
  }
}
