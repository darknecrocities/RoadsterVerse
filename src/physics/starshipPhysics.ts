import type {
  MissionId,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
} from '../types/simulation.ts';
import { computeStarshipAerodynamics } from './aerodynamicsAndRace.ts';

const EARTH_GRAVITY = 9.81;

export function createInitialStarshipState(missionId: MissionId): RigidBodyState {
  if (missionId === 'starship-belly-flop') {
    // Starts high in horizontal skydiver belly-flop attitude (pitch ~ 1.48 rad / 85 deg)
    return {
      position: { x: -2.6, y: 24.0, z: 0 },
      velocity: { x: 1.0, y: -4.8, z: 0 },
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

  // Mission 05 (starship-launch) & Mission 07 (starship-booster-catch):
  // Full 2-Stage Starship + Super Heavy Booster on the Orbital Launch Mount (y = 1.35m)
  return {
    position: { x: 0, y: 1.35, z: 0 },
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
  const aero = computeStarshipAerodynamics(
    state.position.y,
    state.velocity,
    state.attitude,
    thrusters
  );
  const fuelBurnScale = Math.max(0.45, Math.min(1.65, 1.32 - params.rewardFuelWeight * 0.32));

  if (missionId === 'starship-launch' || missionId === 'starship-booster-catch') {
    const isSeparated = state.velocity.z < 0;

    if (!isSeparated) {
      // Phase 1: 33-Raptor Full-Stack Ascent up to Stage Separation Altitude (y >= 13.5m)
      const maxAscentAccel = 19.2;
      const thrustAccel = thrusters.raptorThrottle * maxAscentAccel;

      const pitchTorque =
        thrusters.gimbalPitch * 3.6 - next.angularVelocity.y * 2.2 + aero.flapPitchTorque * 0.12;
      const rollTorque = thrusters.gimbalYaw * 2.6 - next.angularVelocity.x * 2.4;

      next.angularVelocity.y += pitchTorque * dt;
      next.angularVelocity.x += rollTorque * dt;
      next.attitude.pitch = Math.max(
        -1.8,
        Math.min(1.8, next.attitude.pitch + next.angularVelocity.y * dt)
      );
      next.attitude.roll = Math.max(
        -1.5,
        Math.min(1.5, next.attitude.roll + next.angularVelocity.x * dt)
      );

      const sinPitch = Math.sin(-next.attitude.pitch);
      const cosPitch = Math.cos(next.attitude.pitch);

      // Pad rest logic: If resting on the pad and thrust cannot overcome gravity:
      if (state.position.y <= 1.36 && thrustAccel * cosPitch <= gravity + 0.1) {
        next.isGrounded = true;
        next.position.y = 1.35;
        next.velocity.y = 0;
        next.velocity.x = 0;
        next.angularVelocity.x = 0;
        next.angularVelocity.y = 0;
        next.attitude.pitch = 0;
        next.attitude.roll = 0;
        next.gForce = 1.0;
        next.missionProgressPct = 0;
        return next;
      }

      next.isGrounded = false;

      const ax =
        thrustAccel * sinPitch + windImpulseX * 0.2 - 0.08 * next.velocity.x + aero.dragForceX * 0.25;
      const ay =
        thrustAccel * cosPitch - gravity - 0.04 * next.velocity.y + aero.dragForceY * 0.25;

      next.velocity.x += ax * dt;
      next.velocity.y += ay * dt;
      next.position.x += next.velocity.x * dt;
      next.position.y += next.velocity.y * dt;

      // Crash / Fall detection during ascent:
      if (state.position.y > 1.38 && next.position.y <= 1.36) {
        next.crashed = true;
        next.position.y = 1.35;
      }
      if (next.position.y < 4.0 && (Math.abs(next.attitude.pitch) > 0.50 || Math.abs(next.attitude.roll) > 0.50)) {
        next.crashed = true;
      }
      if (Math.abs(next.attitude.pitch) > 0.95) {
        next.crashed = true;
      }
      if (next.position.y < 1.35) {
        next.position.y = 1.35;
        if (state.position.y > 1.36) next.crashed = true;
      }

      if (next.crashed) {
        return next;
      }

      // Trigger Hot-Stage Release once stack reaches separation altitude (y >= 13.5m)
      if (next.position.y >= 13.5) {
        next.velocity.z = -0.02; // Starts stageSepTime timer (-velocity.z)
        next.velocity.y = Math.min(1.6, next.velocity.y * 0.22); // Hot-stage pushback impulse on Booster
      }

      next.gForce = Number((Math.max(1.0, thrustAccel / EARTH_GRAVITY)).toFixed(2));
      next.propellantRemainingPct = Math.max(
        12,
        Number((next.propellantRemainingPct - thrusters.raptorThrottle * 4.2 * fuelBurnScale * dt).toFixed(2))
      );
      next.copvPressurePsi = Math.round(3000 + next.propellantRemainingPct * 70);
      next.missionProgressPct = Math.min(50, Math.round(((next.position.y - 1.35) / 12.15) * 50));
      return next;
    }

    // Phase 2: Post-Separation — Upper Stage Starship climbs to orbit while Super Heavy Booster
    // executes Boostback / Grid-Fin descent and thrusts a SLOW VERTICAL LANDING!
    next.velocity.z = state.velocity.z - dt;
    const maxLandingAccel = 22.8;
    const thrustAccel = thrusters.raptorThrottle * maxLandingAccel;

    const pitchTorque =
      thrusters.gimbalPitch * 4.5 - next.angularVelocity.y * 2.8 + aero.flapPitchTorque * 0.18;
    const rollTorque = thrusters.gimbalYaw * 2.8 - next.angularVelocity.x * 2.8;
    next.angularVelocity.y += pitchTorque * dt;
    next.angularVelocity.x += rollTorque * dt;
    next.attitude.pitch = Math.max(
      -0.85,
      Math.min(0.85, next.attitude.pitch + next.angularVelocity.y * dt)
    );
    next.attitude.roll = Math.max(
      -0.65,
      Math.min(0.65, next.attitude.roll + next.angularVelocity.x * dt)
    );

    const sinPitch = Math.sin(-next.attitude.pitch);
    const cosPitch = Math.cos(next.attitude.pitch);
    const gridFinDragY =
      next.velocity.y < 0
        ? 0.055 * Math.abs(next.velocity.y) * -next.velocity.y + aero.dragForceY * 0.35
        : aero.dragForceY * 0.2;

    const ax =
      thrustAccel * sinPitch - 0.35 * next.velocity.x + aero.dragForceX * 0.3 + windImpulseX * 0.18;
    const ay = thrustAccel * cosPitch - gravity + gridFinDragY;

    next.velocity.x += ax * dt;
    next.velocity.y += ay * dt;
    next.position.x += next.velocity.x * dt;
    next.position.y += next.velocity.y * dt;

    const targetLandingY = missionId === 'starship-booster-catch' ? 1.5 : 1.35;
    if (next.position.y <= targetLandingY) {
      const impactSpeed = Math.abs(next.velocity.y);
      const pitchErr = Math.abs(next.attitude.pitch);
      const xErr = Math.abs(next.position.x);
      if (
        impactSpeed > 1.8 ||
        pitchErr > 0.22 ||
        (missionId === 'starship-booster-catch' && xErr > 1.2)
      ) {
        next.crashed = true;
      }
      next.position.y = targetLandingY;
      if (!next.crashed) {
        next.velocity.y = 0;
        next.velocity.x = 0;
        next.angularVelocity.x = 0;
        next.angularVelocity.y = 0;
        next.attitude.pitch = 0;
        next.attitude.roll = 0;
        next.isGrounded = true;
      }
    }

    next.gForce = Number((Math.max(0.8, thrustAccel / EARTH_GRAVITY)).toFixed(2));
    next.propellantRemainingPct = Math.max(
      6,
      Number((next.propellantRemainingPct - thrusters.raptorThrottle * 3.8 * fuelBurnScale * dt).toFixed(2))
    );
    next.copvPressurePsi = Math.round(3000 + next.propellantRemainingPct * 68);
    const descentFrac = Math.max(
      0,
      Math.min(1, (14.2 - next.position.y) / (14.2 - targetLandingY))
    );
    next.missionProgressPct = next.isGrounded ? 100 : Math.min(99, 50 + Math.round(descentFrac * 50));
    return next;
  }

  // Mission 06: Starship Belly-Flop Skydiver + 3-Raptor Flip-and-Burn Slow Vertical Landing
  const isFlipPhase = next.position.y < 12.2;
  const bellyAreaFactor = Math.abs(Math.sin(next.attitude.pitch));
  const aeroDragY =
    0.18 * bellyAreaFactor * Math.abs(next.velocity.y) * next.velocity.y - aero.dragForceY * 0.45;

  const tvcPitchTorque = isFlipPhase ? thrusters.gimbalPitch * 5.4 : 0;
  const pitchAccel = tvcPitchTorque + aero.flapPitchTorque - next.angularVelocity.y * 2.8;

  next.angularVelocity.y += pitchAccel * dt;
  next.attitude.pitch = Math.max(
    -0.55,
    Math.min(1.65, next.attitude.pitch + next.angularVelocity.y * dt)
  );

  next.angularVelocity.x = (next.angularVelocity.x + aero.flapRollTorque * dt) * 0.9;
  next.attitude.roll += next.angularVelocity.x * dt;

  const maxLandingDecel = 24.5;
  const thrustMag = thrusters.raptorThrottle * maxLandingDecel;
  const ax =
    -thrustMag * Math.sin(next.attitude.pitch) -
    0.42 * next.velocity.x +
    aero.dragForceX * 0.35 +
    windImpulseX * 0.2;
  const ay = thrustMag * Math.cos(next.attitude.pitch) - gravity - aeroDragY;

  next.velocity.x += ax * dt;
  next.velocity.y += ay * dt;
  next.position.x += next.velocity.x * dt;
  next.position.y += next.velocity.y * dt;

  if (next.position.y <= 1.5) {
    const impactSpeed = Math.abs(next.velocity.y);
    const pitchErr = Math.abs(next.attitude.pitch);
    if (impactSpeed > 1.8 || pitchErr > 0.22) {
      next.crashed = true;
    }
    next.position.y = 1.5;
    if (!next.crashed) {
      next.velocity.y = 0;
      next.velocity.x = 0;
      next.angularVelocity.x = 0;
      next.angularVelocity.y = 0;
      next.attitude.pitch = 0;
      next.isGrounded = true;
    }
  }

  next.gForce = Number(
    (Math.max(0.8, (thrustMag + Math.abs(aeroDragY)) / EARTH_GRAVITY)).toFixed(2)
  );
  next.propellantRemainingPct = Math.max(
    5,
    Math.round(next.propellantRemainingPct - thrusters.raptorThrottle * 4.2 * fuelBurnScale * dt)
  );
  next.copvPressurePsi = Math.round(3000 + next.propellantRemainingPct * 65);
  next.missionProgressPct = Math.min(
    100,
    Math.max(0, Math.round(((24.0 - next.position.y) / 22.5) * 100))
  );

  return next;
}
