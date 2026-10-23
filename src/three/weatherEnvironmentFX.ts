import * as THREE from 'three';
import type { WeatherState } from '../types/simulation.ts';

/**
 * 3D Atmospheric Weather & Environmental Visual Effects:
 * 1) Instanced wind-deflected rain streaks (800 particles).
 * 2) Dynamic storm lightning illumination.
 * 3) Wet asphalt specular puddle reflections & car chassis slickness.
 * 4) High-speed wet tire water spray & rooster tails.
 * 5) Volumetric atmospheric fog adaptation.
 */
export class WeatherEnvironmentFX {
  public readonly group = new THREE.Group();
  private readonly rainGeometry: THREE.BufferGeometry;
  private readonly rainMaterial: THREE.LineBasicMaterial;
  private readonly rainLines: THREE.LineSegments;
  private readonly lightningLight: THREE.PointLight;
  private readonly rainPositions: Float32Array;
  private readonly count = 800;
  private readonly rainSpan = 45;

  // Wet tire water spray mist particles
  private readonly sprayGeometry: THREE.BufferGeometry;
  private readonly sprayMaterial: THREE.PointsMaterial;
  private readonly sprayPoints: THREE.Points;
  private readonly sprayPositions: Float32Array;
  private readonly sprayVelocities: Float32Array;
  private readonly sprayCount = 120;

  constructor() {
    this.rainPositions = new Float32Array(this.count * 6);
    for (let i = 0; i < this.count; i++) {
      const idx = i * 6;
      const x = (Math.random() - 0.5) * this.rainSpan;
      const y = Math.random() * 24.0;
      const z = (Math.random() - 0.5) * this.rainSpan;

      this.rainPositions[idx] = x;
      this.rainPositions[idx + 1] = y;
      this.rainPositions[idx + 2] = z;
      this.rainPositions[idx + 3] = x;
      this.rainPositions[idx + 4] = y - 0.75;
      this.rainPositions[idx + 5] = z;
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.rainPositions, 3)
    );

    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    this.group.add(this.rainLines);

    this.lightningLight = new THREE.PointLight(0xdbeafe, 0, 80);
    this.lightningLight.position.set(0, 35, 0);
    this.group.add(this.lightningLight);

