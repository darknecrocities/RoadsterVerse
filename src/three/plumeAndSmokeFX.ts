import * as THREE from 'three';
import type { RigidBodyState, ThrusterActivation, VehicleId } from '../types/simulation.ts';
import type { NozzleEmitterDescriptor } from './roadsterModel.ts';
import { createVolumetricSmokeCloudTexture } from './proceduralTextures.ts';

interface PlumeParticle {
  sprite: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  spinRate: number;
  age: number;
  maxAge: number;
  baseScale: number;
  expansionRate: number;
  kind: 'white-smoke' | 'fire-plume' | 'explosion';
}

interface DebrisShard {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  age: number;
  maxAge: number;
}

/**
 * Physics-based Volumetric Smoke, Raptor Combustion Plume, and Crash Explosion System:
 * 1) Mid-Air Only Roadster Cold-Gas Smoke: Multi-layered soft volumetric vapor clouds
 *    using camera-facing FBM cloud sprites with vortex curl, drag deceleration, and expansion.
 * 2) Starship Raptor Combustion Plume: Thermal cooling gradient + flame trench deflection.
 * 3) Crash Explosion & Disintegration: Triggers when the vehicle crashes or lands upside-down
 *    or sideways, unleashing a shockwave ring, flash light, fireball-to-soot cloud burst,
 *    and 16 physical flying debris shards & detached spinning wheels.
 */
export class VolumetricPlumeSmokeSystem {
  public readonly group = new THREE.Group();
  private readonly particles: PlumeParticle[] = [];
  private readonly debrisShards: DebrisShard[] = [];
  private readonly shockwaveRing: THREE.Mesh;
  private readonly explosionLight: THREE.PointLight;
  private spawnAccumulator = 0;
  private wasCrashed = false;
  private shockwaveAge = 999;
  private engineVaporTimer = 0;

  constructor(poolSize = 260) {
    const cloudTexture = createVolumetricSmokeCloudTexture();

    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);

