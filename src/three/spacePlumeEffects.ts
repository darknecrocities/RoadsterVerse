import * as THREE from 'three';
import { createCanvas } from './proceduralTextures.ts';

/**
 * Procedural Space & Hot-Staging Visual FX System:
 * 1. Supersonic Staging Vapor Ring: Radial condensation shockwave triggered at stage separation.
 * 2. Raptor Engine Afterburn Flame & Thermal Afterglow: Decaying combustion plume and
 *    cooling incandescent nozzle bell throat.
 * 3. Vacuum Cold-Gas RCS Plumes: Rapid radial expansion in near-zero ambient pressure.
 */
export class SpacePlumeAndStagingFX {
  public readonly group = new THREE.Group();

  // 1. Supersonic Staging Condensation Shockwave Ring
  private readonly stagingRing: THREE.Mesh;
  private stagingRingAge = 999;
  private stagingRingMaxAge = 0.85;

  // 2. Engine Afterburn Plume & Thermal Bell Throat
  private readonly afterburnPlume: THREE.Mesh;
  private readonly nozzleGlowLight: THREE.PointLight;
  private afterburnIntensity = 0;

  // 3. Vacuum Cold-Gas RCS Expansion Rings
  private readonly vacuumRcsPool: THREE.Mesh[] = [];
  private rcsPoolIdx = 0;

  constructor() {
    // 1. Staging Condensation Ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.stagingRing = new THREE.Mesh(ringGeo, ringMat);
    this.stagingRing.visible = false;
    this.group.add(this.stagingRing);

    // 2. Engine Afterburn Plume (decays when MECO occurs)
    const plumeGeo = new THREE.ConeGeometry(0.72, 3.2, 24, 1, true);
    plumeGeo.translate(0, -1.6, 0);

    const canvas = createCanvas(32, 128);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(220, 220, 220, 0.85)');
      grad.addColorStop(0.65, 'rgba(140, 140, 140, 0.45)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 128);
    }
    const plumeTex = new THREE.CanvasTexture(canvas);
    const plumeMat = new THREE.MeshBasicMaterial({
      map: plumeTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.afterburnPlume = new THREE.Mesh(plumeGeo, plumeMat);
    this.afterburnPlume.visible = false;
    this.group.add(this.afterburnPlume);

    // Incandescent Nozzle Throat Point Light
    this.nozzleGlowLight = new THREE.PointLight(0xffffff, 0, 12);
    this.group.add(this.nozzleGlowLight);

    // 3. Vacuum RCS Expansion Puff Pool
    const puffGeo = new THREE.RingGeometry(0.1, 0.45, 16);
    puffGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const puffMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const puffMesh = new THREE.Mesh(puffGeo, puffMat);
      puffMesh.visible = false;
      this.vacuumRcsPool.push(puffMesh);
      this.group.add(puffMesh);
    }
  }

  public triggerStagingVaporRing(pos: { x: number; y: number; z: number }): void {
    this.stagingRing.position.set(pos.x, pos.y, pos.z);
    this.stagingRing.scale.set(1, 1, 1);
    this.stagingRing.visible = true;
    this.stagingRingAge = 0;
  }

  public update(
    dt: number,
    stateY: number,
    isStaged: boolean,
    throttle: number,
    shipPos: { x: number; y: number; z: number },
    timeSec: number
  ): void {
    // 1. Update Staging Condensation Shockwave Ring
    if (this.stagingRingAge < this.stagingRingMaxAge) {
      this.stagingRingAge += dt;
      const progress = this.stagingRingAge / this.stagingRingMaxAge;
      const scale = 1.0 + progress * 8.5; // Expands outward radially
      this.stagingRing.scale.set(scale, 1, scale);
      const ringMat = this.stagingRing.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, (1 - progress) * 0.82);
    } else {
      this.stagingRing.visible = false;
    }

    // 2. Engine Afterburn & Thermal Nozzle Afterglow
    // During active thrust, intensity tracks throttle; on MECO cutoff, intensity decays exponentially
    if (isStaged && throttle > 0.05) {
      this.afterburnIntensity = Math.min(1.0, throttle);
    } else {
      this.afterburnIntensity = Math.max(0, this.afterburnIntensity - dt * 1.45);
    }

    const flicker = 0.92 + 0.16 * Math.sin(timeSec * 85);
    if (this.afterburnIntensity > 0.02) {
      this.afterburnPlume.visible = true;
      this.afterburnPlume.position.set(shipPos.x, shipPos.y - 0.2, shipPos.z);
      const plumeMat = this.afterburnPlume.material as THREE.MeshBasicMaterial;
      const curve = Math.pow(this.afterburnIntensity, 1.2);
      plumeMat.opacity = Math.min(0.95, curve * 0.9 * flicker);
      this.afterburnPlume.scale.set(
        0.55 + this.afterburnIntensity * 0.45,
        (0.4 + this.afterburnIntensity * 0.7) * flicker,
        0.55 + this.afterburnIntensity * 0.45
      );
      this.nozzleGlowLight.position.set(shipPos.x, shipPos.y - 0.1, shipPos.z);
      this.nozzleGlowLight.intensity = this.afterburnIntensity * 4.5 * flicker;
    } else {
      this.afterburnPlume.visible = false;
      this.nozzleGlowLight.intensity = 0;
    }
  }

