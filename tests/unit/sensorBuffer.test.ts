import { describe, expect, it } from 'vitest';
import { SensorLatencyBuffer } from '../../src/rl/sensorBuffer.ts';
import { DEFAULT_HYPERPARAMETERS } from '../../src/rl/missions.ts';
import { createInitialRoadsterState } from '../../src/physics/roadsterPhysics.ts';
import type { RigidBodyState } from '../../src/types/simulation.ts';

describe('SensorLatencyBuffer (Time-Stamped Delay FIFO)', () => {
  it('throws descriptive error if sampled while empty', () => {
    const buffer = new SensorLatencyBuffer(50);
    expect(() => buffer.getDelayedState(1.0, 50)).toThrow(/empty/);
  });

  it('returns exact latest state when latency is 0 ms', () => {
    const buffer = new SensorLatencyBuffer(50);
    const s1 = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    s1.position.y = 2.5;
    buffer.push(0.1, s1);

    const delayed = buffer.getDelayedState(0.1, 0);
    expect(delayed.position.y).toBeCloseTo(2.5, 4);
    expect(delayed.elapsedTimeSec).toBe(0.1);
  });

  it('samples historical state corresponding to exact time delay', () => {
    const buffer = new SensorLatencyBuffer(50);
    const baseState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);

    // Push sequence at 50ms intervals (0.00s, 0.05s, 0.10s, 0.15s, 0.20s)
    for (let i = 0; i <= 4; i++) {
      const t = i * 0.05;
      const s: RigidBodyState = {
        ...baseState,
        position: { x: i * 1.0, y: i * 2.0, z: 0 },
        elapsedTimeSec: t,
      };
      buffer.push(t, s);
    }

    // At t = 0.20s with 100ms latency, should sample t = 0.10s (i = 2)
    const delayed100ms = buffer.getDelayedState(0.2, 100);
    expect(delayed100ms.position.x).toBeCloseTo(2.0, 3);
    expect(delayed100ms.position.y).toBeCloseTo(4.0, 3);
    expect(delayed100ms.elapsedTimeSec).toBeCloseTo(0.1, 3);

    // At t = 0.20s with 50ms latency, should sample t = 0.15s (i = 3)
    const delayed50ms = buffer.getDelayedState(0.2, 50);
    expect(delayed50ms.position.x).toBeCloseTo(3.0, 3);
    expect(delayed50ms.position.y).toBeCloseTo(6.0, 3);
    expect(delayed50ms.elapsedTimeSec).toBeCloseTo(0.15, 3);
  });

  it('linearly interpolates state when target delay falls between two discrete frames', () => {
    const buffer = new SensorLatencyBuffer(50);
    const baseState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);

    const s0: RigidBodyState = {
      ...baseState,
      position: { x: 0, y: 1.0, z: 0 },
      velocity: { x: 0, y: 2.0, z: 0 },
      attitude: { roll: 0, pitch: 0.1, yaw: 0 },
      elapsedTimeSec: 0.0,
    };
    const s1: RigidBodyState = {
      ...baseState,
      position: { x: 0, y: 3.0, z: 0 },
      velocity: { x: 0, y: 4.0, z: 0 },
      attitude: { roll: 0, pitch: 0.3, yaw: 0 },
      elapsedTimeSec: 0.1,
    };

    buffer.push(0.0, s0);
    buffer.push(0.1, s1);

    // Target time: 0.1 - 0.05 = 0.05 (exact midpoint, alpha = 0.5)
    const midState = buffer.getDelayedState(0.1, 50);
    expect(midState.position.y).toBeCloseTo(2.0, 3);
    expect(midState.velocity.y).toBeCloseTo(3.0, 3);
    expect(midState.attitude.pitch).toBeCloseTo(0.2, 3);
    expect(midState.elapsedTimeSec).toBeCloseTo(0.05, 3);
  });

  it('clamps to earliest available state when delay exceeds history depth', () => {
    const buffer = new SensorLatencyBuffer(50);
    const baseState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);

    const s0: RigidBodyState = { ...baseState, position: { x: 10, y: 10, z: 0 }, elapsedTimeSec: 0.0 };
    const s1: RigidBodyState = { ...baseState, position: { x: 12, y: 12, z: 0 }, elapsedTimeSec: 0.02 };

    buffer.push(0.0, s0);
    buffer.push(0.02, s1);

    // Request 150ms delay when only 20ms of history has elapsed
    const clampedState = buffer.getDelayedState(0.02, 150);
    expect(clampedState.position.x).toBeCloseTo(10, 3);
    expect(clampedState.position.y).toBeCloseTo(10, 3);
  });

  it('enforces circular buffer capacity bound without memory leakage', () => {
    const capacity = 10;
    const buffer = new SensorLatencyBuffer(capacity);
    const baseState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);

    for (let i = 0; i < 30; i++) {
      buffer.push(i * 0.016, { ...baseState, elapsedTimeSec: i * 0.016 });
    }

    expect(buffer.size()).toBe(capacity);
  });

  it('resets buffer history cleanly on simulation restart', () => {
    const buffer = new SensorLatencyBuffer(20);
    const baseState = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    buffer.push(0.1, baseState);
    expect(buffer.size()).toBe(1);

    buffer.reset();
    expect(buffer.size()).toBe(0);
    expect(() => buffer.getDelayedState(0.1, 10)).toThrow(/empty/);
  });

  it('calculates expected physical phase lag angle in degrees', () => {
    // 2 rad/s roll rate with 50ms latency -> lag = 0.1 rad = 5.7 deg
    const omega = { x: 2.0, y: 0, z: 0 };
    const lagDeg = SensorLatencyBuffer.computePhaseLagDeg(omega, 50);
    expect(lagDeg).toBeCloseTo(5.7, 1);

    // Zero latency yields zero phase lag
    expect(SensorLatencyBuffer.computePhaseLagDeg(omega, 0)).toBe(0);
  });
});
