import * as THREE from 'three';
import type { ThrusterActivation, WheelSpec } from '../types/simulation.ts';
import {
  createCanvas,
  createCarbonWeaveTexture,
  createRoadsterSatinPanelTexture,
  createTireTreadTexture,
} from './proceduralTextures.ts';

export interface NozzleEmitterDescriptor {
  id: string;
  localOffset: THREE.Vector3;
  localDirection: THREE.Vector3;
  intensity: number;
}

export interface RoadsterRig {
  root: THREE.Group;
  activeWing: THREE.Group;
  wheelsGroup: THREE.Group;
  nozzles: {
    fl: THREE.Mesh;
    fr: THREE.Mesh;
    rl: THREE.Mesh;
    rr: THREE.Mesh;
    latLeft: THREE.Mesh;
    latRight: THREE.Mesh;
    rearBoost: THREE.Mesh;
  };
  plumeLight: THREE.PointLight;
  setWheelSpec: (spec: WheelSpec) => void;
  updateThrusters: (t: ThrusterActivation, timeSec: number) => void;
  getActiveNozzleEmitters: (t: ThrusterActivation) => NozzleEmitterDescriptor[];
}

function createColdGasPlumeMesh(length = 2.4, radius = 0.22): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 20, 1, true);
  geo.translate(0, -length / 2, 0);

  const canvas = createCanvas(64, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Pure monochrome white/silver Mach shock-diamond cold-gas jet
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(245, 245, 245, 0.92)');
    grad.addColorStop(0.38, 'rgba(180, 180, 180, 0.42)');
    grad.addColorStop(0.52, 'rgba(255, 255, 255, 0.88)'); // Shock diamond 1
    grad.addColorStop(0.7, 'rgba(160, 160, 160, 0.35)');
    grad.addColorStop(0.84, 'rgba(240, 240, 240, 0.68)'); // Shock diamond 2
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

export function createRoadsterModel(isGhost = false): RoadsterRig {
  const root = new THREE.Group();

  const satinTex = isGhost ? undefined : createRoadsterSatinPanelTexture();
  const carbonTex = isGhost ? undefined : createCarbonWeaveTexture();
  const tireTex = isGhost ? undefined : createTireTreadTexture();

  const bodyMat = isGhost
    ? new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.24,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: satinTex,
        bumpMap: satinTex,
        bumpScale: 0.008,
        metalness: 0.22,
        roughness: 0.2,
        clearcoat: 0.95,
        clearcoatRoughness: 0.1,
      });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    map: carbonTex,
    bumpMap: carbonTex,
    bumpScale: 0.015,
    metalness: 0.48,
    roughness: 0.36,
    transparent: isGhost,
    opacity: isGhost ? 0.2 : 1,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    metalness: 0.9,
    roughness: 0.06,
    transparent: true,
    opacity: isGhost ? 0.18 : 0.92,
  });

  // 1. Textured Cyber-Wedge Sculpted Roadster Hull
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.15, 0.08);
  hullShape.lineTo(2.1, 0.05);
  hullShape.lineTo(2.28, 0.34);
  hullShape.lineTo(1.25, 0.62);
  hullShape.lineTo(0.15, 0.98);
  hullShape.lineTo(-1.15, 0.88);
  hullShape.lineTo(-2.18, 0.64);
  hullShape.lineTo(-2.24, 0.22);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    steps: 1,
    depth: 1.86,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.07,
    bevelSegments: 3,
  });
  hullGeo.translate(0, 0, -0.93);
  const hullMesh = new THREE.Mesh(hullGeo, bodyMat);
  hullMesh.castShadow = !isGhost;
  root.add(hullMesh);

  // 2. Panoramic Dark Glass Canopy
  const canopyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.34, 1.48), glassMat);
  canopyMesh.position.set(-0.12, 0.78, 0);
  canopyMesh.rotation.z = -0.06;
  root.add(canopyMesh);

  // 3. Textured Carbon-Fiber Lower Skirts, Splitter & Side Intakes
  const skirtMesh = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.14, 1.98), carbonMat);
  skirtMesh.position.set(0.02, 0.09, 0);
  root.add(skirtMesh);

  const intakeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 2.01), carbonMat);
  intakeMesh.position.set(0.68, 0.32, 0);
  intakeMesh.rotation.z = -0.18;
  root.add(intakeMesh);

  // 4. Monochrome White Front & Rear Continuous LED Light Bars
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const frontLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 1.88), ledMat);
  frontLed.position.set(2.26, 0.34, 0);
  const rearLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 1.86), ledMat);
  rearLed.position.set(-2.23, 0.56, 0);
  root.add(frontLed, rearLed);

  // 5. Deployed Active Rear Aerodynamic Wing on Dual Carbon Pylons
  const activeWing = new THREE.Group();
  activeWing.position.set(-2.05, 0.72, 0);
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.84), bodyMat);
  wingBlade.position.set(-0.12, 0.18, 0);
  wingBlade.rotation.z = 0.22;
  const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.04), carbonMat);
  pylonL.position.set(-0.05, 0.08, 0.52);
  const pylonR = pylonL.clone();
  pylonR.position.z = -0.52;
  activeWing.add(wingBlade, pylonL, pylonR);
  root.add(activeWing);

  // 6. Textured Wheel Assemblies (6-Spoke Track Rims vs Carbon Aero-Disc Covers)
  const wheelsGroup = new THREE.Group();
  root.add(wheelsGroup);

  const wheelPositions = [
    { x: 1.35, y: 0.32, z: 0.96 },
    { x: 1.35, y: 0.32, z: -0.96 },
    { x: -1.35, y: 0.32, z: 0.96 },
    { x: -1.35, y: 0.32, z: -0.96 },
  ];

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    map: tireTex,
    bumpMap: tireTex,
    bumpScale: 0.02,
    roughness: 0.78,
  });

  function buildWheels(spec: WheelSpec): void {
    while (wheelsGroup.children.length > 0) {
      wheelsGroup.remove(wheelsGroup.children[0]);
    }
    for (const pos of wheelPositions) {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos.x, pos.y, pos.z);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24), tireMat);
      tire.rotation.x = Math.PI / 2;
      wGroup.add(tire);

      if (spec === 'aero-disc') {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.27, 24), carbonMat);
        disc.rotation.x = Math.PI / 2;
        wGroup.add(disc);
      } else {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.24, 16), bodyMat);
        hub.rotation.x = Math.PI / 2;
        wGroup.add(hub);
        for (let s = 0; s < 6; s++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.055, 0.28), carbonMat);
          spoke.rotation.z = (s * Math.PI) / 3;
          wGroup.add(spoke);
        }
      }
      wheelsGroup.add(wGroup);
    }
  }
  buildWheels('six-spoke');

  // 7. Seven Individual Cold-Gas Thruster Nozzles & White Shock-Diamond Cones
  const fl = createColdGasPlumeMesh(2.5, 0.21);
  fl.position.set(0.95, 0.12, 0.78);
  const fr = createColdGasPlumeMesh(2.5, 0.21);
  fr.position.set(0.95, 0.12, -0.78);
  const rl = createColdGasPlumeMesh(2.5, 0.21);
  rl.position.set(-0.95, 0.12, 0.78);
  const rr = createColdGasPlumeMesh(2.5, 0.21);
  rr.position.set(-0.95, 0.12, -0.78);

  const latLeft = createColdGasPlumeMesh(3.1, 0.22);
  latLeft.position.set(1.45, 0.36, 1.02);
  latLeft.rotation.x = -Math.PI / 2;

  const latRight = createColdGasPlumeMesh(3.4, 0.24);
  latRight.position.set(0.35, 0.38, -1.02);
  latRight.rotation.x = Math.PI / 2;
  latRight.rotation.z = -Math.PI / 2;

  const rearBoost = createColdGasPlumeMesh(3.3, 0.28);
  rearBoost.position.set(-2.25, 0.35, 0);
  rearBoost.rotation.z = -Math.PI / 2;

  root.add(fl, fr, rl, rr, latLeft, latRight, rearBoost);

  const plumeLight = new THREE.PointLight(0xffffff, 0, 14);
  plumeLight.position.set(0, -0.6, 0);
  root.add(plumeLight);

  return {
    root,
    activeWing,
    wheelsGroup,
    nozzles: { fl, fr, rl, rr, latLeft, latRight, rearBoost },
    plumeLight,
    setWheelSpec: buildWheels,
    updateThrusters(t: ThrusterActivation, timeSec: number) {
      if (isGhost) return;
      const flicker = 0.92 + Math.sin(timeSec * 65) * 0.08;

      const applyPlume = (mesh: THREE.Mesh, val: number) => {
        mesh.visible = val > 0.04;
        if (mesh.visible) {
          const s = Math.max(0.2, val * flicker);
          mesh.scale.set(0.75 + s * 0.35, s, 0.75 + s * 0.35);
        }
      };

      applyPlume(fl, t.frontLeftLift);
      applyPlume(fr, t.frontRightLift);
      applyPlume(rl, t.rearLeftLift);
      applyPlume(rr, t.rearRightLift);
      applyPlume(latLeft, t.lateralLeft);
      applyPlume(latRight, t.lateralRight);
      applyPlume(rearBoost, t.rearBoost);

      activeWing.rotation.z = 0.1 + t.activeWingAngle * 0.42;
      const avgLift =
        (t.frontLeftLift + t.frontRightLift + t.rearLeftLift + t.rearRightLift + t.lateralRight) / 5;
      plumeLight.intensity = avgLift * 9.0 * flicker;
    },
    getActiveNozzleEmitters(t: ThrusterActivation): NozzleEmitterDescriptor[] {
      return [
        {
          id: 'fl',
          localOffset: new THREE.Vector3(0.95, 0.05, 0.78),
          localDirection: new THREE.Vector3(0, -1, 0.08),
          intensity: t.frontLeftLift,
        },
        {
          id: 'fr',
          localOffset: new THREE.Vector3(0.95, 0.05, -0.78),
          localDirection: new THREE.Vector3(0, -1, -0.08),
          intensity: t.frontRightLift,
        },
        {
          id: 'rl',
          localOffset: new THREE.Vector3(-0.95, 0.05, 0.78),
          localDirection: new THREE.Vector3(0, -1, 0.08),
          intensity: t.rearLeftLift,
        },
        {
          id: 'rr',
          localOffset: new THREE.Vector3(-0.95, 0.05, -0.78),
          localDirection: new THREE.Vector3(0, -1, -0.08),
          intensity: t.rearRightLift,
        },
        {
          id: 'latLeft',
          localOffset: new THREE.Vector3(1.45, 0.36, 1.05),
          localDirection: new THREE.Vector3(-0.2, 0, 1),
          intensity: t.lateralLeft,
        },
        {
          id: 'latRight',
          localOffset: new THREE.Vector3(0.35, 0.38, -1.05),
          localDirection: new THREE.Vector3(-0.4, 0.1, -1),
          intensity: t.lateralRight,
        },
        {
          id: 'rearBoost',
          localOffset: new THREE.Vector3(-2.3, 0.35, 0),
          localDirection: new THREE.Vector3(-1, -0.08, 0),
          intensity: t.rearBoost,
        },
      ];
    },
  };
}
