import * as THREE from 'three';
import type { ThrusterActivation } from '../types/simulation.ts';
import { createCanvas, createStarshipHullAndTpsTexture } from './proceduralTextures.ts';

export interface StarshipRig {
  root: THREE.Group;
  shipGroup: THREE.Group;
  boosterGroup: THREE.Group;
  flaps: {
    frontLeft: THREE.Mesh;
    frontRight: THREE.Mesh;
    aftLeft: THREE.Mesh;
    aftRight: THREE.Mesh;
  };
  boosterPlume: THREE.Mesh;
  shipPlume: THREE.Mesh;
  plumeLight: THREE.PointLight;
  updateStarship: (t: ThrusterActivation, isLaunchMission: boolean, timeSec: number) => void;
}

function createRaptorFirePlumeMesh(length: number, radius: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
  geo.translate(0, -length / 2, 0);

  const canvas = createCanvas(64, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.18, 'rgba(254, 240, 138, 0.98)');
    grad.addColorStop(0.45, 'rgba(249, 115, 22, 0.92)');
    grad.addColorStop(0.74, 'rgba(220, 38, 38, 0.72)');
    grad.addColorStop(1.0, 'rgba(127, 29, 29, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geo, mat);
}

/**
 * Builds a high-detail 3D SpaceX Starship & Super Heavy Booster rig with a LatheGeometry
 * parabolic ogive nosecone, hinged flaps, 304L stainless weld rings, and 33 Raptor nozzle bells.
 */
export function createStarshipModel(isGhost = false): StarshipRig {
  const root = new THREE.Group();
  const shipGroup = new THREE.Group();
  const boosterGroup = new THREE.Group();
  root.add(shipGroup, boosterGroup);

  const opacity = isGhost ? 0.22 : 1.0;
  const transparent = isGhost;
  const hullTex = createStarshipHullAndTpsTexture();

  const stainlessMat = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0xa3a3a3 : 0xe5e5e5,
    map: isGhost ? null : hullTex,
    bumpMap: isGhost ? null : hullTex,
    bumpScale: 0.015,
    metalness: 0.86,
    roughness: 0.2,
    clearcoat: 0.5,
    transparent,
    opacity,
  });

  const tpsDarkMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    metalness: 0.22,
    roughness: 0.7,
    transparent,
    opacity,
  });

  const chromeRingMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d4,
    metalness: 0.92,
    roughness: 0.16,
    transparent,
    opacity,
  });

  // 1. Starship Upper Stage Cylindrical Barrel + Parabolic LatheGeometry Ogive Nosecone
  const shipRadius = 0.56;
  const shipBarrelHeight = 2.6;
  const shipBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, shipBarrelHeight, 36),
    stainlessMat
  );
  shipBarrel.position.y = 1.3;
  shipGroup.add(shipBarrel);

  // Parabolic Ogive Nosecone using LatheGeometry
  const ogivePoints: THREE.Vector2[] = [];
  const ogiveHeight = 1.55;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = shipRadius * Math.pow(1 - t, 0.68);
    ogivePoints.push(new THREE.Vector2(Math.max(0.01, r), t * ogiveHeight));
  }
  const ogiveGeo = new THREE.LatheGeometry(ogivePoints, 36);
  const nosecone = new THREE.Mesh(ogiveGeo, stainlessMat);
  nosecone.position.y = 2.6;
  shipGroup.add(nosecone);

  // Stainless circumferential weld rings & external raceway conduit
  for (const ry of [0.35, 1.05, 1.85, 2.58]) {
    const weldRing = new THREE.Mesh(
      new THREE.TorusGeometry(shipRadius + 0.008, 0.012, 8, 36),
      chromeRingMat
    );
    weldRing.rotation.x = Math.PI / 2;
    weldRing.position.y = ry;
    shipGroup.add(weldRing);
  }

  // Catch Pins on the upper hull for the Launch Paddock Chopstick Arms
  for (const zSign of [-1, 1]) {
    const catchPin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.22), chromeRingMat);
    catchPin.position.set(0, 2.25, zSign * (shipRadius + 0.06));
    shipGroup.add(catchPin);
  }

  // 2. 4 Articulated Stainless Aero Flaps with Hinge Fairings
  const fwdFlapGeo = new THREE.BoxGeometry(0.05, 0.85, 0.44);
  const frontLeft = new THREE.Mesh(fwdFlapGeo, tpsDarkMat);
  frontLeft.position.set(0, 3.25, 0.66);
  frontLeft.rotation.x = -0.22;
  const frontRight = new THREE.Mesh(fwdFlapGeo, tpsDarkMat);
  frontRight.position.set(0, 3.25, -0.66);
  frontRight.rotation.x = 0.22;

  const aftFlapGeo = new THREE.BoxGeometry(0.06, 1.18, 0.58);
  const aftLeft = new THREE.Mesh(aftFlapGeo, tpsDarkMat);
  aftLeft.position.set(0, 0.68, 0.74);
  const aftRight = new THREE.Mesh(aftFlapGeo, tpsDarkMat);
  aftRight.position.set(0, 0.68, -0.74);
  shipGroup.add(frontLeft, frontRight, aftLeft, aftRight);

  // 6 Ship Raptor Engine Bells (3 RVac + 3 Center Sea-Level)
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const isVac = i % 2 === 0;
    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(isVac ? 0.14 : 0.09, isVac ? 0.34 : 0.24, 16, 1, true),
      tpsDarkMat
    );
    bell.position.set(Math.cos(a) * (isVac ? 0.32 : 0.14), -0.1, Math.sin(a) * (isVac ? 0.32 : 0.14));
    shipGroup.add(bell);
  }

  // 3. Super Heavy Booster + Hot-Stage Vented Interstage + 4 Waffle Grid Fins + 33 Raptor Bells
  const hotStageRing = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, 0.36, 28, 2, true),
    new THREE.MeshStandardMaterial({
      color: 0x525252,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: true,
      transparent,
      opacity,
    })
  );
  hotStageRing.position.y = -0.18;
  boosterGroup.add(hotStageRing);

  const boosterHull = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, 4.3, 36),
    stainlessMat
  );
  boosterHull.position.y = -2.5;
  boosterGroup.add(boosterHull);

  // 4 Deployable Titanium Grid Fins + Booster Chines
  const gridFinGeo = new THREE.BoxGeometry(0.46, 0.07, 0.38);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(gridFinGeo, tpsDarkMat);
    fin.position.set(Math.cos(angle) * 0.72, -0.58, Math.sin(angle) * 0.72);
    fin.rotation.y = -angle;
    boosterGroup.add(fin);
  }

  // 33 Super Heavy Raptor Engine Nozzles (20 Outer Ring + 10 Middle + 3 Center)
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 10, 1, true), tpsDarkMat);
    bell.position.set(Math.cos(a) * 0.46, -4.72, Math.sin(a) * 0.46);
    boosterGroup.add(bell);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 10, 1, true), tpsDarkMat);
    bell.position.set(Math.cos(a) * 0.24, -4.72, Math.sin(a) * 0.24);
    boosterGroup.add(bell);
  }

  // 4. Raptor Fire Plumes
  const boosterPlume = createRaptorFirePlumeMesh(6.2, 0.68);
  boosterPlume.position.set(0, -4.75, 0);
  boosterGroup.add(boosterPlume);

  const shipPlume = createRaptorFirePlumeMesh(4.2, 0.44);
  shipPlume.position.set(0, -0.1, 0);
  shipGroup.add(shipPlume);

  const plumeLight = new THREE.PointLight(0xf97316, 0, 24);
  plumeLight.position.set(0, -3.5, 0);
  if (!isGhost) {
    root.add(plumeLight);
  }

  return {
    root,
    shipGroup,
    boosterGroup,
    flaps: { frontLeft, frontRight, aftLeft, aftRight },
    boosterPlume,
    shipPlume,
    plumeLight,
    updateStarship(t: ThrusterActivation, isLaunchMission: boolean, timeSec: number) {
      const showBooster = isLaunchMission && !t.hotStageSeparated;
      boosterGroup.visible = showBooster;

      const flicker = 0.9 + 0.16 * Math.sin(timeSec * 75);
      const activePlume = showBooster ? boosterPlume : shipPlume;
      const inactivePlume = showBooster ? shipPlume : boosterPlume;

      (inactivePlume.material as THREE.MeshBasicMaterial).opacity = 0;
      inactivePlume.visible = false;

      if (isGhost || t.raptorThrottle <= 0.02) {
        (activePlume.material as THREE.MeshBasicMaterial).opacity = 0;
        activePlume.visible = false;
        plumeLight.intensity = 0;
      } else {
        activePlume.visible = true;
        (activePlume.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.98,
          t.raptorThrottle * flicker
        );
        activePlume.scale.set(
          0.85 + t.raptorThrottle * 0.55,
          (0.6 + t.raptorThrottle * 0.95) * flicker,
          0.85 + t.raptorThrottle * 0.55
        );
        activePlume.rotation.z = t.gimbalPitch * 0.28;
        activePlume.rotation.x = t.gimbalYaw * 0.28;
        plumeLight.position.y = showBooster ? -5.2 : -1.0;
        plumeLight.intensity = t.raptorThrottle * 7.5 * flicker;
      }

      frontLeft.rotation.z = (t.flapFrontLeft - 0.5) * 0.9;
      frontRight.rotation.z = (t.flapFrontRight - 0.5) * 0.9;
      aftLeft.rotation.z = (t.flapAftLeft - 0.5) * 0.9;
      aftRight.rotation.z = (t.flapAftRight - 0.5) * 0.9;
    },
  };
}
