import * as THREE from 'three';
import type { MissionId, RigidBodyState, ThrusterActivation } from '../types/simulation.ts';
import { ROADSTER_RACE_OBSTACLES } from '../physics/aerodynamicsAndRace.ts';
import {
  createCarbonWeaveTexture,
  createPaddockDeckTexture,
  createStuntRoadTexture,
} from './proceduralTextures.ts';

export interface StarbasePadAndCraneRig {
  group: THREE.Group;
  chopstickLeftMesh: THREE.Mesh;
  chopstickRightMesh: THREE.Mesh;
  chopstickLeftPivot: THREE.Group;
  chopstickRightPivot: THREE.Group;
  craneBoomPivot: THREE.Group;
  craneHoistCable: THREE.Mesh;
  qdArmPivot: THREE.Group;
}

/**
 * Builds the 3D Roadster Obstacle Gauntlet Course (Stunt 04: `roadster-obstacle-race`).
 * Matches the exact AABB coordinates in `ROADSTER_RACE_OBSTACLES` with zero overlapping geometry.
 */
export function buildObstacleCourseGroup(): THREE.Group {
  const group = new THREE.Group();
  const carbonTex = createCarbonWeaveTexture();
  const roadTex = createStuntRoadTexture();

  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    map: carbonTex,
    roughness: 0.38,
    metalness: 0.58,
  });
  const pylonMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d4,
    roughness: 0.25,
    metalness: 0.82,
  });
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
  });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe5e5e5 });
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    map: roadTex,
    roughness: 0.55,
    metalness: 0.25,
  });

  // 1. Wide 24m x 1050m Super-Highway Asphalt Surface (10km Proving Ground)
  const highway = new THREE.Mesh(new THREE.BoxGeometry(1050, 0.04, 24), roadMat);
  highway.position.set(500, 0.02, 0);
  group.add(highway);

  // Highway Shoulder Barriers with Reflective Beacons (z = +/-12.2m)
  for (const zSide of [-12.2, 12.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1050, 0.45, 0.25), barrierMat);
    rail.position.set(500, 0.26, zSide);
    group.add(rail);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(1050, 0.06, 0.08), laserMat);
    strip.position.set(500, 0.5, zSide);
    group.add(strip);
  }

  // Lane Divider Dashes (4 Lanes: z = -3.5m, 0m, +3.5m)
  for (const zLane of [-3.5, 0, 3.5]) {
    for (let x = 10; x < 1000; x += 18) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.18), stripeMat);
      dash.position.set(x, 0.045, zLane);
      group.add(dash);
    }
  }

  // 2. Obstacles and Cyber-Drone Vehicles along the 10km Course
  for (const obs of ROADSTER_RACE_OBSTACLES) {
    const obsGroup = new THREE.Group();
    const widthX = obs.halfWidthX * 2;
    const spanZ = obs.maxZ - obs.minZ;
    const centerZ = (obs.minZ + obs.maxZ) * 0.5;

    if (obs.type === 'drone-vehicle') {
      // Autonomous Cyber-Drone Pace Vehicle in Lane 3
      const droneBody = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.62, 2.3), barrierMat);
      droneBody.position.set(obs.x, 0.48, centerZ);
      obsGroup.add(droneBody);

      const droneCab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 1.8), pylonMat);
      droneCab.position.set(obs.x - 0.2, 0.88, centerZ);
      obsGroup.add(droneCab);

      const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12), laserMat);
      lidar.position.set(obs.x - 0.2, 1.18, centerZ);
      obsGroup.add(lidar);

      for (const dx of [-1.3, 1.3]) {
        for (const dz of [-1.15, 1.15]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16), barrierMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(obs.x + dx, 0.38, centerZ + dz);
          obsGroup.add(wheel);
        }
      }

      const frontLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.6), laserMat);
      frontLight.position.set(obs.x + 2.22, 0.45, centerZ);
      const rearLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.6), stripeMat);
      rearLight.position.set(obs.x - 2.22, 0.52, centerZ);
      obsGroup.add(frontLight, rearLight);
    } else if (obs.type === 'lane-barrier') {
      // Heavy Concrete & Carbon Jersey Chicane Barrier
      const block = new THREE.Mesh(new THREE.BoxGeometry(widthX, obs.heightY, spanZ), barrierMat);
      block.position.set(obs.x, obs.heightY * 0.5, centerZ);
      obsGroup.add(block);

      const topBeacon = new THREE.Mesh(new THREE.BoxGeometry(widthX * 1.02, 0.09, spanZ * 0.98), laserMat);
      topBeacon.position.set(obs.x, obs.heightY + 0.045, centerZ);
      obsGroup.add(topBeacon);

      for (let s = -1; s <= 1; s++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, obs.heightY * 0.65, 0.35), stripeMat);
        stripe.position.set(obs.x - obs.halfWidthX - 0.02, obs.heightY * 0.5, centerZ + s * (spanZ * 0.28));
        stripe.rotation.x = 0.35;
        obsGroup.add(stripe);
      }
    } else {
      // Full-Width Laser Wall (height = 1.2m, span = 24m)
      const lowerWallH = obs.heightY * 0.45;
      const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(widthX, lowerWallH, spanZ), barrierMat);
      lowerWall.position.set(obs.x, lowerWallH * 0.5, centerZ);
      obsGroup.add(lowerWall);

      for (const zEdge of [obs.minZ + 0.15, obs.maxZ - 0.15]) {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, obs.heightY + 0.25, 12), pylonMat);
        pylon.position.set(obs.x, (obs.heightY + 0.25) * 0.5, zEdge);
        obsGroup.add(pylon);
      }

      for (const fracY of [0.65, 0.85, 1.0]) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, spanZ - 0.3, 10), laserMat);
        beam.rotation.x = Math.PI / 2;
        beam.position.set(obs.x, obs.heightY * fracY, centerZ);
        obsGroup.add(beam);
      }
    }

    group.add(obsGroup);
  }

  // 3. Milestone & Finish Line Gantries across the 10km Super-Highway
  const gantries = [250, 500, 750, 1000];
  for (const gx of gantries) {
    const isFinish = gx === 1000;
    for (const zPillar of [-12.5, 12.5]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, isFinish ? 5.8 : 4.8, 0.35), pylonMat);
      pillar.position.set(gx, (isFinish ? 5.8 : 4.8) * 0.5, zPillar);
      group.add(pillar);
    }
    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 25.4), barrierMat);
    archBeam.position.set(gx, isFinish ? 5.8 : 4.8, 0);
    const archLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 24.8), laserMat);
    archLight.position.set(gx, isFinish ? 5.55 : 4.55, 0);
    group.add(archBeam, archLight);

    if (isFinish) {
      const checkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const finishGrid = new THREE.Mesh(new THREE.PlaneGeometry(6, 24, 6, 24), checkMat);
      finishGrid.rotation.x = -Math.PI / 2;
      finishGrid.position.set(gx, 0.048, 0);
      group.add(finishGrid);
    }
  }

  group.visible = false;
  return group;
}

