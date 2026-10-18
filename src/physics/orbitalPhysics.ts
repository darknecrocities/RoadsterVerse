import type {
  EulerAngles,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
  Vector3D,
} from '../types/simulation.ts';
import { resolveCrashDynamics } from './crashDynamics.ts';

export const ORBITAL_TARGET_ALTITUDE_M = 120.0;
export const ORBITAL_POD_MASS_KG = 2400.0;
export const MAX_POD_RCS_THRUST_N = 850.0;
export const STAGING_ALTITUDE_M = 28.0;
export const SPACE_TRANSITION_ALTITUDE_M = 65.0;

export type OrbitalFlightPhase =
  | 'pad-liftoff'
  | 'hot-staging'
  | 'space-insertion'
  | 'satellite-morph';

export function getOrbitalFlightPhase(state: RigidBodyState): OrbitalFlightPhase {
  if (state.position.y < STAGING_ALTITUDE_M && state.elapsedTimeSec < 3.8) {
    return 'pad-liftoff';
  }
  if (state.position.y < SPACE_TRANSITION_ALTITUDE_M && state.elapsedTimeSec < 7.0) {
    return 'hot-staging';
  }
  if (state.position.y < ORBITAL_TARGET_ALTITUDE_M - 2.0 && state.elapsedTimeSec < 9.5) {
    return 'space-insertion';
  }
  return 'satellite-morph';
}

/**
 * Initializes Stunt 08 at ground level on the Starbase orbital launch mount.
 */
export function createInitialOrbitalPodState(): RigidBodyState {
  return {
    position: { x: 0.0, y: 1.35, z: 0.0 },
    velocity: { x: 0.0, y: 0.0, z: 0.0 },
    attitude: { roll: 0.0, pitch: 0.0, yaw: 0.0 },
    angularVelocity: { x: 0.0, y: 0.0, z: 0.0 },
    copvPressurePsi: 10000,
    propellantRemainingPct: 100,
    gForce: 1.0,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: true,
    crashed: false,
    solarArrayDeployPct: 0,
    missionProgressPct: 0,
    elapsedTimeSec: 0,
  };
}

/**
 * Steps continuous 4-phase orbital flight mechanics for Stunt 08 (`starship-pod-orbit`):
 * 1. Pad Liftoff: Full-stack ascent off Starbase launch mount (y = 1.35m -> 28m)
 * 2. Hot-Staging: Supersonic booster release in mid-air (y = 28m -> 65m)
 * 3. Space Insertion: Atmospheric exit to orbital horizon (y = 65m -> 120m) & engine afterburn MECO
 * 4. Microgravity & Satellite Morph: Zero-G attitude stabilization via lateral/bottom RCS and solar wing deployment
 */
