import { z } from 'zod';

export const MissionIdSchema = z.enum([
  'roadster-hover',
  'roadster-wall-climb',
  'roadster-barrel-roll',
  'starship-launch',
  'starship-belly-flop',
  'starship-booster-catch',
]);

export const VehicleIdSchema = z.enum(['roadster', 'starship']);

export const CheckpointCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Checkpoint name must be at least 2 characters')
    .max(80, 'Checkpoint name must be at most 80 characters')
    .regex(/^[a-zA-Z0-9 _\-./()#]+$/, 'Checkpoint name contains invalid characters'),
  missionId: MissionIdSchema,
  vehicle: VehicleIdSchema,
  epochs: z.number().int().min(1).max(500),
  learningRate: z.number().min(0.00005).max(0.1),
  explorationNoise: z.number().min(0).max(1),
  discountFactor: z.number().min(0.5).max(0.9999),
  rewardAltitudeWeight: z.number().min(0).max(5),
  rewardAttitudeWeight: z.number().min(0).max(5),
  rewardFuelWeight: z.number().min(0).max(5),
  rewardSmoothnessWeight: z.number().min(0).max(5),
  meanReward: z.number().min(-10000).max(100000),
  stabilityScore: z.number().min(0).max(100),
});

export const SimulationRunCreateSchema = z.object({
  missionId: MissionIdSchema,
  vehicle: VehicleIdSchema,
  epochs: z.number().int().min(1).max(500),
  cumulativeReward: z.number().min(-50000).max(100000),
  maxGForce: z.number().min(0).max(50),
  peakWallNormalForceN: z.number().min(0).max(500000),
  finalCopvPsi: z.number().min(0).max(12000),
  succeeded: z.boolean(),
});

export const TriviaSubmissionSchema = z.object({
  pilotCallsign: z
    .string()
    .trim()
    .min(2, 'Callsign must be at least 2 characters')
    .max(32, 'Callsign must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_\- ]+$/, 'Callsign may only contain letters, numbers, spaces, hyphens, or underscores'),
  score: z.number().int().min(0).max(20),
  totalQuestions: z.number().int().min(1).max(20),
});

export type CheckpointCreateInput = z.infer<typeof CheckpointCreateSchema>;
export type SimulationRunCreateInput = z.infer<typeof SimulationRunCreateSchema>;
export type TriviaSubmissionInput = z.infer<typeof TriviaSubmissionSchema>;
