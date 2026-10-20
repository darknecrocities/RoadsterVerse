import type {
  EpochHistoryPoint,
  MissionId,
  RLHyperparameters,
} from '../types/simulation.ts';
import { clamp, computePolicyCompetence } from './competence.ts';

function pseudoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Generates the curriculum learning curve points across epochs for telemetry visualization.
 */
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