    // Wet tire water spray emitter
    this.sprayPositions = new Float32Array(this.sprayCount * 3);
    this.sprayVelocities = new Float32Array(this.sprayCount * 3);
    for (let i = 0; i < this.sprayCount; i++) {
      this.sprayPositions[i * 3 + 1] = -100; // start hidden
    }
    this.sprayGeometry = new THREE.BufferGeometry();
    this.sprayGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.sprayPositions, 3)
    );
    this.sprayMaterial = new THREE.PointsMaterial({
      color: 0xd1d5db,
      size: 0.28,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(this.sprayGeometry, this.sprayMaterial);
    this.group.add(this.sprayPoints);
  }

  /**
   * Dynamically modulates material roughness & metalness to reflect wet puddles,
   * specular asphalt sheen, and chassis slickness.
   */
  public updateMaterialWetness(materials: THREE.Material[], roadWetnessPct: number): void {
    const wetRatio = Math.max(0, Math.min(1.0, roadWetnessPct / 100));
    for (const mat of materials) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        if (!mat.userData.dryRoughness) {
          mat.userData.dryRoughness = mat.roughness;
          mat.userData.dryMetalness = mat.metalness;
        }
        mat.roughness = THREE.MathUtils.lerp(mat.userData.dryRoughness, 0.08, wetRatio);
        mat.metalness = THREE.MathUtils.lerp(mat.userData.dryMetalness, 0.65, wetRatio);
      }
    }
  }

  public update(
    dt: number,
    weather: WeatherState,
    cameraPos: THREE.Vector3,
    sceneFog: THREE.Fog | THREE.FogExp2 | null,
    carPos?: THREE.Vector3,
    carSpeedMs?: number,
    isGrounded?: boolean
  ): void {
    const isRaining = weather.rainIntensityPct > 5;
    this.rainLines.visible = isRaining;

    if (isRaining) {
      const targetOpacity = Math.min(0.65, (weather.rainIntensityPct / 100) * 0.75);
      this.rainMaterial.opacity += (targetOpacity - this.rainMaterial.opacity) * Math.min(1, dt * 5);

      const fallSpeed = 28.0 + weather.rainIntensityPct * 0.12;
      const windX = weather.windVector.x * 0.18;
      const windZ = weather.windVector.z * 0.18;
      const streakLen = 0.65 + (weather.windSpeedMs / 30) * 0.45;

      const pos = this.rainPositions;
      for (let i = 0; i < this.count; i++) {
        const idx = i * 6;
        pos[idx + 1] -= fallSpeed * dt;
        pos[idx] += windX * dt;
        pos[idx + 2] += windZ * dt;

        // Reset if hitting ground
        if (pos[idx + 1] <= 0.05) {
          pos[idx] = cameraPos.x + (Math.random() - 0.5) * this.rainSpan;
          pos[idx + 1] = 22.0 + Math.random() * 4.0;
          pos[idx + 2] = cameraPos.z + (Math.random() - 0.5) * this.rainSpan;
        }

        // Tail of streak deflected by wind:
        pos[idx + 3] = pos[idx] - windX * 0.04;
        pos[idx + 4] = pos[idx + 1] + streakLen;
        pos[idx + 5] = pos[idx + 2] - windZ * 0.04;
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }

    // Dynamic wet tire water spray mist behind wheels at speed
    const shouldSpray =
      Boolean(carPos) &&
      Boolean(isGrounded) &&
      (carSpeedMs ?? 0) > 6.0 &&
      weather.roadWetnessPct > 20;

    this.sprayPoints.visible = shouldSpray;
    if (shouldSpray && carPos) {
      const sprayTargetOpacity = Math.min(
        0.55,
        (weather.roadWetnessPct / 100) * Math.min(1.0, (carSpeedMs ?? 0) / 25.0) * 0.65
      );
      this.sprayMaterial.opacity +=
        (sprayTargetOpacity - this.sprayMaterial.opacity) * Math.min(1, dt * 8);

      const sprayPos = this.sprayPositions;
      const sprayVel = this.sprayVelocities;
      for (let i = 0; i < this.sprayCount; i++) {
        const idx = i * 3;
        sprayPos[idx] += sprayVel[idx] * dt;
        sprayPos[idx + 1] += sprayVel[idx + 1] * dt;
        sprayPos[idx + 2] += sprayVel[idx + 2] * dt;
        sprayVel[idx + 1] -= 5.0 * dt; // gravity settling

        if (sprayPos[idx + 1] <= 0.02 || sprayPos[idx + 1] > 2.5) {
          // Spawn behind car rear axle
          sprayPos[idx] = carPos.x - 0.85 + (Math.random() - 0.5) * 0.35;
          sprayPos[idx + 1] = 0.06 + Math.random() * 0.12;
          sprayPos[idx + 2] = carPos.z + (Math.random() > 0.5 ? 0.42 : -0.42) + (Math.random() - 0.5) * 0.15;

          sprayVel[idx] = -(carSpeedMs ?? 15.0) * 0.35 + (Math.random() - 0.5) * 2.0;
          sprayVel[idx + 1] = 1.2 + Math.random() * 2.2;
          sprayVel[idx + 2] = (Math.random() - 0.5) * 1.8 + weather.windVector.z * 0.15;
        }
      }
      this.sprayGeometry.attributes.position.needsUpdate = true;
    } else {
      this.sprayMaterial.opacity = 0;
    }

    // Dynamic lightning flash in storm:
    if (weather.preset === 'storm' && weather.lightningFlashIntensity > 0.05) {
      this.lightningLight.intensity = weather.lightningFlashIntensity * 18.0;
      this.lightningLight.position.set(cameraPos.x + 12, 32, cameraPos.z - 8);
    } else {
      this.lightningLight.intensity = 0;
    }

    // Fog adaptation:
    if (sceneFog && sceneFog instanceof THREE.FogExp2) {
      if (weather.preset === 'fog') {
        sceneFog.density = 0.045;
        sceneFog.color.setHex(0x262626);
      } else if (weather.preset === 'storm') {
        sceneFog.density = 0.022;
        sceneFog.color.setHex(0x0f172a);
      } else if (weather.preset === 'rain') {
        sceneFog.density = 0.016;
        sceneFog.color.setHex(0x1e293b);
      } else if (weather.preset === 'mars-dust') {
        sceneFog.density = 0.025;
        sceneFog.color.setHex(0x451a03);
      } else {
        sceneFog.density = 0.011;
        sceneFog.color.setHex(0x030303);
      }
    }
  }

  public dispose(): void {
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.sprayGeometry.dispose();
    this.sprayMaterial.dispose();
  }
}
