import type {
  EpochHistoryPoint,
  MissionId,
  NeuralNetworkSnapshot,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
} from '../types/simulation.ts';
import { MISSIONS } from './missions.ts';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function pseudoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Computes the effective policy competence [0.03 .. 0.995] from the user's selected
 * Epochs and RL Hyperparameters (learning rate, discount factor, exploration noise, reward weights).
 * Calibrated across the exact UI slider ranges so every adjustment reflects in the live 3D simulation.
 */
export function computePolicyCompetence(
  missionId: MissionId,
  params: RLHyperparameters,
  epochOverride?: number
): number {
  const mission = MISSIONS[missionId];
  const currentEpoch = epochOverride ?? params.epochs;

  // Calibrated across UI slider [0.0001 .. 0.01]:
  // - < 0.0003: sluggish under-stepping
  // - 0.0003 .. 0.0020: optimal PPO convergence sweet spot
  // - > 0.0020: policy gradient overshoot & instability
  const lrEfficiency =
    params.learningRate < 0.0003
      ? 0.55 + (params.learningRate / 0.0003) * 0.45
      : params.learningRate <= 0.002
        ? 1.04
        : Math.max(0.28, 1.04 - (params.learningRate - 0.002) * 85);

  const gammaFactor = clamp((params.discountFactor - 0.78) / 0.21, 0.32, 1.05);

  const fuelBalancePenalty =
    params.rewardFuelWeight > 1.8 ? Math.max(0.72, 1 - (params.rewardFuelWeight - 1.8) * 0.25) : 1.0;

  const rewardBalance =
    clamp(
      (params.rewardAltitudeWeight * 0.35 +
        params.rewardAttitudeWeight * 0.4 +
        params.rewardSmoothnessWeight * 0.25) /
        2.1,
      0.38,
      1.14
    ) * fuelBalancePenalty;

  const normalizedEpochs = currentEpoch / (mission.recommendedEpochs * 0.55);
  const rawGrowth = 1 - Math.exp(-normalizedEpochs * lrEfficiency * gammaFactor * rewardBalance);
  const noiseDamping = 1 - params.explorationNoise * 0.68;

  return clamp(rawGrowth * noiseDamping, 0.03, 0.995);
}

/**
 * Evaluates the Neural Control Policy at 60Hz given the current 6-DoF RigidBodyState
 * and returns both the physical ThrusterActivation commands and the live NeuralNetworkSnapshot.
 */
