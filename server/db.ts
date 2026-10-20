import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CheckpointCreateInput,
  SimulationRunCreateInput,
  TriviaSubmissionInput,
} from './schemas.ts';

export interface StoredCheckpoint extends CheckpointCreateInput {
  id: string;
  createdAt: string;
}

export interface StoredSimulationRun extends SimulationRunCreateInput {
  id: string;
  createdAt: string;
}

export interface StoredTriviaScore extends TriviaSubmissionInput {
  id: string;
  createdAt: string;
}

export class SimulationRepository {
  private readonly db: DatabaseSync;

  constructor(dbFilePath: string) {
    if (dbFilePath !== ':memory:') {
      const resolvedDir = path.dirname(path.resolve(dbFilePath));
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    this.db = new DatabaseSync(dbFilePath);
    this.initializeSchema();
    this.seedDefaultsIfEmpty();
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS policy_checkpoints (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mission_id TEXT NOT NULL,
        vehicle TEXT NOT NULL,
        epochs INTEGER NOT NULL CHECK (epochs >= 1 AND epochs <= 500),
        learning_rate REAL NOT NULL,
        exploration_noise REAL NOT NULL,
        discount_factor REAL NOT NULL,
        reward_altitude_weight REAL NOT NULL,
        reward_attitude_weight REAL NOT NULL,
        reward_fuel_weight REAL NOT NULL,
        reward_smoothness_weight REAL NOT NULL,
        sensor_latency_ms REAL NOT NULL DEFAULT 0,
        mean_reward REAL NOT NULL,
        stability_score REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_mission
        ON policy_checkpoints (mission_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY NOT NULL,
        mission_id TEXT NOT NULL,
        vehicle TEXT NOT NULL,
        epochs INTEGER NOT NULL,
        cumulative_reward REAL NOT NULL,
        max_g_force REAL NOT NULL,
        peak_wall_normal_force_n REAL NOT NULL,
        final_copv_psi REAL NOT NULL,
        succeeded INTEGER NOT NULL CHECK (succeeded IN (0, 1)),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trivia_leaderboard (
        id TEXT PRIMARY KEY NOT NULL,
        pilot_callsign TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    try {
      this.db.exec(`ALTER TABLE policy_checkpoints ADD COLUMN sensor_latency_ms REAL NOT NULL DEFAULT 0;`);
    } catch {
      // Column already exists or table was just created with it
    }
  }

  private seedDefaultsIfEmpty(): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM policy_checkpoints');
    const row = countStmt.get() as { count: number } | undefined;
    if (row && row.count > 0) {
      return;
    }

    const presets: CheckpointCreateInput[] = [
      {
        name: 'Starbase Night Hover — PPO Optimal (320 Epochs)',
        missionId: 'roadster-hover',
        vehicle: 'roadster',
        epochs: 320,
        learningRate: 0.0003,
        explorationNoise: 0.04,
        discountFactor: 0.99,
        rewardAltitudeWeight: 2.2,
        rewardAttitudeWeight: 2.5,
        rewardFuelWeight: 0.8,
        rewardSmoothnessWeight: 1.4,
        sensorLatencyMs: 0,
        meanReward: 942.5,
        stabilityScore: 98.4,
      },
      {
        name: '90-Deg Wall Pinning — Lateral COPV Thruster Policy (400 Epochs)',
        missionId: 'roadster-wall-climb',
        vehicle: 'roadster',
        epochs: 400,
        learningRate: 0.0005,
        explorationNoise: 0.05,
        discountFactor: 0.995,
        rewardAltitudeWeight: 2.0,
        rewardAttitudeWeight: 2.8,
        rewardFuelWeight: 0.6,
        rewardSmoothnessWeight: 1.6,
        sensorLatencyMs: 0,
        meanReward: 1120.8,
        stabilityScore: 96.9,
      },
      {
        name: 'Untrained Chaos Baseline — Random Valve Exploration (8 Epochs)',
        missionId: 'roadster-hover',
        vehicle: 'roadster',
        epochs: 8,
        learningRate: 0.015,
        explorationNoise: 0.82,
        discountFactor: 0.85,
        rewardAltitudeWeight: 1.0,
        rewardAttitudeWeight: 0.5,
        rewardFuelWeight: 0.1,
        rewardSmoothnessWeight: 0.1,
        sensorLatencyMs: 0,
        meanReward: -145.2,
        stabilityScore: 14.2,
      },
      {
        name: 'Starship IFT Full-Stack Ascent & Hot-Stage (350 Epochs)',
        missionId: 'starship-launch',
        vehicle: 'starship',
        epochs: 350,
        learningRate: 0.0003,
        explorationNoise: 0.03,
        discountFactor: 0.995,
        rewardAltitudeWeight: 2.5,
        rewardAttitudeWeight: 2.6,
        rewardFuelWeight: 1.1,
        rewardSmoothnessWeight: 1.8,
        sensorLatencyMs: 0,
        meanReward: 1280.0,
        stabilityScore: 99.1,
      },
      {
        name: 'Starship Belly-Flop Flip & Tower Catch Guidance (450 Epochs)',
        missionId: 'starship-belly-flop',
        vehicle: 'starship',
        epochs: 450,
        learningRate: 0.00025,
        explorationNoise: 0.02,
        discountFactor: 0.998,
        rewardAltitudeWeight: 2.7,
        rewardAttitudeWeight: 3.0,
        rewardFuelWeight: 1.2,
        rewardSmoothnessWeight: 2.0,
        sensorLatencyMs: 0,
        meanReward: 1410.4,
        stabilityScore: 99.5,
      },
    ];

    for (const preset of presets) {
      this.createCheckpoint(preset);
    }
  }

  public listCheckpoints(missionId?: string): StoredCheckpoint[] {
    const sql = missionId
      ? `SELECT * FROM policy_checkpoints WHERE mission_id = ? ORDER BY created_at DESC LIMIT 50`
      : `SELECT * FROM policy_checkpoints ORDER BY created_at DESC LIMIT 50`;

    const stmt = this.db.prepare(sql);
    const rows = (missionId ? stmt.all(missionId) : stmt.all()) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      missionId: r.mission_id as StoredCheckpoint['missionId'],
      vehicle: r.vehicle as StoredCheckpoint['vehicle'],
      epochs: Number(r.epochs),
      learningRate: Number(r.learning_rate),
      explorationNoise: Number(r.exploration_noise),
      discountFactor: Number(r.discount_factor),
      rewardAltitudeWeight: Number(r.reward_altitude_weight),
      rewardAttitudeWeight: Number(r.reward_attitude_weight),
      rewardFuelWeight: Number(r.reward_fuel_weight),
      rewardSmoothnessWeight: Number(r.reward_smoothness_weight),
      sensorLatencyMs: Number(r.sensor_latency_ms ?? 0),
      meanReward: Number(r.mean_reward),
      stabilityScore: Number(r.stability_score),
      createdAt: String(r.created_at),
    }));
  }

