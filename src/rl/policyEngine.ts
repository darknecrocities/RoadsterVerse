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
 * Computes the effective policy competence [0.02 .. 0.995] from the user's selected
 * Epochs and RL Hyperparameters (learning rate, discount factor, exploration noise, reward weights).
 */
export function computePolicyCompetence(
  missionId: MissionId,
  params: RLHyperparameters,
  epochOverride?: number
): number {
  const mission = MISSIONS[missionId];
  const currentEpoch = epochOverride ?? params.epochs;

  const lrPenalty =
    params.learningRate > 0.01
      ? Math.max(0.25, 1 - (params.learningRate - 0.01) * 14)
      : params.learningRate < 0.0001
        ? 0.65
        : 1.0;

  const gammaFactor = clamp((params.discountFactor - 0.75) / 0.24, 0.35, 1.04);

  const rewardBalance = clamp(
    (params.rewardAltitudeWeight * 0.35 +
      params.rewardAttitudeWeight * 0.4 +
      params.rewardSmoothnessWeight * 0.25) /
      2.1,
    0.4,
    1.12
  );

  const normalizedEpochs = currentEpoch / (mission.recommendedEpochs * 0.55);
  const rawGrowth = 1 - Math.exp(-normalizedEpochs * lrPenalty * gammaFactor * rewardBalance);
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

  const lrOscillation =
    params.learningRate > 0.008
      ? Math.sin(t * 18.0 + agentSeedOffset) * (params.learningRate * 12)
      : 0;

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
    const kpAlt = 0.24 * competence * clamp(params.rewardAltitudeWeight / 1.8, 0.4, 1.6);
    const kdAlt = 0.19 * competence * clamp(params.rewardSmoothnessWeight / 1.2, 0.4, 1.5);
    const baseLift = clamp(
      hoverFeedforward + kpAlt * altError - kdAlt * state.velocity.y + n1 * 0.45 + lrOscillation,
      0,
      1
    );

    const kpAtt = 0.65 * competence * clamp(params.rewardAttitudeWeight / 2.0, 0.3, 1.6);
    const rollCorr =
      -kpAtt * state.attitude.roll - 0.25 * competence * state.angularVelocity.x + n2 * 0.42;
    const pitchCorr =
      -kpAtt * state.attitude.pitch - 0.28 * competence * state.angularVelocity.y + n3 * 0.38;

    thrusters.frontLeftLift = clamp(baseLift + rollCorr + pitchCorr, 0, 1);
    thrusters.frontRightLift = clamp(baseLift - rollCorr + pitchCorr, 0, 1);
    thrusters.rearLeftLift = clamp(baseLift + rollCorr - pitchCorr, 0, 1);
    thrusters.rearRightLift = clamp(baseLift - rollCorr - pitchCorr, 0, 1);

    const latCmd = clamp(0.28 * competence * xError - 0.22 * competence * state.velocity.x + n2 * 0.35, -1, 1);
    thrusters.lateralLeft = clamp(latCmd, 0, 1);
    thrusters.lateralRight = clamp(-latCmd, 0, 1);
    thrusters.activeWingAngle = clamp(0.4 + Math.abs(state.velocity.x) * 0.1, 0.2, 0.9);
  } else if (missionId === 'roadster-wall-climb') {
    // Stunt 02: Hot-Wheels Giant Half-Loop & Sky Flip (Image 1)
    const isAirborneDismount = state.velocity.z < 0;
    const onLoopArc = !isAirborneDismount && (state.position.x > 0.5 || state.position.y > 0.9);
    const learnedLoopPinning = clamp(competence * 1.25 - 0.22 - Math.abs(n1) * 0.45, 0.0, 1.0);

    if (!isAirborneDismount) {
      thrusters.rearBoost = onLoopArc
        ? clamp(0.88 * learnedLoopPinning + 0.12 + n2 * 0.25, 0.05, 1.0)
        : clamp(0.85 * competence + 0.22, 0.25, 1.0);
      thrusters.lateralRight = onLoopArc ? clamp(learnedLoopPinning + lrOscillation * 0.25, 0, 1) : 0.1;
      thrusters.lateralLeft = onLoopArc && incompetence > 0.45 ? clamp(Math.abs(n2) * 0.6, 0, 1) : 0;

      const loopAssistJet = onLoopArc ? clamp(0.75 * learnedLoopPinning, 0.05, 0.95) : 0.12;
      thrusters.frontLeftLift = loopAssistJet;
      thrusters.frontRightLift = loopAssistJet;
      thrusters.rearLeftLift = loopAssistJet * 1.05;
      thrusters.rearRightLift = loopAssistJet * 1.05;
      thrusters.activeWingAngle = onLoopArc ? 0.95 : 0.45;
    } else {
      // Launched upside-down off the overhanging C-loop lip! Flip upright and cushion touchdown!
      const cushion = clamp(0.74 * competence + n1 * 0.2, 0.15, 0.95);
      thrusters.frontLeftLift = clamp(cushion + 0.2 * competence, 0, 1);
      thrusters.frontRightLift = clamp(cushion + 0.2 * competence, 0, 1);
      thrusters.rearLeftLift = clamp(cushion * 0.85, 0, 1);
      thrusters.rearRightLift = clamp(cushion * 0.85, 0, 1);
      thrusters.lateralRight = 0.25 * competence;
      thrusters.activeWingAngle = 0.9;
    }
  } else if (missionId === 'roadster-barrel-roll') {
    // Stunt 03: Curved Quarter-Pipe Ramp Launch -> 360° Kickflip -> Smooth Landing!
    const targetRoll = Math.PI * 2;
    const rollRemaining = targetRoll - state.attitude.roll;

    if (state.position.x < -1.4 && state.position.y < 2.25 && state.attitude.roll < 0.25) {
      // Sprint & Curved Quarter-Pipe Pop phase
      thrusters.rearBoost = clamp(0.92 * competence + 0.2, 0.3, 1.0);
      const popLift = state.position.x > -5.6 ? clamp(0.88 * competence, 0.2, 1.0) : 0.12;
      thrusters.frontLeftLift = popLift;
      thrusters.frontRightLift = popLift * 0.55;
      thrusters.rearLeftLift = popLift;
      thrusters.rearRightLift = popLift * 0.55;
      thrusters.activeWingAngle = 0.25;
    } else if (!state.isGrounded) {
      // Mid-air 360° Kickflip & Cushioned Landing Burn
      const flipComplete = rollRemaining <= 0.35;
      const cushionLift = !flipComplete
        ? clamp(0.42 * competence + n1 * 0.22, 0.12, 0.78)
        : state.velocity.y < -2.2
          ? clamp(0.48 * competence * (-state.velocity.y - 1.6) + 0.22, 0.1, 0.85)
          : 0.08;

      const desiredOmegaX =
        rollRemaining > 0.02
          ? clamp(rollRemaining * 4.4 * competence + 1.85 * competence + n2 * 2.4, -2, 9.5)
          : 0;

      const rollTorqueCmd = clamp(
        0.54 * competence * (desiredOmegaX - state.angularVelocity.x) + n2 * 0.42,
        -0.78,
        0.78
      );
      const pitchKickCmd = rollRemaining > Math.PI ? 0.18 * competence : -0.15 * competence;

      thrusters.frontLeftLift = clamp(cushionLift + rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearLeftLift = clamp(cushionLift + rollTorqueCmd - pitchKickCmd, 0, 1);
      thrusters.frontRightLift = clamp(cushionLift - rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearRightLift = clamp(cushionLift - rollTorqueCmd - pitchKickCmd, 0, 1);
      thrusters.lateralLeft = clamp(n3 * 0.25, 0, 1);
      thrusters.lateralRight = clamp(-n3 * 0.25, 0, 1);
      thrusters.rearBoost = rollRemaining > 1.2 ? 0.35 * competence : 0;
      thrusters.activeWingAngle = flipComplete ? 0.92 : 0.45;
    } else {
      // Smooth post-landing rollout on the Stunt Road deck
      thrusters.activeWingAngle = 0.95;
    }
  } else if (missionId === 'starship-launch') {
    const targetPitch = state.position.y > 6.0 ? -0.18 : 0.0;
    const pitchErr = targetPitch - state.attitude.pitch;

    thrusters.raptorThrottle = clamp(0.88 * competence + 0.25 + n1 * 0.25, 0.35, 1.0);
    thrusters.gimbalPitch = clamp(
      1.4 * competence * pitchErr - 0.65 * competence * state.angularVelocity.y + n2 * 0.6 + lrOscillation,
      -1,
      1
    );
    thrusters.gimbalYaw = clamp(
      -1.2 * competence * state.attitude.roll - 0.5 * competence * state.angularVelocity.x + n3 * 0.5,
      -1,
      1
    );
    thrusters.hotStageSeparated = state.position.y >= 17.5;
  } else {
    const isFlipPhase = state.position.y < 12.5;
    const targetPitch = isFlipPhase ? 0.0 : 1.45;
    const pitchErr = targetPitch - state.attitude.pitch;

    const flapPitchCmd = clamp(0.8 * competence * pitchErr - 0.3 * state.angularVelocity.y + n1 * 0.4, -0.45, 0.45);
    thrusters.flapFrontLeft = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapFrontRight = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftLeft = clamp(0.5 - flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftRight = clamp(0.5 - flapPitchCmd, 0.05, 0.95);

    if (isFlipPhase) {
      const descentBrake = clamp((-state.velocity.y - 0.8) * 0.26 * competence + 0.42, 0.2, 1.0);
      thrusters.raptorThrottle = clamp(descentBrake + n2 * 0.3, 0.1, 1.0);
      thrusters.gimbalPitch = clamp(
        1.8 * competence * pitchErr - 0.7 * competence * state.angularVelocity.y + n3 * 0.5,
        -1,
        1
      );
    } else {
      thrusters.raptorThrottle = incompetence > 0.6 ? clamp(Math.abs(n1) * 0.35, 0, 0.4) : 0;
      thrusters.gimbalPitch = 0;
    }
  }

  const inputs = [
    { label: 'ΔAlt (y)', value: Number(clamp(altError / 10, -1, 1).toFixed(2)) },
    { label: 'Vel Y (vy)', value: Number(clamp(state.velocity.y / 10, -1, 1).toFixed(2)) },
    { label: 'Roll (φ)', value: Number(clamp(state.attitude.roll / Math.PI, -1, 1).toFixed(2)) },
    { label: 'Pitch (θ)', value: Number(clamp(state.attitude.pitch / Math.PI, -1, 1).toFixed(2)) },
    { label: 'Rate ωx', value: Number(clamp(state.angularVelocity.x / 4, -1, 1).toFixed(2)) },
    { label: 'COPV PSI', value: Number(clamp(state.copvPressurePsi / 10000, 0, 1).toFixed(2)) },
  ];

  const hiddenLayer1 = Array.from({ length: 8 }, (_, idx) =>
    Number(
      Math.tanh(
        inputs[idx % inputs.length].value * (0.9 + idx * 0.12) * competence +
          Math.sin(t * 3 + idx) * 0.25
      ).toFixed(2)
    )
  );

  const hiddenLayer2 = Array.from({ length: 6 }, (_, idx) =>
    Number(
      Math.tanh(
        hiddenLayer1[idx] * 0.85 + hiddenLayer1[(idx + 2) % hiddenLayer1.length] * 0.55
      ).toFixed(2)
    )
  );

  const outputs =
    mission.vehicle === 'roadster'
      ? [
          { label: 'FL Nozzle', value: Number(thrusters.frontLeftLift.toFixed(2)) },
          { label: 'FR Nozzle', value: Number(thrusters.frontRightLift.toFixed(2)) },
          { label: 'RL Nozzle', value: Number(thrusters.rearLeftLift.toFixed(2)) },
          { label: 'RR Nozzle', value: Number(thrusters.rearRightLift.toFixed(2)) },
          { label: 'Wall RCS', value: Number(thrusters.lateralRight.toFixed(2)) },
          { label: 'Rear COPV', value: Number(thrusters.rearBoost.toFixed(2)) },
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
