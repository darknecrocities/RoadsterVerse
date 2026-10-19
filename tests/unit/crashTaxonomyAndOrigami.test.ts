import { describe, expect, it } from 'vitest';
import {
  CRASH_TAXONOMY,
  CRASH_TAXONOMY_BY_ID,
  getCrashTaxonomyForStunt,
  resolveCrashRecord,
} from '../../src/data/crashTaxonomy.ts';
import { resolveCrashDynamics } from '../../src/physics/crashDynamics.ts';
import {
  createInitialOrbitalPodState,
  getOrbitalFlightPhase,
  stepOrbitalPodPhysics,
} from '../../src/physics/orbitalPhysics.ts';
import { createOrbitalPodModel } from '../../src/three/orbitalPodModel.ts';
import { DEFAULT_HYPERPARAMETERS, MISSION_LIST } from '../../src/rl/missions.ts';

describe('104-Crash Failure Taxonomy & Origami Satellite System E2E', () => {
  it('contains at least 100 total crash modes with exactly 13 modes per stunt across all 8 stunts', () => {
    expect(CRASH_TAXONOMY.length).toBeGreaterThanOrEqual(100);
    expect(CRASH_TAXONOMY.length).toBe(104);

    // Verify all 8 stunts have exactly 13 crashes
    for (const mission of MISSION_LIST) {
      const stuntCrashes = getCrashTaxonomyForStunt(mission.id);
      expect(stuntCrashes.length).toBe(13);

      stuntCrashes.forEach((rec) => {
        expect(rec.id).toBeTruthy();
        expect(rec.code).toMatch(/^[A-Z]{3}-\d{3}$/);
        expect(rec.title.length).toBeGreaterThan(5);
        expect(rec.category).toMatch(/^(Propulsion|Aerodynamic|Trajectory|Structural|Obstacle|Orbital)$/);
        expect(rec.diagnosticMessage.length).toBeGreaterThan(10);
        expect(rec.physicalTrigger.length).toBeGreaterThan(15);
        expect(rec.mlConfigCause.length).toBeGreaterThan(15);
        expect(rec.environmentalCause.length).toBeGreaterThan(15);
        expect(rec.remedyRecommendation.length).toBeGreaterThan(15);
        expect(rec.severity).toBeGreaterThan(0);
        expect(rec.severity).toBeLessThanOrEqual(1.0);
      });
    }
  });

  it('guarantees unique IDs and code identifiers across all 104 entries', () => {
    const ids = new Set<string>();
    const codes = new Set<string>();

    for (const rec of CRASH_TAXONOMY) {
      expect(ids.has(rec.id)).toBe(false);
      expect(codes.has(rec.code)).toBe(false);
      ids.add(rec.id);
      codes.add(rec.code);
      expect(CRASH_TAXONOMY_BY_ID[rec.id]).toBe(rec);
    }

    expect(ids.size).toBe(104);
    expect(codes.size).toBe(104);
  });

  it('resolves crash records with full diagnostic metadata and physics-based severity', () => {
    const crash1 = resolveCrashDynamics('obstacle-cyber-drone-collision', { x: 72, y: 0, z: 0 }, { roll: 0, pitch: 0, yaw: 0 }, 'roadster-obstacle-race');
    expect(crash1.record).toBeDefined();
    expect(crash1.record?.code).toBe('GNT-041');
    expect(crash1.record?.category).toBe('Obstacle');
    expect(crash1.record?.physicalTrigger).toContain('drone');
    expect(crash1.impactSeverity).toBeGreaterThan(0.7);

    const crash2 = resolveCrashDynamics('orbit-origami-hinge-binding', { x: 0, y: 0, z: 0 }, { roll: 0, pitch: 0, yaw: 0 }, 'starship-pod-orbit');
    expect(crash2.record).toBeDefined();
    expect(crash2.record?.code).toBe('ORB-096');
    expect(crash2.record?.category).toBe('Structural');
    expect(crash2.record?.mlConfigCause).toContain('rewardSmoothnessWeight');
  });

  it('provides safe fallback for unknown crash types', () => {
    const fallback = resolveCrashRecord('unknown-speculative-anomaly', 'roadster-hover');
    expect(fallback).toBeDefined();
    expect(fallback.stuntId).toBe('roadster-hover');
  });

  it('articulates connected origami accordion solar wings and connected hydraulic struts on deployment', () => {
    const podRig = createOrbitalPodModel(false);

    // Initial folded origami state (deployPct = 0)
    podRig.updateDeployment(0);
    expect(podRig.solarWingLeft.scale.x).toBeLessThan(0.05);
    expect(podRig.solarWingRight.scale.x).toBeLessThan(0.05);
    expect(podRig.fairingDoorLeft.rotation.z).toBeCloseTo(0, 2);

    // Mid-transformation origami state (deployPct = 50)
    podRig.updateDeployment(50);
    expect(podRig.solarWingLeft.scale.x).toBeCloseTo(0.5, 1);
    expect(Math.abs(podRig.fairingDoorLeft.rotation.z)).toBeGreaterThan(0.75);

    // Full mechanical transformation into flat coplanar wings (deployPct = 100)
    podRig.updateDeployment(100);
    expect(podRig.solarWingLeft.scale.x).toBeCloseTo(1.0, 1);
    expect(podRig.solarWingRight.scale.x).toBeCloseTo(1.0, 1);
    expect(podRig.antennaGimbal.scale.x).toBeCloseTo(1.0, 1);
    expect(podRig.magnetometerBoom.scale.y).toBeCloseTo(1.0, 1);
  });

function makeThrusters(patch: Partial<import('../../src/types/simulation.ts').ThrusterActivation> = {}): import('../../src/types/simulation.ts').ThrusterActivation {
  return {
    frontLeftLift: 0,
    frontRightLift: 0,
    rearLeftLift: 0,
    rearRightLift: 0,
    lateralLeft: 0,
    lateralRight: 0,
    rearBoost: 0,
    activeWingAngle: 0,
    raptorThrottle: 0,
    gimbalPitch: 0,
    gimbalYaw: 0,
    flapFrontLeft: 0,
    flapFrontRight: 0,
    flapAftLeft: 0,
    flapAftRight: 0,
    hotStageSeparated: false,
    ...patch,
  };
}

  it('executes extended continuous orbital flight stages and attaches crash records on failure', () => {
    let state = createInitialOrbitalPodState();
    expect(getOrbitalFlightPhase(state)).toBe('pad-liftoff');

    const params = { ...DEFAULT_HYPERPARAMETERS, epochs: 280 };

    // Advance 120 steps (3.0s) -> should clear pad
    for (let i = 0; i < 120; i++) {
      state = stepOrbitalPodPhysics(state, makeThrusters({ raptorThrottle: 1.0 }), params, 0.025);
    }
    expect(state.position.y).toBeGreaterThan(12.0);
    expect(state.isGrounded).toBe(false);

    // Test failure mode trigger attaches rich crash record in satellite-morph phase
    const crashState = {
      ...state,
      position: { x: 0, y: 120.0, z: 0 },
      elapsedTimeSec: 12.0,
      angularVelocity: { x: 3.5, y: 1.8, z: 0.5 },
      copvPressurePsi: 8000,
    };
    const afterCrash = stepOrbitalPodPhysics(crashState, makeThrusters({ podSolarDeployCmd: 1.0 }), params, 0.025);

    expect(afterCrash.crashed).toBe(true);
    expect(afterCrash.crashRecord).toBeDefined();
    expect(afterCrash.crashRecord?.stuntId).toBe('starship-pod-orbit');
    expect(afterCrash.crashRecord?.category).toBe('Orbital');
  });
});
