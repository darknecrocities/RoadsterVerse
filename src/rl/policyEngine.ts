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
    // Stunt 02: Hot-Wheels Giant Half-Loop -> Mid-Air Kickflip (No Levitation!) -> Slow Retro Landing at Origin
    const isAirborneDismount = state.velocity.z < 0;
    const onLoopArc = !isAirborneDismount && (state.position.x > 0.5 || state.position.y > 0.9);
    const learnedLoopPinning = clamp(competence * 1.25 - 0.22 - Math.abs(n1) * 0.45, 0.0, 1.0);

    if (!isAirborneDismount) {
      thrusters.rearBoost = onLoopArc
        ? clamp(0.88 * learnedLoopPinning + 0.12 + n2 * 0.25, 0.05, 1.0)
        : clamp(0.85 * competence + 0.22, 0.25, 1.0);
      thrusters.lateralRight = onLoopArc ? clamp(learnedLoopPinning + lrOscillation * 0.25, 0, 1) : 0.18;
      thrusters.lateralLeft = onLoopArc ? clamp(0.45 * learnedLoopPinning, 0, 1) : 0.12;

      const loopAssistJet = onLoopArc ? clamp(0.75 * learnedLoopPinning, 0.05, 0.95) : 0.12;
      thrusters.frontLeftLift = loopAssistJet;
      thrusters.frontRightLift = loopAssistJet;
      thrusters.rearLeftLift = loopAssistJet * 1.05;
      thrusters.rearRightLift = loopAssistJet * 1.05;
      thrusters.activeWingAngle = onLoopArc ? 0.95 : 0.45;
    } else {
      // Airborne after launching off the top lip:
      // 1) NEVER levitate at high altitude — let gravity curve the car down while firing side jets for a 360° Kickflip!
      // 2) Only ignite bottom retro-cushion thrusters when descending near the ground (y <= 4.2m) for a slow landing!
      const rollRemaining = Math.PI * 2 - state.attitude.roll;
      const isKickflipping = rollRemaining > 0.25;
      const isNearGroundDescent = state.position.y <= 4.2 && state.velocity.y < -0.4;

      const retroCushion = isNearGroundDescent
        ? clamp((0.68 + (-state.velocity.y) * 0.08) * competence + n1 * 0.15, 0.1, 0.98)
        : 0.08 * competence;

      const rollBurst = isKickflipping ? 0.48 * competence : 0;
      const pitchLeveling = state.attitude.pitch < Math.PI * 1.92 ? 0.24 * competence : 0;

      thrusters.frontLeftLift = clamp(retroCushion + rollBurst + pitchLeveling, 0, 1);
      thrusters.rearLeftLift = clamp(retroCushion + rollBurst - pitchLeveling * 0.5, 0, 1);
      thrusters.frontRightLift = clamp(retroCushion - rollBurst * 0.5 + pitchLeveling, 0, 1);
      thrusters.rearRightLift = clamp(retroCushion - rollBurst * 0.5 - pitchLeveling * 0.5, 0, 1);

      // Fire side rocker thrusters during the mid-air kickflip so white smoke bursts from the sides of the car!
      thrusters.lateralLeft = isKickflipping
        ? clamp(0.85 * competence + Math.abs(n2) * 0.2, 0.15, 1.0)
        : clamp(0.32 * competence, 0, 0.6);
      thrusters.lateralRight = isKickflipping
        ? clamp(0.65 * competence + Math.abs(n3) * 0.2, 0.15, 0.9)
        : clamp(0.32 * competence, 0, 0.6);
      thrusters.rearBoost = state.position.y > 5.0 ? 0.28 * competence : 0;
      thrusters.activeWingAngle = isNearGroundDescent ? 0.95 : 0.55;
    }
  } else if (missionId === 'roadster-barrel-roll') {
    // Stunt 03: Curved Ramp Launch -> Mid-Air Thruster Kickflip (with Side White Smoke) -> Slow Rocket Landing!
    const targetRoll = Math.PI * 2;
    const rollRemaining = targetRoll - state.attitude.roll;

    if (state.position.x < -1.4 && state.position.y < 2.25 && state.attitude.roll < 0.25) {
      // Phase 1: Sprint up the Curved Steel Quarter-Pipe & Pop into the Air
      thrusters.rearBoost = clamp(0.94 * competence + 0.2, 0.35, 1.0);
      const popLift = state.position.x > -5.4 ? clamp(0.82 * competence, 0.2, 0.95) : 0.14;
      thrusters.frontLeftLift = popLift;
      thrusters.frontRightLift = popLift * 0.65;
      thrusters.rearLeftLift = popLift;
      thrusters.rearRightLift = popLift * 0.65;
      thrusters.lateralLeft = state.position.x > -3.5 ? 0.55 * competence : 0.15;
      thrusters.lateralRight = state.position.x > -3.5 ? 0.35 * competence : 0.15;
      thrusters.activeWingAngle = 0.25;
    } else if (!state.isGrounded) {
      // Phase 2 & 3: Mid-Air 360° Thruster Kickflip + Slow Retro-Cushion Touchdown
      const flipComplete = rollRemaining <= 0.28;
      const isDescendingLow = state.position.y <= 3.2 && state.velocity.y < -0.3;

      const cushionLift = isDescendingLow
        ? clamp((0.64 + (-state.velocity.y) * 0.09) * competence + n1 * 0.15, 0.15, 0.96)
        : !flipComplete
          ? clamp(0.26 * competence + n1 * 0.18, 0.08, 0.45)
          : 0.12 * competence;

      const desiredOmegaX =
        rollRemaining > 0.02
          ? clamp(rollRemaining * 4.6 * competence + 2.1 * competence + n2 * 2.2, -2, 10.0)
          : 0;

      const rollTorqueCmd = clamp(
        0.56 * competence * (desiredOmegaX - state.angularVelocity.x) + n2 * 0.38,
        -0.78,
        0.78
      );
      const pitchKickCmd = rollRemaining > Math.PI ? 0.18 * competence : -0.15 * competence;

      thrusters.frontLeftLift = clamp(cushionLift + rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearLeftLift = clamp(cushionLift + rollTorqueCmd - pitchKickCmd, 0, 1);
      thrusters.frontRightLift = clamp(cushionLift - rollTorqueCmd + pitchKickCmd, 0, 1);
      thrusters.rearRightLift = clamp(cushionLift - rollTorqueCmd - pitchKickCmd, 0, 1);

      // Fire side rocker thrusters vigorously during the kickflip so white smoke plumes billow from both sides!
      thrusters.lateralLeft = !flipComplete
        ? clamp(0.92 * competence + Math.abs(n2) * 0.2, 0.25, 1.0)
        : clamp(0.38 * competence, 0.1, 0.65);
      thrusters.lateralRight = !flipComplete
        ? clamp(0.68 * competence + Math.abs(n3) * 0.2, 0.2, 0.92)
        : clamp(0.38 * competence, 0.1, 0.65);

      thrusters.rearBoost = !flipComplete && state.position.x < 1.5 ? 0.32 * competence : 0;
      thrusters.activeWingAngle = flipComplete ? 0.95 : 0.45;
    } else {
      // Smooth post-landing rollout on the Stunt Road deck
      thrusters.activeWingAngle = 0.95;
    }
  } else if (missionId === 'starship-launch' || missionId === 'starship-booster-catch') {
    const isSeparated = state.velocity.z < 0;
    const isCatchStunt = missionId === 'starship-booster-catch';

    if (!isSeparated) {
      // Phase 1: Full-Stack Ascent up to Hot-Stage Separation (y >= 13.5m)
      const targetPitch =
        state.position.y > 4.2 ? (isCatchStunt ? -0.24 : -0.06) : 0.0;
      const pitchErr = targetPitch - state.attitude.pitch;

      thrusters.raptorThrottle = clamp(0.88 * competence + 0.25 + n1 * 0.22, 0.35, 1.0);
      thrusters.gimbalPitch = clamp(
        1.6 * competence * pitchErr - 0.7 * competence * state.angularVelocity.y + n2 * 0.45 + lrOscillation,
        -1,
        1
      );
      thrusters.gimbalYaw = clamp(
        -1.3 * competence * state.attitude.roll - 0.55 * competence * state.angularVelocity.x + n3 * 0.45,
        -1,
        1
      );
      thrusters.hotStageSeparated = false;
    } else {
      // Phase 2: Hot-Stage Released! Upper Stage Starship climbs to orbit while
      // Super Heavy Booster executes Boostback / Descent and thrusts a SLOW VERTICAL LANDING!
      thrusters.hotStageSeparated = true;
      const targetY = isCatchStunt ? 1.5 : 1.35;
      const heightAbovePad = Math.max(0, state.position.y - targetY);

      // Desired horizontal velocity toward x = 0 (Launch Mount / Chopstick Tower)
      const desiredVx = clamp(-state.position.x * 0.85, -3.6, 3.6);
      const vxError = desiredVx - state.velocity.x;
      // Since ax = thrustAccel * sin(-pitch), positive pitch tilts thrust toward -X!
      const targetPitch =
        heightAbovePad > 2.2
          ? clamp(-vxError * 0.16 * competence, -0.42, 0.42)
          : 0.0;
      const pitchErr = targetPitch - state.attitude.pitch;

      // Progressive slow vertical descent speed profile (approaches ~0.4 m/s near touchdown)
      const desiredVy = -Math.max(0.35, Math.min(4.8, heightAbovePad * 0.52));
      const vyError = desiredVy - state.velocity.y;
      const hoverThrottle = (9.81 * params.gravityMultiplier) / 22.8;
      const needsBoostback = isCatchStunt && Math.abs(state.position.x) > 0.9 && heightAbovePad > 5.0;

      const rawLandingThrottle =
        heightAbovePad > 8.5 && state.velocity.y > -2.2 && !needsBoostback
          ? 0.08 * competence
          : clamp(
              (hoverThrottle + vyError * 0.18 + (needsBoostback ? 0.24 : 0)) * competence +
                n1 * 0.22,
              0.05,
              1.0
            );

      thrusters.raptorThrottle = state.isGrounded ? 0 : rawLandingThrottle;
      thrusters.gimbalPitch = clamp(
        2.1 * competence * pitchErr - 0.85 * competence * state.angularVelocity.y + n2 * 0.45,
        -1,
        1
      );
      thrusters.gimbalYaw = clamp(
        -1.5 * competence * state.attitude.roll - 0.65 * competence * state.angularVelocity.x + n3 * 0.4,
        -1,
        1
      );
    }
  } else {
    // Mission 05: Starship Belly-Flop Skydiver + 3-Raptor Flip-and-Burn Slow Vertical Landing
    const isFlipPhase = state.position.y < 12.2;
    const heightAboveCatch = Math.max(0, state.position.y - 1.5);
    const targetPitch = isFlipPhase ? 0.0 : 1.45;
    const pitchErr = targetPitch - state.attitude.pitch;

    const flapPitchCmd = clamp(
      0.85 * competence * pitchErr - 0.32 * state.angularVelocity.y + n1 * 0.35,
      -0.45,
      0.45
    );
    thrusters.flapFrontLeft = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapFrontRight = clamp(0.5 + flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftLeft = clamp(0.5 - flapPitchCmd, 0.05, 0.95);
    thrusters.flapAftRight = clamp(0.5 - flapPitchCmd, 0.05, 0.95);

    if (isFlipPhase && !state.isGrounded) {
      const desiredVy = -Math.max(0.35, Math.min(4.5, heightAboveCatch * 0.52));
      const vyError = desiredVy - state.velocity.y;
      const hoverThrottle = (9.81 * params.gravityMultiplier) / 24.5;
      thrusters.raptorThrottle = clamp(
        (hoverThrottle + vyError * 0.19) * competence + n2 * 0.24,
        0.08,
        1.0
      );
      thrusters.gimbalPitch = clamp(
        2.0 * competence * pitchErr - 0.78 * competence * state.angularVelocity.y + n3 * 0.45,
        -1,
        1
      );
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
