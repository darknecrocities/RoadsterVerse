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
  // Blowdown pressure scaling factor (thrusters lose authority if COPV drops below 2,500 PSI)
  const pressureScale = Math.max(0.15, Math.min(1.15, next.copvPressurePsi / 8500));

  const fl = thrusters.frontLeftLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const fr = thrusters.frontRightLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const rl = thrusters.rearLeftLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const rr = thrusters.rearRightLift * (MAX_VERTICAL_THRUST_N * 0.25) * pressureScale;
  const totalUnderbodyLiftN = fl + fr + rl + rr;

  const lateralLeftN = thrusters.lateralLeft * MAX_LATERAL_THRUST_N * pressureScale;
  const lateralRightN = thrusters.lateralRight * MAX_LATERAL_THRUST_N * pressureScale;
  const rearBoostN = thrusters.rearBoost * MAX_REAR_BOOST_N * pressureScale;

  // Special handling for Stunt 02: 90-Degree Curved Concrete Mega-Ramp & Wall Adhesion
  if (missionId === 'roadster-wall-climb') {
    const rampStartX = 2.0;
    const wallX = 11.4;
    const rampRadius = 9.4;

    if (next.position.x < rampStartX && next.position.y <= 0.6) {
      // Horizontal approach sprint toward the curved mega-ramp
      const accelX = (rearBoostN + 6500 - 180 * next.velocity.x) / ROADSTER_MASS_KG;
      next.velocity.x = Math.min(13.5, next.velocity.x + accelX * dt);
      next.position.x += next.velocity.x * dt;
      next.position.y = 0.45;
      next.attitude.pitch = 0;
      next.isGrounded = true;
      next.wallContactNormalForceN = ROADSTER_MASS_KG * gravity;
    } else {
      // Transitioning up the curved ramp onto the 90-degree vertical wall
      const curveProgress = Math.min(1, Math.max(0, (next.position.x - rampStartX) / (wallX - rampStartX)));
      const rampAngle = Math.min(Math.PI / 2, curveProgress * (Math.PI / 2) + (next.position.y > 3.5 ? 0.35 : 0));

      // Outward lateral & belly thrusters push Roadster into the vertical concrete wall
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
        // Roadster sticks to the curved/vertical wall and climbs!
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
        // Insufficient lateral cold-gas pinning force: car peels off the vertical wall!
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
  } else {
    // Free-flight 6-DoF hover or barrel-roll physics (Stunts 01 & 03)
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

    // Roll & Pitch angular dynamics from differential corner thrusters
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

    // Ground contact check
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

  // COPV Pressure blowdown & compressor recharge model
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
  const electricPlaidCompressorRecharge = 85; // Onboard composite compressor replenishment
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

  // Compute instantaneous G-Force and mission progress
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
      Math.round((Math.abs(next.attitude.roll) / (Math.PI * 2)) * 100)
    );
  }

  return next;
}
