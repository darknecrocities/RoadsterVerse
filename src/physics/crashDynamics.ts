import type { CrashType, EulerAngles, RigidBodyState, Vector3D } from '../types/simulation.ts';
import { stepDebrisBallistics } from './advancedCrashAndDebris.ts';
import { createInitialWeatherState, stepWeatherEnvironment } from './weatherAndEnvironment.ts';

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
  'laser-wall-clip': 'LATE COLD-GAS VERTICAL IMPULSE // PROVING GROUND TEST BARRIER IMPACT',
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

/**
 * Steps realistic post-crash rigid body ballistics, aerodynamic drag,
 * multi-body debris flight, ground impact restitution, and ground toppling.
 *
 * Prevents mid-air "floating wreckage" by ensuring unpowered ballistic fall
 * under gravity down to the tarmac, with inelastic ground contact and physical toppling.
 */
export function stepCrashedRigidBodyDynamics(
  state: RigidBodyState,
  vehicle: 'starship' | 'roadster',
  gravity: number,
  dt: number,
  windImpulseX = 0
): RigidBodyState {
  const next: RigidBodyState = {
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
    attitude: { ...state.attitude },
    angularVelocity: { ...state.angularVelocity },
    elapsedTimeSec: state.elapsedTimeSec + dt,
  };

  const weather = stepWeatherEnvironment(
    state.weather ?? createInitialWeatherState('clear'),
    dt,
    next.elapsedTimeSec,
    next.position.y
  );
  next.weather = weather;

  // Step physical multi-body debris pieces (rings, fins, bells, wheels, carbon panels)
  if (state.debrisField && state.debrisField.length > 0) {
    next.debrisField = stepDebrisBallistics(
      state.debrisField,
      weather.windVector,
      weather.airDensityKgM3,
      dt,
      vehicle === 'roadster' ? 0.06 : 0.12
    );
  }

  if (vehicle === 'starship') {
    // Starship / Super Heavy: 0.56m radius cylindrical hull
    // Geometric ground elevation depending on pitch angle:
    // When vertical (pitch = 0): lowest point is base nozzles at y = 0.05m
    // When horizontal (pitch = +/- pi/2): centerline rests at y = 0.56m (hull touching tarmac)
    const sinTilt = Math.abs(Math.sin(next.attitude.pitch));
    const groundMinY = 0.05 + 0.51 * sinTilt;

    if (next.position.y > groundMinY + 0.02) {
      // Airborne unpowered ballistic free-fall
      const vyAir = next.velocity.y;
      const vxAir = next.velocity.x - weather.windVector.x;
      const dragY = -0.065 * vyAir * Math.abs(vyAir);
      const dragX = -0.12 * vxAir * Math.abs(vxAir);

      next.velocity.y += (-gravity + dragY) * dt;
      next.velocity.x += (dragX + windImpulseX * 0.15) * dt;
      next.position.y += next.velocity.y * dt;
      next.position.x += next.velocity.x * dt;

      // Tumbling dynamics in flight
      next.attitude.pitch += next.angularVelocity.y * dt;
      next.attitude.roll += next.angularVelocity.x * dt;
      next.angularVelocity.y *= Math.max(0, 1 - 0.7 * dt);
      next.angularVelocity.x *= Math.max(0, 1 - 0.7 * dt);
      next.isGrounded = false;
    }

    // Ground contact, inelastic collision damping, and toppling onto tarmac
    if (next.position.y <= groundMinY + 0.02) {
      next.position.y = groundMinY;

      // Heavy inelastic damping on ground slam
      if (Math.abs(next.velocity.y) > 0.8) {
        next.velocity.y = -next.velocity.y * 0.12;
      } else {
        next.velocity.y = 0;
      }

      // Ground friction slides to halt
      next.velocity.x *= Math.max(0, 1 - 8.5 * dt);
      if (Math.abs(next.velocity.x) < 0.08) next.velocity.x = 0;

      // Gravity torques tall cylinder horizontally onto its side
      const targetPitch = next.attitude.pitch >= 0 ? 1.57 : -1.57;
      const pitchDiff = targetPitch - next.attitude.pitch;
      next.attitude.pitch += pitchDiff * Math.min(1.0, 11.0 * dt);
      next.attitude.roll *= Math.max(0, 1 - 7.5 * dt);

      // Angular velocity settles
      next.angularVelocity.x *= Math.max(0, 1 - 9.0 * dt);
      next.angularVelocity.y *= Math.max(0, 1 - 9.0 * dt);
      next.isGrounded = true;
    }
  } else {
    // 2026 Tesla Roadster: ride height / resting tarmac plane at y = 0.43m
    const groundPlaneY = 0.43;

    if (next.position.y > groundPlaneY + 0.02) {
      const dragY = -0.08 * next.velocity.y * Math.abs(next.velocity.y);
      next.velocity.y += (-gravity + dragY) * dt;
      next.velocity.x += (-0.05 * next.velocity.x + windImpulseX * 0.1) * dt;
      next.position.y += next.velocity.y * dt;
      next.position.x += next.velocity.x * dt;

      next.attitude.roll += next.angularVelocity.x * dt;
      next.attitude.pitch += next.angularVelocity.y * dt;
      next.angularVelocity.x *= Math.max(0, 1 - 0.6 * dt);
      next.angularVelocity.y *= Math.max(0, 1 - 0.6 * dt);
      next.isGrounded = false;
    }

    if (next.position.y <= groundPlaneY + 0.02) {
      next.position.y = groundPlaneY;
      if (Math.abs(next.velocity.y) > 0.8) {
        next.velocity.y = -next.velocity.y * 0.2;
      } else {
        next.velocity.y = 0;
      }

      next.velocity.x *= Math.max(0, 1 - 9.0 * dt);
      next.velocity.z *= Math.max(0, 1 - 9.0 * dt);
      if (Math.abs(next.velocity.x) < 0.08) next.velocity.x = 0;
      if (Math.abs(next.velocity.z) < 0.08) next.velocity.z = 0;

      // Settles flipped / rolled on the ground
      next.attitude.roll += (Math.PI - next.attitude.roll) * Math.min(1.0, 7.5 * dt);
      next.angularVelocity.x *= Math.max(0, 1 - 9.0 * dt);
      next.angularVelocity.y *= Math.max(0, 1 - 9.0 * dt);
      next.isGrounded = true;
    }
  }

  next.gForce = next.isGrounded ? 1.0 : Number((Math.abs(next.velocity.y) / 9.81).toFixed(2));
  return next;
}