export function stepOrbitalPodPhysics(
  state: RigidBodyState,
  thrusters: ThrusterActivation,
  params: RLHyperparameters,
  dt: number
): RigidBodyState {
  if (state.crashed) {
    return {
      ...state,
      elapsedTimeSec: state.elapsedTimeSec + dt,
      position: {
        x: state.position.x + state.velocity.x * dt * 0.98,
        y: state.position.y + state.velocity.y * dt * 0.98,
        z: state.position.z + state.velocity.z * dt * 0.98,
      },
      attitude: {
        roll: state.attitude.roll + state.angularVelocity.x * dt,
        pitch: state.attitude.pitch + state.angularVelocity.y * dt,
        yaw: state.attitude.yaw + state.angularVelocity.z * dt,
      },
    };
  }

  const phase = getOrbitalFlightPhase(state);
  const next: RigidBodyState = {
    position: { ...state.position },
    velocity: { ...state.velocity },
    attitude: { ...state.attitude },
    angularVelocity: { ...state.angularVelocity },
    copvPressurePsi: state.copvPressurePsi,
    propellantRemainingPct: state.propellantRemainingPct,
    gForce: 1.0,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: false,
    crashed: false,
    solarArrayDeployPct: state.solarArrayDeployPct || 0,
    missionProgressPct: Math.min(100, Math.round((state.elapsedTimeSec + dt) * 7.5)),
    elapsedTimeSec: state.elapsedTimeSec + dt,
  };

  const earthG = 9.81 * params.gravityMultiplier;

  if (phase === 'pad-liftoff') {
    // 1. Pad Liftoff: Full 33-Raptor ground acceleration
    const throttle = Math.max(0.85, thrusters.raptorThrottle || 1.0);
    const liftoffAccelY = throttle * 17.5 - earthG;
    next.velocity.y = state.velocity.y + liftoffAccelY * dt;
    next.position.y = Math.max(1.35, state.position.y + next.velocity.y * dt);
    next.isGrounded = next.position.y <= 1.36;
    next.gForce = 1.0 + (liftoffAccelY / earthG);

    // Minor aerodynamic pitch guidance jitter
    const learnedGuidance = Math.min(1.0, params.epochs / 100);
    const pitchCorrection = -state.attitude.pitch * 3.5 * learnedGuidance;
    next.angularVelocity.y = (state.angularVelocity.y + pitchCorrection * dt) * 0.94;
    next.attitude.pitch = state.attitude.pitch + next.angularVelocity.y * dt;
    return next;
  }

  if (phase === 'hot-staging') {
    // 2. Supersonic Hot-Staging & Booster Release
    const throttle = Math.max(0.75, thrusters.raptorThrottle || 0.9);
    const upperStageAccelY = throttle * 19.8 - earthG * 0.75;
    next.velocity.y = state.velocity.y + upperStageAccelY * dt;
    next.position.y = state.position.y + next.velocity.y * dt;
    next.gForce = 1.6;

    // Transient staging separation impulse disturbance
    if (state.elapsedTimeSec < 4.2) {
      next.angularVelocity.x += 0.08 * dt;
      next.angularVelocity.y -= 0.06 * dt;
    }
    const learnedDamping = Math.min(1.0, params.epochs / 120);
    next.angularVelocity.x *= 0.96;
    next.angularVelocity.y *= 0.96;
    next.attitude.roll += next.angularVelocity.x * dt;
    next.attitude.pitch += next.angularVelocity.y * dt;
    return next;
  }

  if (phase === 'space-insertion') {
    // 3. Space Insertion & MECO Engine Cutoff
    const altitudeRemaining = Math.max(0, ORBITAL_TARGET_ALTITUDE_M - state.position.y);
    const throttleTarget = Math.min(1.0, altitudeRemaining / 18.0);
    const accelY = throttleTarget * 12.0 - earthG * 0.15;
    next.velocity.y = (state.velocity.y + accelY * dt) * 0.985;
    next.position.y = Math.min(ORBITAL_TARGET_ALTITUDE_M, state.position.y + next.velocity.y * dt);
    next.gForce = Math.max(0.05, throttleTarget * 1.2);

    // Nearing target orbit: slow pitch into prograde trajectory
    const pitchTarget = 0.0;
    next.angularVelocity.y = (state.angularVelocity.y + (pitchTarget - state.attitude.pitch) * 2.5 * dt) * 0.95;
    next.attitude.pitch += next.angularVelocity.y * dt;
    return next;
  }

  // 4. Zero-G Microgravity Float & Satellite Mechanical Morph (phase === 'satellite-morph')
  next.gForce = 0.02;
  const blowdown = Math.max(0.25, Math.min(1.15, state.copvPressurePsi / 8500));
  const bottomCmd = thrusters.podRcsBottom ?? (thrusters.rearBoost > 0.1 ? thrusters.rearBoost : 0);
  const lateralCmd = thrusters.podRcsLateral ?? Math.abs(thrusters.lateralLeft - thrusters.lateralRight);

  const bottomThrustN = bottomCmd * MAX_POD_RCS_THRUST_N * blowdown;
  const lateralThrustN = lateralCmd * MAX_POD_RCS_THRUST_N * 0.65 * blowdown;

  // COPV Propellant Depletion
  const rcsDuty = bottomCmd + lateralCmd;
  const psiDepletion = rcsDuty * 160.0 * dt * params.rewardFuelWeight;
  next.copvPressurePsi = Math.max(0, state.copvPressurePsi - psiDepletion);
  next.propellantRemainingPct = Math.max(0, (next.copvPressurePsi / 10000) * 100);

  // Microgravity Acceleration (Near-zero gravity with subtle orbital drift)
  const microG = 0.02 * params.gravityMultiplier;
  const accelX = (bottomThrustN * Math.cos(state.attitude.pitch) * Math.cos(state.attitude.yaw)) / ORBITAL_POD_MASS_KG;
  const accelY = (bottomThrustN * Math.sin(state.attitude.pitch) - ORBITAL_POD_MASS_KG * microG) / ORBITAL_POD_MASS_KG;
  const accelZ = (lateralThrustN * Math.cos(state.attitude.roll)) / ORBITAL_POD_MASS_KG;

  next.velocity.x = (state.velocity.x + accelX * dt) * 0.999;
  next.velocity.y = (state.velocity.y + accelY * dt) * 0.995;
  next.velocity.z = (state.velocity.z + accelZ * dt) * 0.999;

  next.position.x = state.position.x + next.velocity.x * dt;
  next.position.y = state.position.y + next.velocity.y * dt;
  next.position.z = state.position.z + next.velocity.z * dt;

  // Cold-gas RCS micro-thrusters arrest separation tumble
  const learnedAttitudeControl = Math.min(1.0, params.epochs / 160);
  const pitchTorque = -state.attitude.pitch * 340.0 * learnedAttitudeControl * blowdown;
  const rollTorque = -state.attitude.roll * 340.0 * learnedAttitudeControl * blowdown;
  const yawTorque = -state.attitude.yaw * 240.0 * learnedAttitudeControl * blowdown;

  const damping = Math.max(0.75, 1 - 2.4 * dt * learnedAttitudeControl);
  next.angularVelocity.x = (state.angularVelocity.x + (rollTorque / 480) * dt) * damping;
  next.angularVelocity.y = (state.angularVelocity.y + (pitchTorque / 650) * dt) * damping;
  next.angularVelocity.z = (state.angularVelocity.z + (yawTorque / 520) * dt) * damping;

  next.attitude.roll = state.attitude.roll + next.angularVelocity.x * dt;
  next.attitude.pitch = state.attitude.pitch + next.angularVelocity.y * dt;
  next.attitude.yaw = state.attitude.yaw + next.angularVelocity.z * dt;

  // Satellite Transformation / Solar Array Deployment
  const angularSpeed = Math.hypot(next.angularVelocity.x, next.angularVelocity.y, next.angularVelocity.z);
  const isStabilized = angularSpeed < 0.28 && Math.abs(next.attitude.pitch) < 0.45;
  const deployCmd =
    (thrusters.podSolarDeployCmd ?? 0) > 0.4 ||
    (isStabilized && state.elapsedTimeSec > 9.8 && params.epochs > 120);

  if (deployCmd) {
    if (angularSpeed > 2.2) {
      const crash = resolveCrashDynamics('orbital-deployment-tumble', next.velocity, next.attitude);
      next.crashed = true;
      next.crashType = crash.type;
      next.crashReason = crash.diagnosticMessage;
      next.angularVelocity = crash.tumbleVelocity;
      return next;
    }
    next.solarArrayDeployPct = Math.min(100, (state.solarArrayDeployPct || 0) + dt * 28.0);
  }

  // Orbital Drift / Depletion Failure Detection
  if (next.copvPressurePsi <= 150 && angularSpeed > 1.2 && (state.solarArrayDeployPct || 0) < 50) {
    const crash = resolveCrashDynamics('zero-g-thruster-depletion-drift', next.velocity, next.attitude);
    next.crashed = true;
    next.crashType = crash.type;
    next.crashReason = crash.diagnosticMessage;
    next.angularVelocity = crash.tumbleVelocity;
  } else if (Math.abs(next.position.x) > 65.0 || Math.abs(next.position.z) > 45.0) {
    const crash = resolveCrashDynamics('orbital-debris-collision', next.velocity, next.attitude);
    next.crashed = true;
    next.crashType = crash.type;
    next.crashReason = crash.diagnosticMessage;
    next.angularVelocity = crash.tumbleVelocity;
  }

  return next;
}
