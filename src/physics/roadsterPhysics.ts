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
    // Stunt 02: Hot-Wheels Giant Overhanging Half-Loop & Sky Flip (Image 1)
    // Track arc-length s in velocity.z while riding the loop surface; velocity.z < 0 means detached/airborne!
    const isDetachedOrPastLip = state.velocity.z < 0;

    if (!isDetachedOrPastLip) {
      const currentArcS = Math.max(0, state.velocity.z === 0 && state.elapsedTimeSec <= dt ? 0 : state.velocity.z);
      const sample = sampleHotWheelsHalfLoop(currentArcS);

      // Tangential speed along the loop track
      const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
      const electricAWDDriveN = 8800;
      const gravityTangentialN = ROADSTER_MASS_KG * gravity * Math.sin(sample.tangentAngle);
      const aeroDragN = 65 * currentSpeed;

      const tangentialAccel =
        (electricAWDDriveN + rearBoostN * 0.92 - gravityTangentialN - aeroDragN) / ROADSTER_MASS_KG;
      const nextSpeed = Math.max(0, Math.min(15.5, currentSpeed + tangentialAccel * dt));
      const nextArcS = currentArcS + nextSpeed * dt;
      const nextSample = sampleHotWheelsHalfLoop(nextArcS);

      // Normal force pressing tires into the loop track:
      // N = m*g*cos(theta) + m*v^2*curvature + F_thruster_pinning
      // Note: When theta > 90 deg (upside-down on overhang!), cos(theta) < 0 so gravity pulls the car OFF the loop!
      const gravityNormalN = ROADSTER_MASS_KG * gravity * Math.cos(nextSample.tangentAngle);
      const centripetalNormalN = ROADSTER_MASS_KG * nextSpeed * nextSpeed * nextSample.curvature;
      const thrusterPinningN =
        lateralRightN * 1.18 + rearBoostN * 0.42 + thrusters.activeWingAngle * 2800;

      const netNormalForceN = gravityNormalN + centripetalNormalN + thrusterPinningN;
      next.wallContactNormalForceN = Math.max(0, netNormalForceN);

      if (nextSample.isPastLip) {
        // Reached the overhanging top lip (142 deg, Image 1)! Launch into mid-air sky-flip dismount!
        next.position.x = nextSample.carCenterX;
        next.position.y = nextSample.carCenterY;
        next.velocity.x = nextSample.tangentX * Math.max(6.2, nextSpeed * 0.65);
        next.velocity.y = nextSample.tangentY * Math.max(4.0, nextSpeed * 0.45);
        next.velocity.z = -1; // Flag: airborne dismount phase
        next.attitude.pitch = nextSample.tangentAngle;
        next.attitude.roll = 0;
        next.isOnWall = false;
        next.isGrounded = false;
      } else if (nextSample.tangentAngle > 1.05 && netNormalForceN < 1200) {
        // Untrained AI failed to generate enough thruster/centripetal normal force on the vertical/overhanging loop!
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
      const isCleanDismount = state.velocity.z === -1;
      const verticalCushionN = isCleanDismount ? totalUnderbodyLiftN * 0.78 : totalUnderbodyLiftN * 0.25;
      const ay = (verticalCushionN - ROADSTER_MASS_KG * gravity) / ROADSTER_MASS_KG;
      const ax = (-85 * next.velocity.x + windImpulseX * 0.3) / ROADSTER_MASS_KG;

      next.velocity.x += ax * dt;
      next.velocity.y += ay * dt;
      next.position.x = Math.max(HALF_LOOP_RUNWAY_START_X, Math.min(10.5, next.position.x + next.velocity.x * dt));
      next.position.y += next.velocity.y * dt;
      next.velocity.z = state.velocity.z;

      if (isCleanDismount) {
        // Complete the backflip from 142 deg (2.48 rad) to 360 deg (2*PI rad = upright!) using pitch nozzles
        const pitchTorque = ((fl + fr) - (rl + rr)) * 1.45 + 3200;
        const Iyy = 1950;
        next.angularVelocity.y =
          (next.angularVelocity.y + (pitchTorque / Iyy) * dt) * Math.max(0.78, 1 - 1.1 * dt);
        next.attitude.pitch = Math.min(Math.PI * 2, next.attitude.pitch + Math.max(2.6, next.angularVelocity.y) * dt);
      } else {
        // Tumbling fall under gravity when peeled off the loop
        next.attitude.pitch -= 1.8 * dt;
        next.attitude.roll += 1.6 * dt;
      }

      if (next.position.y <= GROUND_Y) {
        const pitchErrorFromUpright = Math.min(
          Math.abs(next.attitude.pitch),
          Math.abs(Math.PI * 2 - next.attitude.pitch)
        );
        if (!isCleanDismount || Math.abs(next.velocity.y) > 7.2 || pitchErrorFromUpright > 0.75) {
          next.crashed = true;
        } else {
          next.attitude.pitch = 0;
          next.attitude.roll = 0;
          next.angularVelocity.y = 0;
          next.velocity.x *= 0.6;
        }
        next.position.y = GROUND_Y;
        next.velocity.y = 0;
        next.isGrounded = true;
        next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
      }
    }
  } else if (missionId === 'roadster-barrel-roll') {
    // Stunt 03: Curved Quarter-Pipe Launch Ramp & 360° Air Kickflip (Image 2)
    const rampSample = sampleCurvedKickflipRamp(next.position.x);

    if (next.position.x < KICKFLIP_RAMP_START_X && next.position.y <= GROUND_Y + 0.08) {
      // Phase 1: Sprint along the flat runway toward the Curved Steel Quarter-Pipe
      const ax = (rearBoostN + 7600 - 140 * next.velocity.x) / ROADSTER_MASS_KG;
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
      // Phase 2A: Riding UP the exact Curved Steel Quarter-Pipe surface (zero ramp clipping!)
      const speedX = Math.max(5.8, next.velocity.x);
      next.position.x += speedX * dt;
      const updatedRamp = sampleCurvedKickflipRamp(next.position.x);
      next.position.y = updatedRamp.carCenterY;
      next.attitude.pitch = updatedRamp.tangentAngle;
      next.velocity.x = speedX;
      next.velocity.y =
        Math.sin(updatedRamp.tangentAngle) * speedX +
        3.6 +
        (totalUnderbodyLiftN / ROADSTER_MASS_KG) * 0.11;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity * 1.45;
    } else if (
      next.position.x > KICKFLIP_RAMP_END_X + 2.2 &&
      next.position.y <= GROUND_Y + 0.05 &&
      next.attitude.roll >= Math.PI * 1.65
    ) {
      // Phase 3B: Smooth rollout on the open landing deck after completing the 360° Kickflip
      next.position.y = GROUND_Y;
      next.velocity.y = 0;
      next.velocity.x = Math.max(0, next.velocity.x * (1 - 1.8 * dt));
      next.position.x = Math.min(9.0, next.position.x + next.velocity.x * dt);
      next.attitude.roll = Math.PI * 2;
      next.attitude.pitch *= 0.8;
      next.angularVelocity.x = 0;
      next.angularVelocity.y = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else {
      // Phase 2B: Airborne 360° Kickflip under real gravity + cold-gas cushion
      const verticalLiftN = totalUnderbodyLiftN * 0.68 - ROADSTER_MASS_KG * gravity;
      const ay = verticalLiftN / ROADSTER_MASS_KG;
      const ax = (rearBoostN * 0.18 - 95 * next.velocity.x + windImpulseX * 0.25) / ROADSTER_MASS_KG;

      next.velocity.x = Math.max(2.8, Math.min(7.5, next.velocity.x + ax * dt));
      next.velocity.y += ay * dt;
      next.position.x = Math.min(9.0, next.position.x + next.velocity.x * dt);
      next.position.y += next.velocity.y * dt;

      // Prevent any downward penetration if still over the ramp x-interval
      const underRamp = sampleCurvedKickflipRamp(next.position.x);
      if (underRamp.isOnRamp && next.position.y < underRamp.carCenterY) {
        next.position.y = underRamp.carCenterY;
      }

      const rollTorque = ((fl + rl) - (fr + rr)) * 1.25;
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