/**
 * Builds the Non-Overlapping SpaceX Orbital Launch Mount (OLM) Rocket Pad, Water-Cooled
 * Flame Diverter, Mechazilla Integration Tower (at x = -2.85m so it never overlaps the rocket hull),
 * Retractable Quick-Disconnect (QD) Arm, Chopstick Catch Arms, and Slewing Top Hammerhead Crane.
 */
export function buildArticulatedStarbasePadAndCrane(): StarbasePadAndCraneRig {
  const group = new THREE.Group();
  const paddockTex = createPaddockDeckTexture();

  const paddockPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({
      map: paddockTex,
      bumpMap: paddockTex,
      bumpScale: 0.02,
      roughness: 0.75,
    })
  );
  paddockPlane.rotation.x = -Math.PI / 2;
  group.add(paddockPlane);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x404040,
    metalness: 0.78,
    roughness: 0.28,
  });
  const brightSteelMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d4,
    metalness: 0.85,
    roughness: 0.2,
  });
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 1. Orbital Launch Mount (OLM) Rocket Pad at (0, 0..1.35m, 0)
  // Water-cooled steel plate & flame diverter cone under the pad
  const delugePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.85, 0.14, 24),
    steelMat
  );
  delugePlate.position.set(0, 0.07, 0);
  const diverterCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.48, 20),
    brightSteelMat
  );
  diverterCone.position.set(0, 0.36, 0);
  group.add(delugePlate, diverterCone);

  // Elevated Circular Launch Ring Table at y = 1.35m (inner clearance > 0.72m for 0.68m booster)
  const olmRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.22, 16, 32), steelMat);
  olmRing.rotation.x = Math.PI / 2;
  olmRing.position.set(0, 1.35, 0);
  group.add(olmRing);

  // 6 Support Pillars & 6 Outer Hold-Down Clamp Blocks (at r = 0.96m, zero hull overlap)
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.19, 1.35, 12),
      brightSteelMat
    );
    leg.position.set(Math.cos(a) * 1.15, 0.675, Math.sin(a) * 1.15);
    group.add(leg);

    const clampBlock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), brightSteelMat);
    clampBlock.position.set(Math.cos(a) * 0.96, 1.48, Math.sin(a) * 0.96);
    group.add(clampBlock);
  }

  // 2. Cryo Propellant Tank Farm well clear at x = -8.2m
  for (let t = 0; t < 4; t++) {
    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 4.2, 20),
      brightSteelMat
    );
    silo.position.set(-8.2, 2.1, -4.5 + t * 2.4);
    group.add(silo);
  }

  // 3. Mechazilla Integration Tower placed at x = -2.85m (zero overlap with rocket at x = 0)
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-2.85, 0, 0);

  const towerCore = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 22.0, 1.35),
    new THREE.MeshStandardMaterial({
      color: 0x262626,
      metalness: 0.75,
      roughness: 0.3,
      wireframe: true,
    })
  );
  towerCore.position.y = 11.0;
  towerGroup.add(towerCore);

  for (const cx of [-0.65, 0.65]) {
    for (const cz of [-0.65, 0.65]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 22.0, 0.16), steelMat);
      col.position.set(cx, 11.0, cz);
      towerGroup.add(col);
    }
  }

  // 4. Retractable Quick-Disconnect (QD) Umbilical Arm pivoted at tower face (x = +0.65, y = 6.2)
  const qdArmPivot = new THREE.Group();
  qdArmPivot.position.set(0.65, 6.2, -0.65);
  const qdArmMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.32), steelMat);
  qdArmMesh.position.set(0.68, 0, 0);
  qdArmPivot.add(qdArmMesh);
  towerGroup.add(qdArmPivot);

  // 5. Slewing Top Hammerhead Crane Boom + Winch Hoist Cable pivoted at tower apex (y = 22.25m)
  const craneBoomPivot = new THREE.Group();
  craneBoomPivot.position.set(0, 22.25, 0);

  const craneMainBeam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.65, 1.35), brightSteelMat);
  craneMainBeam.position.set(1.65, 0, 0);
  const craneLedStrip = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.08, 1.4), whiteLedMat);
  craneLedStrip.position.set(1.65, 0.37, 0);
  const mastApex = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), steelMat);
  mastApex.position.set(-0.2, 1.15, 0);
  const tieCable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.8, 8), whiteLedMat);
  tieCable.position.set(1.55, 1.05, 0);
  tieCable.rotation.z = 0.98;

  // Hoist cable geometry translated so top is at y = 0 and scaling y winches the hook up cleanly
  const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.4, 8);
  cableGeo.translate(0, -2.2, 0);
  const craneHoistCable = new THREE.Mesh(cableGeo, brightSteelMat);
  craneHoistCable.position.set(2.85, -0.32, 0);

  craneBoomPivot.add(craneMainBeam, craneLedStrip, mastApex, tieCable, craneHoistCable);
  towerGroup.add(craneBoomPivot);

  // 6. Articulated Mechazilla Chopstick Catch Arms & Crane Hands at world height y = 6.6m
  const carriageGroup = new THREE.Group();
  carriageGroup.position.set(0.68, 6.6, 0);

  const carriageCollar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 1.7), steelMat);
  carriageCollar.position.set(-0.16, 0, 0);
  carriageGroup.add(carriageCollar);

  const chopstickLeftPivot = new THREE.Group();
  chopstickLeftPivot.position.set(0, 0, 0.74);
  const chopstickRightPivot = new THREE.Group();
  chopstickRightPivot.position.set(0, 0, -0.74);

  function createCraneArm(zSign: number) {
    const armGroup = new THREE.Group();

    // Main longitudinal steel box boom extending from tower face towards x = 0
    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 0.16), brightSteelMat);
    boomMesh.position.set(1.7, 0, 0);

    // Inner catch rail shelf positioned directly under the booster catch pins
    const catchRail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.18), steelMat);
    catchRail.position.set(2.1, 0.08, -zSign * 0.12);

    // Forward claw hook / crane hand end-stop to retain the booster pin
    const clawHook = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), brightSteelMat);
    clawHook.position.set(2.45, 0.18, -zSign * 0.12);

    // High-contrast alignment marker LED strip along the crane hand
    const handLed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.04), whiteLedMat);
    handLed.position.set(2.1, 0.16, -zSign * 0.2);

    armGroup.add(boomMesh, catchRail, clawHook, handLed);
    return { boomMesh, armGroup };
  }

  const leftArm = createCraneArm(1);
  const rightArm = createCraneArm(-1);

  chopstickLeftPivot.add(leftArm.armGroup);
  chopstickRightPivot.add(rightArm.armGroup);
  carriageGroup.add(chopstickLeftPivot, chopstickRightPivot);
  towerGroup.add(carriageGroup);

  group.add(towerGroup);
  group.visible = false;

  return {
    group,
    chopstickLeftMesh: leftArm.boomMesh,
    chopstickRightMesh: rightArm.boomMesh,
    chopstickLeftPivot,
    chopstickRightPivot,
    craneBoomPivot,
    craneHoistCable,
    qdArmPivot,
  };
}

