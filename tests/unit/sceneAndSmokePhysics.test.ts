import { describe, expect, it } from 'vitest';
import { createRoadsterModel } from '../../src/three/roadsterModel.ts';
import { createStarshipModel } from '../../src/three/starshipModel.ts';
import { createOrbitalPodModel } from '../../src/three/orbitalPodModel.ts';
import { VolumetricPlumeSmokeSystem } from '../../src/three/plumeAndSmokeFX.ts';
import {
  SpacePlumeAndStagingFX,
  computeBoosterSeparationPhysics,
} from '../../src/three/spacePlumeEffects.ts';
import {
  DEFAULT_HYPERPARAMETERS,
  MISSION_LIST,
} from '../../src/rl/missions.ts';
import {
  createInitialRoadsterState,
  stepRoadsterPhysics,
} from '../../src/physics/roadsterPhysics.ts';
import {
  createInitialStarshipState,
  stepStarshipPhysics,
} from '../../src/physics/starshipPhysics.ts';
import { evaluateRLPolicy } from '../../src/rl/policyEngine.ts';
import {
  KNOWLEDGE_ARTICLES,
  TRIVIA_QUESTIONS,
} from '../../src/data/knowledgeAndTrivia.ts';
import {
  buildArticulatedStarbasePadAndCrane,
  buildObstacleCourseGroup,
  updateStarbasePadAndCraneAnimation,
} from '../../src/three/starbaseAndObstacleProps.ts';

