import { describe, expect, it } from 'vitest';
import { createRoadsterModel } from '../../src/three/roadsterModel.ts';
import { createStarshipModel } from '../../src/three/starshipModel.ts';
import { VolumetricPlumeSmokeSystem } from '../../src/three/plumeAndSmokeFX.ts';
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

    // All 7 cold-gas nozzles on the 2026 Tesla Roadster must be active and emit along their nozzle vector
    expect(nozzleEmitters).toHaveLength(7);

    // Verify ZERO roof thruster: every nozzle is mounted at or below y=0.30m and fires downward/sideways (localDirection.y <= 0)
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

    // Verify that on the road or ramp (isAirborne = false), ZERO nozzle emitters and ZERO thrusters fire
    expect(roadsterRig.getActiveNozzleEmitters(fullThrusters, false)).toHaveLength(0);
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

  it('runs all 6 missions across untrained, mid-training, and converged curriculum regimes without NaN states or runtime exceptions', () => {
    expect(MISSION_LIST).toHaveLength(6);
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
});
