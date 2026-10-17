import type {
  MissionId,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
} from '../types/simulation.ts';
import {
  CAR_RIDE_HEIGHT,
  HALF_LOOP_RUNWAY_START_X,
  HALF_LOOP_TOTAL_LENGTH,
  KICKFLIP_RAMP_END_X,
  KICKFLIP_RAMP_START_X,
  sampleCurvedKickflipRamp,
  sampleHotWheelsHalfLoop,
} from './rampGeometry.ts';

export const ROADSTER_MASS_KG = 1850;
export const GRAVITY_EARTH = 9.81;
export const MAX_CORNER_THRUST_N = 8200; // 4 corners * 8.2 kN = 32.8 kN (~1.81G lift)
export const MAX_LATERAL_THRUST_N = 15500; // Cold-gas loop/wall pinning thruster
export const MAX_REAR_BOOST_N = 18500; // Centerline rear COPV rocket thruster
export const TIRE_FRICTION_COEFF = 1.35; // Heated Michelin Pilot Sport Cup 2R slicks

const GROUND_Y = 0.04 + CAR_RIDE_HEIGHT; // 0.48m exact tire contact plane

export function createInitialRoadsterState(
  missionId: MissionId,
  params: RLHyperparameters
): RigidBodyState {
  if (missionId === 'roadster-wall-climb') {
    const startSample = sampleHotWheelsHalfLoop(0);
    return {
      position: { x: startSample.carCenterX, y: startSample.carCenterY, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      copvPressurePsi: params.initialCopvPsi,
      propellantRemainingPct: 100,
      gForce: 1.0,
      wallContactNormalForceN: ROADSTER_MASS_KG * GRAVITY_EARTH,
      isGrounded: true,
      isOnWall: false,
      crashed: false,
      missionProgressPct: 0,
      elapsedTimeSec: 0,
    };
  }

  if (missionId === 'roadster-barrel-roll') {
    return {
      position: { x: -9.2, y: GROUND_Y, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      copvPressurePsi: params.initialCopvPsi,
      propellantRemainingPct: 100,
      gForce: 1.0,
      wallContactNormalForceN: ROADSTER_MASS_KG * GRAVITY_EARTH,
      isGrounded: true,
      isOnWall: false,
      crashed: false,
      missionProgressPct: 0,
      elapsedTimeSec: 0,
    };
  }

  return {
    position: { x: 0, y: GROUND_Y, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    attitude: { roll: 0, pitch: 0, yaw: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    copvPressurePsi: params.initialCopvPsi,
    propellantRemainingPct: 100,
    gForce: 1.0,
    wallContactNormalForceN: ROADSTER_MASS_KG * GRAVITY_EARTH,
    isGrounded: true,
    isOnWall: false,
    crashed: false,
    missionProgressPct: 0,
    elapsedTimeSec: 0,
  };
}

/**
 * Steps 6-DoF rigid-body & cold-gas blowdown physics for the 2026 Tesla Roadster.
 * Uses exact parametric surface geometry (rampGeometry.ts) so the car never clips through ramps.
 */
export function stepRoadsterPhysics(
  state: RigidBodyState,
  thrusters: ThrusterActivation,
  missionId: MissionId,
  params: RLHyperparameters,
  dt: number,
  windImpulseX = 0
): RigidBodyState {
  if (state.crashed) {
    return state;
  }

  const next: RigidBodyState = {
    position: { ...state.position },
    velocity: { ...state.velocity },
    attitude: { ...state.attitude },
    angularVelocity: { ...state.angularVelocity },
    copvPressurePsi: state.copvPressurePsi,
    propellantRemainingPct: state.propellantRemainingPct,
    gForce: state.gForce,
    wallContactNormalForceN: 0,
    isGrounded: false,
    isOnWall: false,
    crashed: false,
    missionProgressPct: Math.min(100, Math.round((state.elapsedTimeSec + dt) * 20)),
    elapsedTimeSec: state.elapsedTimeSec + dt,
  };

  const gravity = GRAVITY_EARTH * params.gravityMultiplier;
  const blowdownScale = Math.max(0.2, Math.min(1.15, state.copvPressurePsi / 8500));

  const fl = thrusters.frontLeftLift * MAX_CORNER_THRUST_N * blowdownScale;
  const fr = thrusters.frontRightLift * MAX_CORNER_THRUST_N * blowdownScale;
  const rl = thrusters.rearLeftLift * MAX_CORNER_THRUST_N * blowdownScale;
  const rr = thrusters.rearRightLift * MAX_CORNER_THRUST_N * blowdownScale;
  const totalUnderbodyLiftN = fl + fr + rl + rr;

  const lateralLeftN = thrusters.lateralLeft * MAX_LATERAL_THRUST_N * blowdownScale;
  const lateralRightN = thrusters.lateralRight * MAX_LATERAL_THRUST_N * blowdownScale;
  const rearBoostN = thrusters.rearBoost * MAX_REAR_BOOST_N * blowdownScale;

  if (missionId === 'roadster-wall-climb') {
    // Stunt 02: Hot-Wheels Giant Overhanging Half-Loop -> Mid-Air Kickflip -> Slow Landing at Original Position
    // velocity.z >= 0: arc-length s on loop; -1: clean airborne dismount; -2: peeled off loop; -3: landed rollout at origin
    const phaseFlag = state.velocity.z;

    if (phaseFlag === -3) {
      // Phase 3: Smooth post-landing rollout back to rest at the original starting position (x = -8.5m)
      next.position.y = GROUND_Y;
      next.velocity.y = 0;
      const targetOriginX = HALF_LOOP_RUNWAY_START_X;
      const dxToOrigin = targetOriginX - next.position.x;
      next.velocity.x = next.velocity.x * Math.max(0, 1 - 3.2 * dt) + dxToOrigin * 1.8 * dt;
      if (Math.abs(dxToOrigin) < 0.15 && Math.abs(next.velocity.x) < 0.25) {
        next.velocity.x = 0;
        next.position.x = targetOriginX;
      } else {
        next.position.x = Math.max(HALF_LOOP_RUNWAY_START_X - 0.5, Math.min(8.0, next.position.x + next.velocity.x * dt));
      }
      next.velocity.z = -3;
      next.attitude.pitch = 0;
      next.attitude.roll = Math.PI * 2;
      next.angularVelocity.x = 0;
      next.angularVelocity.y = 0;
      next.isGrounded = true;
      next.isOnWall = false;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else if (phaseFlag >= 0) {
      const currentArcS = Math.max(0, state.velocity.z === 0 && state.elapsedTimeSec <= dt ? 0 : state.velocity.z);
      const sample = sampleHotWheelsHalfLoop(currentArcS);

      // Tangential speed along the loop track
      const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
      const electricAWDDriveN = 9200;
      const gravityTangentialN = ROADSTER_MASS_KG * gravity * Math.sin(sample.tangentAngle);
      const aeroDragN = 62 * currentSpeed;

      const tangentialAccel =
        (electricAWDDriveN + rearBoostN * 0.95 - gravityTangentialN - aeroDragN) / ROADSTER_MASS_KG;
      const nextSpeed = Math.max(0, Math.min(15.8, currentSpeed + tangentialAccel * dt));
      const nextArcS = currentArcS + nextSpeed * dt;
      const nextSample = sampleHotWheelsHalfLoop(nextArcS);

      // Normal force pressing tires into the loop track:
      // N = m*g*cos(theta) + m*v^2*curvature + F_thruster_pinning
      const gravityNormalN = ROADSTER_MASS_KG * gravity * Math.cos(nextSample.tangentAngle);
      const centripetalNormalN = ROADSTER_MASS_KG * nextSpeed * nextSpeed * nextSample.curvature;
      const thrusterPinningN =
        lateralRightN * 1.18 + rearBoostN * 0.42 + thrusters.activeWingAngle * 2800;

      const netNormalForceN = gravityNormalN + centripetalNormalN + thrusterPinningN;
      next.wallContactNormalForceN = Math.max(0, netNormalForceN);

      if (nextSample.isPastLip) {
        // Reached the overhanging top lip (142 deg, x ~ 4.56m, y ~ 13.38m)!
        // Launch into a pure gravity ballistic arc back toward the original starting position (x = -8.5m)
        // while executing a mid-air 360° Kickflip — ZERO mid-air levitation!
        next.position.x = nextSample.carCenterX;
        next.position.y = nextSample.carCenterY;
        next.velocity.x = -5.85; // Directed back toward the starting runway (x = -8.5m)
        next.velocity.y = 1.65; // Modest upward pop off the lip; gravity immediately curves it downward
        next.velocity.z = -1; // Flag: clean airborne dismount phase
        next.attitude.pitch = nextSample.tangentAngle;
        next.attitude.roll = 0;
        next.angularVelocity.x = 2.8;
        next.angularVelocity.y = 1.6;
        next.isOnWall = false;
        next.isGrounded = false;
      } else if (nextSample.tangentAngle > 1.05 && netNormalForceN < 1200) {
        // Untrained AI failed to generate enough thruster/centripetal normal force on the overhang!
        // Car peels off the loop and falls under real gravity!
        next.position.x = nextSample.carCenterX - nextSample.normalX * 0.12;
        next.position.y = nextSample.carCenterY - nextSample.normalY * 0.12;
        next.velocity.x = nextSample.tangentX * nextSpeed * 0.4 - 1.5;
        next.velocity.y = Math.min(0, nextSample.tangentY * nextSpeed * 0.3);
        next.velocity.z = -2; // Flag: detached falling from loop
        next.attitude.pitch = nextSample.tangentAngle;
        next.isOnWall = false;
        next.isGrounded = false;
      } else {
        // Locked smoothly onto the exact parametric loop surface — zero ramp clipping!
        next.position.x = nextSample.carCenterX;
        next.position.y = nextSample.carCenterY;
        next.velocity.x = nextSample.tangentX * nextSpeed;
        next.velocity.y = nextSample.tangentY * nextSpeed;
        next.velocity.z = nextArcS;
        next.attitude.pitch = nextSample.tangentAngle;
        next.attitude.roll = 0;
        next.isOnWall = nextSample.tangentAngle > 0.55;
        next.isGrounded = !next.isOnWall;
      }
    } else {
      // Airborne after launching off the overhanging loop lip (-1) or falling off the loop (-2)
      const isCleanDismount = phaseFlag === -1;

      // CRITICAL: Zero upward lift while high in the air (y > 4.2m) so the car NEVER levitates!
      // Below y <= 4.2m during descent, progressive rocket retro-cushion slows vertical speed for a soft landing.
      let retroVerticalForceN = 0;
      if (isCleanDismount && state.position.y <= 4.2 && state.velocity.y < 0) {
        const altFactor = Math.max(0, Math.min(1, (4.2 - state.position.y) / 3.4));
        const targetSlowVy = -1.15 - (1 - altFactor) * 1.6;
        const vyError = targetSlowVy - state.velocity.y;
        const thrustRatio = Math.min(1, totalUnderbodyLiftN / ( ROADSTER_MASS_KG * gravity * 0.95));
        retroVerticalForceN =
          ROADSTER_MASS_KG * gravity * thrustRatio +
          Math.max(0, vyError * ROADSTER_MASS_KG * 6.8 * thrustRatio);
      }

      const ay = (retroVerticalForceN - ROADSTER_MASS_KG * gravity) / ROADSTER_MASS_KG;
      const ax = (-22 * next.velocity.x + windImpulseX * 0.25) / ROADSTER_MASS_KG;

      next.velocity.x += ax * dt;
      next.velocity.y += ay * dt;
      next.position.x = Math.max(
        HALF_LOOP_RUNWAY_START_X - 0.5,
        Math.min(10.5, next.position.x + next.velocity.x * dt)
      );
      next.position.y += next.velocity.y * dt;
      next.velocity.z = phaseFlag;

      if (isCleanDismount) {
        // Mid-air 360° Kickflip (roll 0 -> 2*PI) driven by side thrusters + differential corner nozzles
        // while leveling pitch from 142 deg (2.48 rad) to 360 deg (2*PI rad = upright!)
        const sideKickTorque = (lateralLeftN * 0.85 + lateralRightN * 0.45) * 0.65;
        const cornerRollTorque = Math.abs((fl + rl) - (fr + rr)) * 1.15;
        const Ixx = 820;
        const angularAccelRoll = (sideKickTorque + cornerRollTorque) / Ixx;
        next.angularVelocity.x = Math.min(
          6.5,
          Math.max(2.9, next.angularVelocity.x + angularAccelRoll * dt)
        );
        next.attitude.roll = Math.min(
          Math.PI * 2,
          next.attitude.roll + next.angularVelocity.x * dt
        );

        const pitchTorque = ((fl + fr) - (rl + rr)) * 1.35 + 2900;
        const Iyy = 1950;
        next.angularVelocity.y =
          (next.angularVelocity.y + (pitchTorque / Iyy) * dt) * Math.max(0.78, 1 - 1.1 * dt);
        next.attitude.pitch = Math.min(
          Math.PI * 2,
          next.attitude.pitch + Math.max(2.1, next.angularVelocity.y) * dt
        );
      } else {
        // Tumbling fall under gravity when peeled off the loop
        next.attitude.pitch -= 1.8 * dt;
        next.attitude.roll += 1.6 * dt;
      }

      if (next.position.y <= GROUND_Y) {
        const pitchError = Math.min(Math.abs(next.attitude.pitch), Math.abs(Math.PI * 2 - next.attitude.pitch));
        const rollError = Math.abs(Math.PI * 2 - next.attitude.roll);
        if (!isCleanDismount || Math.abs(next.velocity.y) > 6.5 || pitchError > 0.75 || rollError > 0.75) {
          next.crashed = true;
        } else {
          next.attitude.pitch = 0;
          next.attitude.roll = Math.PI * 2;
          next.angularVelocity.x = 0;
          next.angularVelocity.y = 0;
          next.velocity.x *= 0.45;
          next.velocity.z = -3;
        }
        next.position.y = GROUND_Y;
        next.velocity.y = 0;
        next.isGrounded = true;
        next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
      }
    }
  } else if (missionId === 'roadster-barrel-roll') {
    // Stunt 03: Curved Quarter-Pipe Launch Ramp -> Mid-Air Thruster Kickflip -> Slow Retro-Cushion Landing
    const rampSample = sampleCurvedKickflipRamp(next.position.x);

    if (next.position.x < KICKFLIP_RAMP_START_X && next.position.y <= GROUND_Y + 0.08) {
      const ax = (rearBoostN + 7800 - 135 * next.velocity.x) / ROADSTER_MASS_KG;
      next.velocity.x = Math.min(10.8, next.velocity.x + ax * dt);
      next.position.x += next.velocity.x * dt;
      next.position.y = GROUND_Y;
      next.attitude.pitch = 0;
      next.attitude.roll = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else if (
      rampSample.isOnRamp &&
      next.position.y <= rampSample.carCenterY + 0.35 &&
      next.attitude.roll < 0.35
    ) {
      // Phase 2A: Riding UP the Curved Steel Quarter-Pipe surface and launching off the top lip
      const speedX = Math.max(5.8, next.velocity.x);
      next.position.x += speedX * dt;
      const clampedRampX = Math.min(KICKFLIP_RAMP_END_X, next.position.x);
      const updatedRamp = sampleCurvedKickflipRamp(clampedRampX);
      const exitedLip = next.position.x >= KICKFLIP_RAMP_END_X;
      next.position.y = updatedRamp.carCenterY + (exitedLip ? 0.14 : 0);
      next.attitude.pitch = updatedRamp.tangentAngle;
      next.velocity.x = exitedLip ? 5.6 : speedX;
      next.velocity.y =
        Math.sin(updatedRamp.tangentAngle) * speedX +
        3.8 +
        (totalUnderbodyLiftN / ROADSTER_MASS_KG) * 0.08;
      next.isGrounded = !exitedLip;
      next.wallContactNormalForceN = exitedLip ? 0 : ROADSTER_MASS_KG * gravity * 1.45;
    } else if (
      next.position.x > KICKFLIP_RAMP_END_X + 2.0 &&
      next.position.y <= GROUND_Y + 0.05 &&
      next.attitude.roll >= Math.PI * 1.65
    ) {
      // Phase 3B: Smooth rollout on the open landing deck after completing the 360° Kickflip
      next.position.y = GROUND_Y;
      next.velocity.y = 0;
      next.velocity.x = Math.max(0, next.velocity.x * (1 - 2.1 * dt));
      next.position.x = Math.min(9.0, next.position.x + next.velocity.x * dt);
      next.attitude.roll = Math.PI * 2;
      next.attitude.pitch *= 0.8;
      next.angularVelocity.x = 0;
      next.angularVelocity.y = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else {
      // Phase 2B: Airborne 360° Thruster Kickflip under real gravity + Slow Retro-Cushion Touchdown
      // High in the air: gravity pulls the car along a true parabola (zero artificial levitation).
      // Near the ground (y <= 3.1m and descending): underbody nozzles fire a retro-cushion to land slowly!
      let verticalRetroLiftN = 0;
      if (state.position.y <= 3.1 && state.velocity.y < -0.2) {
        const altBlend = Math.max(0, Math.min(1, (3.1 - state.position.y) / 2.5));
        const desiredTouchdownVy = -1.05 - (1 - altBlend) * 1.4;
        const vyDiff = desiredTouchdownVy - state.velocity.y;
        const powerScale = Math.min(1, totalUnderbodyLiftN / (ROADSTER_MASS_KG * gravity * 0.88));
        verticalRetroLiftN =
          ROADSTER_MASS_KG * gravity * powerScale +
          Math.max(0, vyDiff * ROADSTER_MASS_KG * 6.5 * powerScale);
      } else {
        verticalRetroLiftN = Math.min(totalUnderbodyLiftN * 0.22, ROADSTER_MASS_KG * gravity * 0.32);
      }

      const ay = (verticalRetroLiftN - ROADSTER_MASS_KG * gravity) / ROADSTER_MASS_KG;
      const ax = (rearBoostN * 0.16 - 90 * next.velocity.x + windImpulseX * 0.25) / ROADSTER_MASS_KG;

      next.velocity.x = Math.max(2.6, Math.min(7.2, next.velocity.x + ax * dt));
      next.velocity.y += ay * dt;
      next.position.x = Math.min(9.0, next.position.x + next.velocity.x * dt);
      next.position.y += next.velocity.y * dt;

      // Prevent any downward penetration if still over the ramp x-interval
      const underRamp = sampleCurvedKickflipRamp(next.position.x);
      if (underRamp.isOnRamp && next.position.y < underRamp.carCenterY) {
        next.position.y = underRamp.carCenterY;
      }

      // Both differential underbody nozzles AND side rocker nozzles contribute to the 360° Kickflip torque!
      const sideJetTorque = (lateralLeftN - lateralRightN * 0.4) * 0.38;
      const rollTorque = ((fl + rl) - (fr + rr)) * 1.25 + sideJetTorque;
      const pitchTorque = ((fl + fr) - (rl + rr)) * 0.95;
      const Ixx = 820;
      const Iyy = 2100;

      next.angularVelocity.x =
        (next.angularVelocity.x + (rollTorque / Ixx) * dt) * Math.max(0.75, 1 - 0.95 * dt);
      next.angularVelocity.y =
        (next.angularVelocity.y + (pitchTorque / Iyy) * dt) * Math.max(0.75, 1 - 1.5 * dt);

      next.attitude.roll = Math.max(
        0,
        Math.min(Math.PI * 2.35, next.attitude.roll + next.angularVelocity.x * dt)
      );

      const flipProgress = Math.min(1, next.attitude.roll / (Math.PI * 2));
      const targetKickPitch = Math.sin(flipProgress * Math.PI * 2) * 0.28 * (1 - flipProgress * 0.5);
      next.attitude.pitch +=
        (targetKickPitch - next.attitude.pitch) * Math.min(1, dt * 7) +
        next.angularVelocity.y * dt * 0.25;

      if (next.position.y <= GROUND_Y) {
        const impactVy = Math.abs(next.velocity.y);
        const rollErrorFrom360 = Math.abs(Math.PI * 2 - next.attitude.roll);
        if (impactVy > 6.2 || rollErrorFrom360 > 0.65) {
          next.crashed = true;
        } else {
          next.attitude.roll = Math.PI * 2;
          next.attitude.pitch = 0;
          next.angularVelocity.x = 0;
          next.angularVelocity.y = 0;
        }
        next.position.y = GROUND_Y;
        next.velocity.y = 0;
        next.isGrounded = true;
        next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
      }
    }
  } else {
    // Stunt 01: Supersonic Cold-Gas Hover (Image 3)
    const cosRoll = Math.cos(next.attitude.roll);
    const sinRoll = Math.sin(next.attitude.roll);
    const cosPitch = Math.cos(next.attitude.pitch);

    const verticalForceN =
      totalUnderbodyLiftN * cosRoll * cosPitch - ROADSTER_MASS_KG * gravity;
    const lateralForceX =
      lateralLeftN -
      lateralRightN -
      totalUnderbodyLiftN * sinRoll * 0.35 +
      windImpulseX -
      140 * next.velocity.x;

    const ax = lateralForceX / ROADSTER_MASS_KG;
    const ay = verticalForceN / ROADSTER_MASS_KG;

    next.velocity.x += ax * dt;
    next.velocity.y += ay * dt;
    next.position.x = Math.max(-9, Math.min(9, next.position.x + next.velocity.x * dt));
    next.position.y += next.velocity.y * dt;

    const rollTorque = (fl + rl - (fr + rr)) * 0.95 + (lateralLeftN - lateralRightN) * 0.25;
    const pitchTorque = (fl + fr - (rl + rr)) * 1.35;
    const Ixx = 920;
    const Iyy = 2450;

    next.angularVelocity.x =
      (next.angularVelocity.x + (rollTorque / Ixx) * dt) * Math.max(0.7, 1 - 1.2 * dt);
    next.angularVelocity.y =
      (next.angularVelocity.y + (pitchTorque / Iyy) * dt) * Math.max(0.7, 1 - 1.4 * dt);

    next.attitude.roll += next.angularVelocity.x * dt;
    next.attitude.pitch = Math.max(
      -0.85,
      Math.min(0.85, next.attitude.pitch + next.angularVelocity.y * dt)
    );

    if (next.position.y <= GROUND_Y) {
      const impactSpeed = Math.abs(next.velocity.y);
      const rollMod = Math.abs(((next.attitude.roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      const tiltError = Math.min(rollMod, Math.abs(Math.PI * 2 - rollMod));
      if (impactSpeed > 6.5 || (state.position.y > 1.8 && tiltError > 0.75)) {
        next.crashed = true;
      }
      next.position.y = GROUND_Y;
      next.velocity.y = Math.max(0, next.velocity.y);
      next.velocity.x *= 0.85;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    }
  }

  const totalValveDuty =
    (thrusters.frontLeftLift +
      thrusters.frontRightLift +
      thrusters.rearLeftLift +
      thrusters.rearRightLift +
      thrusters.lateralLeft +
      thrusters.lateralRight +
      thrusters.rearBoost) /
    7;

  const psiDrainRate = totalValveDuty * 420 * (0.6 + 0.4 / Math.max(0.3, params.rewardFuelWeight));
  const electricPlaidCompressorRecharge = 85;
  next.copvPressurePsi = Math.max(
    1800,
    Math.min(
      params.initialCopvPsi,
      next.copvPressurePsi - (psiDrainRate - electricPlaidCompressorRecharge) * dt
    )
  );
  next.propellantRemainingPct = Math.round(
    ((next.copvPressurePsi - 1800) / Math.max(1000, params.initialCopvPsi - 1800)) * 100
  );

  const totalThrustMag =
    totalUnderbodyLiftN + Math.abs(lateralLeftN - lateralRightN) + rearBoostN;
  next.gForce = Number((totalThrustMag / (ROADSTER_MASS_KG * GRAVITY_EARTH)).toFixed(2));

  return next;
}