  public spawnVacuumRcsPuff(pos: { x: number; y: number; z: number }, intensity: number): void {
    if (intensity < 0.05) return;
    const mesh = this.vacuumRcsPool[this.rcsPoolIdx];
    this.rcsPoolIdx = (this.rcsPoolIdx + 1) % this.vacuumRcsPool.length;
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.scale.set(0.6, 1, 0.6);
    (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.75, intensity * 0.8);
    mesh.visible = true;
  }
}

export interface BoosterSeparationTrajectory {
  boosterWorldY: number;
  boosterPitch: number;
  boosterRoll: number;
  plumeOpacity: number;
  isVisible: boolean;
}

/**
 * Computes Newtonian gravity drop and aerodynamic tumble for the Super Heavy Booster
 * falling away after hot-staging separation in mid-air.
 */
export function computeBoosterSeparationPhysics(
  stagingAltitude: number,
  elapsedTimeSec: number,
  stagingTimeSec = 9.5
): BoosterSeparationTrajectory {
  if (elapsedTimeSec < stagingTimeSec) {
    return {
      boosterWorldY: stagingAltitude,
      boosterPitch: 0,
      boosterRoll: 0,
      plumeOpacity: 1.0,
      isVisible: true,
    };
  }

  const tSep = elapsedTimeSec - stagingTimeSec;
  // Separation impulse pushes booster downward relative to staging altitude
  // Gravity acceleration pulls booster down: a_y = -9.81 m/s^2
  const separationVelocity = 3.5;
  const gravityDrop = separationVelocity * tSep + 0.5 * 9.81 * tSep * tSep;
  const boosterWorldY = stagingAltitude - gravityDrop;

  // Gentle aerodynamic tumble pitch and roll away from the stack
  const boosterPitch = -Math.min(1.4, tSep * 0.32);
  const boosterRoll = Math.sin(tSep * 0.9) * 0.12;

  // Booster engine flame cuts off over 0.65s
  const plumeOpacity = Math.max(0, 1.0 - tSep * 1.55);
  const isVisible = boosterWorldY > -15.0;

  return {
    boosterWorldY,
    boosterPitch,
    boosterRoll,
    plumeOpacity,
    isVisible,
  };
}

export function buildSpaceEnvironment(): THREE.Group {
  const group = new THREE.Group();
  const starCount = 380;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * 2.0 * Math.PI;
    const r = 160 + Math.random() * 90;
    starPositions[i * 3] = r * Math.cos(theta);
    starPositions[i * 3 + 1] = -20 + Math.random() * 260; // Spans entire vertical flight corridor
    starPositions[i * 3 + 2] = r * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.85 });
  group.add(new THREE.Points(starGeo, starMat));

  const earthGeo = new THREE.SphereGeometry(180, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.75, metalness: 0.1 });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.position.set(0, -188, 0);
  earthMesh.rotation.x = Math.PI;

  const atmosphereRingGeo = new THREE.TorusGeometry(180, 1.2, 16, 80);
  const atmosphereRingMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.35 });
  const ringMesh = new THREE.Mesh(atmosphereRingGeo, atmosphereRingMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0, -8, 0);

  group.add(earthMesh, ringMesh);
  return group;
}