/**
 * Animates the Starbase Launch Crane Slew, Winch Cable Retraction, QD Umbilical Arm Swing,
 * and Chopstick Catch Arms during Starship launch-off and mid-air catch landing.
 */
export function updateStarbasePadAndCraneAnimation(
  rig: StarbasePadAndCraneRig,
  missionId: MissionId,
  primaryState: RigidBodyState,
  primaryThrusters: ThrusterActivation
): void {
  const isTwoStageMission =
    missionId === 'starship-launch' || missionId === 'starship-booster-catch';
  const isSeparated = primaryThrusters.hotStageSeparated;
  const heightAbovePad = Math.max(0, primaryState.position.y - 1.35);

  // 1. Slewing Hammerhead Crane Boom & Winch Hoist Cable:
  // As the rocket lifts off (heightAbovePad > 0.1m), the crane winches its cable up and slews 32 deg aside!
  const launchProgress = isTwoStageMission
    ? isSeparated
      ? 1.0
      : Math.max(0, Math.min(1, heightAbovePad / 3.5))
    : 1.0;

  rig.craneBoomPivot.rotation.y = launchProgress * 0.56; // Slews ~32 deg clear of the launch corridor
  rig.craneHoistCable.scale.y = Math.max(0.12, 1.0 - launchProgress * 0.88); // Winches hook upward

  // 2. Quick-Disconnect (QD) Umbilical Arm swings back away from rocket hull on liftoff
  rig.qdArmPivot.rotation.y = -launchProgress * 0.72;

  // 3. Articulated Chopstick Crane Arms & Hands open wide for launch, then clamp to catch in mid-air
  const armSpread = isTwoStageMission
    ? !isSeparated
      ? heightAbovePad > 0.4
        ? 0.38
        : 0.08
      : missionId === 'starship-booster-catch'
        ? Math.max(0.0, Math.min(0.32, (primaryState.position.y - 2.6) * 0.065))
        : 0.32
    : Math.max(0.0, Math.min(0.32, (primaryState.position.y - 3.0) * 0.065));

  rig.chopstickLeftPivot.rotation.y = armSpread;
  rig.chopstickRightPivot.rotation.y = -armSpread;
}
