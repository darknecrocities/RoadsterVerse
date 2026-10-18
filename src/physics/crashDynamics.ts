import type { CrashType, EulerAngles, Vector3D } from '../types/simulation.ts';

export interface CrashResolution {
  type: CrashType;
  diagnosticMessage: string;
  tumbleVelocity: Vector3D;
  impactSeverity: number; // 0.0 - 1.0
}

const CRASH_DIAGNOSTICS: Record<CrashType, string> = {
  // Stunt 01 Hover
  'hover-blowdown-ground-slam': 'COPV BLOWDOWN FAILURE // VERTICAL GROUND IMPACT',
  'hover-attitude-flip': 'ROLL/PITCH DIVERGENCE // VEHICLE INVERTED IMPACT',
  'hover-boundary-impact': 'PROVING GROUND DRIFT // PERIMETER BARRICADE SMASH',

  // Stunt 02 Loop
  'loop-apex-gravity-stall': 'INSUFFICIENT CENTRIPETAL VELOCITY // 14.2M APEX PLUNGE',
  'loop-curvature-smash': 'EXCESSIVE YAW DIVERGENCE // CURVATURE WALL SMASH',
  'loop-inverted-exit-flat-spin': 'INCOMPLETE AXIAL TWIST // INVERTED ROAD SLAM',

  // Stunt 03 Kickflip
  'kickflip-under-rotation-nose-dive': 'UNDER-ROTATION (< 270 DEG) // NOSE-DIVE CRUSH',
  'kickflip-over-rotation-roof-crush': 'OVER-ROTATION (> 450 DEG) // CANOPY ROOF CRUSH',
  'ramp-lip-strike': 'INSUFFICIENT APPROACH SPEED // STEEL RAMP LIP STRIKE',

  // Stunt 04 Gauntlet Race
  'obstacle-concrete-chicane-impact': 'LANE-1 CHICANE COLLISION // 280+ KM/H IMPACT',
  'obstacle-cyber-drone-collision': 'LANE-3 CYBER-DRONE T-BONE // IMPACT OVERRUN',
  'laser-wall-clip': 'LATE BUNNY-HOP JUMP // HIGH-VOLTAGE LASER WALL CLIP',
  'post-jump-cartwheel': 'ASYMMETRIC TOUCHDOWN ROLL // HIGH-SPEED CARTWHEEL',

  // Stunt 05 Launch
  'orbital-pad-mount-strike': 'LIFTOFF TVC GIMBAL DRIFT // ORBITAL MOUNT STRIKE',
  'max-q-aerodynamic-breakup': 'MAX-Q DYNAMIC PRESSURE // STRUCTURAL BREAKUP',
  'hot-stage-collision': 'VENTED INTERSTAGE STAGING // BOOSTER-SHIP COLLISION',

  // Stunt 06 Belly-Flop
  'skydive-flat-spin': 'AERODYNAMIC FLAP DESYNC // UNRECOVERABLE FLAT SPIN',
  'flip-failure-belly-slam': 'LATE RAPTOR IGNITION // TERMINAL BELLY SLAM',
  'flip-over-rotation-tail-strike': 'TVC OVER-COMPENSATION // AFT FLAP TAIL STRIKE',

  // Stunt 07 Booster Catch
  'tower-chopstick-miss': 'PINPOINT CATCH HORIZON MISS // PAD MOUNT IMPACT',
  'chopstick-arm-collision': 'EXCESSIVE LATERAL DRIFT // CRANE ARM SMASH',
  'catch-hard-landing-over-g': 'HIGH DESCENT RATE (> 3.5 M/S) // PIN SHEAR IMPACT',

  // Stunt 08 Pod Orbit
  'orbital-deployment-tumble': 'HIGH ANGULAR RATE DEPLOYMENT // SOLAR WING COLLISION',
  'zero-g-thruster-depletion-drift': 'NITROGEN DEPLETION // ORBITAL MICROGRAVITY DRIFT',
  'orbital-debris-collision': 'TRAJECTORY INSERTION DRIFT // UPPER STAGE COLLISION',
};

/**
 * Computes physically tailored tumbling angular velocity and diagnostic metadata
 * for every stunt crash failure mode.
 */
export function resolveCrashDynamics(
  type: CrashType,
  velocity: Vector3D,
  attitude: EulerAngles
): CrashResolution {
  const diagnosticMessage = CRASH_DIAGNOSTICS[type] || 'FLIGHT DYNAMICS FAILURE // CRASH DETECTED';
  const speed = Math.sqrt(
    velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z
  );
  const impactSeverity = Math.min(1.0, Math.max(0.25, speed / 45.0));

  let tumbleX = 0;
  let tumbleY = 0;
  let tumbleZ = 0;

  switch (type) {
    case 'loop-apex-gravity-stall':
      tumbleX = (Math.random() - 0.5) * 4.5;
      tumbleY = 6.8 + Math.random() * 3.2;
      tumbleZ = (Math.random() - 0.5) * 4.5;
      break;

    case 'obstacle-concrete-chicane-impact':
    case 'obstacle-cyber-drone-collision':
      tumbleX = 9.2 + Math.random() * 5.5;
      tumbleY = (Math.random() - 0.5) * 6.5;
      tumbleZ = (velocity.z > 0 ? 1 : -1) * (11.0 + Math.random() * 4.5);
      break;

    case 'post-jump-cartwheel':
      tumbleX = (attitude.roll >= 0 ? 1 : -1) * (14.5 + Math.random() * 5.0);
      tumbleY = 3.5;
      tumbleZ = (Math.random() - 0.5) * 6.0;
      break;

    case 'flip-failure-belly-slam':
      tumbleX = (Math.random() - 0.5) * 2.2;
      tumbleY = 0.5;
      tumbleZ = (Math.random() - 0.5) * 2.2;
      break;

    case 'tower-chopstick-miss':
    case 'chopstick-arm-collision':
      tumbleX = (Math.random() - 0.5) * 7.5;
      tumbleY = (Math.random() - 0.5) * 6.2;
      tumbleZ = (velocity.x >= 0 ? 1 : -1) * 8.5;
      break;

    case 'orbital-deployment-tumble':
      tumbleX = 5.2 + (Math.random() - 0.5) * 3.0;
      tumbleY = -4.8 + (Math.random() - 0.5) * 3.0;
      tumbleZ = 3.6 + (Math.random() - 0.5) * 2.5;
      break;

    default:
      tumbleX = (Math.random() - 0.5) * 6.0;
      tumbleY = (Math.random() - 0.5) * 6.0;
      tumbleZ = (Math.random() - 0.5) * 6.0;
      break;
  }

  return {
    type,
    diagnosticMessage,
    tumbleVelocity: { x: tumbleX, y: tumbleY, z: tumbleZ },
    impactSeverity,
  };
}
