import * as THREE from 'three';
import type { ThrusterActivation } from '../types/simulation.ts';
import type { NozzleEmitterDescriptor } from './roadsterModel.ts';
import { createCanvas } from './proceduralTextures.ts';

export interface OrbitalPodRig {
  root: THREE.Group;
  fairingDoorLeft: THREE.Group;
  fairingDoorRight: THREE.Group;
  solarWingLeft: THREE.Group;
  solarWingRight: THREE.Group;
  antennaDish: THREE.Mesh;
  nozzles: {
    bottom1: THREE.Mesh;
    bottom2: THREE.Mesh;
    sideLeft: THREE.Mesh;
    sideRight: THREE.Mesh;
  };
  rcsLight: THREE.PointLight;
  updateRCS: (t: ThrusterActivation, timeSec: number) => void;
  updateDeployment: (deployPct: number) => void;
  getActiveNozzleEmitters: (t: ThrusterActivation) => NozzleEmitterDescriptor[];
}

function createRcsVaporMesh(length = 1.4, radius = 0.14): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 16, 1, true);
  geo.translate(0, -length / 2, 0);

  const canvas = createCanvas(32, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.3, 'rgba(230, 230, 230, 0.75)');
    grad.addColorStop(0.65, 'rgba(180, 180, 180, 0.35)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 128);
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
 * Builds the 3D Orbital Payload Pod and transforming satellite array.
 */
export function createOrbitalPodModel(isGhost = false): OrbitalPodRig {
  const root = new THREE.Group();
  const opacity = isGhost ? 0.25 : 1.0;
  const transparent = isGhost;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe0e0e0,
    metalness: 0.92,
    roughness: 0.22,
    transparent,
    opacity,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    metalness: 0.45,
    roughness: 0.35,
    transparent,
    opacity,
  });

  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.85,
    roughness: 0.15,
    transparent,
    opacity,
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    metalness: 0.6,
    roughness: 0.4,
    transparent,
    opacity,
  });

  // 1. Pod Base Chassis & Avionics Core
  const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.8, 32), interiorMat);
  coreBody.position.y = 0.0;
  root.add(coreBody);

  // 2. High-Gain Phased-Array Satellite Dish (inside payload core)
  const dishGeo = new THREE.CylinderGeometry(0.32, 0.04, 0.08, 24);
  const antennaDish = new THREE.Mesh(dishGeo, steelMat);
  antennaDish.position.set(0, 0.65, 0);
  root.add(antennaDish);

  // 3. Articulated Payload Fairing Shell Doors (Left & Right)
  const fairingGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.1, 24, 1, false, 0, Math.PI);

  const fairingDoorLeft = new THREE.Group();
  fairingDoorLeft.position.set(-0.55, 0.15, 0);
  const fairingShellL = new THREE.Mesh(fairingGeo, steelMat);
  fairingShellL.position.set(0.55, 0, 0);
  fairingShellL.rotation.y = Math.PI / 2;
  fairingDoorLeft.add(fairingShellL);

  const fairingDoorRight = new THREE.Group();
  fairingDoorRight.position.set(0.55, 0.15, 0);
  const fairingShellR = new THREE.Mesh(fairingGeo, steelMat);
  fairingShellR.position.set(-0.55, 0, 0);
  fairingShellR.rotation.y = -Math.PI / 2;
  fairingDoorRight.add(fairingShellR);

  root.add(fairingDoorLeft, fairingDoorRight);

  // 4. Multi-Segment Deployable Solar Array Wings (Left & Right)
  const solarWingLeft = new THREE.Group();
  solarWingLeft.position.set(-0.52, 0.1, 0);

  const wingBoomL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.04), carbonMat);
  wingBoomL.position.set(-0.32, 0, 0);
  const panelGridL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.65), solarCellMat);
  panelGridL.position.set(-1.05, 0, 0);
  solarWingLeft.add(wingBoomL, panelGridL);

  const solarWingRight = new THREE.Group();
  solarWingRight.position.set(0.52, 0.1, 0);

  const wingBoomR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.04), carbonMat);
  wingBoomR.position.set(0.32, 0, 0);
  const panelGridR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.65), solarCellMat);
  panelGridR.position.set(1.05, 0, 0);
  solarWingRight.add(wingBoomR, panelGridR);

  // Initially stowed/folded
  solarWingLeft.scale.set(0.01, 1, 0.01);
  solarWingRight.scale.set(0.01, 1, 0.01);
  root.add(solarWingLeft, solarWingRight);

  // 5. Cold-Gas RCS Thruster Nozzles (Bottom & Lateral Sides Only!)
  const bottom1 = createRcsVaporMesh(1.4, 0.15);
  bottom1.position.set(-0.25, -0.92, 0.0);
  bottom1.rotation.z = Math.PI;

  const bottom2 = createRcsVaporMesh(1.4, 0.15);
  bottom2.position.set(0.25, -0.92, 0.0);
  bottom2.rotation.z = Math.PI;

  const sideLeft = createRcsVaporMesh(1.2, 0.12);
  sideLeft.position.set(-0.54, 0.45, 0.0);
  sideLeft.rotation.z = Math.PI / 2;

  const sideRight = createRcsVaporMesh(1.2, 0.12);
  sideRight.position.set(0.54, 0.45, 0.0);
  sideRight.rotation.z = -Math.PI / 2;

  root.add(bottom1, bottom2, sideLeft, sideRight);

  const rcsLight = new THREE.PointLight(0xffffff, 0, 10);
  rcsLight.position.set(0, -0.6, 0);
  if (!isGhost) root.add(rcsLight);

  const updateVapor = (mesh: THREE.Mesh, val: number, flicker: number) => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (isGhost || val <= 0.02) {
      mat.opacity = 0;
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mat.opacity = Math.min(0.85, val * 0.8 * flicker);
    mesh.scale.set(0.75 + val * 0.45, (0.55 + val * 0.85) * flicker, 0.75 + val * 0.45);
  };

  return {
    root,
    fairingDoorLeft,
    fairingDoorRight,
    solarWingLeft,
    solarWingRight,
    antennaDish,
    nozzles: {
      bottom1,
      bottom2,
      sideLeft,
      sideRight,
    },
    rcsLight,
    updateRCS(t: ThrusterActivation, timeSec: number) {
      const flicker = 0.9 + 0.16 * Math.sin(timeSec * 75);
      const bVal = t.podRcsBottom ?? (t.rearBoost > 0.1 ? t.rearBoost : 0);
      const lVal = t.podRcsLateral ?? Math.abs(t.lateralLeft - t.lateralRight);

      updateVapor(bottom1, bVal, flicker);
      updateVapor(bottom2, bVal, flicker);
      updateVapor(sideLeft, t.lateralLeft > 0.05 ? t.lateralLeft : lVal * 0.5, flicker);
      updateVapor(sideRight, t.lateralRight > 0.05 ? t.lateralRight : lVal * 0.5, flicker);

      rcsLight.intensity = isGhost ? 0 : (bVal * 2.5 + lVal * 1.5) * flicker;
    },
    updateDeployment(deployPct: number) {
      const factor = Math.max(0, Math.min(1.0, deployPct / 100));
      // Articulate fairing doors open 0 -> 82 degrees
      fairingDoorLeft.rotation.z = -factor * 1.42;
      fairingDoorRight.rotation.z = factor * 1.42;

      // Extend and unfold solar array wings
      solarWingLeft.scale.set(factor, 1, factor);
      solarWingRight.scale.set(factor, 1, factor);

      // Tilt antenna dish toward orbital horizon
      antennaDish.rotation.x = factor * 0.45;
    },
    getActiveNozzleEmitters(t: ThrusterActivation): NozzleEmitterDescriptor[] {
      const bVal = t.podRcsBottom ?? (t.rearBoost > 0.1 ? t.rearBoost : 0);
      const lVal = t.podRcsLateral ?? Math.abs(t.lateralLeft - t.lateralRight);
      const emitters: NozzleEmitterDescriptor[] = [];

      if (bVal > 0.05) {
        emitters.push(
          { id: 'podBottom1', localOffset: new THREE.Vector3(-0.25, -0.92, 0), localDirection: new THREE.Vector3(0, -1, 0), intensity: bVal },
          { id: 'podBottom2', localOffset: new THREE.Vector3(0.25, -0.92, 0), localDirection: new THREE.Vector3(0, -1, 0), intensity: bVal }
        );
      }
      if (lVal > 0.05 || t.lateralLeft > 0.05 || t.lateralRight > 0.05) {
        emitters.push(
          { id: 'podSideLeft', localOffset: new THREE.Vector3(-0.54, 0.45, 0), localDirection: new THREE.Vector3(-1, 0, 0), intensity: t.lateralLeft || lVal },
          { id: 'podSideRight', localOffset: new THREE.Vector3(0.54, 0.45, 0), localDirection: new THREE.Vector3(1, 0, 0), intensity: t.lateralRight || lVal }
        );
      }
      return emitters;
    },
  };
}
