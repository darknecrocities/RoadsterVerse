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

  it('penalizes policy competence when learning rate or exploration noise is outside the optimal PPO range (0.0001 - 0.01) or discount factor is short-sighted', () => {
    const optimalComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 300,
      learningRate: 0.001,
      explorationNoise: 0.03,
      discountFactor: 0.99,
    });

    const slowLrComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 120,
      learningRate: 0.0001,
      explorationNoise: 0.03,
      discountFactor: 0.99,
    });

    const optimalMidEpochComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 120,
      learningRate: 0.001,
      explorationNoise: 0.03,
      discountFactor: 0.99,
    });

    const noisyUnstableComp = computePolicyCompetence('roadster-wall-climb', {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 300,
      learningRate: 0.0095,
      explorationNoise: 0.85,
      discountFactor: 0.82,
    });

    expect(optimalMidEpochComp).toBeGreaterThan(slowLrComp);
    expect(optimalComp).toBeGreaterThan(noisyUnstableComp);
  });

  it('directly reflects rewardAltitudeWeight, rewardAttitudeWeight, rewardFuelWeight, and discountFactor in live thruster and steering outputs', () => {
    const hoverState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    hoverState.position.y = 1.2; // Below target hover height
    hoverState.attitude.roll = 0.28; // Tilted roll

    const lowAltLowAttEval = evaluateRLPolicy(
      hoverState,
      'roadster-hover',
      {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 320,
        explorationNoise: 0,
        rewardAltitudeWeight: 0.5,
        rewardAttitudeWeight: 0.5,
        rewardFuelWeight: 0.2,
      },
      0
    );

    const highAltHighAttEval = evaluateRLPolicy(
      hoverState,
      'roadster-hover',
      {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 320,
        explorationNoise: 0,
        rewardAltitudeWeight: 4.5,
        rewardAttitudeWeight: 4.5,
        rewardFuelWeight: 0.2,
      },
      0
    );

    const highFuelSavingEval = evaluateRLPolicy(
      hoverState,
      'roadster-hover',
      {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 320,
        explorationNoise: 0,
        rewardAltitudeWeight: 4.5,
        rewardAttitudeWeight: 4.5,
        rewardFuelWeight: 3.0,
      },
      0
    );

    const avgLiftLow =
      (lowAltLowAttEval.thrusters.frontLeftLift + lowAltLowAttEval.thrusters.frontRightLift) * 0.5;
    const avgLiftHigh =
      (highAltHighAttEval.thrusters.frontLeftLift + highAltHighAttEval.thrusters.frontRightLift) * 0.5;
    const avgLiftFuelSaved =
      (highFuelSavingEval.thrusters.frontLeftLift + highFuelSavingEval.thrusters.frontRightLift) * 0.5;

    expect(avgLiftHigh).toBeGreaterThan(avgLiftLow);
    expect(avgLiftFuelSaved).toBeLessThan(avgLiftHigh);
  });

  it('produces valid bounded thruster commands and neural network snapshots for all 7 missions', () => {
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

  it('steps auto-practice epoch iterations by configurable step sizes (+1, +5, +10, +25, +50) up to 500 ceiling', () => {
    const stepAutoPractice = (currentEpochs: number, stepSize: number): { epochs: number; noise: number } => {
      const nextEpoch = Math.min(500, currentEpochs + stepSize);
      const cooledNoise = Math.max(0.02, Number((0.45 * Math.exp(-nextEpoch / 180)).toFixed(2)));
      return { epochs: nextEpoch, noise: cooledNoise };
    };

    // Test +1 step
    const stepPlus1 = stepAutoPractice(0, 1);
    expect(stepPlus1.epochs).toBe(1);

    // Test +5 step
    const stepPlus5 = stepAutoPractice(10, 5);
    expect(stepPlus5.epochs).toBe(15);

    // Test +10 step (default)
    const stepPlus10 = stepAutoPractice(20, 10);
    expect(stepPlus10.epochs).toBe(30);

    // Test +25 step
    const stepPlus25 = stepAutoPractice(50, 25);
    expect(stepPlus25.epochs).toBe(75);

    // Test +50 step
    const stepPlus50 = stepAutoPractice(100, 50);
    expect(stepPlus50.epochs).toBe(150);

    // Test ceiling cap at 500 regardless of step size
    const cappedStep = stepAutoPractice(480, 50);
    expect(cappedStep.epochs).toBe(500);

    // Policy competence monotonically increases across epoch increments
    const comp0 = computePolicyCompetence('starship-booster-catch', { ...DEFAULT_HYPERPARAMETERS, epochs: 0 });
    const comp10 = computePolicyCompetence('starship-booster-catch', { ...DEFAULT_HYPERPARAMETERS, epochs: 10 });
    const comp50 = computePolicyCompetence('starship-booster-catch', { ...DEFAULT_HYPERPARAMETERS, epochs: 50 });
    expect(comp10).toBeGreaterThanOrEqual(comp0);
    expect(comp50).toBeGreaterThan(comp10);
  });
});
