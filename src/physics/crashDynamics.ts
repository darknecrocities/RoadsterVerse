import type { CrashFailureRecord, CrashType, EulerAngles, MissionId, Vector3D } from '../types/simulation.ts';
import { CRASH_TAXONOMY_BY_ID, resolveCrashRecord } from '../data/crashTaxonomy.ts';

export interface CrashResolution {
  type: CrashType;
  diagnosticMessage: string;
  tumbleVelocity: Vector3D;
  impactSeverity: number; // 0.0 - 1.0
  record?: CrashFailureRecord;
}

/**
 * Computes physically tailored tumbling angular velocity and diagnostic metadata
 * for every stunt crash failure mode from the comprehensive 104-failure taxonomy.
 */
export function resolveCrashDynamics(
  type: CrashType,
  velocity: Vector3D,
  attitude: EulerAngles,
  stuntId?: MissionId
): CrashResolution {
  const record = CRASH_TAXONOMY_BY_ID[type] || resolveCrashRecord(type, stuntId);
  const diagnosticMessage = record?.diagnosticMessage || 'FLIGHT DYNAMICS FAILURE // CRASH DETECTED';
  const speed = Math.sqrt(
    velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z
  );
  const baseImpact = record ? record.severity : Math.min(1.0, Math.max(0.25, speed / 45.0));
  const impactSeverity = Math.min(1.0, Math.max(0.2, baseImpact * 0.7 + (speed / 50.0) * 0.3));

  let tumbleX = 0;
  let tumbleY = 0;
  let tumbleZ = 0;

  const category = record?.category;

  if (category === 'Orbital') {
    tumbleX = 5.2 + (Math.random() - 0.5) * 3.0;
    tumbleY = -4.8 + (Math.random() - 0.5) * 3.0;
    tumbleZ = 3.6 + (Math.random() - 0.5) * 2.5;
  } else if (category === 'Obstacle') {
    tumbleX = 9.2 + Math.random() * 5.5;
    tumbleY = (Math.random() - 0.5) * 6.5;
    tumbleZ = (velocity.z > 0 ? 1 : -1) * (11.0 + Math.random() * 4.5);
  } else if (category === 'Structural') {
    tumbleX = (attitude.roll >= 0 ? 1 : -1) * (14.5 + Math.random() * 5.0);
    tumbleY = 3.5 + Math.random() * 3.0;
    tumbleZ = (Math.random() - 0.5) * 6.0;
  } else if (category === 'Trajectory') {
    tumbleX = (Math.random() - 0.5) * 4.5;
    tumbleY = 6.8 + Math.random() * 3.2;
    tumbleZ = (Math.random() - 0.5) * 4.5;
  } else if (category === 'Aerodynamic') {
    tumbleX = (Math.random() - 0.5) * 8.5;
    tumbleY = (Math.random() - 0.5) * 5.5;
    tumbleZ = (velocity.x >= 0 ? 1 : -1) * 7.5;
  } else if (category === 'Propulsion') {
    tumbleX = (Math.random() - 0.5) * 3.5;
    tumbleY = 0.5 + Math.random() * 2.0;
    tumbleZ = (Math.random() - 0.5) * 3.5;
  } else {
    tumbleX = (Math.random() - 0.5) * 6.0;
    tumbleY = (Math.random() - 0.5) * 6.0;
    tumbleZ = (Math.random() - 0.5) * 6.0;
  }

  return {
    type: record ? record.id : type,
    diagnosticMessage,
    tumbleVelocity: { x: tumbleX, y: tumbleY, z: tumbleZ },
    impactSeverity,
    record,
  };
}
