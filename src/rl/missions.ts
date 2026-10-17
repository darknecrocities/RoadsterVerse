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
    title: 'Stunt 01 // Supersonic Cold-Gas Hover',
    subtitle: '4-Corner Undercarriage COPV Thrusters + Physics White Smoke Station-Keeping',
    badge: 'TESLA ROADSTER // SPACEX PKG',
    targetDescription:
      'Liftoff to 3.8m altitude and hold a razor-flat hover over physics-simulated billowing white cold-gas smoke while rejecting lateral wind gusts.',
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
    title: 'Stunt 03 // Stunt Road Launch & 360° Kickflip',
    subtitle: 'Tesla Demo Stunt Track Sprint, Kicker Ramp Air Launch, 360° Kickflip & Smooth Landing',
    badge: 'KICKFLIP STUNT POLICY',
    targetDescription:
      'Accelerate down the Tesla Demo Stunt Road, launch off the kicker ramp into mid-air, fire asymmetric cold-gas thrusters to execute a 360° Kickflip (coupled roll + pitch kick), and cushion the landing smoothly on all four wheels.',
    targetPosition: { x: 5.2, y: 0.45, z: 0 },
    targetAttitude: { roll: Math.PI * 2, pitch: 0, yaw: 0 },
    recommendedEpochs: 360,
    mlTechniqueSummary:
      'Multi-Phase Curriculum RL trains three sequential sub-policies: (1) COPV rear boost sprint to ramp takeoff velocity, (2) asymmetric roll + pitch impulse for the 360° kickflip, and (3) D-gain angular arrest + vertical retro-cushion for a butter-smooth four-wheel landing.',
    physicsFormulaLatex:
      'I_{xx}\\dot{\\omega}_x = \\frac{W}{2}(F_L - F_R), \\quad \\theta_{\\text{kick}}(t) = \\theta_0 \\sin\\left(\\frac{\\phi(t)}{2}\\right), \\quad v_y(t_{\\text{land}}) \\to 0',
  },
  'starship-launch': {
    id: 'starship-launch',
    vehicle: 'starship',
    title: 'Mission 04 // Paddock Crane Launch & Hot-Staging',
    subtitle: '33-Raptor Fire Thruster Liftoff from Orbital Launch Paddock & Crane Tower',
    badge: 'SPACEX STARSHIP // IFT',
    targetDescription:
      'Release from the Orbital Launch Paddock & Crane Beam, ignite 33 Raptor fire thrusters, stabilize the 121m stack through pitch-over, and trigger hot-stage separation.',
    targetPosition: { x: 4.5, y: 26.0, z: 0 },
    targetAttitude: { roll: 0, pitch: -0.18, yaw: 0 },
    recommendedEpochs: 300,
    mlTechniqueSummary:
      'Neural Residual Control + Thrust Vector Control (TVC) allocates gimbal angles across the 13 center/middle Raptor fire engines while clearing the Launch Paddock Crane Tower and suppressing structural bending modes.',
    physicsFormulaLatex:
      '\\tau_{\\text{TVC}} = -L_{\\text{com}} \\cdot T_{\\text{33-Raptor}} \\sin(\\delta_{\\text{gimbal}}) - q_{\\infty} S d (C_{N\\alpha} \\alpha)',
  },
  'starship-belly-flop': {
    id: 'starship-belly-flop',
    vehicle: 'starship',
    title: 'Mission 05 // Belly-Flop Flip & Paddock Crane Catch',
    subtitle: '4-Flap Skydiver Control + 3-Raptor Fire Flip-and-Burn into Paddock Chopstick Beams',
    badge: 'PROPULSIVE CATCH RL',
    targetDescription:
      'Descend horizontally on the textured hexagonal TPS heat shield using 4 articulated stainless-steel flaps, ignite 3 Raptor fire thrusters to execute the rapid flip maneuver, and guide into the Paddock Crane Catch Beams.',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 420,
    mlTechniqueSummary:
      'Powered Explicit Guidance (G-FOLD Convex Optimization) fused with Deep RL Policy Adaptation coordinates the transition from non-linear hypersonic flap aerodynamics (alpha ~ 90 deg) to 3-engine fire retro-propulsion into the Paddock Crane arms.',
    physicsFormulaLatex:
      '\\min_{T(t), \\delta(t)} \\int_{t_0}^{t_f} \\|T(t)\\| dt \\quad \\text{s.t.} \\quad \\mathbf{r}(t_f)=\\mathbf{0}, \\; \\mathbf{v}(t_f)=\\mathbf{0}, \\; \\theta(t_f)=0',
  },
};

export const MISSION_LIST: MissionDefinition[] = Object.values(MISSIONS);
