import type {
  EulerAngles,
  RigidBodyState,
  Vector3D,
} from '../types/simulation.ts';

export interface SensorSnapshot {
  timestamp: number;
  state: RigidBodyState;
}

/**
 * Circular / ring buffer for storing time-stamped rigid-body telemetry snapshots
 * and reconstructing delayed sensor observations s(t - tau) for the RL control loop.
 */
export class SensorLatencyBuffer {
  private buffer: SensorSnapshot[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 360) {
    this.maxCapacity = Math.max(2, maxCapacity);
  }

  /**
   * Pushes a new physical state snapshot into the history buffer.
   */
  public push(timestamp: number, state: RigidBodyState): void {
    const snapshot: SensorSnapshot = {
      timestamp,
      state: {
        ...state,
        position: { ...state.position },
        velocity: { ...state.velocity },
        attitude: { ...state.attitude },
        angularVelocity: { ...state.angularVelocity },
        elapsedTimeSec: timestamp,
      },
    };

    this.buffer.push(snapshot);
    if (this.buffer.length > this.maxCapacity) {
      this.buffer.shift();
    }
  }

  /**
   * Resets the buffer (used when simulation resets or vehicle crashes).
   */
  public reset(): void {
    this.buffer = [];
  }

  /**
   * Returns current number of recorded history points.
   */
  public size(): number {
    return this.buffer.length;
  }

  /**
   * Samples the delayed rigid body state at t_target = currentTime - latencyMs / 1000.
   * If latencyMs <= 0 or history is insufficient, returns the latest state.
   */
  public getDelayedState(currentTime: number, latencyMs: number): RigidBodyState {
    if (this.buffer.length === 0) {
      throw new Error('SensorLatencyBuffer is empty; push at least one state before sampling');
    }

    const latest = this.buffer[this.buffer.length - 1].state;
    if (latencyMs <= 0 || this.buffer.length === 1) {
      return latest;
    }

    const delaySec = Math.max(0, latencyMs) / 1000;
    const targetTime = currentTime - delaySec;

    // If target is older than our oldest snapshot, clamp to oldest available
    const oldest = this.buffer[0];
    if (targetTime <= oldest.timestamp) {
      return oldest.state;
    }

    // If target is newer than or equal to latest, return latest
    const newest = this.buffer[this.buffer.length - 1];
    if (targetTime >= newest.timestamp) {
      return latest;
    }

    // Binary search for interval [i, i+1] where buffer[i].timestamp <= targetTime <= buffer[i+1].timestamp
    let low = 0;
    let high = this.buffer.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const curTime = this.buffer[mid].timestamp;

      if (curTime <= targetTime) {
        if (mid === this.buffer.length - 1 || this.buffer[mid + 1].timestamp >= targetTime) {
          low = mid;
          break;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const s0 = this.buffer[low];
    const s1 = this.buffer[Math.min(this.buffer.length - 1, low + 1)];

    if (s0 === s1 || Math.abs(s1.timestamp - s0.timestamp) < 1e-6) {
      return s0.state;
    }

    const alpha = Math.max(0, Math.min(1, (targetTime - s0.timestamp) / (s1.timestamp - s0.timestamp)));
    return interpolateState(s0.state, s1.state, alpha, targetTime);
  }

  /**
   * Computes the estimated angular phase lag in degrees based on vehicle angular rate:
   * delta_theta = |omega| * tau (in radians) converted to degrees.
   */
  public static computePhaseLagDeg(angularVelocity: Vector3D, latencyMs: number): number {
    if (latencyMs <= 0) return 0;
    const totalOmega = Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z);
    const tauSec = latencyMs / 1000;
    const lagRad = totalOmega * tauSec;
    return Number(((lagRad * 180) / Math.PI).toFixed(1));
  }
}

/**
 * Linearly interpolates 3D vectors.
 */
function lerpVector(v0: Vector3D, v1: Vector3D, a: number): Vector3D {
  return {
    x: v0.x + (v1.x - v0.x) * a,
    y: v0.y + (v1.y - v0.y) * a,
    z: v0.z + (v1.z - v0.z) * a,
  };
}

/**
 * Linearly interpolates Euler angles accounting for phase wrapping where appropriate.
 */
function lerpEuler(e0: EulerAngles, e1: EulerAngles, a: number): EulerAngles {
  return {
    roll: e0.roll + (e1.roll - e0.roll) * a,
    pitch: e0.pitch + (e1.pitch - e0.pitch) * a,
    yaw: e0.yaw + (e1.yaw - e0.yaw) * a,
  };
}

/**
 * Helper to interpolate between two discrete state snapshots.
 */
function interpolateState(
  s0: RigidBodyState,
  s1: RigidBodyState,
  alpha: number,
  interpolatedTime: number
): RigidBodyState {
  return {
    ...s1,
    position: lerpVector(s0.position, s1.position, alpha),
    velocity: lerpVector(s0.velocity, s1.velocity, alpha),
    attitude: lerpEuler(s0.attitude, s1.attitude, alpha),
    angularVelocity: lerpVector(s0.angularVelocity, s1.angularVelocity, alpha),
    copvPressurePsi: s0.copvPressurePsi + (s1.copvPressurePsi - s0.copvPressurePsi) * alpha,
    propellantRemainingPct:
      s0.propellantRemainingPct + (s1.propellantRemainingPct - s0.propellantRemainingPct) * alpha,
    gForce: s0.gForce + (s1.gForce - s0.gForce) * alpha,
    elapsedTimeSec: interpolatedTime,
  };
}
