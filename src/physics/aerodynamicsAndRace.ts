import type {
  CrashType,
  EulerAngles,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
  Vector3D,
} from '../types/simulation.ts';
import { CAR_RIDE_HEIGHT } from './rampGeometry.ts';
import { resolveCrashDynamics } from './crashDynamics.ts';

export const AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m^3
export const ROADSTER_FRONTAL_AREA_M2 = 2.08; // m^2
export const ROADSTER_BASE_CD = 0.21;
export const ROADSTER_MASS_KG_RACE = 1850;
export const TIRE_MU_SLICK = 1.35;

export interface RoadsterAeroForces {
  dynamicPressurePa: number;
  dragForce: Vector3D;
  downforceN: number;
  aeroPitchTorqueNm: number;
  angleOfAttackRad: number;
}

export interface StarshipAeroForces {
  dynamicPressurePa: number;
  dragForceX: number;
  dragForceY: number;
  flapPitchTorque: number;
  flapRollTorque: number;
  angleOfAttackRad: number;
}

export interface ObstacleBox {
  id: string;
  label: string;
  x: number;
  halfWidthX: number;
  minZ: number;
  maxZ: number;
  heightY: number;
  type: 'lane-barrier' | 'full-jump-wall' | 'drone-vehicle';
}

export const GAUNTLET_START_X = 0.0;
export const GAUNTLET_FINISH_X = 1000.0;
export const GAUNTLET_ROAD_HALF_WIDTH_Z = 12.0;

/**
 * Widely spaced physical obstacles and cyber-drone vehicles along the 10km proving ground super-highway (24m wide):
 * - Hazard 1 (x = 220m, 2.2 km): Left-Lane Jersey Chicane (z in [0.5m, 11.5m]) -> Steer to Lane 3/4 (z ~ -4.2m)
 * - Hazard 2 (x = 450m, 4.5 km): Autonomous Cyber-Drone Vehicle in Lane 3 (z in [-5.8m, -0.6m]) -> Overtake via Lane 2 (z ~ +3.8m)
 * - Hazard 3 (x = 680m, 6.8 km): Right-Lane Concrete Barrier (z in [-11.5m, -0.5m]) -> Steer to Lane 1/2 (z ~ +4.2m)
 * - Hazard 4 (x = 880m, 8.8 km): Full-Width Laser Wall (z in [-11.8m, 11.8m], height = 1.2m) -> Cold-Gas Thruster Bunny-Hop Jump!
 * - Finish Line (x = 1000m, 10.0 km): Telemetry Milestone Overpass Gantry
 */
export const ROADSTER_RACE_OBSTACLES: readonly ObstacleBox[] = [
  {
    id: 'chicane-left-barrier',
    label: 'Hazard 01 // 2.2 km Left-Lane Heavy Chicane',
    x: 220.0,
    halfWidthX: 1.6,
    minZ: 0.5,
    maxZ: 11.5,
    heightY: 1.15,
    type: 'lane-barrier',
  },
  {
    id: 'autonomous-drone-vehicle-1',
    label: 'Hazard 02 // 4.5 km Autonomous Cyber-Drone Vehicle',
    x: 450.0,
    halfWidthX: 2.4,
    minZ: -5.8,
    maxZ: -0.6,
    heightY: 1.25,
    type: 'drone-vehicle',
  },
  {
    id: 'chicane-right-barrier',
    label: 'Hazard 03 // 6.8 km Right-Lane Concrete Barrier',
    x: 680.0,
    halfWidthX: 1.6,
    minZ: -11.5,
    maxZ: -0.5,
    heightY: 1.15,
    type: 'lane-barrier',
  },
  {
    id: 'full-width-laser-wall',
    label: 'Hazard 04 // 8.8 km Full-Width Laser Roadblock (Jump Required)',
    x: 880.0,
    halfWidthX: 1.8,
    minZ: -11.8,
    maxZ: 11.8,
    heightY: 1.2,
    type: 'full-jump-wall',
  },
];

