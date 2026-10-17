import { describe, expect, it } from 'vitest';
import {
  createInitialRoadsterState,
  stepRoadsterPhysics,
} from '../../src/physics/roadsterPhysics.ts';
import {
  createInitialStarshipState,
  stepStarshipPhysics,
} from '../../src/physics/starshipPhysics.ts';
import { DEFAULT_HYPERPARAMETERS } from '../../src/rl/missions.ts';
import type { ThrusterActivation } from '../../src/types/simulation.ts';

const IDLE_THRUSTERS: ThrusterActivation = {
  frontLeftLift: 0,
  frontRightLift: 0,
  rearLeftLift: 0,
  rearRightLift: 0,
  lateralLeft: 0,
  lateralRight: 0,
  rearBoost: 0,
  activeWingAngle: 0.3,
  raptorThrottle: 0,
  gimbalPitch: 0,
  gimbalYaw: 0,
  flapFrontLeft: 0.5,
  flapFrontRight: 0.5,
  flapAftLeft: 0.5,
  flapAftRight: 0.5,
  hotStageSeparated: false,
};

describe('6-DoF Roadster & Starship Physics Engine', () => {
  it('lifts the 2026 Tesla Roadster into a supersonic cold-gas hover when 4 corner nozzles fire', () => {
    let state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    const fullHoverThrusters: ThrusterActivation = {
      ...IDLE_THRUSTERS,
      frontLeftLift: 0.85,
      frontRightLift: 0.85,
      rearLeftLift: 0.85,
      rearRightLift: 0.85,
    };

    for (let i = 0; i < 40; i++) {
      state = stepRoadsterPhysics(
        state,
        fullHoverThrusters,
        'roadster-hover',
        DEFAULT_HYPERPARAMETERS,
        0.02
      );
    }

    expect(state.position.y).toBeGreaterThan(1.2);
    expect(state.velocity.y).toBeGreaterThan(0);
    expect(state.copvPressurePsi).toBeLessThan(DEFAULT_HYPERPARAMETERS.initialCopvPsi);
    expect(state.gForce).toBeGreaterThan(1.3);
  });

  it('pins the Roadster onto the 90-degree vertical wall when lateral cold-gas thruster provides normal force', () => {
    let state = createInitialRoadsterState('roadster-wall-climb', DEFAULT_HYPERPARAMETERS);
    state.position.x = 8.5;
    state.position.y = 4.2;

    const wallPinThrusters: ThrusterActivation = {
      ...IDLE_THRUSTERS,
      frontLeftLift: 0.75,
      frontRightLift: 0.75,
      rearLeftLift: 0.8,
      rearRightLift: 0.8,
      lateralRight: 0.95,
      rearBoost: 0.9,
      activeWingAngle: 0.95,
    };

    for (let i = 0; i < 25; i++) {
      state = stepRoadsterPhysics(
        state,
        wallPinThrusters,
        'roadster-wall-climb',
        DEFAULT_HYPERPARAMETERS,
        0.02
      );
    }

    expect(state.wallContactNormalForceN).toBeGreaterThan(15000);
    expect(state.isOnWall).toBe(true);
    expect(state.position.y).toBeGreaterThan(4.5);
    expect(state.crashed).toBe(false);
  });

  it('accelerates Full-Stack Starship upward during 33-Raptor coastal launch', () => {
    let state = createInitialStarshipState('starship-launch');
    const launchThrusters: ThrusterActivation = {
      ...IDLE_THRUSTERS,
      raptorThrottle: 0.95,
      gimbalPitch: -0.05,
    };

    for (let i = 0; i < 50; i++) {
      state = stepStarshipPhysics(
        state,
        launchThrusters,
        'starship-launch',
        DEFAULT_HYPERPARAMETERS,
        0.02
      );
    }

    expect(state.position.y).toBeGreaterThan(2.5);
    expect(state.velocity.y).toBeGreaterThan(3.0);
    expect(state.propellantRemainingPct).toBeLessThan(100);
  });

  it('rotates Starship from horizontal belly-flop to vertical during flip-and-burn maneuver', () => {
    let state = createInitialStarshipState('starship-belly-flop');
    state.position.y = 10.0; // Inside flip zone (< 12.5m)
    const initialPitch = state.attitude.pitch;

    const flipThrusters: ThrusterActivation = {
      ...IDLE_THRUSTERS,
      raptorThrottle: 0.9,
      gimbalPitch: -0.8,
      flapFrontLeft: 0.1,
      flapFrontRight: 0.1,
      flapAftLeft: 0.9,
      flapAftRight: 0.9,
    };

    for (let i = 0; i < 30; i++) {
      state = stepStarshipPhysics(
        state,
        flipThrusters,
        'starship-belly-flop',
        DEFAULT_HYPERPARAMETERS,
        0.02
      );
    }

    expect(state.attitude.pitch).toBeLessThan(initialPitch);
  });
});
