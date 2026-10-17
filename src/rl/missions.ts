import type { MissionDefinition, MissionId, RLHyperparameters } from '../types/simulation.ts';

export const DEFAULT_HYPERPARAMETERS: RLHyperparameters = {
  epochs: 280,
  learningRate: 0.0005,
  explorationNoise: 0.05,
  discountFactor: 0.99,
  rewardAltitudeWeight: 2.0,
  rewardAttitudeWeight: 2.4,
  rewardFuelWeight: 0.8,
  rewardSmoothnessWeight: 1.3,
  gravityMultiplier: 1.0,
  initialCopvPsi: 10000,
  ghostSwarmCount: 4,
  simulationSpeed: 1,
};

export const MISSIONS: Record<MissionId, MissionDefinition> = {
  'roadster-hover': {
    id: 'roadster-hover',
    vehicle: 'roadster',
    title: 'Stunt 01 // Supersonic Cold-Gas Night Hover',
    subtitle: '4-Corner Undercarriage COPV Thrusters + Lateral RCS Station-Keeping',
    badge: 'TESLA ROADSTER // SPACEX PKG',
    targetDescription:
      'Liftoff to 3.8m altitude and hold a razor-flat hover over billowing ground-effect smoke while rejecting lateral wind gusts.',
    targetPosition: { x: 0, y: 3.8, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 260,
    mlTechniqueSummary:
      'Proximal Policy Optimization (PPO) maps 12-state IMU telemetry (altitude error, vertical velocity, roll/pitch angles, angular rates) to 4 independent supersonic cold-gas proportional valves and 2 lateral RCS thrusters at 100 Hz.',
    physicsFormulaLatex:
      'm\\ddot{y} = \\sum_{i=1}^{4} F_{\\text{thruster},i}(P_{\\text{COPV}})\\cos\\theta\\cos\\phi - mg',
  },
  'roadster-wall-climb': {
    id: 'roadster-wall-climb',
    vehicle: 'roadster',
    title: 'Stunt 02 // 90° Vertical Wall-Climb & Adhesion',
    subtitle: 'Lateral Cold-Gas Thruster Normal-Force Pinning on Curved Concrete Mega-Ramp',
    badge: 'WALL ADHESION STUNT',
    targetDescription:
      'Drive up the curved concrete mega-ramp and fire the side/belly cold-gas thrusters outward to pin the tires onto the 90° vertical wall without sliding down.',
    targetPosition: { x: 11.4, y: 8.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 1.52, yaw: 0 },
    recommendedEpochs: 340,
    mlTechniqueSummary:
      'Constrained RL (SAC + Control Barrier Functions) learns that as ramp inclination approaches 90°, gravity no longer presses tires into the surface—the policy must fire lateral & dorsal cold-gas thrusters to synthesize artificial normal force N so tire friction mu*N > mg.',
    physicsFormulaLatex:
      'F_{\\text{friction}} = \\mu_{\\text{tire}} \\left( F_{\\text{thruster},\\perp} + \\frac{mv^2}{R_{\\text{ramp}}} \\right) \\ge mg \\sin\\theta',
  },
  'roadster-barrel-roll': {
    id: 'roadster-barrel-roll',
    vehicle: 'roadster',
    title: 'Stunt 03 // Ballistic Hop & 360° Mid-Air Barrel Roll',
    subtitle: 'Asymmetric Cold-Gas Roll Impulse + Angular Momentum Arrest Before Touchdown',
    badge: 'ACROBATIC RL POLICY',
    targetDescription:
      'Launch 6.5m into the air, fire asymmetric left/right cold-gas nozzles to execute a full 360° barrel roll, and arrest roll rate to land flat on all four wheels.',
    targetPosition: { x: 0, y: 2.2, z: 0 },
    targetAttitude: { roll: Math.PI * 2, pitch: 0, yaw: 0 },
    recommendedEpochs: 380,
    mlTechniqueSummary:
      'Multi-Phase Curriculum RL trains two sub-policies: Phase 1 maximizes angular impulse around the longitudinal x-axis; Phase 2 triggers bang-bang counter-torque via opposite cold-gas nozzles to zero out roll velocity prior to ground contact.',
    physicsFormulaLatex:
      'I_{xx}\\dot{\\omega}_x = \\frac{W_{\\text{track}}}{2}\\left(F_{\\text{FL}} + F_{\\text{RL}} - F_{\\text{FR}} - F_{\\text{RR}}\\right) - b_{\\text{damp}}\\omega_x',
  },
  'starship-launch': {
    id: 'starship-launch',
    vehicle: 'starship',
    title: 'Mission 04 // Starship Full-Stack Ascent & Hot-Staging',
    subtitle: '33-Raptor Super Heavy Liftoff, Gravity Turn & Vented Interstage Separation',
    badge: 'SPACEX STARSHIP // IFT',
    targetDescription:
      'Ignite 33 Raptor engines over Starbase coastal wetlands, stabilize the 121m stack through Max-Q pitch-over, and trigger hot-stage separation.',
    targetPosition: { x: 4.5, y: 26.0, z: 0 },
    targetAttitude: { roll: 0, pitch: -0.18, yaw: 0 },
    recommendedEpochs: 300,
    mlTechniqueSummary:
      'Neural Residual Control + Thrust Vector Control (TVC) allocates gimbal angles across the 13 center/middle Raptor engines while suppressing structural bending modes and aerodynamic center-of-pressure instability.',
    physicsFormulaLatex:
      '\\tau_{\\text{TVC}} = -L_{\\text{com}} \\cdot T_{\\text{33-Raptor}} \\sin(\\delta_{\\text{gimbal}}) - q_{\\infty} S d (C_{N\\alpha} \\alpha)',
  },
  'starship-belly-flop': {
    id: 'starship-belly-flop',
    vehicle: 'starship',
    title: 'Mission 05 // Starship Belly-Flop Flip & Catch Burn',
    subtitle: '4-Flap Skydiver Aero Control + 3-Raptor High-G Flip-and-Burn Touchdown',
    badge: 'PROPULSIVE LANDING RL',
    targetDescription:
      'Descend horizontally on the hexagonal TPS heat shield using 4 articulated stainless-steel flaps, then ignite 3 Raptors to execute the rapid flip maneuver to a soft vertical landing.',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 420,
    mlTechniqueSummary:
      'Powered Explicit Guidance (G-FOLD Convex Optimization) fused with Deep RL Policy Adaptation coordinates the transition from non-linear hypersonic flap aerodynamics (alpha ~ 90 deg) to 3-engine TVC retro-propulsion.',
    physicsFormulaLatex:
      '\\min_{T(t), \\delta(t)} \\int_{t_0}^{t_f} \\|T(t)\\| dt \\quad \\text{s.t.} \\quad \\mathbf{r}(t_f)=\\mathbf{0}, \\; \\mathbf{v}(t_f)=\\mathbf{0}, \\; \\theta(t_f)=0',
  },
};

export const MISSION_LIST: MissionDefinition[] = Object.values(MISSIONS);
