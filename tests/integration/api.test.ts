import { describe, expect, it } from 'vitest';
import { Socket } from 'node:net';
import http from 'node:http';
import type { Express } from 'express';
import { createApp } from '../../server/index.ts';

interface InMemoryResponse {
  status: number;
  headers: Record<string, string | string[] | number | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/**
 * Dispatches an HTTP request directly through the Express application pipeline in-memory
 * (including Helmet CSP, CORS, rate-limiting, body parsing, Zod validation, and SQLite)
 * without opening a kernel TCP socket.
 */
async function invokeExpressApp(
  app: Express,
  options: {
    method: string;
    url: string;
    body?: Record<string, unknown>;
  }
): Promise<InMemoryResponse> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      host: '127.0.0.1:3001',
      'content-type': 'application/json',
    };
    // Provide a valid loopback address for express-rate-limit
    Object.defineProperty(req, 'ip', { value: '127.0.0.1' });

    const bodyStr = options.body ? JSON.stringify(options.body) : '';
    if (bodyStr) {
      req.headers['content-length'] = String(Buffer.byteLength(bodyStr));
    }

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];

    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.write = ((chunk: any, ...rest: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return origWrite(chunk, ...rest);
    }) as typeof res.write;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = ((chunk?: any, ...rest: any[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      origEnd(chunk, ...rest);
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsedBody: unknown = raw;
      try {
        parsedBody = raw ? JSON.parse(raw) : null;
      } catch {
        // Leave raw string if not JSON
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
      });
      return res;
    }) as typeof res.end;

    try {
      app(req, res);
      if (bodyStr) {
        req.push(bodyStr);
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

describe('THRUST//WEIGHT Backend API & SQLite Persistence', () => {
  const app = createApp(':memory:');

  it('returns 200 on GET /api/health with strict security headers', async () => {
    const res = await invokeExpressApp(app, { method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(String(res.headers['permissions-policy'])).toContain('camera=()');
    expect(String(res.headers['content-security-policy'])).toContain("default-src 'self'");
  });

  it('lists seeded default RL policy checkpoints and filters by missionId', async () => {
    const res = await invokeExpressApp(app, {
      method: 'GET',
      url: '/api/checkpoints?missionId=roadster-wall-climb',
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].missionId).toBe('roadster-wall-climb');
  });

  it('persists a valid new RL policy checkpoint and rejects invalid XSS payloads with 422', async () => {
    const validPayload = {
      name: 'Custom Wall Adhesion Policy v2',
      missionId: 'roadster-wall-climb',
      vehicle: 'roadster',
      epochs: 360,
      learningRate: 0.0004,
      explorationNoise: 0.03,
      discountFactor: 0.995,
      rewardAltitudeWeight: 2.3,
      rewardAttitudeWeight: 2.7,
      rewardFuelWeight: 0.9,
      rewardSmoothnessWeight: 1.5,
      meanReward: 1185.2,
      stabilityScore: 97.6,
    };

    const createRes = await invokeExpressApp(app, {
      method: 'POST',
      url: '/api/checkpoints',
      body: validPayload,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.id).toMatch(/^chk_/);
    expect(createRes.body.data.name).toBe('Custom Wall Adhesion Policy v2');

    // Attempt XSS payload injection in checkpoint name
    const maliciousRes = await invokeExpressApp(app, {
      method: 'POST',
      url: '/api/checkpoints',
      body: {
        ...validPayload,
        name: '<script>alert("xss")</script>',
      },
    });
    expect(maliciousRes.status).toBe(422);
    expect(maliciousRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('records simulation telemetry runs and trivia leaderboard scores', async () => {
    const runRes = await invokeExpressApp(app, {
      method: 'POST',
      url: '/api/runs',
      body: {
        missionId: 'starship-belly-flop',
        vehicle: 'starship',
        epochs: 420,
        cumulativeReward: 1390.5,
        maxGForce: 3.15,
        peakWallNormalForceN: 0,
        finalCopvPsi: 7850,
        succeeded: true,
      },
    });
    expect(runRes.status).toBe(201);

    const triviaRes = await invokeExpressApp(app, {
      method: 'POST',
      url: '/api/trivia/submit',
      body: {
        pilotCallsign: 'Starman_01',
        score: 6,
        totalQuestions: 6,
      },
    });
    expect(triviaRes.status).toBe(201);

    const boardRes = await invokeExpressApp(app, {
      method: 'GET',
      url: '/api/trivia/leaderboard',
    });
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.data[0].pilotCallsign).toBe('Starman_01');
  });

  it('rejects disallowed HTTP methods such as DELETE with 405', async () => {
    const res = await invokeExpressApp(app, {
      method: 'DELETE',
      url: '/api/checkpoints',
    });
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
