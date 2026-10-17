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
  updateStarship: (
    t: ThrusterActivation,
    isLaunchMission: boolean,
    timeSec: number,
    rootY?: number,
    rootPitch?: number,
    stageSepTime?: number
  ) => void;
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
 * Builds a high-detail 3D SpaceX Starship (Upper Stage) & Super Heavy Booster (Bottom Half)
 * matching reference Images 3 & 4: black thermal nosecone tip, central vertical raceway spine,
 * circular porthole/RCS vents, 4 articulated flaps with hinge fairings, vented hot-stage ring,
 * 4 titanium grid fins, and 33 Raptor nozzles.
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
    roughness: 0.72,
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

  // 1. Starship Upper Stage Cylindrical Barrel + Parabolic Ogive Nosecone + Black TPS Tip (Images 3 & 4)
  const shipRadius = 0.56;
  const shipBarrelHeight = 2.6;
  const shipBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, shipBarrelHeight, 36),
    stainlessMat
  );
  shipBarrel.position.y = 1.3;
  shipGroup.add(shipBarrel);

  // Lower Stainless Ogive Section + Upper Black Thermal Protection Nosecone Cap (Image 3)
  const lowerOgivePts: THREE.Vector2[] = [];
  const upperTipPts: THREE.Vector2[] = [];
  const ogiveHeight = 1.58;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = shipRadius * Math.pow(1 - t, 0.68);
    const pt = new THREE.Vector2(Math.max(0.01, r), t * ogiveHeight);
    if (t <= 0.62) lowerOgivePts.push(pt);
    if (t >= 0.55) upperTipPts.push(pt);
  }
  const nosecone = new THREE.Mesh(new THREE.LatheGeometry(lowerOgivePts, 36), stainlessMat);
  nosecone.position.y = 2.6;
  const blackNoseTip = new THREE.Mesh(new THREE.LatheGeometry(upperTipPts, 36), tpsDarkMat);
  blackNoseTip.position.y = 2.6;
  shipGroup.add(nosecone, blackNoseTip);

  // Stepped Black Heat-Shield Windward Cladding Shell (Image 3 & 4 contrast)
  const tpsWindwardShell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      shipRadius + 0.006,
      shipRadius + 0.006,
      shipBarrelHeight * 0.96,
      24,
      1,
      true,
      -Math.PI * 0.42,
      Math.PI * 0.84
    ),
    tpsDarkMat
  );
  tpsWindwardShell.position.y = 1.3;
  shipGroup.add(tpsWindwardShell);

  // Circumferential weld rings, Central Vertical Raceway Spine & Circular Porthole Vents (Image 3)
  for (const ry of [0.35, 1.05, 1.85, 2.58]) {
    const weldRing = new THREE.Mesh(
      new THREE.TorusGeometry(shipRadius + 0.009, 0.012, 8, 36),
      chromeRingMat
    );
    weldRing.rotation.x = Math.PI / 2;
    weldRing.position.y = ry;
    shipGroup.add(weldRing);
  }

  for (const zSign of [-1, 1]) {
    const racewaySpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 2.55, 0.04),
      chromeRingMat
    );
    racewaySpine.position.set(0, 1.32, zSign * (shipRadius + 0.015));
    const portholeLow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16),
      tpsDarkMat
    );
    portholeLow.rotation.x = Math.PI / 2;
    portholeLow.position.set(0.18, 1.96, zSign * (shipRadius + 0.01));
    const portholeHigh = portholeLow.clone();
    portholeHigh.position.set(-0.14, 2.74, zSign * (shipRadius * 0.84));
    const catchPin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.22), chromeRingMat);
    catchPin.position.set(0, 2.25, zSign * (shipRadius + 0.06));
    shipGroup.add(racewaySpine, portholeLow, portholeHigh, catchPin);
  }

  // 2. 4 Articulated Stainless Aero Flaps with Black Aerodynamic Hinge Fairings (Image 3)
  const fwdFlapGeo = new THREE.BoxGeometry(0.05, 0.88, 0.46);
  const frontLeft = new THREE.Mesh(fwdFlapGeo, tpsDarkMat);
  frontLeft.position.set(0, 3.25, 0.66);
  frontLeft.rotation.x = -0.22;
  const frontRight = new THREE.Mesh(fwdFlapGeo, tpsDarkMat);
  frontRight.position.set(0, 3.25, -0.66);
  frontRight.rotation.x = 0.22;

  const aftFlapGeo = new THREE.BoxGeometry(0.06, 1.22, 0.6);
  const aftLeft = new THREE.Mesh(aftFlapGeo, tpsDarkMat);
  aftLeft.position.set(0, 0.68, 0.74);
  const aftRight = new THREE.Mesh(aftFlapGeo, tpsDarkMat);
  aftRight.position.set(0, 0.68, -0.74);
  shipGroup.add(frontLeft, frontRight, aftLeft, aftRight);

  for (const zSign of [-1, 1]) {
    const fwdHingePod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.045, 0.92, 12),
      tpsDarkMat
    );
    fwdHingePod.position.set(0, 3.25, zSign * 0.48);
    const aftHingePod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 1.26, 12),
      tpsDarkMat
    );
    aftHingePod.position.set(0, 0.68, zSign * 0.55);
    shipGroup.add(fwdHingePod, aftHingePod);
  }

  // 6 Ship Raptor Engine Bells (3 RVac + 3 Center Sea-Level)
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const isVac = i % 2 === 0;
    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(isVac ? 0.14 : 0.09, isVac ? 0.34 : 0.24, 16, 1, true),
      tpsDarkMat
    );
    bell.position.set(
      Math.cos(a) * (isVac ? 0.32 : 0.14),
      -0.1,
      Math.sin(a) * (isVac ? 0.32 : 0.14)
    );
    shipGroup.add(bell);
  }

  // 3. Super Heavy Booster + Hot-Stage Vented Interstage + 4 Waffle Grid Fins + 33 Raptor Bells (Image 4)
  const hotStageRing = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, 0.38, 28, 2, true),
    new THREE.MeshStandardMaterial({
      color: 0x525252,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: true,
      transparent,
      opacity,
    })
  );
  hotStageRing.position.y = -0.19;
  boosterGroup.add(hotStageRing);

  const boosterHull = new THREE.Mesh(
    new THREE.CylinderGeometry(shipRadius, shipRadius, 4.3, 36),
    stainlessMat
  );
  boosterHull.position.y = -2.52;
  boosterGroup.add(boosterHull);

  // Booster Weld Rings & Vertical Pressurization Chines (Image 4)
  for (const by of [-0.9, -1.8, -2.7, -3.6, -4.4]) {
    const bRing = new THREE.Mesh(
      new THREE.TorusGeometry(shipRadius + 0.008, 0.011, 8, 36),
      chromeRingMat
    );
    bRing.rotation.x = Math.PI / 2;
    bRing.position.y = by;
    boosterGroup.add(bRing);
  }
  for (const zSign of [-1, 1]) {
    const boosterChine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.1, 0.07), chromeRingMat);
    boosterChine.position.set(0, -2.52, zSign * (shipRadius + 0.02));
    boosterGroup.add(boosterChine);
  }

  // 4 Deployable Titanium Waffle Grid Fins
  const gridFinGeo = new THREE.BoxGeometry(0.48, 0.075, 0.4);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(gridFinGeo, tpsDarkMat);
    fin.position.set(Math.cos(angle) * 0.74, -0.58, Math.sin(angle) * 0.74);
    fin.rotation.y = -angle;
    boosterGroup.add(fin);
  }

  // 33 Super Heavy Raptor Engine Nozzles
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

  // 4. Dual-Stage Raptor Fire Plumes (Booster Plume + Upper-Stage Ship Plume)
  const boosterPlume = createRaptorFirePlumeMesh(6.2, 0.68);
  boosterPlume.position.set(0, -4.75, 0);
  boosterGroup.add(boosterPlume);

  const shipPlume = createRaptorFirePlumeMesh(4.2, 0.44);
  shipPlume.position.set(0, -0.1, 0);
  shipGroup.add(shipPlume);

  const plumeLight = new THREE.PointLight(0xf97316, 0, 26);
  plumeLight.position.set(0, -1.5, 0);
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
    updateStarship(
      t: ThrusterActivation,
      isLaunchMission: boolean,
      timeSec: number,
      rootY = 1.35,
      rootPitch = 0,
      stageSepTime = 0
    ) {
      const flicker = 0.9 + 0.16 * Math.sin(timeSec * 75);

      if (isLaunchMission) {
        // Both Super Heavy Booster AND Starship Upper Stage stay visible!
        boosterGroup.visible = true;
        boosterGroup.position.set(0, 4.75, 0);

        if (!t.hotStageSeparated) {
          // Stacked together during Full-Stack Ascent
          shipGroup.position.set(0, 4.75, 0);
          shipGroup.rotation.set(0, 0, 0);
          (shipPlume.material as THREE.MeshBasicMaterial).opacity = 0;
          shipPlume.visible = false;
        } else {
          // Hot-Stage Release: Upper Stage Ship detaches & climbs into orbit with its own 6-Raptor plume,
          // while root tracks the Super Heavy Booster returning for its slow vertical landing!
          const sepSec = Math.max(0.08, stageSepTime);
          const worldDx = sepSec * 2.4;
          const worldDy = Math.max(0.6, 13.6 - rootY + sepSec * 5.2);
          const cosP = Math.cos(-rootPitch);
          const sinP = Math.sin(-rootPitch);
          shipGroup.position.set(
            worldDx * cosP - worldDy * sinP,
            4.75 + worldDx * sinP + worldDy * cosP,
            0
          );
          shipGroup.rotation.set(0, 0, -rootPitch - 0.22);

          if (!isGhost) {
            shipPlume.visible = true;
            (shipPlume.material as THREE.MeshBasicMaterial).opacity = Math.min(0.95, 0.88 * flicker);
            shipPlume.scale.set(1.1, 1.25 * flicker, 1.1);
          }
        }

        // Booster 33-Raptor Ascent / Landing Retro-Burn Plume
        if (isGhost || t.raptorThrottle <= 0.02) {
          (boosterPlume.material as THREE.MeshBasicMaterial).opacity = 0;
          boosterPlume.visible = false;
          plumeLight.intensity = t.hotStageSeparated && !isGhost ? 3.2 * flicker : 0;
        } else {
          boosterPlume.visible = true;
          (boosterPlume.material as THREE.MeshBasicMaterial).opacity = Math.min(
            0.98,
            t.raptorThrottle * flicker
          );
          boosterPlume.scale.set(
            0.82 + t.raptorThrottle * 0.55,
            (0.55 + t.raptorThrottle * 0.95) * flicker,
            0.82 + t.raptorThrottle * 0.55
          );
          boosterPlume.rotation.z = t.gimbalPitch * 0.28;
          boosterPlume.rotation.x = t.gimbalYaw * 0.28;
          plumeLight.position.y = -0.2;
          plumeLight.intensity = t.raptorThrottle * 7.5 * flicker;
        }
      } else {
        // Mission 05: Starship Belly-Flop Skydiver & Slow Vertical Flip-and-Burn Landing
        boosterGroup.visible = false;
        shipGroup.position.set(0, 0, 0);
        shipGroup.rotation.set(0, 0, 0);
        (boosterPlume.material as THREE.MeshBasicMaterial).opacity = 0;
        boosterPlume.visible = false;

        if (isGhost || t.raptorThrottle <= 0.02) {
          (shipPlume.material as THREE.MeshBasicMaterial).opacity = 0;
          shipPlume.visible = false;
          plumeLight.intensity = 0;
        } else {
          shipPlume.visible = true;
          (shipPlume.material as THREE.MeshBasicMaterial).opacity = Math.min(
            0.98,
            t.raptorThrottle * flicker
          );
          shipPlume.scale.set(
            0.85 + t.raptorThrottle * 0.55,
            (0.6 + t.raptorThrottle * 0.95) * flicker,
            0.85 + t.raptorThrottle * 0.55
          );
          shipPlume.rotation.z = t.gimbalPitch * 0.28;
          shipPlume.rotation.x = t.gimbalYaw * 0.28;
          plumeLight.position.y = -1.0;
          plumeLight.intensity = t.raptorThrottle * 7.5 * flicker;
        }
      }

      frontLeft.rotation.z = (t.flapFrontLeft - 0.5) * 0.9;
      frontRight.rotation.z = (t.flapFrontRight - 0.5) * 0.9;
      aftLeft.rotation.z = (t.flapAftLeft - 0.5) * 0.9;
      aftRight.rotation.z = (t.flapAftRight - 0.5) * 0.9;
    },
  };
}
