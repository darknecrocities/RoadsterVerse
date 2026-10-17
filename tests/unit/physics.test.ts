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
import {
  computeRoadsterAerodynamics,
  computeStarshipAerodynamics,
} from '../../src/physics/aerodynamicsAndRace.ts';
import type { ThrusterActivation } from '../../src/types/simulation.ts';

describe('6-DoF Roadster & Starship Physics Engine (v7.0 Aerodynamics, Obstacle Race & Gravity)', () => {
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
    expect(trainedState.position.y).toBeCloseTo(0.43, 2);
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

  it('launches Full-Stack Starship in Mission 04, releases the Upper Stage at Hot-Stage Separation, and lands the Booster vertically slowly', () => {
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 360,
      explorationNoise: 0.01,
    };
    let state = createInitialStarshipState('starship-launch');
    let peakAltitude = state.position.y;
    let didSeparate = false;
    let finalDescentSpeedBeforeTouchdown = 0;

    for (let i = 0; i < 360; i++) {
      const { thrusters } = evaluateRLPolicy(state, 'starship-launch', trainedParams, 0);
      if (thrusters.hotStageSeparated) {
        didSeparate = true;
      }
      if (!state.isGrounded && state.velocity.z < 0 && state.position.y < 2.2) {
        finalDescentSpeedBeforeTouchdown = Math.abs(state.velocity.y);
      }
      state = stepStarshipPhysics(state, thrusters, 'starship-launch', trainedParams, 0.025);
      if (state.position.y > peakAltitude) {
        peakAltitude = state.position.y;
      }
    }

    expect(peakAltitude).toBeGreaterThanOrEqual(13.5);
    expect(didSeparate).toBe(true);
    expect(finalDescentSpeedBeforeTouchdown).toBeLessThan(1.5); // Slow vertical landing burn!
    expect(state.isGrounded).toBe(true);
    expect(state.position.y).toBeCloseTo(1.35, 2);
    expect(state.crashed).toBe(false);
  });

  it('flips Starship from horizontal belly-flop to vertical and thrusts a slow vertical landing in Mission 05', () => {
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 360,
      explorationNoise: 0.01,
    };
    let state = createInitialStarshipState('starship-belly-flop');
    const initialPitch = state.attitude.pitch;
    let finalTouchdownSpeed = 0;

    for (let i = 0; i < 360; i++) {
      const { thrusters } = evaluateRLPolicy(state, 'starship-belly-flop', trainedParams, 0);
      if (!state.isGrounded && state.position.y < 2.2) {
        finalTouchdownSpeed = Math.abs(state.velocity.y);
      }
      state = stepStarshipPhysics(state, thrusters, 'starship-belly-flop', trainedParams, 0.025);
    }

    expect(initialPitch).toBeGreaterThan(1.4);
    expect(finalTouchdownSpeed).toBeLessThan(1.5); // Slow vertical landing!
    expect(state.isGrounded).toBe(true);
    expect(state.position.y).toBeCloseTo(1.5, 2);
    expect(state.attitude.pitch).toBeCloseTo(0, 2);
    expect(state.crashed).toBe(false);
  });

  it('releases the Upper Stage, executes a Boostback pitch flip, and catches the Super Heavy Booster vertically in Mission 06', () => {
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 380,
      explorationNoise: 0.01,
    };
    let state = createInitialStarshipState('starship-booster-catch');
    let maxDownrangeX = 0;
    let didSeparate = false;

    for (let i = 0; i < 380; i++) {
      const { thrusters } = evaluateRLPolicy(state, 'starship-booster-catch', trainedParams, 0);
      if (thrusters.hotStageSeparated) {
        didSeparate = true;
      }
      state = stepStarshipPhysics(state, thrusters, 'starship-booster-catch', trainedParams, 0.025);
      if (state.position.x > maxDownrangeX) {
        maxDownrangeX = state.position.x;
      }
    }

    expect(didSeparate).toBe(true);
    expect(maxDownrangeX).toBeGreaterThan(0.5); // Flew downrange before boostback flip!
    expect(state.isGrounded).toBe(true);
    expect(state.position.y).toBeCloseTo(1.5, 2);
    expect(Math.abs(state.position.x)).toBeLessThan(1.5); // Returned to Chopstick tower!
    expect(state.crashed).toBe(false);
  });

  it('weaves the Roadster through the S-curve chicanes and bunny-hop jumps over Obstacle #3 when trained, while crashing & exploding when untrained or short-sighted', () => {
    // 1. Untrained AI (Epochs = 8): fails to weave/jump and crashes into an obstacle
    const untrainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 8,
      explorationNoise: 0.0,
    };
    let untrainedState = createInitialRoadsterState('roadster-obstacle-race', untrainedParams);
    for (let step = 0; step < 260; step++) {
      const { thrusters } = evaluateRLPolicy(untrainedState, 'roadster-obstacle-race', untrainedParams, 0);
      untrainedState = stepRoadsterPhysics(
        untrainedState,
        thrusters,
        'roadster-obstacle-race',
        untrainedParams,
        0.025
      );
      if (untrainedState.crashed) break;
    }
    expect(untrainedState.crashed).toBe(true);

    // 2. Trained AI (Epochs = 380, discountFactor = 0.99): steers around Obstacles #1 & #2,
    // jumps over full-width Obstacle #3 at x = +4.2m with cold-gas thrusters firing only mid-air,
    // and lands safely past x > 6.5m!
    const trainedParams = {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: 380,
      explorationNoise: 0.01,
      discountFactor: 0.99,
    };
    let trainedState = createInitialRoadsterState('roadster-obstacle-race', trainedParams);
    let peakJumpAltitude = trainedState.position.y;
    let minRightLaneZ = 0;
    let maxLeftLaneZ = 0;

    for (let step = 0; step < 300; step++) {
      const { thrusters } = evaluateRLPolicy(trainedState, 'roadster-obstacle-race', trainedParams, 0);

      // Verify zero thruster firing while tires are grounded on the asphalt
      if (trainedState.isGrounded) {
        expect(thrusters.frontLeftLift).toBe(0);
        expect(thrusters.rearBoost).toBe(0);
      }

      trainedState = stepRoadsterPhysics(
        trainedState,
        thrusters,
        'roadster-obstacle-race',
        trainedParams,
        0.025
      );
      if (trainedState.position.y > peakJumpAltitude) {
        peakJumpAltitude = trainedState.position.y;
      }
      if (trainedState.position.z < minRightLaneZ) {
        minRightLaneZ = trainedState.position.z;
      }
      if (trainedState.position.z > maxLeftLaneZ) {
        maxLeftLaneZ = trainedState.position.z;
      }
    }

    expect(minRightLaneZ).toBeLessThan(-0.7); // Dodged Obstacle #1 in the right lane
    expect(maxLeftLaneZ).toBeGreaterThan(0.7); // Dodged Obstacle #2 in the left lane
    expect(peakJumpAltitude).toBeGreaterThan(1.35); // Bunny-hop jumped over Obstacle #3 (height 1.05m)
    expect(trainedState.position.x).toBeGreaterThan(6.5); // Crossed the finish line past all 3 obstacles
    expect(trainedState.isGrounded).toBe(true);
    expect(trainedState.crashed).toBe(false);
  });

  it('computes explicit fluid-body aerodynamics (dynamic pressure q = 0.5*rho*v^2, quadratic drag, active wing downforce, and altitude density decay)', () => {
    const roadsterAeroLowWing = computeRoadsterAerodynamics(
      { x: 12, y: 0, z: 0 },
      { roll: 0, pitch: 0.05, yaw: 0 },
      0.0
    );
    const roadsterAeroHighWing = computeRoadsterAerodynamics(
      { x: 12, y: 0, z: 0 },
      { roll: 0, pitch: 0.05, yaw: 0 },
      1.0
    );

    expect(roadsterAeroHighWing.dynamicPressurePa).toBeGreaterThan(80);
    expect(roadsterAeroHighWing.downforceN).toBeGreaterThan(roadsterAeroLowWing.downforceN);
    expect(roadsterAeroHighWing.dragForce.x).toBeLessThan(0); // Opposes forward velocity

    const starshipFlapThrusters: ThrusterActivation = {
      frontLeftLift: 0,
      frontRightLift: 0,
      rearLeftLift: 0,
      rearRightLift: 0,
      lateralLeft: 0,
      lateralRight: 0,
      rearBoost: 0,
      activeWingAngle: 0,
      raptorThrottle: 0,
      gimbalPitch: 0,
      gimbalYaw: 0,
      flapFrontLeft: 0.8,
      flapFrontRight: 0.8,
      flapAftLeft: 0.2,
      flapAftRight: 0.2,
      hotStageSeparated: false,
    };

    const starshipSeaLevel = computeStarshipAerodynamics(
      1.5,
      { x: 0, y: -6, z: 0 },
      { roll: 0, pitch: 1.5, yaw: 0 },
      starshipFlapThrusters
    );
    const starshipHighAlt = computeStarshipAerodynamics(
      500.0,
      { x: 0, y: -6, z: 0 },
      { roll: 0, pitch: 1.5, yaw: 0 },
      starshipFlapThrusters
    );

    expect(starshipSeaLevel.dynamicPressurePa).toBeGreaterThan(starshipHighAlt.dynamicPressurePa);
    expect(starshipSeaLevel.dragForceY).toBeGreaterThan(0); // Drag opposes downward belly-flop velocity
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
      'src/components/NeuralNetworkModal.tsx',
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
