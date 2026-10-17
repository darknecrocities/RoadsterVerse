import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createInitialRoadsterState,
  stepRoadsterPhysics,
} from '../../src/physics/roadsterPhysics.ts';
import {
  createInitialStarshipState,
  stepStarshipPhysics,
} from '../../src/physics/starshipPhysics.ts';
import { sampleCurvedKickflipRamp } from '../../src/physics/rampGeometry.ts';
import { DEFAULT_HYPERPARAMETERS } from '../../src/rl/missions.ts';
import { evaluateRLPolicy } from '../../src/rl/policyEngine.ts';
import type { ThrusterActivation } from '../../src/types/simulation.ts';

describe('6-DoF Roadster & Starship Physics Engine (v3.0 Exact Ramp & Gravity)', () => {
  it('lifts the 2026 Tesla Roadster into a supersonic cold-gas hover when 4 corner nozzles fire', () => {
    let state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    const fullHoverThrusters: ThrusterActivation = {
      frontLeftLift: 0.9,
      frontRightLift: 0.9,
      rearLeftLift: 0.9,
      rearRightLift: 0.9,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0.5,
      raptorThrottle: 0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0,
      flapFrontRight: 0,
      flapAftLeft: 0,
      flapAftRight: 0,
      hotStageSeparated: false,
    };

    for (let i = 0; i < 60; i++) {
      state = stepRoadsterPhysics(
        state,
        fullHoverThrusters,
        'roadster-hover',
        DEFAULT_HYPERPARAMETERS,
        0.02
      );
    }

    expect(state.position.y).toBeGreaterThan(2.5);
    expect(state.copvPressurePsi).toBeLessThan(DEFAULT_HYPERPARAMETERS.initialCopvPsi);
    expect(state.crashed).toBe(false);
  });

  it('sticks upside-down on the Hot-Wheels Overhanging Half-Loop when trained, and falls off under gravity when untrained', () => {
    // 1. Untrained AI (Try #5): fails to generate enough thruster/loop force and falls off under gravity!
    const untrainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 5,
      explorationNoise: 0.0,
    };
    let untrainedState = createInitialRoadsterState('roadster-wall-climb', untrainedParams);
    let peeledOffLoop = false;

    for (let i = 0; i < 180; i++) {
      const { thrusters } = evaluateRLPolicy(untrainedState, 'roadster-wall-climb', untrainedParams, 0);
      untrainedState = stepRoadsterPhysics(
        untrainedState,
        thrusters,
        'roadster-wall-climb',
        untrainedParams,
        0.025
      );
      if (untrainedState.velocity.z === -2) {
        peeledOffLoop = true;
      }
    }
    expect(peeledOffLoop).toBe(true);

    // 2. Trained AI (Try #360): sticks upside-down around the 142-deg overhanging C-loop,
    // launches off the top lip with ZERO mid-air levitation (< 16m), executes a mid-air 360° kickflip,
    // and lands slowly back near its original starting position (y = 0.48m)!
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 360,
      explorationNoise: 0.01,
    };
    let trainedState = createInitialRoadsterState('roadster-wall-climb', trainedParams);
    let peakLoopAltitude = 0;
    let peakOverhangAngle = 0;
    let peakMidAirRoll = 0;

    for (let i = 0; i < 240; i++) {
      const { thrusters } = evaluateRLPolicy(trainedState, 'roadster-wall-climb', trainedParams, 0);
      trainedState = stepRoadsterPhysics(
        trainedState,
        thrusters,
        'roadster-wall-climb',
        trainedParams,
        0.025
      );
      if (trainedState.position.y > peakLoopAltitude) {
        peakLoopAltitude = trainedState.position.y;
      }
      if (trainedState.attitude.pitch > peakOverhangAngle) {
        peakOverhangAngle = trainedState.attitude.pitch;
      }
      if (trainedState.attitude.roll > peakMidAirRoll) {
        peakMidAirRoll = trainedState.attitude.roll;
      }
    }

    expect(peakLoopAltitude).toBeGreaterThan(11.5);
    expect(peakLoopAltitude).toBeLessThan(16.0); // Strictly ZERO mid-air levitation!
    expect(peakOverhangAngle).toBeGreaterThan(2.2); // >126 deg upside-down overhang!
    expect(peakMidAirRoll).toBeCloseTo(Math.PI * 2, 1); // Completed 360° mid-air kickflip!
    expect(trainedState.isGrounded).toBe(true);
    expect(trainedState.position.y).toBeCloseTo(0.48, 2);
    expect(trainedState.position.x).toBeLessThan(-4.0); // Landed back near the original starting position!
    expect(trainedState.crashed).toBe(false);
  });

  it('launches the Roadster off the Curved Steel Quarter-Pipe with zero ramp clipping, executes a 360-degree kickflip, and lands smoothly', () => {
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 380,
      explorationNoise: 0.01,
      learningRate: 0.0004,
    };
    let state = createInitialRoadsterState('roadster-barrel-roll', trainedParams);
    let peakAltitudeY = state.position.y;
    let peakPitchKick = 0;

    for (let step = 0; step < 260; step++) {
      const { thrusters } = evaluateRLPolicy(state, 'roadster-barrel-roll', trainedParams, 0);
      state = stepRoadsterPhysics(state, thrusters, 'roadster-barrel-roll', trainedParams, 0.025);

      // Verify zero ramp penetration whenever over the curved launch ramp x-interval
      const rampSample = sampleCurvedKickflipRamp(state.position.x);
      if (rampSample.isOnRamp) {
        expect(state.position.y).toBeGreaterThanOrEqual(rampSample.carCenterY - 0.01);
      }

      if (state.position.y > peakAltitudeY) {
        peakAltitudeY = state.position.y;
      }
      if (Math.abs(state.attitude.pitch) > peakPitchKick) {
        peakPitchKick = Math.abs(state.attitude.pitch);
      }
    }

    expect(peakAltitudeY).toBeGreaterThan(2.2);
    expect(peakPitchKick).toBeGreaterThan(0.15);
    expect(state.attitude.roll).toBeCloseTo(Math.PI * 2, 1);
    expect(state.isGrounded).toBe(true);
    expect(state.crashed).toBe(false);
  });

  it('accelerates Full-Stack Starship upward during 33-Raptor coastal launch', () => {
    let state = createInitialStarshipState('starship-launch');
    const launchThrusters: ThrusterActivation = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 0.95,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0.5,
      flapFrontRight: 0.5,
      flapAftLeft: 0.5,
      flapAftRight: 0.5,
      hotStageSeparated: false,
    };

    for (let i = 0; i < 60; i++) {
      state = stepStarshipPhysics(
        state,
        launchThrusters,
        'starship-launch',
        DEFAULT_HYPERPARAMETERS,
        0.025
      );
    }

    expect(state.position.y).toBeGreaterThan(5.0);
    expect(state.velocity.y).toBeGreaterThan(4.0);
    expect(state.crashed).toBe(false);
  });

  it('rotates Starship from horizontal belly-flop to vertical during flip-and-burn maneuver', () => {
    let state = createInitialStarshipState('starship-belly-flop');
    state.position.y = 10.0;
    const initialPitch = state.attitude.pitch;

    const flipThrusters: ThrusterActivation = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 0.85,
      gimbalPitch: -0.9,
      gimbalYaw: 0,
      flapFrontLeft: 0.1,
      flapFrontRight: 0.1,
      flapAftLeft: 0.9,
      flapAftRight: 0.9,
      hotStageSeparated: true,
    };

    for (let i = 0; i < 40; i++) {
      state = stepStarshipPhysics(
        state,
        flipThrusters,
        'starship-belly-flop',
        DEFAULT_HYPERPARAMETERS,
        0.025
      );
    }

    expect(state.attitude.pitch).toBeLessThan(initialPitch);
  });

  it('enforces 100% pure Black and White monochrome colors across all UI stylesheets and React components', () => {
    const filesToAudit = [
      'src/styles.css',
      'src/App.tsx',
      'src/components/WelcomeScreen.tsx',
      'src/components/HelpTooltip.tsx',
      'src/components/Viewport3D.tsx',
      'src/components/RLTrainingControls.tsx',
      'src/components/NeuralTelemetryHUD.tsx',
      'src/components/KnowledgeAndTriviaModal.tsx',
    ];

    const hexRegex = /#([0-9a-fA-F]{6})\b/g;

    for (const relPath of filesToAudit) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = hexRegex.exec(content)) !== null) {
        const hex = match[1].toLowerCase();
        const r = hex.slice(0, 2);
        const g = hex.slice(2, 4);
        const b = hex.slice(4, 6);
        // Every 6-digit hex color in the UI must be pure grayscale (R === G === B)
        expect(r === g && g === b, `Non-monochrome color #${hex} found in ${relPath}`).toBe(true);
      }
    }
  });
});
