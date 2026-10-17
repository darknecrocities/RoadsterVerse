import * as THREE from 'three';
import type { MissionId, RigidBodyState, ThrusterActivation } from '../types/simulation.ts';
import { ROADSTER_RACE_OBSTACLES } from '../physics/aerodynamicsAndRace.ts';
import { createCarbonWeaveTexture, createPaddockDeckTexture } from './proceduralTextures.ts';

export interface StarbasePadAndCraneRig {
  group: THREE.Group;
  chopstickLeftMesh: THREE.Mesh;
  chopstickRightMesh: THREE.Mesh;
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

  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x262626,
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

  for (const obs of ROADSTER_RACE_OBSTACLES) {
    const obsGroup = new THREE.Group();
    const widthX = obs.halfWidthX * 2;
    const spanZ = obs.maxZ - obs.minZ;
    const centerZ = (obs.minZ + obs.maxZ) * 0.5;

    if (obs.type === 'lane-barrier') {
      // Concrete & Carbon Jersey Chicane Barrier blocking one lane
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(widthX, obs.heightY, spanZ),
        barrierMat
      );
      block.position.set(obs.x, obs.heightY * 0.5, centerZ);
      obsGroup.add(block);

      // Top high-contrast white hazard beacon bar
      const topBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(widthX * 1.02, 0.09, spanZ * 0.98),
        laserMat
      );
      topBeacon.position.set(obs.x, obs.heightY + 0.045, centerZ);
      obsGroup.add(topBeacon);

      // Diagonal monochrome warning stripes on the approach face (-X)
      for (let s = -1; s <= 1; s++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, obs.heightY * 0.65, 0.22),
          stripeMat
        );
        stripe.position.set(
          obs.x - obs.halfWidthX - 0.015,
          obs.heightY * 0.5,
          centerZ + s * (spanZ * 0.28)
        );
        stripe.rotation.x = 0.35;
        obsGroup.add(stripe);
      }
    } else {
      // Obstacle #3: Full-Width Concrete & High-Voltage Laser Jump Wall (height = 1.05m)
      const lowerWallH = obs.heightY * 0.52;
      const lowerWall = new THREE.Mesh(
        new THREE.BoxGeometry(widthX, lowerWallH, spanZ),
        barrierMat
      );
      lowerWall.position.set(obs.x, lowerWallH * 0.5, centerZ);
      obsGroup.add(lowerWall);

      // Left & Right Emitter Pylons at track edges
      for (const zEdge of [obs.minZ + 0.12, obs.maxZ - 0.12]) {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, obs.heightY + 0.12, 12),
          pylonMat
        );
        pylon.position.set(obs.x, (obs.heightY + 0.12) * 0.5, zEdge);
        obsGroup.add(pylon);
      }

      // 3 Horizontal High-Contrast White Laser Beams across the full width up to obs.heightY
      for (const fracY of [0.68, 0.84, 0.98]) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, spanZ - 0.2, 10),
          laserMat
        );
        beam.rotation.x = Math.PI / 2;
        beam.position.set(obs.x, obs.heightY * fracY, centerZ);
        obsGroup.add(beam);
      }
    }

    group.add(obsGroup);
  }

  // Finish-Line Monochrome Gantry Arch at x = 8.8m
  const finishX = 8.8;
  for (const zPillar of [-2.45, 2.45]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.6, 0.22), pylonMat);
    pillar.position.set(finishX, 1.8, zPillar);
    group.add(pillar);
  }
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 5.15), barrierMat);
  archBeam.position.set(finishX, 3.65, 0);
  const archLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 4.9), laserMat);
  archLight.position.set(finishX, 3.45, 0);
  group.add(archBeam, archLight);

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

  // 6. Articulated Mechazilla Chopstick Catch Arms flanking the rocket hull (z = +/-0.92m)
  const chopstickLeftMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.28, 0.24),
    brightSteelMat
  );
  chopstickLeftMesh.position.set(1.85, 5.6, 0.92);
  const chopstickRightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.28, 0.24),
    brightSteelMat
  );
  chopstickRightMesh.position.set(1.85, 5.6, -0.92);
  towerGroup.add(chopstickLeftMesh, chopstickRightMesh);

  group.add(towerGroup);
  group.visible = false;

  return {
    group,
    chopstickLeftMesh,
    chopstickRightMesh,
    craneBoomPivot,
    craneHoistCable,
    qdArmPivot,
  };
}

/**
 * Animates the Starbase Launch Crane Slew, Winch Cable Retraction, QD Umbilical Arm Swing,
 * and Chopstick Catch Arms during Starship launch-off and landing.
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

  // 3. Chopstick Catch Arms open wide for launch clearance, then close to catch Booster/Starship
  const armSpread = isTwoStageMission
    ? !isSeparated
      ? heightAbovePad > 0.4
        ? 0.44
        : 0.08
      : missionId === 'starship-booster-catch'
        ? Math.max(0.0, Math.min(0.38, (primaryState.position.y - 2.4) * 0.055))
        : 0.36
    : Math.max(0, Math.min(0.38, (primaryState.position.y - 3.0) * 0.055));

  rig.chopstickLeftMesh.rotation.y = armSpread;
  rig.chopstickRightMesh.rotation.y = -armSpread;
}