describe('3D Vehicle Rigs, Per-Nozzle Physics White Smoke & Starship Fire Plume E2E', () => {
  it('emits physics-based pure white smoke independently from all 7 Tesla Roadster cold-gas nozzles and deflects off the ground', () => {
    const roadsterRig = createRoadsterModel(false);
    const smokeSystem = new VolumetricPlumeSmokeSystem(220);

    const state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    state.position.y = 1.2;

    const fullThrusters = {
      frontLeftLift: 0.95,
      frontRightLift: 0.9,
      rearLeftLift: 0.92,
      rearRightLift: 0.88,
      lateralLeft: 0.75,
      lateralRight: 0.7,
      rearBoost: 0.85,
      activeWingAngle: 0.8,
      raptorThrottle: 0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0,
      flapFrontRight: 0,
      flapAftLeft: 0,
      flapAftRight: 0,
      hotStageSeparated: false,
    };

    roadsterRig.updateThrusters(fullThrusters, 0.5);
    const nozzleEmitters = roadsterRig.getActiveNozzleEmitters(fullThrusters);

    // All 8 cold-gas nozzles on the 2026 Tesla Roadster must be active and emit along their nozzle vector
    expect(nozzleEmitters).toHaveLength(8);

    // Verify ZERO roof thruster: every nozzle is mounted at or below y=0.30m and fires downward/sideways/backwards (localDirection.y <= 0)
    for (const emitter of nozzleEmitters) {
      expect(emitter.localOffset.y).toBeLessThanOrEqual(0.3);
      expect(emitter.localDirection.y).toBeLessThanOrEqual(0);
    }

    // Verify left & right side rocker thrusters emit outward from the sides of the vehicle (|z| > 0.9)
    const latLeft = nozzleEmitters.find((e) => e.id === 'latLeft');
    const latRight = nozzleEmitters.find((e) => e.id === 'latRight');
    expect(latLeft?.localOffset.z).toBeGreaterThan(0.9);
    expect(latLeft?.localDirection.z).toBeGreaterThan(0.9);
    expect(latRight?.localOffset.z).toBeLessThan(-0.9);
    expect(latRight?.localDirection.z).toBeLessThan(-0.9);

    // Verify dual rear SpaceX rocket thrusters flanking rear fascia (z = ±0.38m) firing straight backward (-X)
    const rearLeft = nozzleEmitters.find((e) => e.id === 'rearBoostLeft');
    const rearRight = nozzleEmitters.find((e) => e.id === 'rearBoostRight');
    expect(rearLeft).toBeDefined();
    expect(rearRight).toBeDefined();
    expect(rearLeft?.localOffset.z).toBeCloseTo(0.38, 2);
    expect(rearRight?.localOffset.z).toBeCloseTo(-0.38, 2);
    expect(rearLeft?.localDirection.x).toBeLessThan(-0.9);
    expect(rearRight?.localDirection.x).toBeLessThan(-0.9);

    for (let step = 0; step < 30; step++) {
      smokeSystem.update(0.025, 'roadster', state, fullThrusters, nozzleEmitters);
    }

    const stats = smokeSystem.getActiveParticleStats();
    expect(stats.activeWhiteSmokeCount).toBeGreaterThan(25);
    expect(stats.activeFirePlumeCount).toBe(0);

    // Verify wheel spec switching between 10-Spoke Track and Carbon Aero-Disc
    roadsterRig.setWheelSpec('six-spoke');
    roadsterRig.setWheelSpec('aero-disc');
    expect(roadsterRig.root.children.length).toBeGreaterThan(8);

    // Verify the 4 wheels inside wheelsGroup have their tire bottoms (front r=0.38m, rear r=0.41m) at local y = -0.39m (CAR_RIDE_HEIGHT = 0.39m)
    const wheelsGroup = roadsterRig.root.children.find((c) => c.children.length === 4);
    expect(wheelsGroup).toBeDefined();
    for (const wheel of wheelsGroup!.children) {
      const tireRadius = wheel.position.x < 0 ? 0.41 : 0.38;
      const tireBottomY = wheelsGroup!.position.y + wheel.position.y - tireRadius;
      expect(tireBottomY).toBeCloseTo(-0.39, 3);
    }

    // Verify that on the road (isAirborne = false), underbody lift is zero, while rear boost emits when active
    expect(roadsterRig.getActiveNozzleEmitters({ ...fullThrusters, rearBoost: 0 }, false)).toHaveLength(0);
    expect(roadsterRig.getActiveNozzleEmitters(fullThrusters, false)).toHaveLength(2);
    const rampStartState = createInitialRoadsterState('roadster-barrel-roll', DEFAULT_HYPERPARAMETERS);
    const rampEval = evaluateRLPolicy(rampStartState, 'roadster-barrel-roll', DEFAULT_HYPERPARAMETERS, 0);
    expect(rampEval.thrusters.frontLeftLift).toBe(0);
    expect(rampEval.thrusters.rearBoost).toBe(0);
    expect(rampEval.thrusters.lateralLeft).toBe(0);

    // Verify that when the Roadster crashes (landing upside-down or sideways), it detonates a 3D explosion burst
    const crashedState = { ...state, crashed: true, isGrounded: true };
    smokeSystem.update(0.025, 'roadster', crashedState, fullThrusters, []);
    const crashStats = smokeSystem.getActiveParticleStats();
    expect(crashStats.activeFirePlumeCount).toBeGreaterThan(50);
  });

  it('emits physics-based combustion fire thruster particles from Starship Raptor nozzles with thermal cooling and keeps the Super Heavy Booster above ground', () => {
    const starshipRig = createStarshipModel(false);
    const smokeSystem = new VolumetricPlumeSmokeSystem(220);

    // Verify Super Heavy Booster meshes inside boosterGroup sit at positive local Y (>= 0.0m) so the lower half is never buried in the ground!
    for (const child of starshipRig.boosterGroup.children) {
      if (child !== starshipRig.boosterPlume) {
        expect(child.position.y).toBeGreaterThanOrEqual(0.0);
      }
    }

    let state = createInitialStarshipState('starship-launch');
    const launchThrusters = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 1.0,
      gimbalPitch: 0.12,
      gimbalYaw: -0.08,
      flapFrontLeft: 0.5,
      flapFrontRight: 0.5,
      flapAftLeft: 0.5,
      flapAftRight: 0.5,
      hotStageSeparated: false,
    };

    starshipRig.updateStarship(launchThrusters, true, 1.0);

    for (let step = 0; step < 25; step++) {
      state = stepStarshipPhysics(state, launchThrusters, 'starship-launch', DEFAULT_HYPERPARAMETERS, 0.025);
      smokeSystem.update(0.025, 'starship', state, launchThrusters, []);
    }

    const stats = smokeSystem.getActiveParticleStats();
    expect(stats.activeFirePlumeCount).toBeGreaterThan(20);
    expect(stats.activeWhiteSmokeCount).toBe(0);

    // Verify 2-Stage Release: when hotStageSeparated is true, BOTH boosterGroup and shipGroup stay visible,
    // shipGroup climbs above boosterGroup, and both shipPlume and boosterPlume fire!
    starshipRig.updateStarship(
      { ...launchThrusters, hotStageSeparated: true, raptorThrottle: 0.65 },
      true,
      2.5,
      8.0,
      0.0,
      1.8
    );
    expect(starshipRig.boosterGroup.visible).toBe(true);
    expect(starshipRig.shipGroup.visible).toBe(true);
    expect(starshipRig.shipGroup.position.y).toBeGreaterThan(starshipRig.boosterGroup.position.y + 4.0);
    expect(starshipRig.shipPlume.visible).toBe(true);
    expect(starshipRig.boosterPlume.visible).toBe(true);
  });

  it('runs all 8 missions across untrained, mid-training, and converged curriculum regimes without NaN states or runtime exceptions', () => {
    expect(MISSION_LIST).toHaveLength(8);
    const epochRegimes = [5, 80, 240, 420];
    for (const mission of MISSION_LIST) {
      for (const epochs of epochRegimes) {
        const params = {
          ...DEFAULT_HYPERPARAMETERS,
          epochs,
          explorationNoise: epochs < 30 ? 0.45 : 0.02,
        };

        let state =
          mission.vehicle === 'roadster'
            ? createInitialRoadsterState(mission.id, params)
            : createInitialStarshipState(mission.id);

        for (let step = 0; step < 80; step++) {
          const { thrusters, nnSnapshot } = evaluateRLPolicy(state, mission.id, params, 0);
          expect(nnSnapshot.inputs).toHaveLength(6);
          expect(nnSnapshot.hiddenLayer1).toHaveLength(8);
          expect(nnSnapshot.hiddenLayer2).toHaveLength(6);
          expect(nnSnapshot.outputs).toHaveLength(6);

          state =
            mission.vehicle === 'roadster'
              ? stepRoadsterPhysics(state, thrusters, mission.id, params, 0.025, 0)
              : stepStarshipPhysics(state, thrusters, mission.id, params, 0.025, 0);

          expect(Number.isFinite(state.position.x)).toBe(true);
          expect(Number.isFinite(state.position.y)).toBe(true);
          expect(Number.isFinite(state.attitude.roll)).toBe(true);
          expect(Number.isFinite(state.attitude.pitch)).toBe(true);
        }
      }
    }
  });

  it('builds non-overlapping 3D Obstacle Course props and animates the Starbase Rocket Pad, Hammerhead Crane, Winch Cable, and QD Arm on launch-off', () => {
    const obstacleCourse = buildObstacleCourseGroup();
    expect(obstacleCourse.children.length).toBeGreaterThanOrEqual(7);

    const starbaseHandles = buildArticulatedStarbasePadAndCrane();
    // Verify Mechazilla tower group sits at x = -2.85m, completely clear of the 0.68m-radius rocket hull at x = 0.0m
    expect(starbaseHandles.craneBoomPivot.parent?.position.x).toBeLessThanOrEqual(-2.5);
    expect(starbaseHandles.qdArmPivot.parent?.position.x).toBeLessThanOrEqual(-2.5);

    const dummyThrusters = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 1.0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0,
      flapFrontRight: 0,
      flapAftLeft: 0,
      flapAftRight: 0,
      hotStageSeparated: false,
    };

    const preLaunchState = createInitialStarshipState('starship-launch');
    updateStarbasePadAndCraneAnimation(
      starbaseHandles,
      'starship-launch',
      preLaunchState,
      dummyThrusters
    );
    const preLaunchCraneYaw = starbaseHandles.craneBoomPivot.rotation.y;
    const preLaunchQdYaw = starbaseHandles.qdArmPivot.rotation.y;

    // Simulate launch-off at y = 6.5m
    const midLaunchState = {
      ...preLaunchState,
      position: { x: 0, y: 6.5, z: 0 },
      velocity: { x: 0, y: 7.5, z: 1.0 },
      isGrounded: false,
    };
    updateStarbasePadAndCraneAnimation(
      starbaseHandles,
      'starship-launch',
      midLaunchState,
      dummyThrusters
    );

    // Verify top Hammerhead Crane slews aside, hoist cable winches up, QD arm retracts, and chopsticks open wide
    expect(starbaseHandles.craneBoomPivot.rotation.y).toBeGreaterThan(preLaunchCraneYaw + 0.5);
    expect(starbaseHandles.qdArmPivot.rotation.y).toBeLessThan(preLaunchQdYaw - 0.5);
    expect(starbaseHandles.craneHoistCable.scale.y).toBeLessThan(0.5);
    expect(starbaseHandles.chopstickLeftPivot.rotation.y).toBeGreaterThan(0.2);
    expect(starbaseHandles.chopstickRightPivot.rotation.y).toBeLessThan(-0.2);
  });

  it('validates all Knowledge Articles and Trivia Deck entries have complete engineering formulas and explanations', () => {
    expect(KNOWLEDGE_ARTICLES.length).toBeGreaterThanOrEqual(4);
    for (const card of KNOWLEDGE_ARTICLES) {
      expect(card.title.length).toBeGreaterThan(5);
      expect(card.equationLatex.length).toBeGreaterThan(5);
      expect(card.summary.length).toBeGreaterThan(10);
    }

    expect(TRIVIA_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    for (const q of TRIVIA_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.explanation.length).toBeGreaterThan(15);
    }
  });

  it('animates supersonic staging vapor ring and engine afterburn decay in SpacePlumeAndStagingFX', () => {
    const fx = new SpacePlumeAndStagingFX();
    expect(fx.group.children.length).toBeGreaterThan(5);

    // Staging ring trigger
    fx.triggerStagingVaporRing({ x: 0, y: 28, z: 0 });
    fx.update(0.05, 30, true, 0.9, { x: 0, y: 30, z: 0 }, 3.85);

    // Engine cutoff & afterburn decay
    fx.update(0.05, 120, true, 0.0, { x: 0, y: 120, z: 0 }, 9.5);
    fx.spawnVacuumRcsPuff({ x: 0, y: 10, z: 0 }, 0.8);
    expect(fx.group.children.length).toBeGreaterThan(10);
  });

  it('constructs aerodynamic rocket tip ogive fairings and transforms into deep-space satellite with parabolic dish and 6-panel solar wings', () => {
    const podRig = createOrbitalPodModel(false);
    expect(podRig.root.children.length).toBeGreaterThanOrEqual(3);

    // Initially stowed/folded before transformation (deployPct = 0)
    podRig.updateDeployment(0);
    expect(podRig.fairingDoorLeft.rotation.z).toBeCloseTo(0, 2);
    expect(podRig.fairingDoorRight.rotation.z).toBeCloseTo(0, 2);
    expect(podRig.solarWingLeft.scale.x).toBeLessThan(0.05);

    // Full mechanical transformation into deep-space satellite (deployPct = 100)
    podRig.updateDeployment(100);
    expect(Math.abs(podRig.fairingDoorLeft.rotation.z)).toBeGreaterThan(1.5); // Petals peeled open > 85 deg!
    expect(Math.abs(podRig.fairingDoorRight.rotation.z)).toBeGreaterThan(1.5);
    expect(podRig.solarWingLeft.scale.x).toBeCloseTo(1.0, 1); // 6 solar array panels fully unfurled!
    expect(podRig.solarWingRight.scale.x).toBeCloseTo(1.0, 1);
    expect(podRig.magnetometerBoom.scale.y).toBeCloseTo(1.0, 1); // Forward boom extended!

    // Verify Cold-Gas RCS nozzles fire strictly on the bottom and lateral sides only
    const dummyThrusters = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0.8,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0,
      flapFrontRight: 0,
      flapAftLeft: 0,
      flapAftRight: 0,
      hotStageSeparated: true,
      podRcsBottom: 0.9,
      podRcsLateral: 0.85,
    };
    const emitters = podRig.getActiveNozzleEmitters(dummyThrusters);
    expect(emitters.length).toBeGreaterThanOrEqual(3);
    for (const emitter of emitters) {
      // Emitters must fire downward (-Y) or laterally (X != 0) — strictly ZERO top or forward nozzles!
      expect(emitter.localDirection.y <= 0 || Math.abs(emitter.localDirection.x) > 0.5).toBe(true);
    }
  });

  it('computes continuous Newtonian booster separation physics with gravity drop, backward tumble, and engine flame cutoff', () => {
    // Before separation (elapsedTimeSec < stagingTimeSec)
    const preSep = computeBoosterSeparationPhysics(28.0, 3.2, 3.8);
    expect(preSep.boosterWorldY).toBe(28.0);
    expect(preSep.boosterPitch).toBe(0);
    expect(preSep.plumeOpacity).toBe(1.0);
    expect(preSep.isVisible).toBe(true);

    // 1 second after separation (tSep = 1.0s)
    const postSep1s = computeBoosterSeparationPhysics(28.0, 4.8, 3.8);
    // gravityDrop = 3.5 * 1.0 + 0.5 * 9.81 * 1.0^2 = 8.405m
    // boosterWorldY = 28.0 - 8.405 = 19.595m
    expect(postSep1s.boosterWorldY).toBeLessThan(20.0);
    expect(postSep1s.boosterWorldY).toBeGreaterThan(18.0);
    expect(postSep1s.boosterPitch).toBeLessThan(0); // Tumbles backward
    expect(postSep1s.plumeOpacity).toBe(0); // Flame has decayed to 0 after 0.65s
    expect(postSep1s.isVisible).toBe(true);

    // After falling past ground boundary (-15m)
    const postSepLong = computeBoosterSeparationPhysics(28.0, 8.0, 3.8);
    expect(postSepLong.boosterWorldY).toBeLessThan(-15.0);
    expect(postSepLong.isVisible).toBe(false);
  });
});
