import type { MissionDefinition, MissionId, RLHyperparameters } from '../types/simulation.ts';

export const DEFAULT_HYPERPARAMETERS: RLHyperparameters = {
  epochs: 480,
  learningRate: 0.0005,
  explorationNoise: 0.03,
  discountFactor: 0.99,
  rewardAltitudeWeight: 2.0,
  rewardAttitudeWeight: 2.4,
  rewardFuelWeight: 0.8,
  rewardSmoothnessWeight: 1.3,
  gravityMultiplier: 1.0,
  initialCopvPsi: 10000,
  ghostSwarmCount: 0,
  simulationSpeed: 1,
  sensorLatencyMs: 0,
};

export const MISSIONS: Record<MissionId, MissionDefinition> = {
  'roadster-hover': {
    id: 'roadster-hover',
    vehicle: 'roadster',
    title: 'Stunt 01 // SpaceX Cold-Gas Thruster Hover',
    subtitle: 'Dual 700-bar COPV nitrogen blowdown & 4-nozzle vertical thrust balancing (T/W >= 1.0)',
    badge: 'TESLA ROADSTER // SPACEX PACKAGE RCS',
    targetDescription:
      'Command four underbody supersonic de Laval nozzles fed by dual 140L 700-bar (10,000 PSI) carbon-overwrapped pressure vessels to balance gravitational load (19.62 kN) at 3.8m altitude, maintaining sub-millimeter position stability and attitude equilibrium under turbulent ambient crosswinds.',
    targetPosition: { x: 0, y: 3.8, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'Closed-loop Proximal Policy Optimization (PPO) neural flight controller continuously regulates high-frequency pulse-width modulation (PWM) mass flow rates across 4 underbody vertical thrusters, nulling roll and pitch moment perturbations to achieve steady-state hover.',
    physicsFormulaLatex:
      'T_total = sum(m_dot_i * v_e) >= m_veh * g  [tau_roll = 0, tau_pitch = 0]',
  },
  'roadster-wall-climb': {
    id: 'roadster-wall-climb',
    vehicle: 'roadster',
    title: 'Stunt 02 // Inverted Parabolic Loop & Cold-Gas Downforce Vectoring',
    subtitle: 'Tri-Motor Plaid AWD acceleration & active thruster normal force (N > 0)',
    badge: 'COLD-GAS VECTORING // INVERTED LOOP',
    targetDescription:
      'Execute high-velocity entry into an overhanging steel parabolic arc using Tri-Motor Plaid AWD. Fire dorsal cold-gas RCS thrusters to generate >15 kN artificial downforce, sustaining positive tire normal force (N > 0) through inverted apex flight before executing a controlled lip departure and 4-point touchdown.',
    targetPosition: { x: 3.5, y: 12.2, z: 0 },
    targetAttitude: { roll: 0, pitch: 2.48, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'The PPO policy coordinates electric drivetrain torque delivery with dynamic cold-gas thruster firing to balance centripetal acceleration (a_c = v^2/R) and counteract inverted gravitational stall (g), preventing wheel slip or premature ballistic decoupling.',
    physicsFormulaLatex:
      'N = m_veh * (v^2/R - g * cos(theta)) + F_thruster_normal > 0',
  },
  'roadster-barrel-roll': {
    id: 'roadster-barrel-roll',
    vehicle: 'roadster',
    title: 'Stunt 03 // Ballistic Ramp Launch & 360° Cold-Gas Axial Roll',
    subtitle: 'Parabolic arc trajectory, 6-DoF roll rate control & retro-thruster touchdown',
    badge: '6-DOF AEROBATICS // AXIAL ROLL',
    targetDescription:
      'Launch off a curved steel quarter-pipe takeoff ramp into a ballistic parabolic arc. Fire differential lateral cold-gas RCS thrusters to impart a calibrated roll torque, complete a full 360° (2pi rad) axial rotation, damp residual angular rates, and execute vertical retro-thrust blowdown for a cushioned landing.',
    targetPosition: { x: 4.5, y: 0.48, z: 0 },
    targetAttitude: { roll: Math.PI * 2, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'The policy decomposes the maneuver into three ballistic phases: (1) takeoff trajectory pitch-rate matching, (2) asymmetric thruster impulse firing to achieve targeted roll rate (dphi/dt ~ 4.2 rad/s), and (3) terminal retro-thruster firing to arrest descent velocity before suspension contact.',
    physicsFormulaLatex:
      'tau_x = I_xx * d2phi/dt2 = F_RCS * d_moment,  Delta_vy = integral(F_retro / m * dt)',
  },
  'roadster-obstacle-race': {
    id: 'roadster-obstacle-race',
    vehicle: 'roadster',
    title: 'Stunt 04 // Tesla Proving Ground Dynamic Slalom & Cold-Gas Vault',
    subtitle: 'Tesla Vision obstacle avoidance, active aero downforce & cold-gas vertical vault',
    badge: 'TESLA PROVING GROUNDS // DYNAMIC SLALOM',
    targetDescription:
      'Traverse a 24m wide proving ground test corridor at speeds up to 280 km/h. Employ Tesla Vision predictive trajectory planning to navigate concrete chicanes and autonomous fleet test units, followed by a synchronized 4-nozzle cold-gas vertical impulse vault over an 8.8km test barrier to complete the 10km proving run.',
    targetPosition: { x: 1000.0, y: 0.43, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'Convolutional/recurrent neural network evaluates predictive distance fields and lateral slip margins, modulating Plaid differential torque vectoring and active aero downforce around ground hazards before triggering an open-loop vertical impulse thruster burst at the containment barrier.',
    physicsFormulaLatex:
      'F_down = 0.5 * rho * v^2 * C_L * A,  h_vault = ((F_pulse/m - g) * Delta_t^2) / 2 > h_barrier',
  },
  'starship-launch': {
    id: 'starship-launch',
    vehicle: 'starship',
    title: 'Mission 05 // Starship Full-Stack Liftoff & Hot-Stage Separation',
    subtitle: '33-Raptor methalox ascent, vented interstage ignition & boostback return',
    badge: 'SPACEX STARBASE // HOT-STAGE SEPARATION',
    targetDescription:
      'Initiate full-stack liftoff from the Orbital Launch Mount (OLM) powered by 33 Raptor engines (74 MN thrust). Ascend through Max-Q to stage separation altitude, ignite Starship second-stage Raptors through the vented hot-staging ring, and command Super Heavy center-engine boostback ignition for return trajectory alignment.',
    targetPosition: { x: 0, y: 0.6, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'Reinforcement learning guidance manages full-stack thrust-vector control (TVC) through dynamic pressure transients (Max-Q), coordinates staging separation attitudes to avoid plume impingement, and throttles center Raptor engines for booster deceleration.',
    physicsFormulaLatex:
      'T_liftoff = 33 * F_Raptor ~ 74 MN,  a(t) = (T(t) - D(t))/m(t) - g',
  },
  'starship-belly-flop': {
    id: 'starship-belly-flop',
    vehicle: 'starship',
    title: 'Mission 06 // Subsonic Atmospheric Entry & Landing Flip Burn',
    subtitle: 'Aerodynamic body flap attitude trim & 3-Raptor TVC vertical transition',
    badge: 'STARSHIP ENTRY // RAPTOR LANDING BURN',
    targetDescription:
      'Control subsonic atmospheric descent holding an 85° angle of attack using four electromechanical body flaps to maximize cross-sectional drag (v_t ~ 65 m/s). At 500m altitude, ignite center Raptor engines from cryogenic header tanks, execute high-deflection TVC gimbaling to transition from horizontal to vertical, and throttle to zero descent velocity.',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'The neural flight controller synthesizes non-linear flap deflections for aerodynamic trim during terminal descent, then executes a time-optimal pitch flip and retro-propulsion throttle profile using G-FOLD guidance principles to achieve pinpoint vertical landing.',
    physicsFormulaLatex:
      'F_drag = 0.5 * rho * v^2 * C_D * A_belly,  tau_TVC = F_Raptor * L_gimbal * sin(delta_gimbal)',
  },
  'starship-booster-catch': {
    id: 'starship-booster-catch',
    vehicle: 'starship',
    title: 'Mission 07 // Super Heavy Booster Tower Catch',
    subtitle: 'Grid fin aerodynamic descent, center-Raptor landing burn & Tower Catch Arm lock',
    badge: 'SPACEX STARBASE // TOWER CATCH ARMS',
    targetDescription:
      'Guide the 71-meter Super Heavy booster through atmospheric entry steered by 4 actuated titanium grid fins. Execute a precision 3-Raptor landing burn to arrest descent rate to < 1.0 m/s, cancel lateral velocity between the Orbital Launch and Catch Tower Arms, and engage structural hardpoint catch pins onto the receiving rails.',
    targetPosition: { x: 0, y: 2.6, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'Convex optimization / PPO guidance coordinates grid-fin drag trim with center Raptor thrust vector control (TVC). Closed-loop sensor fusion minimizes horizontal position error (sigma < 0.2m) and descent velocity to safely nestle the booster between the damped Tower Catch Arms.',
    physicsFormulaLatex:
      'a_net = (T_Raptor + F_gridfins)/m(t) - g,  lim_{t -> t_catch} v(t) = 0',
  },
  'starship-pod-orbit': {
    id: 'starship-pod-orbit',
    vehicle: 'orbital-pod',
    title: 'Mission 08 // Orbital Insertion & Solar Array Deployment',
    subtitle: 'Microgravity cold-gas RCS stabilization & articulated solar wing deployment',
    badge: 'ORBITAL INSERTION // MICROGRAVITY RCS',
    targetDescription:
      'Achieve orbital insertion in low Earth orbit microgravity. Utilize pulsed nitrogen cold-gas reaction control system (RCS) thrusters to null 3-axis separation tumble rates (omega -> 0), maintain solar vector attitude alignment, and command motorized deployment of articulated dual-wing photovoltaic arrays.',
    targetPosition: { x: 0, y: 120.0, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 480,
    mlTechniqueSummary:
      'The zero-G attitude controller computes minimum-fuel pulsed firings across 8 cold-gas RCS nozzles to damp angular momentum in microgravity, executing three-axis attitude lock before enabling solar panel deployment kinematics.',
    physicsFormulaLatex:
      'H = I * omega,  dH/dt = sum(tau_RCS) => omega -> 0',
  },
};

export const MISSION_LIST: MissionDefinition[] = Object.values(MISSIONS);
