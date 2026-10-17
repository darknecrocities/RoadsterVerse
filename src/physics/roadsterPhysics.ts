import type {
  MissionId,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
} from '../types/simulation.ts';

const EARTH_GRAVITY = 9.81; // m/s^2
const ROADSTER_MASS_KG = 1850;
const MAX_VERTICAL_THRUST_N = 34000; // 4 corners combined at 10,000 PSI (~1.87G vertical capability)
const MAX_LATERAL_THRUST_N = 19500;  // Side/wall-pinning cold-gas nozzle thrust
const MAX_REAR_BOOST_N = 26000;      // Rear SpaceX package longitudinal rocket thruster
const TIRE_FRICTION_COEFF = 1.35;    // Michelin Pilot Sport Cup 2R warm slick compound

export function createInitialRoadsterState(
  missionId: MissionId,
  params: RLHyperparameters
): RigidBodyState {
  if (missionId === 'roadster-wall-climb') {
    return {
      position: { x: -4.0, y: 0.45, z: 0 },
      velocity: { x: 5.5, y: 0, z: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      copvPressurePsi: params.initialCopvPsi,
      propellantRemainingPct: 100,
      gForce: 1.0,
      wallContactNormalForceN: 0,
      isOnWall: false,
      isGrounded: true,
      crashed: false,
      missionProgressPct: 0,
      elapsedTimeSec: 0,
    };
  }

  if (missionId === 'roadster-barrel-roll') {
    // Starts at the beginning of the Tesla Demo Stunt Road for the Kicker Ramp Launch + Kickflip!
    return {
      position: { x: -8.8, y: 0.45, z: 0 },
      velocity: { x: 4.2, y: 0, z: 0 },
      attitude: { roll: 0, pitch: 0, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      copvPressurePsi: params.initialCopvPsi,
      propellantRemainingPct: 100,
      gForce: 1.0,
      wallContactNormalForceN: 0,
      isOnWall: false,
      isGrounded: true,
      crashed: false,
      missionProgressPct: 0,
      elapsedTimeSec: 0,
    };
  }

  return {
    position: { x: 0, y: 0.45, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    attitude: { roll: 0, pitch: 0, yaw: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    copvPressurePsi: params.initialCopvPsi,
    propellantRemainingPct: 100,
    gForce: 1.0,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: true,
    crashed: false,
    missionProgressPct: 0,
    elapsedTimeSec: 0,
  };
}

export function stepRoadsterPhysics(
  state: RigidBodyState,
  thrusters: ThrusterActivation,
  missionId: MissionId,
  params: RLHyperparameters,
  dt: number,
  windImpulseX = 0
): RigidBodyState {
  const next: RigidBodyState = {
    position: { ...state.position },
    velocity: { ...state.velocity },
    attitude: { ...state.attitude },
    angularVelocity: { ...state.angularVelocity },
    copvPressurePsi: state.copvPressurePsi,
    propellantRemainingPct: state.propellantRemainingPct,
    gForce: state.gForce,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: false,
    crashed: state.crashed,
    missionProgressPct: state.missionProgressPct,
    elapsedTimeSec: state.elapsedTimeSec + dt,
  };

  if (next.crashed) {
    return next;
  }

  const gravity = EARTH_GRAVITY * params.gravityMultiplier;
  const pressureScale = Math.max(0.15, Math.min(1.15, next.copvPressurePsi / 8500));

  const fl = thrusters.frontLeftLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const fr = thrusters.frontRightLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const rl = thrusters.rearLeftLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const rr = thrusters.rearRightLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const totalUnderbodyLiftN = fl + fr + rl + rr;

  const lateralLeftN = thrusters.lateralLeft * MAX_LATERAL_THRUST_N * pressureScale;
  const lateralRightN = thrusters.lateralRight * MAX_LATERAL_THRUST_N * pressureScale;
  const rearBoostN = thrusters.rearBoost * MAX_REAR_BOOST_N * pressureScale;

  if (missionId === 'roadster-wall-climb') {
    const rampStartX = 2.0;
    const wallX = 11.4;
    const rampRadius = 9.4;

    if (next.position.x < rampStartX && next.position.y <= 0.6) {
      const accelX = (rearBoostN + 6500 - 180 * next.velocity.x) / ROADSTER_MASS_KG;
      next.velocity.x = Math.min(13.5, next.velocity.x + accelX * dt);
      next.position.x += next.velocity.x * dt;
      next.position.y = 0.45;
      next.attitude.pitch = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else {
      const curveProgress = Math.min(1, Math.max(0, (next.position.x - rampStartX) / (wallX - rampStartX)));
      const rampAngle = Math.min(Math.PI / 2, curveProgress * (Math.PI / 2) + (next.position.y > 3.5 ? 0.35 : 0));

      const activeAeroDownforceN = thrusters.activeWingAngle * 4200 * (next.velocity.y * 0.15 + 1);
      const centripetalNormalN =
        rampAngle < 1.48
          ? (ROADSTER_MASS_KG * (next.velocity.x * next.velocity.x + next.velocity.y * next.velocity.y)) /
            rampRadius
          : 0;

      const thrusterPinningNormalN =
        lateralRightN * 1.15 + totalUnderbodyLiftN * 0.55 + activeAeroDownforceN;
      const normalForceN = Math.max(
        0,
        ROADSTER_MASS_KG * gravity * Math.cos(rampAngle) + centripetalNormalN + thrusterPinningNormalN
      );
      next.wallContactNormalForceN = normalForceN;

      const maxTireFrictionN = TIRE_FRICTION_COEFF * normalForceN;
      const gravityParallelN = ROADSTER_MASS_KG * gravity * Math.sin(rampAngle);

      if (maxTireFrictionN >= gravityParallelN * 0.72) {
        next.isOnWall = rampAngle > 0.6;
        const climbDriveForceN = rearBoostN * 0.85 + (maxTireFrictionN - gravityParallelN) * 0.45;
        const targetVy = next.position.y < 8.5 ? 4.2 : 0.0;
        const rawAy = (climbDriveForceN - gravityParallelN * 0.25) / ROADSTER_MASS_KG;
        next.velocity.y += (rawAy * 0.4 + (targetVy - next.velocity.y) * 2.8) * dt;
        next.position.y = Math.max(0.45, Math.min(12.2, next.position.y + next.velocity.y * dt));
        next.position.x = Math.min(wallX, rampStartX + Math.sin(rampAngle) * (wallX - rampStartX));
        next.attitude.pitch += (rampAngle - next.attitude.pitch) * Math.min(1, dt * 6);
        next.attitude.roll *= 0.9;
      } else {
        next.isOnWall = false;
        next.velocity.y -= gravity * dt;
        next.velocity.x -= 2.4 * dt;
        next.position.x = Math.max(-4, next.position.x + next.velocity.x * dt);
        next.position.y = Math.max(0.45, next.position.y + next.velocity.y * dt);
        next.attitude.roll += 1.4 * dt;
        next.attitude.pitch = Math.max(0, next.attitude.pitch - 1.1 * dt);
        if (next.position.y <= 0.46 && state.position.y > 2.5) {
          next.crashed = true;
        }
      }
    }
  } else if (missionId === 'roadster-barrel-roll') {
    // Stunt 03: Tesla Demo Stunt Road Sprint -> Kicker Ramp Launch -> 360° Kickflip -> Smooth Landing!
    const kickerStartX = -3.8;
    const kickerEndX = -1.2;
    const landingZoneX = 3.2;

    if (next.position.x < kickerStartX && next.position.y <= 0.55) {
      // Phase 1: Sprint along the Stunt Road toward the Kicker Ramp
      const ax = (rearBoostN + 7200 - 150 * next.velocity.x) / ROADSTER_MASS_KG;
      next.velocity.x = Math.min(10.5, next.velocity.x + ax * dt);
      next.position.x += next.velocity.x * dt;
      next.position.y = 0.45;
      next.attitude.pitch = 0;
      next.attitude.roll = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else if (
      next.position.x >= kickerStartX &&
      next.position.x <= kickerEndX &&
      next.position.y <= 1.55 &&
      next.attitude.roll < 0.35
    ) {
      // Phase 2A: Ascending the Stunt Road Kicker Ramp and popping into the air
      const rampFrac = (next.position.x - kickerStartX) / (kickerEndX - kickerStartX);
      const kickerAngle = 0.38; // ~22 deg launch ramp
      next.position.x += Math.max(5.5, next.velocity.x) * dt;
      next.position.y = 0.45 + rampFrac * 1.05;
      next.velocity.y = Math.max(next.velocity.y, 5.6 + (totalUnderbodyLiftN / ROADSTER_MASS_KG) * 0.12);
      next.attitude.pitch = kickerAngle;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity * 1.3;
    } else if (next.position.x >= landingZoneX && next.position.y <= 0.52 && next.attitude.roll >= Math.PI * 1.65) {
      // Phase 3B: Smooth roll-out on the Stunt Road Landing Deck after completing the 360° Kickflip!
      next.position.y = 0.45;
      next.velocity.y = 0;
      next.velocity.x = Math.max(0, next.velocity.x * (1 - 1.8 * dt));
      next.position.x = Math.min(8.5, next.position.x + next.velocity.x * dt);
      next.attitude.roll = Math.PI * 2;
      next.attitude.pitch *= 0.82;
      next.angularVelocity.x = 0;
      next.angularVelocity.y = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else {
      // Phase 2B: Airborne 360° Kickflip Trajectory (coupled roll + nose kick + cold-gas cushion)
      const verticalLiftN = totalUnderbodyLiftN * 0.68 - ROADSTER_MASS_KG * gravity;
      const ay = verticalLiftN / ROADSTER_MASS_KG;
      const ax = (rearBoostN * 0.18 - 95 * next.velocity.x + windImpulseX * 0.25) / ROADSTER_MASS_KG;

      next.velocity.x = Math.max(2.6, Math.min(7.5, next.velocity.x + ax * dt));
      next.velocity.y += ay * dt;
      next.position.x = Math.min(8.5, next.position.x + next.velocity.x * dt);
      next.position.y += next.velocity.y * dt;

      // Differential left vs right thrusters drive the 360° roll; front vs rear drives the kickflip pitch
      const rollTorque = ((fl + rl) - (fr + rr)) * 1.25;
      const pitchTorque = ((fl + fr) - (rl + rr)) * 0.95;
      const Ixx = 820;
      const Iyy = 2100;

      next.angularVelocity.x =
        (next.angularVelocity.x + (rollTorque / Ixx) * dt) * Math.max(0.75, 1 - 0.95 * dt);
      next.angularVelocity.y =
        (next.angularVelocity.y + (pitchTorque / Iyy) * dt) * Math.max(0.75, 1 - 1.5 * dt);

      next.attitude.roll = Math.max(0, Math.min(Math.PI * 2.35, next.attitude.roll + next.angularVelocity.x * dt));

      // Coupled kickflip pitch wave: nose kicks up at start of flip, dips mid-flip, and levels out at 360°
      const flipProgress = Math.min(1, next.attitude.roll / (Math.PI * 2));
      const targetKickPitch = Math.sin(flipProgress * Math.PI * 2) * 0.28 * (1 - flipProgress * 0.5);
      next.attitude.pitch += (targetKickPitch - next.attitude.pitch) * Math.min(1, dt * 7) + next.angularVelocity.y * dt * 0.25;

      // Check landing touchdown on the Stunt Road
      if (next.position.y <= 0.45) {
        const impactVy = Math.abs(next.velocity.y);
        const rollErrorFrom360 = Math.abs(Math.PI * 2 - next.attitude.roll);
        if (impactVy > 6.2 || rollErrorFrom360 > 0.65) {
          next.crashed = true;
        } else {
          // Smooth four-wheel landing!
          next.attitude.roll = Math.PI * 2;
          next.attitude.pitch = 0;
          next.angularVelocity.x = 0;
          next.angularVelocity.y = 0;
        }
        next.position.y = 0.45;
        next.velocity.y = 0;
        next.isGrounded = true;
        next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
      }
    }
  } else {
    // Stunt 01: Free-flight 6-DoF Supersonic Cold-Gas Hover
    const cosRoll = Math.cos(next.attitude.roll);
    const sinRoll = Math.sin(next.attitude.roll);
    const cosPitch = Math.cos(next.attitude.pitch);

    const verticalForceN =
      totalUnderbodyLiftN * cosRoll * cosPitch - ROADSTER_MASS_KG * gravity;
    const lateralForceX =
      (lateralLeftN - lateralRightN) -
      totalUnderbodyLiftN * sinRoll * 0.35 +
      windImpulseX -
      140 * next.velocity.x;

    const ax = lateralForceX / ROADSTER_MASS_KG;
    const ay = verticalForceN / ROADSTER_MASS_KG;

    next.velocity.x += ax * dt;
    next.velocity.y += ay * dt;
    next.position.x = Math.max(-9, Math.min(9, next.position.x + next.velocity.x * dt));
    next.position.y += next.velocity.y * dt;

    const rollTorque = ((fl + rl) - (fr + rr)) * 0.95 + (lateralLeftN - lateralRightN) * 0.25;
    const pitchTorque = ((fl + fr) - (rl + rr)) * 1.35;
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

    if (next.position.y <= 0.45) {
      const impactSpeed = Math.abs(next.velocity.y);
      const rollMod = Math.abs(((next.attitude.roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      const tiltError = Math.min(rollMod, Math.abs(Math.PI * 2 - rollMod));
      if (impactSpeed > 6.5 || (state.position.y > 1.8 && tiltError > 0.75)) {
        next.crashed = true;
      }
      next.position.y = 0.45;
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

  const totalThrustN = totalUnderbodyLiftN + lateralLeftN + lateralRightN + rearBoostN;
  next.gForce = Number((Math.max(1.0, totalThrustN / (ROADSTER_MASS_KG * EARTH_GRAVITY))).toFixed(2));

  if (missionId === 'roadster-hover') {
    const altAcc = Math.max(0, 1 - Math.abs(next.position.y - 3.8) / 3.8);
    next.missionProgressPct = Math.min(100, Math.round(altAcc * 100));
  } else if (missionId === 'roadster-wall-climb') {
    next.missionProgressPct = Math.min(100, Math.round((next.position.y / 8.5) * 100));
  } else {
    next.missionProgressPct = Math.min(
      100,
      Math.round((Math.min(Math.PI * 2, Math.abs(next.attitude.roll)) / (Math.PI * 2)) * 100)
    );
  }

  return next;
}
