import type {
  MissionId,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
} from '../types/simulation.ts';

const EARTH_GRAVITY = 9.81;

export function createInitialStarshipState(missionId: MissionId): RigidBodyState {
  if (missionId === 'starship-belly-flop') {
    // Starts high in horizontal skydiver belly-flop attitude (pitch ~ 1.48 rad / 85 deg)
    return {
      position: { x: -3.2, y: 26.0, z: 0 },
      velocity: { x: 1.1, y: -5.2, z: 0 },
      attitude: { roll: 0, pitch: 1.48, yaw: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      copvPressurePsi: 9500,
      propellantRemainingPct: 100,
      gForce: 1.2,
      wallContactNormalForceN: 0,
      isOnWall: false,
      isGrounded: false,
      crashed: false,
      missionProgressPct: 0,
      elapsedTimeSec: 0,
    };
  }

  // Mission 04: Full-Stack Starship + Super Heavy on Orbital Launch Mount
  return {
    position: { x: 0, y: 0.6, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    attitude: { roll: 0, pitch: 0, yaw: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    copvPressurePsi: 10000,
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

export function stepStarshipPhysics(
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

  if (missionId === 'starship-launch') {
    // 33-Raptor Full-Stack Ascent, Gravity Turn, and Hot-Stage Separation
    const maxAscentAccel = 16.8; // ~1.71 TWR
    const thrustAccel = thrusters.raptorThrottle * maxAscentAccel;

    // Pitch-over torque from Raptor TVC gimbal
    const pitchTorque = thrusters.gimbalPitch * 2.8 - next.angularVelocity.y * 1.9;
    const rollTorque = thrusters.gimbalYaw * 2.0 - next.angularVelocity.x * 2.1;

    next.angularVelocity.y += pitchTorque * dt;
    next.angularVelocity.x += rollTorque * dt;
    next.attitude.pitch = Math.max(-0.85, Math.min(0.85, next.attitude.pitch + next.angularVelocity.y * dt));
    next.attitude.roll = Math.max(-0.7, Math.min(0.7, next.attitude.roll + next.angularVelocity.x * dt));

    const sinPitch = Math.sin(-next.attitude.pitch);
    const cosPitch = Math.cos(next.attitude.pitch);

    const ax = thrustAccel * sinPitch + windImpulseX * 0.25 - 0.08 * next.velocity.x;
    const ay = thrustAccel * cosPitch - gravity - 0.04 * next.velocity.y;

    next.velocity.x += ax * dt;
    next.velocity.y += ay * dt;
    next.position.x += next.velocity.x * dt;
    next.position.y = Math.max(0.6, next.position.y + next.velocity.y * dt);

    if (next.position.y <= 0.65 && state.position.y > 3.0) {
      next.crashed = true;
    }

    next.gForce = Number((Math.max(1.0, thrustAccel / EARTH_GRAVITY)).toFixed(2));
    next.propellantRemainingPct = Math.max(
      8,
      Number((next.propellantRemainingPct - thrusters.raptorThrottle * 4.5 * dt).toFixed(2))
    );
    next.copvPressurePsi = Math.round(3000 + next.propellantRemainingPct * 70);
    next.missionProgressPct = Math.min(100, Math.round((next.position.y / 26.0) * 100));
    return next;
  }

  // Mission 05: Starship Belly-Flop Skydiver + 3-Raptor Flip-and-Burn Landing
  const isFlipPhase = next.position.y < 12.5;
  const aeroFlapDifferential =
    (thrusters.flapFrontLeft + thrusters.flapFrontRight) -
    (thrusters.flapAftLeft + thrusters.flapAftRight);

  // Aerodynamic drag is high when belly-flopping horizontally (sin(pitch) near 1)
  const bellyAreaFactor = Math.abs(Math.sin(next.attitude.pitch));
  const aeroDragY = 0.22 * bellyAreaFactor * Math.abs(next.velocity.y) * next.velocity.y;

  // TVC gimbal + Aero Flaps control pitch rotation during flip maneuver
  const tvcPitchTorque = isFlipPhase ? thrusters.gimbalPitch * 5.2 : 0;
  const aeroPitchTorque = aeroFlapDifferential * 2.4;
  const pitchAccel = tvcPitchTorque + aeroPitchTorque - next.angularVelocity.y * 2.6;

  next.angularVelocity.y += pitchAccel * dt;
  next.attitude.pitch = Math.max(
    -0.55,
    Math.min(1.65, next.attitude.pitch + next.angularVelocity.y * dt)
  );

  // Roll control from left vs right flaps
  const flapRollDiff =
    (thrusters.flapFrontLeft + thrusters.flapAftLeft) -
    (thrusters.flapFrontRight + thrusters.flapAftRight);
  next.angularVelocity.x = (next.angularVelocity.x + flapRollDiff * 1.8 * dt) * 0.9;
  next.attitude.roll += next.angularVelocity.x * dt;

  // Raptor landing burn thrust vector
  const maxLandingDecel = 24.5; // 3 Center Raptors high TWR on nearly empty Ship
  const thrustMag = thrusters.raptorThrottle * maxLandingDecel;
  const ax =
    -thrustMag * Math.sin(next.attitude.pitch) -
    0.45 * next.velocity.x +
    windImpulseX * 0.2;
  const ay =
    thrustMag * Math.cos(next.attitude.pitch) -
    gravity -
    aeroDragY;

  next.velocity.x += ax * dt;
  next.velocity.y += ay * dt;
  next.position.x += next.velocity.x * dt;
  next.position.y += next.velocity.y * dt;

  // Pad / Mechazilla catch height check at y = 1.5m
  if (next.position.y <= 1.5) {
    const impactSpeed = Math.abs(next.velocity.y);
    const pitchErr = Math.abs(next.attitude.pitch);
    if (impactSpeed > 4.2 || pitchErr > 0.38) {
      next.crashed = true;
    }
    next.position.y = 1.5;
    next.velocity.y = 0;
    next.velocity.x = 0;
    next.angularVelocity.x = 0;
    next.angularVelocity.y = 0;
    next.isGrounded = true;
  }

  next.gForce = Number(
    (Math.max(0.8, (thrustMag + Math.abs(aeroDragY)) / EARTH_GRAVITY)).toFixed(2)
  );
  next.propellantRemainingPct = Math.max(
    5,
    Math.round(next.propellantRemainingPct - thrusters.raptorThrottle * 4.5 * dt)
  );
  next.copvPressurePsi = Math.round(3000 + next.propellantRemainingPct * 65);
  next.missionProgressPct = Math.min(
    100,
    Math.max(0, Math.round(((26.0 - next.position.y) / 24.5) * 100))
  );

  return next;
}
