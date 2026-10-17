import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { SimulationRepository } from './db.ts';
import { createApiRouter } from './routes.ts';

// TODO(security): Public interactive educational sandbox uses anonymous sessionless checkpoints;
// if multi-tenant accounts are added later, integrate OAuth 2.0 / OIDC + MFA and __Host- HttpOnly cookies.

export function createApp(dbPath?: string): Express {
  const app = express();
  const resolvedDbPath = dbPath ?? process.env.DB_PATH ?? './data/thrust_weight.db';
  const repo = new SimulationRepository(resolvedDbPath);

  // Strict security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'http://127.0.0.1:3001', 'http://localhost:3001'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      frameguard: { action: 'deny' },
      noSniff: true,
    })
  );

  // Explicitly disable unused browser sensors & enforce strict CORS allow-list
  const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5173';
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const origin = req.headers.origin;
    if (origin && (origin === allowedOrigin || origin === 'http://localhost:5173')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Rate limiting on API endpoints
  const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', createApiRouter(repo));

  // Serve static production frontend bundle when present
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3001);
  // Strictly bind to 127.0.0.1 in development/test as mandated by security guidelines
  const host =
    process.env.NODE_ENV === 'production' ? (process.env.HOST ?? '127.0.0.1') : '127.0.0.1';
  const app = createApp();
  const server = app.listen(port, host, () => {
    console.log(`THRUST//WEIGHT API Server listening on http://${host}:${port}`);
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 15_000;
}
