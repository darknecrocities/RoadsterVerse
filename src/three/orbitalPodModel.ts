import * as THREE from 'three';
import type { ThrusterActivation } from '../types/simulation.ts';
import type { NozzleEmitterDescriptor } from './roadsterModel.ts';
import {
  createCanvas,
  createCarbonWeaveTexture,
  createSatelliteMliTexture,
  createSatelliteSolarCellTexture,
  createStarshipHullAndTpsTexture,
} from './proceduralTextures.ts';

export interface OrigamiWingRig {
  wingRoot: THREE.Group;
  joints: THREE.Group[];
  hinges: THREE.Mesh[];
}

export interface OrbitalPodRig {
  root: THREE.Group;
  fairingDoorLeft: THREE.Group;
  fairingDoorRight: THREE.Group;
  solarWingLeft: THREE.Group;
  solarWingRight: THREE.Group;
  antennaDish: THREE.Mesh;
  antennaGimbal: THREE.Group;
  magnetometerBoom: THREE.Group;
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
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
}

/**
 * Builds the Authentic Aerodynamic Rocket Nosecone Tip that mechanically splits
 * and transforms in space into an interconnected origami deep-space satellite bus.
 */
export function createOrbitalPodModel(isGhost = false): OrbitalPodRig {
  const root = new THREE.Group();
  const opacity = isGhost ? 0.25 : 1.0;
  const transparent = isGhost;

  const hullTex = createStarshipHullAndTpsTexture();
  const solarTex = createSatelliteSolarCellTexture();
  const mliTex = createSatelliteMliTexture();
  const carbonTex = createCarbonWeaveTexture();

  const stainlessMat = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0xa3a3a3 : 0xe5e5e5,
    map: isGhost ? null : hullTex,
    bumpMap: isGhost ? null : hullTex,
    bumpScale: 0.015,
    metalness: 0.9,
    roughness: 0.2,
    clearcoat: 0.5,
    transparent,
    opacity,
  });

  const tpsDarkMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    metalness: 0.2,
    roughness: 0.75,
    transparent,
    opacity,
  });

  const mliMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d4,
    map: isGhost ? null : mliTex,
    metalness: 0.85,
    roughness: 0.28,
    transparent,
    opacity,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: isGhost ? null : solarTex,
    metalness: 0.75,
    roughness: 0.22,
    transparent,
    opacity,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    map: isGhost ? null : carbonTex,
    roughness: 0.45,
    metalness: 0.35,
    transparent,
    opacity,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.12,
    transparent,
    opacity,
  });

  // 1. Central Satellite Avionics Bus Chassis
  const busGroup = new THREE.Group();
  busGroup.position.set(0, 0.15, 0);
  root.add(busGroup);

  const busCore = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 1.45, 8), mliMat);
  busGroup.add(busCore);

  const topDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8), carbonMat);
  topDeck.position.y = 0.75;
  const bottomDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 8), carbonMat);
  bottomDeck.position.y = -0.75;
  busGroup.add(topDeck, bottomDeck);

  // Nadir-facing Earth-Observation Optical Camera & Star Trackers
  const cameraBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.28, 24), chromeMat);
  cameraBarrel.position.set(0, 0.88, 0.16);
  const opticalLens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), tpsDarkMat);
  opticalLens.rotation.x = -Math.PI / 2;
  opticalLens.position.set(0, 1.02, 0.16);
  busGroup.add(cameraBarrel, opticalLens);

  for (const xSign of [-1, 1]) {
    const starTracker = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16, 1, true), carbonMat);
    starTracker.position.set(xSign * 0.28, 0.65, -0.22);
    starTracker.rotation.set(-0.6, 0, xSign * 0.4);
    busGroup.add(starTracker);
  }

  // 3-Axis Gyroscopic Reaction Wheels
  for (let i = 0; i < 3; i++) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 18), chromeMat);
    wheel.position.set((i - 1) * 0.18, -0.45, -0.2);
    wheel.rotation.set(i === 0 ? Math.PI / 2 : 0, 0, i === 1 ? Math.PI / 2 : 0);
    busGroup.add(wheel);
  }

  // Telescoping Forward Magnetometer Boom
  const magnetometerBoom = new THREE.Group();
  magnetometerBoom.position.set(0, 0.78, 0);
  const boomMast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.95, 12), chromeMat);
  boomMast.position.y = 0.48;
  const sensorSphere1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), chromeMat);
  sensorSphere1.position.y = 0.95;
  const sensorCross = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.015), carbonMat);
  sensorCross.position.y = 0.88;
  magnetometerBoom.add(boomMast, sensorSphere1, sensorCross);
  magnetometerBoom.scale.set(1, 0.05, 1);
  busGroup.add(magnetometerBoom);

  // 2. High-Gain Concave Parabolic Communications Dish & Pantograph Boom
  const antennaGimbal = new THREE.Group();
  antennaGimbal.position.set(0, 0.22, 0.32);
  busGroup.add(antennaGimbal);

  const pantographBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.02), carbonMat);
  pantographBar1.position.set(-0.04, 0.21, 0.08);
  pantographBar1.rotation.x = 0.42;

  const pantographBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.02), carbonMat);
  pantographBar2.position.set(0.04, 0.21, 0.08);
  pantographBar2.rotation.x = 0.42;

  const dishPts: THREE.Vector2[] = [];
  const dishRadius = 0.46;
  for (let i = 0; i <= 14; i++) {
    const r = (i / 14) * dishRadius;
    const y = 0.24 * (r / dishRadius) * (r / dishRadius);
    dishPts.push(new THREE.Vector2(Math.max(0.01, r), y));
  }
  const dishGeo = new THREE.LatheGeometry(dishPts, 32);
  const antennaDish = new THREE.Mesh(dishGeo, chromeMat);
  antennaDish.position.set(0, 0.42, 0.26);
  antennaDish.rotation.x = Math.PI * 0.65;

  const feedHorn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 12), chromeMat);
  feedHorn.position.set(0, 0.08, 0);
  antennaDish.add(feedHorn);

  antennaGimbal.add(pantographBar1, pantographBar2, antennaDish);
  antennaGimbal.scale.set(0.1, 0.1, 0.1);

  // 3. Clamshell Aerodynamic Rocket Tip with Connected Hydraulic Actuator Rods
  const shipRadius = 0.56;
  const ogiveHeight = 2.4;
  const ogivePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = shipRadius * Math.pow(1 - t, 0.72);
    ogivePts.push(new THREE.Vector2(Math.max(0.01, r), t * ogiveHeight - 0.75));
  }

  const fairingDoorLeft = new THREE.Group();
  fairingDoorLeft.position.set(-0.54, -0.65, 0);
  const shellGeoL = new THREE.LatheGeometry(ogivePts, 24, 0, Math.PI);
  const shellMeshL = new THREE.Mesh(shellGeoL, stainlessMat);
  shellMeshL.position.set(0.54, 0, 0);
  shellMeshL.rotation.y = Math.PI / 2;
  const tpsCoverL = new THREE.Mesh(new THREE.LatheGeometry(ogivePts, 24, Math.PI, Math.PI), tpsDarkMat);
  tpsCoverL.position.set(0.54, 0, 0);
  tpsCoverL.rotation.y = Math.PI / 2;
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.65, 0.28), stainlessMat);
  flapL.position.set(0.54 - shipRadius - 0.08, 0.55, 0);
  fairingDoorLeft.add(shellMeshL, tpsCoverL, flapL);

  const fairingDoorRight = new THREE.Group();
  fairingDoorRight.position.set(0.54, -0.65, 0);
  const shellGeoR = new THREE.LatheGeometry(ogivePts, 24, 0, Math.PI);
  const shellMeshR = new THREE.Mesh(shellGeoR, stainlessMat);
  shellMeshR.position.set(-0.54, 0, 0);
  shellMeshR.rotation.y = -Math.PI / 2;
  const tpsCoverR = new THREE.Mesh(new THREE.LatheGeometry(ogivePts, 24, Math.PI, Math.PI), tpsDarkMat);
  tpsCoverR.position.set(-0.54, 0, 0);
  tpsCoverR.rotation.y = -Math.PI / 2;
  const flapR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.65, 0.28), stainlessMat);
  flapR.position.set(-0.54 + shipRadius + 0.08, 0.55, 0);
  fairingDoorRight.add(shellMeshR, tpsCoverR, flapR);

  // Connected Hydraulic Actuator Cylinders and Piston Rods on Bus Deck
  const hydraulicPistonL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12), chromeMat);
  hydraulicPistonL.position.set(-0.42, -0.42, 0.15);
  hydraulicPistonL.rotation.z = -0.55;
  const hydraulicPistonR = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12), chromeMat);
  hydraulicPistonR.position.set(0.42, -0.42, 0.15);
  hydraulicPistonR.rotation.z = 0.55;
  busGroup.add(hydraulicPistonL, hydraulicPistonR);

  root.add(fairingDoorLeft, fairingDoorRight);

  // 4. Interconnected Kinematic Origami Accordion Solar Array Wings (4 Panels per Wing)
  const buildOrigamiWing = (xSign: number): OrigamiWingRig => {
    const wingRoot = new THREE.Group();
    wingRoot.position.set(xSign * 0.44, 0.12, 0);

    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.045), carbonMat);
    yoke.position.set(xSign * 0.12, 0, 0);
    wingRoot.add(yoke);

    const joints: THREE.Group[] = [];
    const hinges: THREE.Mesh[] = [];
    let currentParent: THREE.Group = wingRoot;
    let anchorOffset = xSign * 0.24;

    const panelWidth = 0.55;
    const panelHeight = 0.74;

    for (let p = 0; p < 4; p++) {
      const joint = new THREE.Group();
      joint.position.set(anchorOffset, 0, 0);

      // Panel Frame & Double-Sided Photovoltaic Cells
      const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.016, panelHeight), carbonMat);
      frameMesh.position.set(xSign * (panelWidth / 2), 0, 0);

      const cellMesh = new THREE.Mesh(new THREE.BoxGeometry(panelWidth - 0.03, 0.02, panelHeight - 0.04), solarPanelMat);
      cellMesh.position.set(xSign * (panelWidth / 2), 0, 0);

      // Chrome Interconnected Knuckle Hinge at Folding Seam
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, panelHeight + 0.02, 12), chromeMat);
      hinge.rotation.x = Math.PI / 2;

      joint.add(frameMesh, cellMesh, hinge);
      currentParent.add(joint);
      joints.push(joint);
      hinges.push(hinge);

      currentParent = joint;
      anchorOffset = xSign * panelWidth;
    }

    wingRoot.scale.set(0.01, 1, 0.01);
    return { wingRoot, joints, hinges };
  };

  const wingL = buildOrigamiWing(-1);
  const wingR = buildOrigamiWing(1);
  const solarWingLeft = wingL.wingRoot;
  const solarWingRight = wingR.wingRoot;
  busGroup.add(solarWingLeft, solarWingRight);

  // 5. Cold-Gas RCS Thruster Nozzles (Bottom & Lateral Sides)
  const bottom1 = createRcsVaporMesh(1.5, 0.15);
  bottom1.position.set(-0.25, -0.85, 0.0);
  bottom1.rotation.z = Math.PI;

  const bottom2 = createRcsVaporMesh(1.5, 0.15);
  bottom2.position.set(0.25, -0.85, 0.0);
  bottom2.rotation.z = Math.PI;

  const sideLeft = createRcsVaporMesh(1.2, 0.12);
  sideLeft.position.set(-0.48, 0.35, 0.0);
  sideLeft.rotation.z = Math.PI / 2;

  const sideRight = createRcsVaporMesh(1.2, 0.12);
  sideRight.position.set(0.48, 0.35, 0.0);
  sideRight.rotation.z = -Math.PI / 2;

  busGroup.add(bottom1, bottom2, sideLeft, sideRight);

  const rcsLight = new THREE.PointLight(0xffffff, 0, 10);
  rcsLight.position.set(0, -0.5, 0);
  if (!isGhost) busGroup.add(rcsLight);

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
    antennaGimbal,
    magnetometerBoom,
    nozzles: { bottom1, bottom2, sideLeft, sideRight },
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
      const f = Math.max(0, Math.min(1.0, deployPct / 100));

      // 1. Clamshell Fairing Nosecone Shell swings open (0 -> 94 degrees)
      fairingDoorLeft.rotation.z = -f * 1.64;
      fairingDoorRight.rotation.z = f * 1.64;

      // Hydraulic Piston Rod Kinematic Extension & Rotation
      const pistonExtension = 1.0 + f * 0.65;
      hydraulicPistonL.scale.set(1, pistonExtension, 1);
      hydraulicPistonL.rotation.z = -0.55 - f * 0.62;
      hydraulicPistonR.scale.set(1, pistonExtension, 1);
      hydraulicPistonR.rotation.z = 0.55 + f * 0.62;

      // 2. Telescoping Magnetometer Boom extends forward
      const boomScaleY = 0.05 + f * 0.95;
      magnetometerBoom.scale.set(1, boomScaleY, 1);

      // 3. High-Gain Dish Pantograph Linkage articulates upward
      const dishScale = 0.1 + f * 0.9;
      antennaGimbal.scale.set(dishScale, dishScale, dishScale);
      antennaGimbal.rotation.x = f * 0.45;

      // 4. Interconnected Kinematic Origami Accordion Solar Wings Unfolding
      solarWingLeft.scale.set(Math.max(0.01, f), 1, Math.min(1.0, 0.05 + f * 0.95));
      solarWingRight.scale.set(Math.max(0.01, f), 1, Math.min(1.0, 0.05 + f * 0.95));

      // Alternating accordion folding angles: fold angle shrinks to 0 as f -> 1.0
      const foldMag = (1.0 - f);
      const foldAngles = [-1.48, 2.92, -2.92, 2.92];

      for (let i = 0; i < 4; i++) {
        const jointL = wingL.joints[i];
        const jointR = wingR.joints[i];
        if (jointL) jointL.rotation.y = foldAngles[i] * foldMag;
        if (jointR) jointR.rotation.y = -foldAngles[i] * foldMag;
      }
    },
    getActiveNozzleEmitters(t: ThrusterActivation): NozzleEmitterDescriptor[] {
      const bVal = t.podRcsBottom ?? (t.rearBoost > 0.1 ? t.rearBoost : 0);
      const lVal = t.podRcsLateral ?? Math.abs(t.lateralLeft - t.lateralRight);
      const emitters: NozzleEmitterDescriptor[] = [];

      if (bVal > 0.05) {
        emitters.push(
          { id: 'podBottom1', localOffset: new THREE.Vector3(-0.25, -0.85, 0), localDirection: new THREE.Vector3(0, -1, 0), intensity: bVal },
          { id: 'podBottom2', localOffset: new THREE.Vector3(0.25, -0.85, 0), localDirection: new THREE.Vector3(0, -1, 0), intensity: bVal }
        );
      }
      if (lVal > 0.05 || t.lateralLeft > 0.05 || t.lateralRight > 0.05) {
        emitters.push(
          { id: 'podSideLeft', localOffset: new THREE.Vector3(-0.48, 0.35, 0), localDirection: new THREE.Vector3(-1, 0, 0), intensity: t.lateralLeft || lVal },
          { id: 'podSideRight', localOffset: new THREE.Vector3(0.48, 0.35, 0), localDirection: new THREE.Vector3(1, 0, 0), intensity: t.lateralRight || lVal }
        );
      }
      return emitters;
    },
  };
}
