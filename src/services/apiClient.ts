import type { MissionId, SavedCheckpoint, VehicleId } from '../types/simulation.ts';

interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: { requestId: string; timestamp: string };
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CONNECT_TIMEOUT_MS = 3_000;
const READ_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 30_000;

const responseCache = new Map<string, CacheEntry<unknown>>();

export function invalidateApiCache(prefix = ''): void {
  for (const key of responseCache.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

export function createDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delayMs = 250
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delayMs);
  };
}

async function sleepWithJitter(attempt: number): Promise<void> {
  const baseDelay = Math.min(2000, 200 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 120);
  await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
}

async function fetchWithResilience<T>(
  url: string,
  options: RequestInit = {},
  useCache = false
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const cacheKey = `${method}:${url}`;

  if (useCache && method === 'GET') {
    const hit = responseCache.get(cacheKey) as CacheEntry<T> | undefined;
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS + READ_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
      });
      clearTimeout(connectTimer);

      if (response.status >= 500 || response.status === 429) {
        throw new Error(`Transient HTTP status ${response.status}`);
      }

      const payload = (await response.json()) as ApiEnvelope<T>;
      if (!response.ok || payload.error || payload.data === null) {
        throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
      }

      if (useCache && method === 'GET') {
        responseCache.set(cacheKey, {
          value: payload.data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return payload.data;
    } catch (err) {
      clearTimeout(connectTimer);
      lastError = err instanceof Error ? err : new Error('Network request failed');
      // Only retry GET or idempotent requests on transient failure
      if (attempt < MAX_RETRIES - 1 && method === 'GET') {
        await sleepWithJitter(attempt);
        continue;
      }
      break;
    }
  }

  throw lastError ?? new Error('Unreachable API endpoint');
}

export async function fetchCheckpoints(missionId?: MissionId): Promise<SavedCheckpoint[]> {
  const query = missionId ? `?missionId=${encodeURIComponent(missionId)}` : '';
  return fetchWithResilience<SavedCheckpoint[]>(`/api/checkpoints${query}`, { method: 'GET' }, true);
}

export async function saveCheckpointApi(
  input: Omit<SavedCheckpoint, 'id' | 'createdAt'>
): Promise<SavedCheckpoint> {
  const created = await fetchWithResilience<SavedCheckpoint>('/api/checkpoints', {
    method: 'POST',
    headers: {
      'Idempotency-Key': `idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    },
    body: JSON.stringify(input),
  });
  invalidateApiCache('GET:/api/checkpoints');
  return created;
}

export async function recordSimulationRunApi(input: {
  missionId: MissionId;
  vehicle: VehicleId;
  epochs: number;
  cumulativeReward: number;
  maxGForce: number;
  peakWallNormalForceN: number;
  finalCopvPsi: number;
  succeeded: boolean;
}): Promise<void> {
  await fetchWithResilience('/api/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  invalidateApiCache('GET:/api/runs');
}

export interface TriviaScoreRecord {
  id: string;
  pilotCallsign: string;
  score: number;
  totalQuestions: number;
  createdAt: string;
}

export async function fetchTriviaLeaderboard(): Promise<TriviaScoreRecord[]> {
  return fetchWithResilience<TriviaScoreRecord[]>('/api/trivia/leaderboard', { method: 'GET' }, true);
}

export async function submitTriviaScoreApi(input: {
  pilotCallsign: string;
  score: number;
  totalQuestions: number;
}): Promise<TriviaScoreRecord> {
  const res = await fetchWithResilience<TriviaScoreRecord>('/api/trivia/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  invalidateApiCache('GET:/api/trivia/leaderboard');
  return res;
}
