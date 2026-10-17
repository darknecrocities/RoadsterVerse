import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import type { SimulationRepository } from './db.ts';
import {
  CheckpointCreateSchema,
  MissionIdSchema,
  SimulationRunCreateSchema,
  TriviaSubmissionSchema,
} from './schemas.ts';

function buildEnvelope<T>(data: T | null, error: { code: string; message: string } | null = null) {
  return {
    data,
    error,
    meta: {
      requestId: `req_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createApiRouter(repo: SimulationRepository): Router {
  const router = Router();

  // Only allow GET and POST methods on API routes
  router.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
      res.status(405).json(
        buildEnvelope(null, {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only GET and POST methods are permitted on this endpoint.',
        })
      );
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json(
      buildEnvelope({
        status: 'ok',
        service: 'thrust-weight-rl-sandbox-api',
      })
    );
  });

  router.get('/checkpoints', (req: Request, res: Response) => {
    try {
      const rawMissionId = req.query.missionId;
      let missionFilter: string | undefined;

      if (typeof rawMissionId === 'string' && rawMissionId.length > 0) {
        const parsed = MissionIdSchema.safeParse(rawMissionId);
        if (!parsed.success) {
          res.status(400).json(
            buildEnvelope(null, {
              code: 'INVALID_MISSION_ID',
              message: 'Provided missionId query filter is invalid.',
            })
          );
          return;
        }
        missionFilter = parsed.data;
      }

      const checkpoints = repo.listCheckpoints(missionFilter);
      res.status(200).json(buildEnvelope(checkpoints));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to retrieve policy checkpoints.',
        })
      );
    }
  });

  router.post('/checkpoints', (req: Request, res: Response) => {
    const parsed = CheckpointCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json(
        buildEnvelope(null, {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        })
      );
      return;
    }

    try {
      const created = repo.createCheckpoint(parsed.data);
      res.status(201).json(buildEnvelope(created));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'PERSISTENCE_ERROR',
          message: 'Failed to store policy checkpoint.',
        })
      );
    }
  });

  router.get('/runs', (_req: Request, res: Response) => {
    try {
      const runs = repo.listRecentRuns();
      res.status(200).json(buildEnvelope(runs));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to list recent simulation runs.',
        })
      );
    }
  });

  router.post('/runs', (req: Request, res: Response) => {
    const parsed = SimulationRunCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json(
        buildEnvelope(null, {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        })
      );
      return;
    }

    try {
      const created = repo.recordSimulationRun(parsed.data);
      res.status(201).json(buildEnvelope(created));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'PERSISTENCE_ERROR',
          message: 'Failed to record simulation run.',
        })
      );
    }
  });

  router.get('/trivia/leaderboard', (_req: Request, res: Response) => {
    try {
      const scores = repo.listTriviaLeaderboard();
      res.status(200).json(buildEnvelope(scores));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to fetch trivia leaderboard.',
        })
      );
    }
  });

  router.post('/trivia/submit', (req: Request, res: Response) => {
    const parsed = TriviaSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json(
        buildEnvelope(null, {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        })
      );
      return;
    }

    try {
      const recorded = repo.recordTriviaScore(parsed.data);
      res.status(201).json(buildEnvelope(recorded));
    } catch {
      res.status(500).json(
        buildEnvelope(null, {
          code: 'PERSISTENCE_ERROR',
          message: 'Failed to submit trivia score.',
        })
      );
    }
  });

  return router;
}
