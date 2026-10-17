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
    // Physics-based combustion fire plume gradient: white-hot nozzle core -> yellow -> orange fire -> deep red tail
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
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

export function createStarshipModel(isGhost = false): StarshipRig {
  const root = new THREE.Group();
  const shipGroup = new THREE.Group();
  const boosterGroup = new THREE.Group();
  root.add(shipGroup, boosterGroup);

  const hullTex = isGhost ? undefined : createStarshipHullAndTpsTexture();
  const shipMat = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0xd4d4d4,
        wireframe: true,
        transparent: true,
        opacity: 0.24,
      })
    : new THREE.MeshStandardMaterial({
        map: hullTex,
        bumpMap: hullTex,
        bumpScale: 0.018,
        metalness: 0.82,
        roughness: 0.24,
      });

  const darkTpsMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    metalness: 0.35,
    roughness: 0.55,
    transparent: isGhost,
    opacity: isGhost ? 0.22 : 1,
  });

  // 1. Textured Starship Upper Stage Barrel + Ogive Nosecone
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 3.1, 32), shipMat);
  barrel.position.y = 1.55;
  shipGroup.add(barrel);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.45, 32), shipMat);
  nose.position.y = 3.82;
  shipGroup.add(nose);

  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 24), darkTpsMat);
  noseTip.position.y = 4.35;
  shipGroup.add(noseTip);

  // 2. Four Articulated Stainless Steel Aerodynamic Flaps
  const fwdFlapGeo = new THREE.BoxGeometry(0.06, 0.88, 0.52);
  const frontLeft = new THREE.Mesh(fwdFlapGeo, shipMat);
  frontLeft.position.set(0, 3.45, 0.72);
  frontLeft.rotation.x = -0.22;

  const frontRight = new THREE.Mesh(fwdFlapGeo, shipMat);
  frontRight.position.set(0, 3.45, -0.72);
  frontRight.rotation.x = 0.22;

  const aftFlapGeo = new THREE.BoxGeometry(0.07, 1.25, 0.68);
  const aftLeft = new THREE.Mesh(aftFlapGeo, shipMat);
  aftLeft.position.set(0, 0.72, 0.82);
  aftLeft.rotation.x = -0.15;

  const aftRight = new THREE.Mesh(aftFlapGeo, shipMat);
  aftRight.position.set(0, 0.72, -0.82);
  aftRight.rotation.x = 0.15;

  shipGroup.add(frontLeft, frontRight, aftLeft, aftRight);

  // 3. Super Heavy Booster + Vented Hot-Stage Interstage + 4 Waffle Grid Fins
  const hotStageRing = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.32, 24), darkTpsMat);
  hotStageRing.position.y = -0.16;
  boosterGroup.add(hotStageRing);

  const boosterHull = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 4.4, 32), shipMat);
  boosterHull.position.y = -2.52;
  boosterGroup.add(boosterHull);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.34), darkTpsMat);
    fin.position.set(Math.cos(angle) * 0.78, -0.52, Math.sin(angle) * 0.78);
    fin.rotation.y = -angle;
    boosterGroup.add(fin);
  }

  // Raptor Engine Fire Plumes
  const boosterPlume = createRaptorFirePlumeMesh(7.0, 0.82);
  boosterPlume.position.y = -4.72;
  boosterGroup.add(boosterPlume);

  const shipPlume = createRaptorFirePlumeMesh(4.4, 0.54);
  shipPlume.position.y = 0.0;
  shipGroup.add(shipPlume);

  const plumeLight = new THREE.PointLight(0xff7b00, 0, 25);
  plumeLight.position.set(0, -2.5, 0);
  root.add(plumeLight);

  return {
    root,
    shipGroup,
    boosterGroup,
    flaps: { frontLeft, frontRight, aftLeft, aftRight },
    boosterPlume,
    shipPlume,
    plumeLight,
    updateStarship(t: ThrusterActivation, isLaunchMission: boolean, timeSec: number) {
      if (isGhost) return;
      const flicker = 0.9 + Math.sin(timeSec * 85) * 0.1;

      frontLeft.rotation.y = (t.flapFrontLeft - 0.5) * 1.1;
      frontRight.rotation.y = -(t.flapFrontRight - 0.5) * 1.1;
      aftLeft.rotation.y = (t.flapAftLeft - 0.5) * 1.1;
      aftRight.rotation.y = -(t.flapAftRight - 0.5) * 1.1;

      if (isLaunchMission) {
        boosterGroup.visible = true;
        if (t.hotStageSeparated) {
          boosterGroup.position.y = Math.max(-7.5, boosterGroup.position.y - 0.06);
          boosterPlume.visible = false;
          shipPlume.visible = t.raptorThrottle > 0.05;
          shipPlume.scale.set(1, t.raptorThrottle * flicker, 1);
        } else {
          boosterGroup.position.y = 0;
          boosterPlume.visible = t.raptorThrottle > 0.05;
          shipPlume.visible = false;
          boosterPlume.scale.set(
            0.85 + t.raptorThrottle * 0.35,
            t.raptorThrottle * flicker,
            0.85 + t.raptorThrottle * 0.35
          );
          boosterPlume.rotation.z = t.gimbalPitch * 0.22;
        }
      } else {
        boosterGroup.visible = false;
        boosterPlume.visible = false;
        shipPlume.visible = t.raptorThrottle > 0.05;
        shipPlume.scale.set(
          0.75 + t.raptorThrottle * 0.35,
          t.raptorThrottle * flicker,
          0.75 + t.raptorThrottle * 0.35
        );
        shipPlume.rotation.z = t.gimbalPitch * 0.28;
      }

      plumeLight.intensity = t.raptorThrottle * 16 * flicker;
    },
  };
}
