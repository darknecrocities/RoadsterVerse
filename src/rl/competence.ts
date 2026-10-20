import type { MissionId, RLHyperparameters } from '../types/simulation.ts';
import { MISSIONS } from './missions.ts';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes the effective policy competence [0.03 .. 0.995] from the user's selected
 * Epochs and RL Hyperparameters (learning rate, discount factor, exploration noise, reward weights, sensor latency).
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

  // Real-world sensor latency (10 - 250 ms) degrades uncompensated policy responsiveness
  const latencyPenalty =
    params.sensorLatencyMs && params.sensorLatencyMs > 0
      ? Math.max(0.6, 1 - (params.sensorLatencyMs / 250) * 0.35)
      : 1.0;

  const normalizedEpochs = currentEpoch / (mission.recommendedEpochs * 0.55);
  const rawGrowth =
    (1 - Math.exp(-normalizedEpochs * lrEfficiency * gammaFactor * rewardBalance)) * latencyPenalty;
  const noiseDamping = 1 - params.explorationNoise * 0.68;

  return clamp(rawGrowth * noiseDamping, 0.03, 0.995);
}