  public createCheckpoint(input: CheckpointCreateInput): StoredCheckpoint {
    const id = `chk_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO policy_checkpoints (
        id, name, mission_id, vehicle, epochs, learning_rate, exploration_noise,
        discount_factor, reward_altitude_weight, reward_attitude_weight,
        reward_fuel_weight, reward_smoothness_weight, sensor_latency_ms, mean_reward, stability_score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.missionId,
      input.vehicle,
      input.epochs,
      input.learningRate,
      input.explorationNoise,
      input.discountFactor,
      input.rewardAltitudeWeight,
      input.rewardAttitudeWeight,
      input.rewardFuelWeight,
      input.rewardSmoothnessWeight,
      input.sensorLatencyMs ?? 0,
      input.meanReward,
      input.stabilityScore,
      createdAt
    );

    return { id, ...input, createdAt };
  }

  public recordSimulationRun(input: SimulationRunCreateInput): StoredSimulationRun {
    const id = `run_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO simulation_runs (
        id, mission_id, vehicle, epochs, cumulative_reward,
        max_g_force, peak_wall_normal_force_n, final_copv_psi, succeeded, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.missionId,
      input.vehicle,
      input.epochs,
      input.cumulativeReward,
      input.maxGForce,
      input.peakWallNormalForceN,
      input.finalCopvPsi,
      input.succeeded ? 1 : 0,
      createdAt
    );

    return { id, ...input, createdAt };
  }

  public listRecentRuns(): StoredSimulationRun[] {
    const stmt = this.db.prepare(`SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 25`);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      missionId: r.mission_id as StoredSimulationRun['missionId'],
      vehicle: r.vehicle as StoredSimulationRun['vehicle'],
      epochs: Number(r.epochs),
      cumulativeReward: Number(r.cumulative_reward),
      maxGForce: Number(r.max_g_force),
      peakWallNormalForceN: Number(r.peak_wall_normal_force_n),
      finalCopvPsi: Number(r.final_copv_psi),
      succeeded: Number(r.succeeded) === 1,
      createdAt: String(r.created_at),
    }));
  }

  public recordTriviaScore(input: TriviaSubmissionInput): StoredTriviaScore {
    const id = `trv_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO trivia_leaderboard (id, pilot_callsign, score, total_questions, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.pilotCallsign, input.score, input.totalQuestions, createdAt);
    return { id, ...input, createdAt };
  }

  public listTriviaLeaderboard(): StoredTriviaScore[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trivia_leaderboard
      ORDER BY score DESC, created_at DESC
      LIMIT 15
    `);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      pilotCallsign: String(r.pilot_callsign),
      score: Number(r.score),
      totalQuestions: Number(r.total_questions),
      createdAt: String(r.created_at),
    }));
  }
}