export function evaluateRLPolicy(
  state: RigidBodyState,
  missionId: MissionId,
  params: RLHyperparameters,
  agentSeedOffset = 0
): { thrusters: ThrusterActivation; nnSnapshot: NeuralNetworkSnapshot } {
  const mission = MISSIONS[missionId];
  const competence = computePolicyCompetence(missionId, params);
  const incompetence = 1 - competence;
  const t = state.elapsedTimeSec;

  const noiseScale = clamp(incompetence * 0.85 + params.explorationNoise * 0.55, 0.0, 1.0);
  const n1 = pseudoNoise(t * 9.1 + agentSeedOffset * 17.3) * noiseScale;
  const n2 = pseudoNoise(t * 13.7 + agentSeedOffset * 31.1) * noiseScale;
  const n3 = pseudoNoise(t * 7.3 + agentSeedOffset * 47.9) * noiseScale;

  // High learning rate (> 0.0022) induces visible policy gradient oscillation; very low (< 0.0003) lags
  const lrOscillation =
    params.learningRate > 0.0022
      ? Math.sin(t * 18.0 + agentSeedOffset) * ((params.learningRate - 0.0022) * 46)
      : 0;
  const lrResponseScale =
    params.learningRate < 0.0003 ? 0.68 + (params.learningRate / 0.0003) * 0.32 : 1.0;

  // Calibrated gain multipliers for all 4 reward weights + discount factor look-ahead horizon
  const lookAheadFactor = clamp((params.discountFactor - 0.8) / 0.19, 0.25, 1.15);
  const altGain = clamp(params.rewardAltitudeWeight / 2.0, 0.35, 1.65) * lrResponseScale;
  const attGain = clamp(params.rewardAttitudeWeight / 2.4, 0.35, 1.65) * lrResponseScale;
  const smoothGain = clamp(params.rewardSmoothnessWeight / 1.3, 0.35, 1.65);
  const fuelCap = clamp(1.14 - params.rewardFuelWeight * 0.16, 0.65, 1.04);

  const thrusters: ThrusterActivation = {
    frontLeftLift: 0,
    frontRightLift: 0,
    rearLeftLift: 0,
    rearRightLift: 0,
    lateralLeft: 0,
    lateralRight: 0,
    rearBoost: 0,
    activeWingAngle: 0.35,
    raptorThrottle: 0,
    gimbalPitch: 0,
    gimbalYaw: 0,
    flapFrontLeft: 0.5,
    flapFrontRight: 0.5,
    flapAftLeft: 0.5,
    flapAftRight: 0.5,
    hotStageSeparated: false,
  };

  const altError = mission.targetPosition.y - state.position.y;
  const xError = mission.targetPosition.x - state.position.x;

  if (missionId === 'roadster-hover') {
    const hoverFeedforward = 0.54 * params.gravityMultiplier;
    const kpAlt = 0.24 * competence * altGain;
    const kdAlt = 0.19 * competence * smoothGain;
    const baseLift = clamp(
      (hoverFeedforward + kpAlt * altError - kdAlt * state.velocity.y + n1 * 0.45 + lrOscillation) *
        fuelCap,
      0,
      1
    );

    const kpAtt = 0.65 * competence * attGain;
    const rollCorr =
      -kpAtt * state.attitude.roll - 0.25 * competence * smoothGain * state.angularVelocity.x + n2 * 0.42;
    const pitchCorr =
      -kpAtt * state.attitude.pitch - 0.28 * competence * smoothGain * state.angularVelocity.y + n3 * 0.38;

    thrusters.frontLeftLift = clamp(baseLift + rollCorr + pitchCorr, 0, 1);
    thrusters.frontRightLift = clamp(baseLift - rollCorr + pitchCorr, 0, 1);
    thrusters.rearLeftLift = clamp(baseLift + rollCorr - pitchCorr, 0, 1);
    thrusters.rearRightLift = clamp(baseLift - rollCorr - pitchCorr, 0, 1);

    const latCmd = clamp(0.28 * competence * altGain * xError - 0.22 * competence * smoothGain * state.velocity.x + n2 * 0.35, -1, 1);
    thrusters.lateralLeft = clamp(latCmd, 0, 1);
    thrusters.lateralRight = clamp(-latCmd, 0, 1);
    thrusters.activeWingAngle = clamp(0.4 + Math.abs(state.velocity.x) * 0.1, 0.2, 0.9);
  } else if (missionId === 'roadster-obstacle-race') {
    // Stunt 04: 10km Highway Obstacle Gauntlet & 6-Lane Laser Wall Thruster Jump!
    const lookAheadDistM = 25.0 + 60.0 * lookAheadFactor * competence;

    let targetZ = 0.0;
    if (state.position.x < 225.0) {
      // Hazard 01 at x = 220m blocks Left Lanes (z > 0.5) -> Steer into Lane 3/4 (z ~ -4.2m)
      targetZ = 220.0 - state.position.x <= lookAheadDistM ? -4.2 * competence : 2.5;
    } else if (state.position.x < 455.0) {
      // Hazard 02 at x = 450m is a Cyber-Drone in Lane 3 (z ~ -3.2m) -> Overtake via Lane 2 (z ~ +3.8m)
      targetZ = 450.0 - state.position.x <= lookAheadDistM ? 3.8 * competence : -4.2;
    } else if (state.position.x < 685.0) {
      // Hazard 03 at x = 680m blocks Right Lanes (z < -0.5) -> Steer into Lane 1/2 (z ~ +4.2m)
      targetZ = 680.0 - state.position.x <= lookAheadDistM ? 4.2 * competence : 3.8;
    } else {
      // Clear straightaway aligning for Hazard 04 Full-Width Laser Wall jump
      targetZ = 0.0;
    }

    const zError = targetZ - state.position.z;
    const steerCmd = clamp(
      0.45 * competence * attGain * zError -
        0.12 * competence * smoothGain * state.velocity.z +
        n2 * (0.65 * incompetence + 0.02) +
        lrOscillation,
      -1,
      1
    );

    const isAirborne = !state.isGrounded && !state.crashed;

    // Cold-gas lift thrusters fire when airborne; rear rocket boost propels the car both on ground and in air!
    const isFinished = state.position.x >= 995.0;
    if (isAirborne) {
      const isBoostingOverWall = state.position.x <= 892.0 && state.position.y < 3.2;
      const isLandingCushion =
        state.position.x > 892.0 && state.position.y < 3.0 && state.velocity.y < -0.8;
      const baseJumpLift = isBoostingOverWall
        ? clamp((0.78 * altGain * competence + n1 * 0.1 + lrOscillation) * fuelCap, 0.45, 0.95)
        : isLandingCushion
          ? clamp((0.72 + (-state.velocity.y) * 0.06) * competence * altGain * fuelCap, 0.35, 0.92)
          : 0.08 * competence;

      const rollTrim =
        -0.55 * competence * attGain * state.attitude.roll -
        0.22 * competence * smoothGain * state.angularVelocity.x +
        n2 * 0.15;
      const pitchTrim =
        -0.58 * competence * attGain * state.attitude.pitch -
        0.24 * competence * smoothGain * state.angularVelocity.y +
        n3 * 0.15;

      thrusters.frontLeftLift = clamp(baseJumpLift + rollTrim + pitchTrim, 0, 1);
      thrusters.frontRightLift = clamp(baseJumpLift - rollTrim + pitchTrim, 0, 1);
      thrusters.rearLeftLift = clamp(baseJumpLift + rollTrim - pitchTrim, 0, 1);
      thrusters.rearRightLift = clamp(baseJumpLift - rollTrim - pitchTrim, 0, 1);
      thrusters.rearBoost = isBoostingOverWall
        ? clamp(0.95 * competence * fuelCap, 0.6, 1)
        : isLandingCushion
          ? clamp(0.28 * competence * fuelCap, 0, 0.5)
          : clamp(0.85 * competence * fuelCap, 0.4, 0.95);
    } else {
      thrusters.rearBoost = isFinished
        ? 0
        : clamp((0.75 + 0.25 * competence) * fuelCap, 0.35, 1.0);
    }

    thrusters.lateralRight = clamp(steerCmd, 0, 1);
    thrusters.lateralLeft = clamp(-steerCmd, 0, 1);
    const isPreJumpZone = state.position.x >= 840.0 && state.position.x <= 870.0;
    thrusters.activeWingAngle = isPreJumpZone
      ? 1.0
      : isAirborne
        ? 0.35
        : clamp(0.75 * competence, 0.3, 0.85);
  } else if (missionId === 'roadster-wall-climb') {
    const isAirborneDismount = state.velocity.z < 0 && !state.isGrounded && !state.crashed;
    const onLoopArc = state.velocity.z >= 0 && (state.position.x > 0.5 || state.position.y > 0.9);

    if (!isAirborneDismount) {
      thrusters.activeWingAngle = onLoopArc ? clamp(0.95 * altGain, 0.35, 1.0) : 0.45;
    } else {
      const rollRemaining = Math.PI * 2 - state.attitude.roll;
      const isKickflipping = rollRemaining > 0.25;
      const isNearGroundDescent = state.position.y <= 3.2 + lookAheadFactor && state.velocity.y < -0.4;

      const retroCushion = isNearGroundDescent
        ? clamp(((0.68 + (-state.velocity.y) * 0.08 * smoothGain) * competence * altGain + n1 * 0.15 + lrOscillation) * fuelCap, 0.1, 0.98)
        : 0.08 * competence;

      const rollBurst = isKickflipping ? 0.48 * competence * attGain : 0;
      const pitchLeveling = state.attitude.pitch < Math.PI * 1.92 ? 0.24 * competence * attGain : 0;

      thrusters.frontLeftLift = clamp(retroCushion + rollBurst + pitchLeveling, 0, 1);
      thrusters.rearLeftLift = clamp(retroCushion + rollBurst - pitchLeveling * 0.5, 0, 1);
      thrusters.frontRightLift = clamp(retroCushion - rollBurst * 0.5 + pitchLeveling, 0, 1);
      thrusters.rearRightLift = clamp(retroCushion - rollBurst * 0.5 - pitchLeveling * 0.5, 0, 1);

      thrusters.lateralLeft = isKickflipping ? clamp(0.85 * competence * attGain + Math.abs(n2) * 0.2, 0.15, 1.0) : clamp(0.32 * competence, 0, 0.6);
      thrusters.lateralRight = isKickflipping ? clamp(0.65 * competence * attGain + Math.abs(n3) * 0.2, 0.15, 0.9) : clamp(0.32 * competence, 0, 0.6);
      thrusters.rearBoost = isKickflipping
        ? clamp(0.85 * competence * fuelCap, 0, 1)
        : isNearGroundDescent
          ? clamp(0.25 * competence * fuelCap, 0, 0.45)
          : clamp(0.62 * competence * fuelCap, 0, 0.85);
      thrusters.activeWingAngle = isNearGroundDescent ? 0.95 : 0.55;
    }
  } else if (missionId === 'roadster-barrel-roll') {
    const rollRemaining = Math.PI * 2 - state.attitude.roll;

    if (state.isGrounded || state.crashed) {
      thrusters.activeWingAngle = state.position.x > 0 ? 0.95 : 0.25;
    } else {
      const flipComplete = rollRemaining <= 0.28;
      const isDescendingLow = state.position.y <= 2.4 + 0.85 * lookAheadFactor && state.velocity.y < -0.3;

      const cushionLift = isDescendingLow
        ? clamp(((0.64 + (-state.velocity.y) * 0.09 * smoothGain) * competence * altGain + n1 * 0.15 + lrOscillation) * fuelCap, 0.15, 0.96)
        : !flipComplete
          ? clamp(0.26 * competence * altGain + n1 * 0.18, 0.08, 0.45)
          : 0.12 * competence;

      const desiredOmegaX = rollRemaining > 0.02 ? clamp(rollRemaining * 4.6 * competence * attGain + 2.1 * competence + n2 * 2.2, -2, 10.0) : 0;
      const rollTorqueCmd = clamp(0.56 * competence * smoothGain * (desiredOmegaX - state.angularVelocity.x) + n2 * 0.38 + lrOscillation, -0.78, 0.78);
      const pitchKickCmd = (rollRemaining > Math.PI ? 0.18 : -0.15) * competence * attGain;

      thrusters.frontLeftLift = clamp(cushionLift + rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearLeftLift = clamp(cushionLift + rollTorqueCmd - pitchKickCmd, 0, 1);
      thrusters.frontRightLift = clamp(cushionLift - rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearRightLift = clamp(cushionLift - rollTorqueCmd - pitchKickCmd, 0, 1);

      thrusters.lateralLeft = !flipComplete ? clamp(0.92 * competence * attGain + Math.abs(n2) * 0.2, 0.25, 1.0) : clamp(0.38 * competence, 0.1, 0.65);
      thrusters.lateralRight = !flipComplete ? clamp(0.68 * competence * attGain + Math.abs(n3) * 0.2, 0.2, 0.92) : clamp(0.38 * competence, 0.1, 0.65);
      thrusters.rearBoost = !flipComplete
        ? clamp(0.88 * competence * fuelCap, 0, 1)
        : isDescendingLow
          ? clamp(0.25 * competence * fuelCap, 0, 0.45)
          : clamp(0.6 * competence * fuelCap, 0, 0.85);
      thrusters.activeWingAngle = flipComplete ? 0.95 : 0.45;
    }
  } else if (missionId === 'starship-launch' || missionId === 'starship-booster-catch') {
    const isSeparated = state.velocity.z < 0;
    const isCatchStunt = missionId === 'starship-booster-catch';

    if (!isSeparated) {
      const targetPitch = state.position.y > 4.2 ? (isCatchStunt ? -0.24 : -0.06) : 0.0;
      const pitchErr = targetPitch - state.attitude.pitch;

      const baseThrottle = clamp(
        (0.72 + 0.22 * competence * altGain + n1 * (0.35 * incompetence + 0.05)) * fuelCap,
        0.45,
        1.0
      );
      thrusters.raptorThrottle = baseThrottle;

      const tvcNoiseScale = 0.72 * incompetence + 0.12;
      thrusters.gimbalPitch = clamp(
        1.85 * competence * attGain * pitchErr -
          0.75 * competence * smoothGain * state.angularVelocity.y +
          n2 * tvcNoiseScale +
          lrOscillation,
        -1,
        1
      );
      thrusters.gimbalYaw = clamp(
        -1.45 * competence * attGain * state.attitude.roll -
          0.6 * competence * smoothGain * state.angularVelocity.x +
          n3 * tvcNoiseScale,
        -1,
        1
      );
      thrusters.hotStageSeparated = false;
    } else {
      thrusters.hotStageSeparated = true;
      const targetY = isCatchStunt ? 2.6 : 1.35;
      const heightAbovePad = Math.max(0, state.position.y - targetY);

      const desiredVx = clamp(-state.position.x * 0.85 * lookAheadFactor, -3.6, 3.6);
      const vxError = desiredVx - state.velocity.x;
      const targetPitch = heightAbovePad > 2.2 ? clamp(-vxError * 0.16 * competence * attGain, -0.42, 0.42) : 0.0;
      const pitchErr = targetPitch - state.attitude.pitch;

      const desiredVy = -Math.max(0.35, Math.min(4.8, heightAbovePad * 0.52));
      const vyError = desiredVy - state.velocity.y;
      const hoverThrottle = (9.81 * params.gravityMultiplier) / 22.8;
      const needsBoostback = isCatchStunt && Math.abs(state.position.x) > 0.9 && heightAbovePad > 5.0;

      const rawLandingThrottle =
        heightAbovePad > 6.5 + 2.5 * lookAheadFactor && state.velocity.y > -2.2 && !needsBoostback
          ? 0.08 * competence
          : clamp(((hoverThrottle + vyError * 0.18 * altGain + (needsBoostback ? 0.24 : 0)) * competence + n1 * 0.22 + lrOscillation) * fuelCap, 0.05, 1.0);

      thrusters.raptorThrottle = state.isGrounded ? 0 : rawLandingThrottle;
      thrusters.gimbalPitch = clamp(2.1 * competence * attGain * pitchErr - 0.85 * competence * smoothGain * state.angularVelocity.y + n2 * 0.45 + lrOscillation, -1, 1);
      thrusters.gimbalYaw = clamp(-1.5 * competence * attGain * state.attitude.roll - 0.65 * competence * smoothGain * state.angularVelocity.x + n3 * 0.4, -1, 1);
    }
  } else if (missionId === 'starship-pod-orbit') {
    const isAscent = state.position.y < 65.0;
    const isInsertion = state.position.y >= 65.0 && state.position.y < 118.0;
    thrusters.raptorThrottle = isAscent ? clamp(0.85 * competence + 0.15, 0.5, 1.0) : isInsertion ? clamp((120.0 - state.position.y) / 20.0, 0, 0.75) : 0;
    thrusters.hotStageSeparated = state.position.y >= 28.0;
    const pitchErr = -state.attitude.pitch;
    const rollErr = -state.attitude.roll;
    const rcsPitchCmd = clamp(2.2 * competence * attGain * pitchErr - 1.1 * smoothGain * state.angularVelocity.y + n1 * 0.15, -1, 1);
    const rcsRollCmd = clamp(2.2 * competence * attGain * rollErr - 1.1 * smoothGain * state.angularVelocity.x + n2 * 0.15, -1, 1);
    thrusters.podRcsBottom = isAscent ? 0 : clamp(0.25 * competence + (state.velocity.y < 0 ? 0.45 : 0), 0, 1);
    thrusters.podRcsLateral = isAscent ? 0 : clamp(Math.max(Math.abs(rcsPitchCmd), Math.abs(rcsRollCmd)), 0, 1);
    const settled = Math.hypot(pitchErr, rollErr) < 0.08 && Math.hypot(state.angularVelocity.y, state.angularVelocity.x) < 0.05;
    thrusters.podSolarDeployCmd = !isAscent && !isInsertion && (settled || (competence > 0.85 && state.elapsedTimeSec > 9.8)) ? 1.0 : 0.0;
  } else {
    const isFlipPhase = state.position.y < 9.8 + 2.6 * lookAheadFactor;
    const heightAboveCatch = Math.max(0, state.position.y - 1.5);
    const pitchErr = (isFlipPhase ? 0.0 : 1.45) - state.attitude.pitch;

    const flapPitchCmd = clamp(0.85 * competence * attGain * pitchErr - 0.32 * smoothGain * state.angularVelocity.y + n1 * 0.35 + lrOscillation, -0.45, 0.45);
    thrusters.flapFrontLeft = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapFrontRight = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftLeft = clamp(0.5 - flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftRight = clamp(0.5 - flapPitchCmd, 0.05, 0.95);

    if (isFlipPhase && !state.isGrounded) {
      const desiredVy = -Math.max(0.35, Math.min(4.5, heightAboveCatch * 0.52));
      const vyError = desiredVy - state.velocity.y;
      const hoverThrottle = (9.81 * params.gravityMultiplier) / 24.5;
      thrusters.raptorThrottle = clamp(((hoverThrottle + vyError * 0.19 * altGain) * competence + n2 * 0.24 + lrOscillation) * fuelCap, 0.08, 1.0);
      thrusters.gimbalPitch = clamp(2.0 * competence * attGain * pitchErr - 0.78 * competence * smoothGain * state.angularVelocity.y + n3 * 0.45 + lrOscillation, -1, 1);
    } else {
      thrusters.raptorThrottle = incompetence > 0.6 && !state.isGrounded ? clamp(Math.abs(n1) * 0.35, 0, 0.4) : 0;
      thrusters.gimbalPitch = 0;
    }
  }

  const inputs = [
    { label: 'ΔAlt (y)', value: Number(clamp(altError / 10, -1, 1).toFixed(2)) },
    { label: 'Vel Y (vy)', value: Number(clamp(state.velocity.y / 10, -1, 1).toFixed(2)) },
    { label: 'Roll (φ)', value: Number(clamp(state.attitude.roll / Math.PI, -1, 1).toFixed(2)) },
    { label: 'Pitch (θ)', value: Number(clamp(state.attitude.pitch / Math.PI, -1, 1).toFixed(2)) },
    { label: 'Lane/ω', value: Number(clamp((missionId === 'roadster-obstacle-race' ? state.position.z : state.angularVelocity.x) / 3, -1, 1).toFixed(2)) },
    { label: 'COPV PSI', value: Number(clamp(state.copvPressurePsi / 10000, 0, 1).toFixed(2)) },
  ];

  const hiddenLayer1 = Array.from({ length: 8 }, (_, idx) =>
    Number(Math.tanh(inputs[idx % inputs.length].value * (0.9 + idx * 0.12) * competence + Math.sin(t * 3 + idx) * 0.25).toFixed(2))
  );
  const hiddenLayer2 = Array.from({ length: 6 }, (_, idx) =>
    Number(Math.tanh(hiddenLayer1[idx] * 0.85 + hiddenLayer1[(idx + 2) % hiddenLayer1.length] * 0.55).toFixed(2))
  );

  const outputs =
    mission.vehicle === 'roadster'
      ? [
          { label: 'FL Nozzle', value: Number(thrusters.frontLeftLift.toFixed(2)) },
          { label: 'FR Nozzle', value: Number(thrusters.frontRightLift.toFixed(2)) },
          { label: 'RL Nozzle', value: Number(thrusters.rearLeftLift.toFixed(2)) },
          { label: 'RR Nozzle', value: Number(thrusters.rearRightLift.toFixed(2)) },
          { label: 'Side/Steer', value: Number(Math.max(thrusters.lateralLeft, thrusters.lateralRight).toFixed(2)) },
          { label: 'Aero Wing', value: Number(thrusters.activeWingAngle.toFixed(2)) },
        ]
      : mission.vehicle === 'orbital-pod'
        ? [
            { label: 'Bottom RCS', value: Number((thrusters.podRcsBottom ?? 0).toFixed(2)) },
            { label: 'Lateral RCS', value: Number((thrusters.podRcsLateral ?? 0).toFixed(2)) },
            { label: 'Deploy Cmd', value: (thrusters.podSolarDeployCmd ?? 0) > 0.5 ? 1 : 0 },
            { label: 'Solar Wing %', value: Number(((state.solarArrayDeployPct ?? 0) / 100).toFixed(2)) },
            { label: 'RCS Press', value: Number((state.copvPressurePsi / 10000).toFixed(2)) },
            { label: 'Micro-G', value: Number(state.gForce.toFixed(2)) },
          ]
        : [
            { label: 'Raptor Fire', value: Number(thrusters.raptorThrottle.toFixed(2)) },
            { label: 'TVC Pitch', value: Number(((thrusters.gimbalPitch + 1) / 2).toFixed(2)) },
            { label: 'Fwd Flaps', value: Number(thrusters.flapFrontLeft.toFixed(2)) },
            { label: 'Aft Flaps', value: Number(thrusters.flapAftLeft.toFixed(2)) },
            { label: 'Hot-Stage', value: thrusters.hotStageSeparated ? 1 : 0 },
            { label: 'Grid Fins', value: Number(clamp(0.5 + thrusters.gimbalYaw * 0.4, 0, 1).toFixed(2)) },
          ];

  const posReward = params.rewardAltitudeWeight * Math.exp(-Math.abs(altError) * 0.35);
  const attReward =
    params.rewardAttitudeWeight *
    Math.cos(state.attitude.roll * 0.5) *
    Math.cos((mission.targetAttitude.pitch - state.attitude.pitch) * 0.7);
  const fuelPenalty = params.rewardFuelWeight * 0.18 * outputs.reduce((acc, o) => acc + o.value, 0);
  const instantReward = state.crashed
    ? -25.0
    : Number((posReward + attReward - fuelPenalty + competence * 2.2).toFixed(2));

  return {
    thrusters,
    nnSnapshot: {
      inputs,
      hiddenLayer1,
      hiddenLayer2,
      outputs,
      instantReward,
      cumulativeReward: Number((instantReward * (state.elapsedTimeSec * 12 + 1)).toFixed(1)),
      policyEntropy: Number((clamp(1 - competence + params.explorationNoise * 0.5, 0.02, 0.99)).toFixed(2)),
      stabilityScore: Number((competence * 100).toFixed(1)),
    },
  };
}

export function generateEpochLearningCurve(
  missionId: MissionId,
  params: RLHyperparameters
): EpochHistoryPoint[] {
  const points: EpochHistoryPoint[] = [];
  const totalEpochs = Math.max(5, params.epochs);
  const step = Math.max(1, Math.floor(totalEpochs / 25));

  for (let ep = 1; ep <= totalEpochs; ep += step) {
    const comp = computePolicyCompetence(missionId, params, ep);
    const deterministicJitter = pseudoNoise(ep * 3.7) * (1 - comp) * 45;
    const meanReward = Number((-180 + comp * 1450 + deterministicJitter).toFixed(1));
    const survivalRatePct = Math.round(clamp(comp * 102 - (1 - comp) * 15, 4, 100));
    const maxAltitudeM = Number((1.2 + comp * 11.4).toFixed(1));
    const attitudeErrorDeg = Number(((1 - comp) * 68 + 0.8).toFixed(1));

    points.push({
      epoch: ep,
      meanReward,
      survivalRatePct,
      maxAltitudeM,
      attitudeErrorDeg,
    });
  }

  if (points[points.length - 1]?.epoch !== totalEpochs) {
    const comp = computePolicyCompetence(missionId, params, totalEpochs);
    points.push({
      epoch: totalEpochs,
      meanReward: Number((-180 + comp * 1450).toFixed(1)),
      survivalRatePct: Math.round(clamp(comp * 100, 5, 100)),
      maxAltitudeM: Number((1.2 + comp * 11.4).toFixed(1)),
      attitudeErrorDeg: Number(((1 - comp) * 68 + 0.8).toFixed(1)),
    });
  }

  return points;
}
