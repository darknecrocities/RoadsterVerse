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

export function createInitialOrbitalPodState(): RigidBodyState {
  return {
    position: { x: -8.0, y: ORBITAL_TARGET_ALTITUDE_M + 1.5, z: 0.0 },
    velocity: { x: 3.2, y: -0.4, z: 0.2 },
    attitude: { roll: 0.18, pitch: -0.22, yaw: 0.12 },
    angularVelocity: { x: 0.35, y: -0.28, z: 0.22 },
    copvPressurePsi: 10000,
    propellantRemainingPct: 100,
    gForce: 0.0,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: false,
    crashed: false,
    solarArrayDeployPct: 0,
    missionProgressPct: 0,
    elapsedTimeSec: 0,
  };
}

/**
 * Steps 6-DoF microgravity orbital flight mechanics and satellite transformation
 * for Stunt 08 (`starship-pod-orbit`).
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

  const next: RigidBodyState = {
    position: { ...state.position },
    velocity: { ...state.velocity },
    attitude: { ...state.attitude },
    angularVelocity: { ...state.angularVelocity },
    copvPressurePsi: state.copvPressurePsi,
    propellantRemainingPct: state.propellantRemainingPct,
    gForce: 0.0,
    wallContactNormalForceN: 0,
    isOnWall: false,
    isGrounded: false,
    crashed: false,
    solarArrayDeployPct: state.solarArrayDeployPct || 0,
    missionProgressPct: Math.min(100, Math.round((state.elapsedTimeSec + dt) * 12)),
    elapsedTimeSec: state.elapsedTimeSec + dt,
  };

  // 1. Cold-Gas RCS Blowdown Pressure & Thrust
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

  // 2. Microgravity Acceleration (Near-zero gravity with subtle orbital drift)
  const microG = 0.02 * params.gravityMultiplier;
  const accelX = (bottomThrustN * Math.cos(state.attitude.pitch) * Math.cos(state.attitude.yaw)) / ORBITAL_POD_MASS_KG;
  const accelY = (bottomThrustN * Math.sin(state.attitude.pitch) - ORBITAL_POD_MASS_KG * microG) / ORBITAL_POD_MASS_KG;
  const accelZ = (lateralThrustN * Math.cos(state.attitude.roll)) / ORBITAL_POD_MASS_KG;

  next.velocity.x = (state.velocity.x + accelX * dt) * 0.999;
  next.velocity.y = (state.velocity.y + accelY * dt) * 0.999;
  next.velocity.z = (state.velocity.z + accelZ * dt) * 0.999;

  next.position.x = state.position.x + next.velocity.x * dt;
  next.position.y = state.position.y + next.velocity.y * dt;
  next.position.z = state.position.z + next.velocity.z * dt;

  // 3. Attitude & Angular Momentum Integration
  // Lateral and bottom RCS micro-thrusters arrest separation tumble
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

  // 4. Satellite Transformation / Solar Array Deployment
  const angularSpeed = Math.sqrt(
    next.angularVelocity.x * next.angularVelocity.x +
      next.angularVelocity.y * next.angularVelocity.y +
      next.angularVelocity.z * next.angularVelocity.z
  );
  const isStabilized = angularSpeed < 0.28 && Math.abs(next.attitude.pitch) < 0.45;
  const deployCmd =
    (thrusters.podSolarDeployCmd ?? 0) > 0.4 ||
    (isStabilized && state.elapsedTimeSec > 1.2 && params.epochs > 120);

  if (deployCmd) {
    if (angularSpeed > 2.2) {
      // Crash: Uncontrolled high-rate tumble destroys deploying solar arrays!
      const crash = resolveCrashDynamics('orbital-deployment-tumble', next.velocity, next.attitude);
      next.crashed = true;
      next.crashType = crash.type;
      next.crashReason = crash.diagnosticMessage;
      next.angularVelocity = crash.tumbleVelocity;
      return next;
    }
    next.solarArrayDeployPct = Math.min(100, (state.solarArrayDeployPct || 0) + dt * 28.0);
  }

  // 5. Orbital Drift / Depletion Failure Detection
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