/**
 * Computes explicit 3D fluid-body aerodynamics for the 2026 Tesla Roadster:
 * - Dynamic pressure q = 0.5 * rho * v^2
 * - Quadratic 3D aerodynamic drag F_drag = -q * C_D(alpha, wing) * A * v_hat
 * - Active rear-wing aerodynamic downforce F_downforce = q * C_L(wing) * A
 * - Angle-of-attack (alpha) aerodynamic pitching moment
 */
export function computeRoadsterAerodynamics(
  velocity: Vector3D,
  attitude: EulerAngles,
  activeWingAngle: number,
  windVector: Vector3D = { x: 0, y: 0, z: 0 },
  airDensityKgM3 = AIR_DENSITY_SEA_LEVEL
): RoadsterAeroForces {
  const relVx = velocity.x - windVector.x;
  const relVy = velocity.y - windVector.y;
  const relVz = velocity.z - windVector.z;
  const speedSq = relVx * relVx + relVy * relVy + relVz * relVz;
  const speed = Math.sqrt(speedSq);
  const dynamicPressurePa = 0.5 * airDensityKgM3 * speedSq;

  const flightPathAngle = Math.atan2(relVy, Math.max(0.5, Math.abs(relVx)));
  const angleOfAttackRad = attitude.pitch - flightPathAngle;

  const sideslipRad = speed > 0.5 ? Math.asin(Math.max(-1, Math.min(1, relVz / speed))) : 0;
  const wingClamped = Math.max(0, Math.min(1, activeWingAngle));
  const cd =
    ROADSTER_BASE_CD +
    0.14 * wingClamped +
    0.55 * Math.sin(angleOfAttackRad) * Math.sin(angleOfAttackRad) +
    0.35 * Math.sin(sideslipRad) * Math.sin(sideslipRad);
  const clDownforce = 0.28 + 0.92 * wingClamped;

  const dragMagN = dynamicPressurePa * cd * ROADSTER_FRONTAL_AREA_M2;
  const invSpeed = speed > 0.05 ? 1 / speed : 0;

  const dragForce: Vector3D = {
    x: -dragMagN * relVx * invSpeed,
    y: -dragMagN * relVy * invSpeed,
    z: -dragMagN * relVz * invSpeed,
  };

  const downforceN =
    dynamicPressurePa * clDownforce * ROADSTER_FRONTAL_AREA_M2 * 18.0;

  const aeroPitchTorqueNm =
    -dynamicPressurePa * ROADSTER_FRONTAL_AREA_M2 * 1.45 * Math.sin(angleOfAttackRad) -
    downforceN * 0.04 * (wingClamped - 0.45);

  return {
    dynamicPressurePa,
    dragForce,
    downforceN,
    aeroPitchTorqueNm,
    angleOfAttackRad,
  };
}

/**
 * Computes explicit atmospheric density decay, dynamic pressure q = 0.5 * rho(y) * v^2,
 * quadratic drag, and aerodynamic flap authority for SpaceX Starship & Super Heavy.
 */
export function computeStarshipAerodynamics(
  positionY: number,
  velocity: Vector3D,
  attitude: EulerAngles,
  thrusters: ThrusterActivation,
  windVector: Vector3D = { x: 0, y: 0, z: 0 }
): StarshipAeroForces {
  const rho = AIR_DENSITY_SEA_LEVEL * Math.exp(-Math.max(0, positionY) / 8500);
  const relVx = velocity.x - windVector.x;
  const relVy = velocity.y - windVector.y;
  const speedSq = relVx * relVx + relVy * relVy;
  const speed = Math.sqrt(speedSq);
  const dynamicPressurePa = 0.5 * rho * speedSq;

  const flightAngle = Math.atan2(relVx, Math.max(0.4, Math.abs(relVy)));
  const angleOfAttackRad = attitude.pitch - flightAngle;

  const bellyExposure = Math.abs(Math.sin(attitude.pitch));
  const cdEffective = 0.22 + 1.35 * bellyExposure;
  const invSpeed = speed > 0.05 ? 1 / speed : 0;
  const dragAccelMag = 0.045 * cdEffective * speedSq;

  const dragForceX = -dragAccelMag * relVx * invSpeed;
  const dragForceY = -dragAccelMag * relVy * invSpeed;

  const qAuthority = Math.max(0.35, Math.min(1.65, 0.45 + dynamicPressurePa / 45));
  const aeroFlapDiffPitch =
    thrusters.flapFrontLeft +
    thrusters.flapFrontRight -
    (thrusters.flapAftLeft + thrusters.flapAftRight);
  const aeroFlapDiffRoll =
    thrusters.flapFrontLeft +
    thrusters.flapAftLeft -
    (thrusters.flapFrontRight + thrusters.flapAftRight);

  const weathervanePitch = -0.35 * Math.sin(angleOfAttackRad) * qAuthority;

  return {
    dynamicPressurePa,
    dragForceX,
    dragForceY,
    flapPitchTorque: aeroFlapDiffPitch * 2.5 * qAuthority + weathervanePitch,
    flapRollTorque: aeroFlapDiffRoll * 1.8 * qAuthority,
    angleOfAttackRad,
  };
}

