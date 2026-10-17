import { describe, expect, it } from 'vitest';
import {
  computePolicyCompetence,
  evaluateRLPolicy,
  generateEpochLearningCurve,
} from '../../src/rl/policyEngine.ts';
import { DEFAULT_HYPERPARAMETERS, MISSION_LIST } from '../../src/rl/missions.ts';
import { createInitialRoadsterState } from '../../src/physics/roadsterPhysics.ts';

describe('Reinforcement Learning Policy & Curriculum Engine', () => {
  it('increases policy competence monotonically as training epochs increase from 5 to 400', () => {
    const lowEpochComp = computePolicyCompetence(
      'roadster-hover',
      DEFAULT_HYPERPARAMETERS,
      5
    );
    const midEpochComp = computePolicyCompetence(
      'roadster-hover',
      DEFAULT_HYPERPARAMETERS,
      90
    );
    const highEpochComp = computePolicyCompetence(
      'roadster-hover',
      DEFAULT_HYPERPARAMETERS,
      400
    );

    expect(midEpochComp).toBeGreaterThan(lowEpochComp);
    expect(highEpochComp).toBeGreaterThan(midEpochComp);
    expect(highEpochComp).toBeGreaterThan(0.85);
  });

  it('penalizes policy competence when learning rate or exploration noise is excessively high', () => {
    const optimalComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 300,
      learningRate: 0.0005,
      explorationNoise: 0.03,
    });

    const noisyUnstableComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 300,
      learningRate: 0.035,
      explorationNoise: 0.85,
    });

    expect(optimalComp).toBeGreaterThan(noisyUnstableComp);
  });

  it('produces valid bounded thruster commands and neural network snapshots for all 5 missions', () => {
    const state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);

    for (const mission of MISSION_LIST) {
      const { thrusters, nnSnapshot } = evaluateRLPolicy(
        state,
        mission.id,
        DEFAULT_HYPERPARAMETERS
      );

      expect(thrusters.frontLeftLift).toBeGreaterThanOrEqual(0);
      expect(thrusters.frontLeftLift).toBeLessThanOrEqual(1);
      expect(thrusters.raptorThrottle).toBeGreaterThanOrEqual(0);
      expect(thrusters.raptorThrottle).toBeLessThanOrEqual(1);
      expect(nnSnapshot.inputs).toHaveLength(6);
      expect(nnSnapshot.hiddenLayer1).toHaveLength(8);
      expect(nnSnapshot.hiddenLayer2).toHaveLength(6);
      expect(nnSnapshot.outputs).toHaveLength(6);
    }
  });

  it('generates a complete Epoch Learning Curve reflecting hyperparameter convergence', () => {
    const curve = generateEpochLearningCurve('starship-belly-flop', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 350,
    });

    expect(curve.length).toBeGreaterThan(10);
    const first = curve[0];
    const last = curve[curve.length - 1];
    expect(last.epoch).toBe(350);
    expect(last.meanReward).toBeGreaterThan(first.meanReward);
    expect(last.survivalRatePct).toBeGreaterThan(first.survivalRatePct);
  });
});
