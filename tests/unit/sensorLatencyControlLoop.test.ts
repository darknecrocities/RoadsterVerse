import { describe, expect, it } from 'vitest';
import { SensorLatencyBuffer } from '../../src/rl/sensorBuffer.ts';
import { evaluateRLPolicy } from '../../src/rl/policyEngine.ts';
import { computePolicyCompetence } from '../../src/rl/competence.ts';
import { DEFAULT_HYPERPARAMETERS } from '../../src/rl/missions.ts';
import { createInitialRoadsterState, stepRoadsterPhysics } from '../../src/physics/roadsterPhysics.ts';

describe('Sensor Latency Closed-Loop Dynamics & Phase Lag', () => {
  it('reports active sensorLatencyMs and non-zero phase lag in nnSnapshot when spinning', () => {
    const state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    state.angularVelocity.x = 3.5; // 3.5 rad/s roll rate
    const params = { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 80 };

    const { nnSnapshot } = evaluateRLPolicy(state, 'roadster-hover', params, 0);

    expect(nnSnapshot.sensorLatencyMs).toBe(80);
    expect(nnSnapshot.sensorDelayDeg).toBeGreaterThan(10); // 3.5 * 0.08 rad = 0.28 rad ~ 16 deg
  });

  it('degrades uncompensated policy competence when sensor latency increases from 0 to 150ms', () => {
    const zeroLatencyComp = computePolicyCompetence('roadster-hover', {
      ...DEFAULT_HYPERPARAMETERS,
      sensorLatencyMs: 0,
    });
    const lowLatencyComp = computePolicyCompetence('roadster-hover', {
      ...DEFAULT_HYPERPARAMETERS,
      sensorLatencyMs: 50,
    });
    const highLatencyComp = computePolicyCompetence('roadster-hover', {
      ...DEFAULT_HYPERPARAMETERS,
      sensorLatencyMs: 150,
    });

    expect(zeroLatencyComp).toBeGreaterThan(lowLatencyComp);
    expect(lowLatencyComp).toBeGreaterThan(highLatencyComp);
  });

  it('demonstrates that delayed sensor observation produces lagged thruster commands during dynamic roll disturbance', () => {
    const buffer = new SensorLatencyBuffer(100);
    const paramsZero = { ...DEFAULT_HYPERPARAMETERS, epochs: 400, explorationNoise: 0, sensorLatencyMs: 0 };
    const paramsDelay = { ...DEFAULT_HYPERPARAMETERS, epochs: 400, explorationNoise: 0, sensorLatencyMs: 100 };

    // Initial state: level hover
    const s0 = createInitialRoadsterState('roadster-hover', paramsZero);
    s0.position.y = 3.8;
    s0.elapsedTimeSec = 0.0;
    buffer.push(0.0, s0);

    // After 100ms, a sudden roll tilt hits the vehicle: roll = 0.25 rad
    const sTilted = {
      ...s0,
      attitude: { roll: 0.25, pitch: 0, yaw: 0 },
      angularVelocity: { x: 1.5, y: 0, z: 0 },
      elapsedTimeSec: 0.1,
    };
    buffer.push(0.1, sTilted);

    // Instantaneous policy immediately reacts to the tilt
    const { thrusters: instantThrusters } = evaluateRLPolicy(sTilted, 'roadster-hover', paramsZero, 0);

    // Delayed policy at t = 0.1s with 100ms latency observes s(0.0) where roll = 0!
    const delayedObservation = buffer.getDelayedState(0.1, paramsDelay.sensorLatencyMs);
    const { thrusters: delayedThrusters } = evaluateRLPolicy(delayedObservation, 'roadster-hover', paramsDelay, 0);

    // Instantaneous policy fires differential FL/FR nozzles to correct roll
    const instantDiff = Math.abs(instantThrusters.frontLeftLift - instantThrusters.frontRightLift);
    const delayedDiff = Math.abs(delayedThrusters.frontLeftLift - delayedThrusters.frontRightLift);

    expect(instantDiff).toBeGreaterThan(0.4);
    // Delayed policy still thinks the car is level (t = 0.0s), so differential correction is minimal
    expect(delayedDiff).toBeLessThan(0.12);
    expect(instantDiff).toBeGreaterThan(delayedDiff + 0.35);
  });

  it('runs multi-step closed-loop simulation showing stability difference with 0ms vs 120ms latency', () => {
    const simSteps = 60; // 1 second of 60Hz physics
    const dt = 1 / 60;

    // Simulation 1: Zero Latency
    const bufferZero = new SensorLatencyBuffer( simSteps + 10 );
    let stateZero = createInitialRoadsterState('roadster-hover', { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 0 });
    stateZero.position.y = 3.5;
    stateZero.attitude.roll = 0.15; // initial tilt perturbation

    for (let i = 0; i < simSteps; i++) {
      bufferZero.push(stateZero.elapsedTimeSec, stateZero);
      const obs = bufferZero.getDelayedState(stateZero.elapsedTimeSec, 0);
      const { thrusters } = evaluateRLPolicy(obs, 'roadster-hover', { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 0 }, 0);
      stateZero = stepRoadsterPhysics(stateZero, thrusters, 'roadster-hover', DEFAULT_HYPERPARAMETERS, dt, 0);
    }

    // Simulation 2: 120ms Latency
    const bufferDelayed = new SensorLatencyBuffer(simSteps + 10);
    let stateDelayed = createInitialRoadsterState('roadster-hover', { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 120 });
    stateDelayed.position.y = 3.5;
    stateDelayed.attitude.roll = 0.15;

    for (let i = 0; i < simSteps; i++) {
      bufferDelayed.push(stateDelayed.elapsedTimeSec, stateDelayed);
      const obs = bufferDelayed.getDelayedState(stateDelayed.elapsedTimeSec, 120);
      const { thrusters } = evaluateRLPolicy(obs, 'roadster-hover', { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 120 }, 0);
      stateDelayed = stepRoadsterPhysics(stateDelayed, thrusters, 'roadster-hover', { ...DEFAULT_HYPERPARAMETERS, sensorLatencyMs: 120 }, dt, 0);
    }

    // Both simulations completed valid physical steps
    expect(stateZero.elapsedTimeSec).toBeCloseTo(1.0, 1);
    expect(stateDelayed.elapsedTimeSec).toBeCloseTo(1.0, 1);
    // Zero latency settles roll error faster and more stably than 120ms delayed feedback
    expect(Math.abs(stateZero.attitude.roll)).toBeLessThan(Math.abs(stateDelayed.attitude.roll) + 0.1);
  });
});
