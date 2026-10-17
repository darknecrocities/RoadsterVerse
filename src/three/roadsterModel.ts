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
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(245, 245, 245, 0.92)');
    grad.addColorStop(0.38, 'rgba(180, 180, 180, 0.42)');
    grad.addColorStop(0.52, 'rgba(255, 255, 255, 0.88)');
    grad.addColorStop(0.7, 'rgba(160, 160, 160, 0.35)');
    grad.addColorStop(0.84, 'rgba(240, 240, 240, 0.65)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
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
 * Builds a sculpted, curvaceous 2026 Tesla Roadster (SpaceX Cold-Gas Thruster Package)
 * matching the open-top Targa supercar silhouette in the reference imagery.
 */
export function createRoadsterModel(isGhost = false): RoadsterRig {
  const root = new THREE.Group();
  const opacity = isGhost ? 0.22 : 1.0;
  const transparent = isGhost;

  const satinPanelTex = createRoadsterSatinPanelTexture();
  const carbonTex = createCarbonWeaveTexture();
  const tireTex = createTireTreadTexture();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0xa3a3a3 : 0xfafafa,
    map: isGhost ? null : satinPanelTex,
    metalness: 0.25,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent,
    opacity,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    map: isGhost ? null : carbonTex,
    metalness: 0.45,
    roughness: 0.32,
    transparent,
    opacity,
  });

  const darkIntakeMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.6,
    metalness: 0.2,
    transparent,
    opacity,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    metalness: 0.15,
    roughness: 0.05,
    transmission: isGhost ? 0 : 0.55,
    transparent: true,
    opacity: isGhost ? 0.15 : 0.84,
  });

  // 1. Sculpted Center Supercar Monocoque Profile (smooth Bezier curves, open Targa cockpit)
  const centerShape = new THREE.Shape();
  centerShape.moveTo(-2.12, 0.22);
  centerShape.lineTo(2.14, 0.12); // Low aerodynamic front chin
  centerShape.bezierCurveTo(2.22, 0.26, 2.02, 0.44, 1.55, 0.52); // Curved nose cone
  centerShape.bezierCurveTo(1.15, 0.58, 0.85, 0.6, 0.58, 0.62); // Front hood deck
  centerShape.lineTo(0.28, 0.62); // Base of windshield
  centerShape.lineTo(0.15, 0.44); // Recessed open-top Targa cockpit floor
  centerShape.lineTo(-0.58, 0.44); // Rear bulkhead behind seats
  centerShape.lineTo(-0.68, 0.78); // Twin rear tonneau speedster humps
  centerShape.bezierCurveTo(-1.15, 0.82, -1.68, 0.76, -2.1, 0.64); // Fastback tail deck
  centerShape.lineTo(-2.16, 0.34); // Rear fascia
  centerShape.closePath();

  const centerDepth = 1.16;
  const centerGeo = new THREE.ExtrudeGeometry(centerShape, {
    depth: centerDepth,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.08,
    bevelSegments: 5,
    curveSegments: 24,
  });
  centerGeo.translate(0, 0, -centerDepth / 2);
  root.add(new THREE.Mesh(centerGeo, bodyMat));

  // 2. Sculpted Left & Right Widebody Fender & Rear Haunch Curves
  const fenderShape = new THREE.Shape();
  fenderShape.moveTo(-2.08, 0.24);
  fenderShape.lineTo(-0.68, 0.2);
  fenderShape.lineTo(0.68, 0.18);
  fenderShape.lineTo(2.08, 0.14);
  fenderShape.bezierCurveTo(2.15, 0.34, 1.85, 0.64, 1.32, 0.66); // Muscular front wheel arch swell
  fenderShape.bezierCurveTo(0.92, 0.66, 0.68, 0.54, 0.35, 0.52); // Scalloped door waist
  fenderShape.bezierCurveTo(-0.15, 0.5, -0.45, 0.56, -0.78, 0.72); // Rising rear haunch
  fenderShape.bezierCurveTo(-1.18, 0.82, -1.72, 0.76, -2.08, 0.62); // Rear fender arch
  fenderShape.closePath();

  const fenderGeo = new THREE.ExtrudeGeometry(fenderShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.06,
    bevelSegments: 5,
    curveSegments: 24,
  });

  const leftFender = new THREE.Mesh(fenderGeo, bodyMat);
  leftFender.position.z = 0.54;
  const rightFender = new THREE.Mesh(fenderGeo, bodyMat);
  rightFender.position.z = -0.88;
  root.add(leftFender, rightFender);

  // 3. Deep Side Air Intake Scoops & Front Corner Vents (matching Image 2!)
  for (const zSign of [-1, 1]) {
    // Deep triangular side intake cove ahead of rear wheel
    const sideIntake = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.28, 0.12), darkIntakeMat);
    sideIntake.position.set(-0.38, 0.44, zSign * 0.91);
    sideIntake.rotation.z = -0.14;
    root.add(sideIntake);

    // Front bumper corner air curtain intake (Image 2)
    const frontIntake = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.26), darkIntakeMat);
    frontIntake.position.set(1.96, 0.25, zSign * 0.72);
    frontIntake.rotation.y = zSign * 0.28;
    root.add(frontIntake);

    // Carbon side rocker skirt blade
    const rockerSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.07, 0.16), carbonMat);
    rockerSkirt.position.set(0.0, 0.14, zSign * 0.94);
    root.add(rockerSkirt);
  }

  // 4. Raked Curved Windshield, Black A-Pillars, Bucket Seats, Roll Hoops & Steering Yoke
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 1.36), glassMat);
  windshield.position.set(0.52, 0.78, 0);
  windshield.rotation.z = -0.46;
  root.add(windshield);

  for (const zSign of [-1, 1]) {
    // Gloss black A-pillar frame
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.055, 0.06), carbonMat);
    aPillar.position.set(0.52, 0.79, zSign * 0.68);
    aPillar.rotation.z = -0.46;
    root.add(aPillar);

    // Racing bucket seat + headrest inside open Targa cabin
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.38), carbonMat);
    seatBack.position.set(-0.42, 0.62, zSign * 0.34);
    seatBack.rotation.z = 0.22;
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.24), bodyMat);
    headrest.position.set(-0.48, 0.88, zSign * 0.34);
    const rollHoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.028, 10, 20, Math.PI),
      carbonMat
    );
    rollHoop.position.set(-0.58, 0.82, zSign * 0.34);
    rollHoop.rotation.y = Math.PI / 2;
    root.add(seatBack, headrest, rollHoop);
  }

  // Steering Yoke
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.26), bodyMat);
  yoke.position.set(0.18, 0.68, 0.34);
  yoke.rotation.z = -0.35;
  root.add(yoke);

  // 5. Front Carbon Aero Splitter, Rear Venturi Diffuser & Active Wing
  const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 1.96), carbonMat);
  frontSplitter.position.set(2.02, 0.1, 0);
  const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 1.88), carbonMat);
  rearDiffuser.position.set(-1.98, 0.18, 0);
  root.add(frontSplitter, rearDiffuser);

  const activeWing = new THREE.Group();
  activeWing.position.set(-1.96, 0.74, 0);
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 1.78), carbonMat);
  const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.04), carbonMat);
  pylonL.position.set(0, -0.08, 0.52);
  const pylonR = pylonL.clone();
  pylonR.position.z = -0.52;
  activeWing.add(wingBlade, pylonL, pylonR);
  root.add(activeWing);

  // 6. Angled LED Laser Headlights & Full-Width Rear Taillight Strip
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailLedMat = new THREE.MeshBasicMaterial({ color: 0xe5e5e5 });

  for (const zSign of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.36), whiteLedMat);
    headlight.position.set(1.94, 0.44, zSign * 0.68);
    headlight.rotation.y = zSign * 0.32;
    headlight.rotation.z = -0.18;
    root.add(headlight);
  }
  const taillightBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 1.82), tailLedMat);
  taillightBar.position.set(-2.17, 0.54, 0);
  root.add(taillightBar);

  // 7. Detailed Wheels with Grooved Tires, Ventilated Brake Discs, Calipers & Concave Spokes
  const wheelsGroup = new THREE.Group();
  root.add(wheelsGroup);

  const wheelPositions = [
    { x: 1.34, y: 0.38, z: 0.94 },
    { x: 1.34, y: 0.38, z: -0.94 },
    { x: -1.34, y: 0.41, z: 0.96 },
    { x: -1.34, y: 0.41, z: -0.96 },
  ];

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x121212,
    map: isGhost ? null : tireTex,
    roughness: 0.82,
    metalness: 0.12,
    transparent,
    opacity,
  });
  const rimMetalMat = new THREE.MeshStandardMaterial({
    color: 0x262626,
    metalness: 0.88,
    roughness: 0.22,
    transparent,
    opacity,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0xa3a3a3,
    metalness: 0.85,
    roughness: 0.3,
    transparent,
    opacity,
  });

  const buildWheels = (spec: WheelSpec) => {
    wheelsGroup.clear();
    for (const pos of wheelPositions) {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos.x, pos.y, pos.z);
      const isRear = pos.x < 0;
      const radius = isRear ? 0.41 : 0.38;

      const tireGeo = new THREE.CylinderGeometry(radius, radius, 0.32, 32);
      tireGeo.rotateX(Math.PI / 2);
      wGroup.add(new THREE.Mesh(tireGeo, tireMat));

      // Outer alloy rim lip ring
      const lipRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.76, 0.022, 12, 28), rotorMat);
      lipRing.position.z = pos.z > 0 ? 0.15 : -0.15;
      wGroup.add(lipRing);

      // Ventilated Brake Rotor & Caliper
      const rotorGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.04, 24);
      rotorGeo.rotateX(Math.PI / 2);
      wGroup.add(new THREE.Mesh(rotorGeo, rotorMat));

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.09), bodyMat);
      caliper.position.set(pos.x > 0 ? -0.14 : 0.14, 0.06, pos.z > 0 ? 0.06 : -0.06);
      wGroup.add(caliper);

      if (spec === 'aero-disc') {
        const discGeo = new THREE.CylinderGeometry(radius * 0.75, radius * 0.75, 0.33, 28);
        discGeo.rotateX(Math.PI / 2);
        wGroup.add(new THREE.Mesh(discGeo, carbonMat));
      } else {
        for (let s = 0; s < 10; s++) {
          const spoke = new THREE.Mesh(
            new THREE.BoxGeometry(radius * 1.44, 0.032, 0.33),
            rimMetalMat
          );
          spoke.rotation.z = (s * Math.PI) / 5;
          wGroup.add(spoke);
        }
      }
      wheelsGroup.add(wGroup);
    }
  };
  buildWheels('six-spoke');

  // 8. 7 Supersonic Cold-Gas Nozzles
  const fl = createColdGasPlumeMesh(2.4, 0.24);
  fl.position.set(1.25, 0.12, 0.75);
  const fr = createColdGasPlumeMesh(2.4, 0.24);
  fr.position.set(1.25, 0.12, -0.75);
  const rl = createColdGasPlumeMesh(2.5, 0.26);
  rl.position.set(-1.25, 0.12, 0.78);
  const rr = createColdGasPlumeMesh(2.5, 0.26);
  rr.position.set(-1.25, 0.12, -0.78);

  const latLeft = createColdGasPlumeMesh(2.0, 0.18);
  latLeft.position.set(1.85, 0.28, 0.45);
  latLeft.rotation.z = -1.15;

  const latRight = createColdGasPlumeMesh(2.2, 0.2);
  latRight.position.set(0.0, 0.68, 0.0);
  latRight.rotation.z = Math.PI;

  const rearBoost = createColdGasPlumeMesh(3.2, 0.28);
  rearBoost.position.set(-2.15, 0.28, 0);
  rearBoost.rotation.z = -Math.PI / 2;

  root.add(fl, fr, rl, rr, latLeft, latRight, rearBoost);

  const plumeLight = new THREE.PointLight(0xffffff, 0, 12);
  plumeLight.position.set(0, -0.5, 0);
  if (!isGhost) {
    root.add(plumeLight);
  }

  const updatePlume = (mesh: THREE.Mesh, val: number, flicker: number) => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (isGhost || val <= 0.02) {
      mat.opacity = 0;
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mat.opacity = Math.min(0.95, val * 0.9 * flicker);
    mesh.scale.set(0.85 + val * 0.4, (0.55 + val * 0.85) * flicker, 0.85 + val * 0.4);
  };

  return {
    root,
    activeWing,
    wheelsGroup,
    nozzles: { fl, fr, rl, rr, latLeft, latRight, rearBoost },
    plumeLight,
    setWheelSpec: buildWheels,
    updateThrusters(t: ThrusterActivation, timeSec: number) {
      const flicker = 0.92 + 0.14 * Math.sin(timeSec * 65);
      updatePlume(fl, t.frontLeftLift, flicker);
      updatePlume(fr, t.frontRightLift, flicker);
      updatePlume(rl, t.rearLeftLift, flicker);
      updatePlume(rr, t.rearRightLift, flicker);
      updatePlume(latLeft, t.lateralLeft, flicker);
      updatePlume(latRight, t.lateralRight, flicker);
      updatePlume(rearBoost, t.rearBoost, flicker);

      activeWing.rotation.z = 0.1 + t.activeWingAngle * 0.35;
      const avgLift = (t.frontLeftLift + t.frontRightLift + t.rearLeftLift + t.rearRightLift) / 4;
      plumeLight.intensity = isGhost ? 0 : (avgLift * 4.5 + t.rearBoost * 2.5) * flicker;
    },
    getActiveNozzleEmitters(t: ThrusterActivation): NozzleEmitterDescriptor[] {
      return [
        {
          id: 'fl',
          localOffset: new THREE.Vector3(1.25, 0.12, 0.75),
          localDirection: new THREE.Vector3(0, -1, 0),
          intensity: t.frontLeftLift,
        },
        {
          id: 'fr',
          localOffset: new THREE.Vector3(1.25, 0.12, -0.75),
          localDirection: new THREE.Vector3(0, -1, 0),
          intensity: t.frontRightLift,
        },
        {
          id: 'rl',
          localOffset: new THREE.Vector3(-1.25, 0.12, 0.78),
          localDirection: new THREE.Vector3(0, -1, 0),
          intensity: t.rearLeftLift,
        },
        {
          id: 'rr',
          localOffset: new THREE.Vector3(-1.25, 0.12, -0.78),
          localDirection: new THREE.Vector3(0, -1, 0),
          intensity: t.rearRightLift,
        },
        {
          id: 'latLeft',
          localOffset: new THREE.Vector3(1.9, 0.28, 0.0),
          localDirection: new THREE.Vector3(0.85, -0.5, 0),
          intensity: t.lateralLeft,
        },
        {
          id: 'latRight',
          localOffset: new THREE.Vector3(0.0, 0.72, 0.0),
          localDirection: new THREE.Vector3(0, 1, 0),
          intensity: t.lateralRight,
        },
        {
          id: 'rearBoost',
          localOffset: new THREE.Vector3(-2.15, 0.28, 0),
          localDirection: new THREE.Vector3(-1, -0.1, 0),
          intensity: t.rearBoost,
        },
      ];
    },
  };
}