/**
 * Checks 3D AABB collision between the Roadster chassis/tires and all 3 track obstacles.
 */
export function checkRoadsterObstacleCollision(position: Vector3D): {
  collided: boolean;
  obstacleId: string | null;
} {
  const carHalfLenX = 0.65;
  const carHalfWidthZ = 0.42;
  const carBottomY = position.y - CAR_RIDE_HEIGHT;

  for (const obs of ROADSTER_RACE_OBSTACLES) {
    const overlapX =
      position.x + carHalfLenX > obs.x - obs.halfWidthX &&
      position.x - carHalfLenX < obs.x + obs.halfWidthX;
    const overlapZ =
      position.z + carHalfWidthZ > obs.minZ &&
      position.z - carHalfWidthZ < obs.maxZ;
    const overlapY = carBottomY < obs.heightY - 0.04;

    if (overlapX && overlapZ && overlapY) {
      return { collided: true, obstacleId: obs.id };
    }
  }

  return { collided: false, obstacleId: null };
}

/**
 * Steps Stunt 04 (`roadster-obstacle-race`): High-Speed Obstacle Gauntlet & Cold-Gas Thruster Bunny-Hop Jump!
 */
export function stepRoadsterObstacleRacePhysics(
  state: RigidBodyState,
  next: RigidBodyState,
  thrusters: ThrusterActivation,
  params: RLHyperparameters,
  dt: number,
  windImpulseX: number,
  totalUnderbodyLiftN: number,
  lateralLeftN: number,
  lateralRightN: number,
  rearBoostN: number,
  fl: number,
  fr: number,
  rl: number,
  rr: number
): RigidBodyState {
  const groundY = 0.04 + CAR_RIDE_HEIGHT;
  const gravity = 9.81 * params.gravityMultiplier;

  const aero = computeRoadsterAerodynamics(
    state.velocity,
    state.attitude,
    thrusters.activeWingAngle
  );

  // Finish-line deceleration zone past x >= 995m (10.0 km)
  const finishedCourse = state.position.x >= 995.0;
  const gammaHorizon = Math.max(0.15, Math.min(1.1, (params.discountFactor - 0.78) / 0.21));
  const learnedDrive = Math.max(
    0.1,
    Math.min(1.0, (params.epochs / 140) * (1 - params.explorationNoise * 0.4) * gammaHorizon)
  );

  // Active suspension launch strip right before Hazard #4 (x in [862m, 874m]) pops the car airborne when trained
  const onBunnyHopLaunchStrip =
    state.isGrounded &&
    state.position.x >= 862.0 &&
    state.position.x <= 874.0 &&
    learnedDrive > 0.48;

  const isCurrentlyGrounded =
    state.position.y <= groundY + 0.04 && !onBunnyHopLaunchStrip && state.velocity.y <= 0.2;

  if (isCurrentlyGrounded) {
    next.position.y = groundY;
    next.velocity.y = 0;
    next.isGrounded = true;

    // Normal load = weight + Active Rear Wing aerodynamic downforce
    const normalForceN = Math.max(
      400,
      ROADSTER_MASS_KG_RACE * gravity + aero.downforceN
    );
    next.wallContactNormalForceN = Math.round(normalForceN);

    // Tire grip scales with normal force, dynamic surface friction mu, and hydroplaning
    const surfaceMu = state.weather?.surfaceFrictionMu ?? TIRE_MU_SLICK;
    const wetPct = state.weather?.roadWetnessPct ?? 0;
    const hydroplaneSpeedMs = 58.3; // NASA critical hydroplane speed: 9 * sqrt(42 PSI)
    const hydroplaneRatio = (wetPct / 100) * Math.max(0, Math.min(1.0, (state.velocity.x - 28.0) / (hydroplaneSpeedMs - 28.0)));
    const effectiveMu = Math.max(0.08, surfaceMu * (1.0 - hydroplaneRatio * 0.85));
    const maxTireGripFactor = Math.min(
      1.65,
      (effectiveMu * normalForceN) / (ROADSTER_MASS_KG_RACE * 9.81)
    );

    const targetCruiseVx = finishedCourse ? 0 : 70.0 + 12.0 * learnedDrive;
    const vxErr = targetCruiseVx - state.velocity.x;
    const wheelDriveForceX = finishedCourse
      ? -state.velocity.x * 6800
      : vxErr * 8500 * maxTireGripFactor;

    const rearBoostForceX = finishedCourse ? 0 : rearBoostN * 0.75;
    const ax =
      (wheelDriveForceX + rearBoostForceX + aero.dragForce.x + windImpulseX * 0.15) /
      ROADSTER_MASS_KG_RACE;
    next.velocity.x = Math.max(0, Math.min(88.0, state.velocity.x + ax * dt));
    next.position.x = Math.min(1005.0, state.position.x + next.velocity.x * dt);

    // Lateral Z-lane steering & dynamic wet road tire slide motion
    const steerInput = thrusters.lateralRight - thrusters.lateralLeft;
    const crosswindZ = (state.weather?.windVector.z ?? 0) * (state.weather?.airDensityKgM3 ?? 1.225) * 8.0;
    const lateralSteerAccelZ =
      steerInput * 55.0 * maxTireGripFactor -
      (2.2 + 2.6 * (effectiveMu / 1.35)) * state.velocity.z +
      (aero.dragForce.z + crosswindZ) / ROADSTER_MASS_KG_RACE;

    next.velocity.z = Math.max(
      -22.0,
      Math.min(22.0, state.velocity.z + lateralSteerAccelZ * dt)
    );
    next.position.z = Math.max(
      -12.5,
      Math.min(12.5, state.position.z + next.velocity.z * dt)
    );

    // Dynamic yaw slip angle when sliding laterally
    const slipAngle = Math.atan2(next.velocity.z, Math.max(8.0, next.velocity.x));
    next.attitude.yaw = Math.max(-0.45, Math.min(0.45, slipAngle * 1.6));
    next.attitude.roll = Math.max(-0.15, Math.min(0.15, -next.velocity.z * 0.015));
    next.attitude.pitch = 0;
    next.angularVelocity.x = 0;
    next.angularVelocity.y = 0;
    next.angularVelocity.z = 0;
  } else {
    // Mid-Air Bunny-Hop Jump Phase over Hazard #4 (Full-Width Laser Wall at x = 880m)!
    next.isGrounded = false;
    next.wallContactNormalForceN = 0;

    const jumpBoostImpulseY = onBunnyHopLaunchStrip ? 8.2 * learnedDrive : 0;

    const netVerticalForceN =
      totalUnderbodyLiftN * Math.cos(state.attitude.roll) * Math.cos(state.attitude.pitch) -
      ROADSTER_MASS_KG_RACE * gravity +
      aero.dragForce.y;

    const ay = netVerticalForceN / ROADSTER_MASS_KG_RACE;
    const ax =
      (rearBoostN * 0.45 + aero.dragForce.x + windImpulseX * 0.2) /
      ROADSTER_MASS_KG_RACE;
    const az =
      ((lateralRightN - lateralLeftN) * 0.28 + aero.dragForce.z) /
      ROADSTER_MASS_KG_RACE;

    next.velocity.x = Math.max(45.0, Math.min(88.0, state.velocity.x + ax * dt));
    next.velocity.y = state.velocity.y + jumpBoostImpulseY + ay * dt;
    next.velocity.z = state.velocity.z * (1 - 1.2 * dt) + az * dt;

    next.position.x = Math.min(1005.0, state.position.x + next.velocity.x * dt);
    next.position.y =
      (onBunnyHopLaunchStrip ? groundY + 0.06 : state.position.y) + next.velocity.y * dt;
    next.position.z = Math.max(-11.2, Math.min(11.2, state.position.z + next.velocity.z * dt));

    const activeAttitudeDamping = learnedDrive * 4.5;
    const rollTorque =
      (fl + rl - (fr + rr)) * 0.85 - state.attitude.roll * 1800 * activeAttitudeDamping;
    const pitchTorque =
      (fl + fr - (rl + rr)) * 1.15 +
      aero.aeroPitchTorqueNm * 0.18 -
      state.attitude.pitch * 3600 * activeAttitudeDamping;
    next.angularVelocity.x =
      (state.angularVelocity.x + (rollTorque / 920) * dt) * Math.max(0.7, 1 - 2.4 * dt);
    next.angularVelocity.y =
      (state.angularVelocity.y + (pitchTorque / 2150) * dt) * Math.max(0.7, 1 - 2.4 * dt);

    next.attitude.roll = Math.max(
      -0.75,
      Math.min(0.75, state.attitude.roll + next.angularVelocity.x * dt)
    );
    next.attitude.pitch = Math.max(
      -0.65,
      Math.min(0.65, state.attitude.pitch + next.angularVelocity.y * dt)
    );
    next.attitude.yaw *= Math.max(0, 1 - 3.0 * dt);

    // Check touchdown after jumping over Hazard #4
    if (next.position.y <= groundY) {
      const impactVy = Math.abs(next.velocity.y);
      const tiltErr = Math.max(Math.abs(next.attitude.roll), Math.abs(next.attitude.pitch));
      if (impactVy > 9.5 || tiltErr > 0.58) {
        const crash = resolveCrashDynamics('post-jump-cartwheel', next.velocity, next.attitude);
        next.crashed = true;
        next.crashType = crash.type;
        next.crashReason = crash.diagnosticMessage;
        next.angularVelocity = crash.tumbleVelocity;
      } else {
        next.attitude.roll = 0;
        next.attitude.pitch = 0;
        next.angularVelocity.x = 0;
        next.angularVelocity.y = 0;
      }
      next.position.y = groundY;
      next.velocity.y = 0;
      next.isGrounded = !next.crashed;
      next.wallContactNormalForceN = Math.round(
        ROADSTER_MASS_KG_RACE * gravity + aero.downforceN
      );
    }
  }

  // Check 3D collision against all track obstacles and vehicles
  const collision = checkRoadsterObstacleCollision(next.position);
  if (collision.collided) {
    let crashType: CrashType = 'obstacle-concrete-chicane-impact';
    if (collision.obstacleId === 'drone-overtake-vehicle') {
      crashType = 'obstacle-cyber-drone-collision';
    } else if (collision.obstacleId === 'laser-hazard-wall') {
      crashType = 'laser-wall-clip';
    }
    const crash = resolveCrashDynamics(crashType, next.velocity, next.attitude);
    next.crashed = true;
    next.crashType = crash.type;
    next.crashReason = crash.diagnosticMessage;
    next.angularVelocity = crash.tumbleVelocity;
  }

  // Check outside road shoulder barrier impact (road width is 24m, +/-12m)
  if (!next.crashed && Math.abs(next.position.z) >= 11.8) {
    const crash = resolveCrashDynamics('obstacle-concrete-chicane-impact', next.velocity, next.attitude);
    next.crashed = true;
    next.crashType = crash.type;
    next.crashReason = 'ROAD RUNOFF // LATERAL SLIDE IMPACT INTO PERIMETER BARRIER';
    next.angularVelocity = {
      x: 7.2 * Math.sign(next.velocity.z),
      y: 4.8,
      z: -3.5,
    };
  }

  next.missionProgressPct = Math.min(
    100,
    Math.max(0, Math.round((next.position.x / 1000.0) * 100))
  );

  return next;
}