      this.particles.push({
        sprite,
        vx: 0,
        vy: 0,
        vz: 0,
        spinRate: (i % 2 === 0 ? 1 : -1) * (1.2 + (i % 5) * 0.4),
        age: 999,
        maxAge: 1.5,
        baseScale: 0.65,
        expansionRate: 3.4,
        kind: 'white-smoke',
      });
    }

    // Supersonic ground shockwave ring triggered on crash explosion
    const ringGeo = new THREE.RingGeometry(0.45, 0.95, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.visible = false;
    this.group.add(this.shockwaveRing);

    this.explosionLight = new THREE.PointLight(0xffffff, 0, 26);
    this.group.add(this.explosionLight);

    // 16 physical flying mechanical debris shards + 4 detached wheels on crash explosion
    const panelGeo = new THREE.BoxGeometry(0.42, 0.08, 0.28);
    const wheelDebrisGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
    wheelDebrisGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const isWheel = i < 4;
      const mat = new THREE.MeshStandardMaterial({
        color: isWheel ? 0x171717 : i % 2 === 0 ? 0xe5e5e5 : 0x262626,
        roughness: 0.45,
        metalness: 0.65,
      });
      const mesh = new THREE.Mesh(isWheel ? wheelDebrisGeo : panelGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.debrisShards.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        age: 999,
        maxAge: 1.8,
      });
    }
  }

  private recycleIdx = 0;

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    baseScale: number,
    maxAge: number,
    kind: 'white-smoke' | 'fire-plume' | 'explosion',
    expansionRate = 3.5
  ): void {
    const slot =
      this.particles.find((p) => p.age >= p.maxAge) ??
      (kind === 'explosion'
        ? this.particles[this.recycleIdx++ % this.particles.length]
        : undefined);
    if (!slot) return;

    slot.sprite.position.set(x, y, z);
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.age = 0;
    slot.maxAge = maxAge;
    slot.baseScale = baseScale;
    slot.expansionRate = expansionRate;
    slot.kind = kind;
    slot.sprite.visible = true;
    slot.sprite.scale.set(baseScale, baseScale, baseScale);

    const mat = slot.sprite.material;
    mat.rotation = Math.random() * Math.PI * 2;
    if (kind === 'white-smoke') {
      mat.color.setHex(0xfafafa);
      mat.opacity = 0.86;
    } else if (kind === 'explosion') {
      mat.color.setHex(0xffffff);
      mat.opacity = 0.98;
    } else {
      mat.color.setHex(0xfffbeb);
      mat.opacity = 0.94;
    }
  }

  private triggerCrashExplosion(pos: { x: number; y: number; z: number }): void {
    this.shockwaveAge = 0;
    this.shockwaveRing.position.set(pos.x, Math.max(0.08, pos.y - 0.25), pos.z);
    this.shockwaveRing.scale.set(1, 1, 1);
    this.shockwaveRing.visible = true;
    this.explosionLight.position.set(pos.x, pos.y + 1.2, pos.z);
    this.explosionLight.intensity = 22.0;

    // Burst 72 high-velocity fireball & billowing explosion smoke clouds
    for (let i = 0; i < 72; i++) {
      const az = (i / 72) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const elev = Math.random() * Math.PI * 0.48;
      const speed = 4.5 + Math.random() * 14.5;
      const vx = Math.cos(az) * Math.cos(elev) * speed;
      const vy = Math.sin(elev) * speed + 2.8;
      const vz = Math.sin(az) * Math.cos(elev) * speed;

      this.spawnParticle(
        pos.x + (Math.random() - 0.5) * 0.9,
        Math.max(0.22, pos.y + (Math.random() - 0.2) * 0.6),
        pos.z + (Math.random() - 0.5) * 0.9,
        vx,
        vy,
        vz,
        0.95 + Math.random() * 0.85,
        0.95 + Math.random() * 0.85,
        'explosion',
        4.4
      );
    }

    // Launch 16 physical flying debris shards & detached wheels
    for (let i = 0; i < this.debrisShards.length; i++) {
      const shard = this.debrisShards[i];
      const angle = (i / this.debrisShards.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const outSpeed = 4.2 + Math.random() * 7.5;
      shard.mesh.position.set(
        pos.x + Math.cos(angle) * 0.6,
        Math.max(0.28, pos.y + 0.25),
        pos.z + Math.sin(angle) * 0.6
      );
      shard.vx = Math.cos(angle) * outSpeed;
      shard.vy = 5.5 + Math.random() * 6.8;
      shard.vz = Math.sin(angle) * outSpeed;
      shard.rx = (Math.random() - 0.5) * 14;
      shard.ry = (Math.random() - 0.5) * 14;
      shard.rz = (Math.random() - 0.5) * 14;
      shard.age = 0;
      shard.maxAge = 1.75;
      shard.mesh.visible = true;
    }
  }

  public update(
    dt: number,
    vehicle: VehicleId,
    state: RigidBodyState,
    thrusters: ThrusterActivation,
    roadsterNozzles: NozzleEmitterDescriptor[] = []
  ): void {
    // Detect transition into crashed state (e.g., landing upside-down or sideways) and detonate!
    if (state.crashed && !this.wasCrashed) {
      this.wasCrashed = true;
      this.triggerCrashExplosion(state.position);
    } else if (!state.crashed && this.wasCrashed) {
      this.wasCrashed = false;
      this.shockwaveRing.visible = false;
      this.explosionLight.intensity = 0;
      for (const s of this.debrisShards) { s.mesh.visible = false; s.age = 999; }
    }

    this.spawnAccumulator += dt;

    if (this.spawnAccumulator >= 0.016) {
      this.spawnAccumulator = 0;

      if (state.crashed) {
        // Continuous secondary rising black/white wreck smoke from the exploded vehicle
        for (let k = 0; k < 3; k++) {
          this.spawnParticle(
            state.position.x + (Math.random() - 0.5) * 1.4,
            Math.max(0.25, state.position.y + 0.2),
            state.position.z + (Math.random() - 0.5) * 1.1,
            (Math.random() - 0.5) * 2.4,
            3.2 + Math.random() * 3.8,
            (Math.random() - 0.5) * 2.4,
            0.85 + Math.random() * 0.55,
            0.95 + Math.random() * 0.55,
            'explosion',
            3.6
          );
        }
      } else if (vehicle === 'roadster') {
        // Roadster cold-gas smoke ONLY triggers when nozzles are active in mid-air!
        const euler = new THREE.Euler(state.attitude.roll, state.attitude.yaw, state.attitude.pitch, 'XYZ');

        for (const nozzle of roadsterNozzles) {
          if (nozzle.intensity <= 0.05) continue;

          const worldPos = nozzle.localOffset.clone().applyEuler(euler);
          worldPos.x += state.position.x;
          worldPos.y += state.position.y;
          worldPos.z += state.position.z;

          const worldDir = nozzle.localDirection.clone().applyEuler(euler).normalize();
          const jetSpeed = 10.5 + nozzle.intensity * 12.5;

          // Layer 1: Dense supersonic cryo-nitrogen jet core puff
          this.spawnParticle(
            worldPos.x + (Math.random() - 0.5) * 0.1,
            Math.max(0.16, worldPos.y),
            worldPos.z + (Math.random() - 0.5) * 0.1,
            state.velocity.x * 0.3 + worldDir.x * jetSpeed + (Math.random() - 0.5) * 1.8,
            worldDir.y * jetSpeed + (Math.random() - 0.5) * 1.2,
            worldDir.z * jetSpeed + (Math.random() - 0.5) * 1.8,
            0.46 + nozzle.intensity * 0.42,
            0.65 + Math.random() * 0.35,
            'white-smoke',
            3.8
          );

          // Layer 2: Wide billowing turbulent shear-layer vapor cloud
          if (nozzle.intensity > 0.22) {
            this.spawnParticle(
              worldPos.x + worldDir.x * 0.28 + (Math.random() - 0.5) * 0.24,
              Math.max(0.18, worldPos.y + worldDir.y * 0.28),
              worldPos.z + worldDir.z * 0.28 + (Math.random() - 0.5) * 0.24,
              state.velocity.x * 0.2 + worldDir.x * (jetSpeed * 0.55) + (Math.random() - 0.5) * 3.2,
              worldDir.y * (jetSpeed * 0.55) + (Math.random() - 0.5) * 2.4,
              worldDir.z * (jetSpeed * 0.55) + (Math.random() - 0.5) * 3.2,
              0.68 + nozzle.intensity * 0.58,
              0.85 + Math.random() * 0.45,
              'white-smoke',
              4.3
            );
          }
        }
      } else if (thrusters.raptorThrottle > 0.06) {
        // Starship Physics-Based Fire Thruster Plume
        this.engineVaporTimer = 1.8;
        const isFullStack = !thrusters.hotStageSeparated && state.position.y < 17.5;
        const engineBellOffsetY = isFullStack ? 0.0 : -0.1;
        const euler = new THREE.Euler(state.attitude.roll, state.attitude.yaw, state.attitude.pitch, 'XYZ');
        const nozzleWorld = new THREE.Vector3(0, engineBellOffsetY, 0).applyEuler(euler);
        nozzleWorld.x += state.position.x;
        nozzleWorld.y += state.position.y;
        nozzleWorld.z += state.position.z;

        const jetDir = new THREE.Vector3(Math.sin(thrusters.gimbalPitch * 0.25), -1, Math.sin(thrusters.gimbalYaw * 0.25)).applyEuler(euler).normalize();
        const fireJetSpeed = 14.0 + thrusters.raptorThrottle * 16.0;

        for (let k = 0; k < 4; k++) {
          this.spawnParticle(
            nozzleWorld.x + (Math.random() - 0.5) * 0.65,
            Math.max(0.2, nozzleWorld.y),
            nozzleWorld.z + (Math.random() - 0.5) * 0.65,
            jetDir.x * fireJetSpeed + (Math.random() - 0.5) * 3.8,
            jetDir.y * fireJetSpeed + (Math.random() - 0.5) * 2.4,
            jetDir.z * fireJetSpeed + (Math.random() - 0.5) * 3.8,
            0.72 + thrusters.raptorThrottle * 0.75,
            0.7 + Math.random() * 0.4,
            'fire-plume',
            3.5
          );
        }
      } else if (this.engineVaporTimer > 0) {
        // Lingering cooling vapor and heat smoke wafting after Raptor cutoff
        this.engineVaporTimer -= dt;
        const euler = new THREE.Euler(state.attitude.roll, state.attitude.yaw, state.attitude.pitch, 'XYZ');
        const nozzleWorld = new THREE.Vector3(0, -0.1, 0).applyEuler(euler);
        nozzleWorld.x += state.position.x;
        nozzleWorld.y += state.position.y;
        nozzleWorld.z += state.position.z;
        const vaporScale = Math.min(1.0, this.engineVaporTimer / 1.8);

        for (let k = 0; k < 2; k++) {
          this.spawnParticle(
            nozzleWorld.x + (Math.random() - 0.5) * 0.5,
            Math.max(0.2, nozzleWorld.y),
            nozzleWorld.z + (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 1.2,
            0.75 + Math.random() * 1.4,
            (Math.random() - 0.5) * 1.2,
            0.52 + vaporScale * 0.42,
            1.2 + Math.random() * 0.6,
            'white-smoke',
            3.0
          );
        }
      }
    }

    // Update supersonic crash shockwave ring & flash light
    if (this.shockwaveAge < 0.85) {
      this.shockwaveAge += dt;
      const p = this.shockwaveAge / 0.85;
      const radiusScale = 1 + p * 14.5;
      this.shockwaveRing.scale.set(radiusScale, radiusScale, 1);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.85);
      this.explosionLight.intensity = Math.max(0, (1 - p * 1.4) * 22.0);
    } else if (this.shockwaveRing.visible) {
      this.shockwaveRing.visible = false;
      this.explosionLight.intensity = 0;
    }

    // Step 6-DoF rigid-body gravity & road bounce for flying explosion debris shards
    for (const shard of this.debrisShards) {
      if (shard.age >= shard.maxAge) continue;
      shard.age += dt;
      if (shard.age >= shard.maxAge) {
        shard.mesh.visible = false;
        continue;
      }
      shard.vy -= 9.81 * dt;
      shard.mesh.position.x += shard.vx * dt;
      shard.mesh.position.y += shard.vy * dt;
      shard.mesh.position.z += shard.vz * dt;
      if (shard.mesh.position.y <= 0.16 && shard.vy < 0) {
        shard.mesh.position.y = 0.16;
        shard.vy = -shard.vy * 0.42;
        shard.vx *= 0.72;
        shard.vz *= 0.72;
      }
      shard.mesh.rotation.x += shard.rx * dt;
      shard.mesh.rotation.y += shard.ry * dt;
      shard.mesh.rotation.z += shard.rz * dt;
    }

    // Step Volumetric Cloud Sprites
    for (const p of this.particles) {
      if (p.age >= p.maxAge) continue;
      p.age += dt;
      const progress = p.age / p.maxAge;
      if (progress >= 1) {
        p.sprite.visible = false;
        continue;
      }

      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;

      if (p.sprite.position.y <= 0.2 && p.vy < 0) {
        p.sprite.position.y = 0.2;
        const impactSpeed = Math.abs(p.vy);
        p.vy = impactSpeed * 0.24 + 0.95;
        const radialAngle = Math.atan2(p.vz, p.vx) + (Math.random() - 0.5) * 0.65;
        const vortexBurst = impactSpeed * 0.72;
        p.vx += Math.cos(radialAngle) * vortexBurst;
        p.vz += Math.sin(radialAngle) * vortexBurst;
      }

      const drag = Math.max(0.8, 1 - 2.8 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + (p.kind === 'explosion' ? 3.2 : 1.9) * dt;

      const scale = p.baseScale * (1 + progress * p.expansionRate);
      p.sprite.scale.set(scale, scale, scale);

      const mat = p.sprite.material;
      mat.rotation += p.spinRate * dt * (1 - progress * 0.5);

      if (p.kind === 'white-smoke') {
        const smoothFade = (1 - progress) * (1 - progress * 0.65);
        mat.color.setHex(progress < 0.35 ? 0xffffff : 0xe5e5e5);
        mat.opacity = Math.max(0, smoothFade * 0.78);
      } else if (p.kind === 'explosion') {
        if (progress < 0.16) {
          mat.color.setHex(0xffffff);
        } else if (progress < 0.34) {
          mat.color.setHex(0xfef08a);
        } else if (progress < 0.56) {
          mat.color.setHex(0xf97316);
        } else if (progress < 0.76) {
          mat.color.setHex(0x525252);
        } else {
          mat.color.setHex(0x262626);
        }
        mat.opacity = Math.max(0, (1 - progress * progress) * 0.92);
      } else {
        if (progress < 0.22) {
          mat.color.setHex(0xfef08a);
        } else if (progress < 0.52) {
          mat.color.setHex(0xf97316);
        } else if (progress < 0.78) {
          mat.color.setHex(0xdc2626);
        } else {
          mat.color.setHex(0xd4d4d4);
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
      if (p.age < p.maxAge && p.sprite.visible) {
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
