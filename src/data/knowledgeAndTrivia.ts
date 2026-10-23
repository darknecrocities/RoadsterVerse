import type { MissionId, TriviaQuestion } from '../types/simulation.ts';

export interface KnowledgeArticle {
  id: string;
  tag: string;
  title: string;
  summary: string;
  deepDivePoints: string[];
  equationLatex: string;
  linkedMissionId: MissionId;
  demoEpochs: number;
}

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'copv-cold-gas',
    tag: 'AEROSPACE PROPULSION',
    title: 'Cold-Gas Nitrogen Blowdown & COPV Storage Thermodynamics',
    summary:
      'The Tesla Roadster SpaceX package incorporates dual Carbon-Overwrapped Pressure Vessels (COPV) storing dry gaseous nitrogen (N2) compressed to 700 bar (10,000 PSI), derived from Falcon 9 and Dragon reaction control systems.',
    deepDivePoints: [
      'Four underbody supersonic de Laval nozzles expand high-pressure nitrogen gas into ambient atmosphere, generating over 19.6 kN vertical thrust.',
      'Rapid adiabatic gas expansion produces Joule-Thomson cooling, condensing atmospheric humidity into cryogenic white vapor plumes.',
      'The vehicle 200 kWh battery pack powers high-pressure compressors to recharge the nitrogen vessels during drive cycles.',
    ],
    equationLatex:
      'T_total = sum(m_dot_i * v_e) >= m_veh * g  [T/W >= 1.0]',
    linkedMissionId: 'roadster-hover',
    demoEpochs: 300,
  },
  {
    id: 'wall-adhesion-rl',
    tag: 'AERODYNAMICS & TRACTION',
    title: 'Inverted Parabolic Loop Adhesion & Centripetal Normal Force',
    summary:
      'Traversing an inverted parabolic or circular vertical loop requires sustained positive tire normal force (N > 0) to avoid gravitational stall and wheel decoupling at the apex.',
    deepDivePoints: [
      'Plaid Tri-Motor AWD accelerates the chassis to high velocity, generating centripetal acceleration a_c = v^2 / R.',
      'Dorsal cold-gas RCS thrusters deliver over 15 kN of artificial downforce directly against the steel track.',
      'The combined centripetal acceleration and active gas downforce sustain tire normal load even when inverted at the loop apex.',
    ],
    equationLatex:
      'N = m_veh * (v^2 / R - g * cos(theta)) + F_thruster_normal > 0',
    linkedMissionId: 'roadster-wall-climb',
    demoEpochs: 380,
  },
  {
    id: 'ppo-sim-to-real',
    tag: 'REINFORCEMENT LEARNING',
    title: 'Proximal Policy Optimization (PPO) & Sim-to-Real Convergence',
    summary:
      'Autonomous flight and stunt control utilizes deep reinforcement learning trained across hundreds of thousands of simulated state-action transitions.',
    deepDivePoints: [
      'At low training iterations (Epochs < 25), actions are driven by Gaussian exploration noise, leading to attitude divergence.',
      'The reward function evaluates altitude tracking, roll/pitch attitude error, fuel mass depletion, and actuator rate smoothness.',
      'By Epoch 350+, the neural actor network converges on optimal high-frequency thruster valve modulation.',
    ],
    equationLatex:
      'L_CLIP(theta) = E_t [ min(r_t * A_t, clip(r_t, 1-eps, 1+eps) * A_t) ]',
    linkedMissionId: 'roadster-barrel-roll',
    demoEpochs: 380,
  },
  {
    id: 'starship-belly-flop-gfold',
    tag: 'STARSHIP AERODYNAMICS',
    title: 'Terminal Atmospheric Entry Flap Trim & 3-Raptor TVC Flip Burn',
    summary:
      'SpaceX Starship performs a subsonic terminal descent holding an 85° angle of attack, utilizing body flaps to bleed orbital kinetic energy without consuming propellants.',
    deepDivePoints: [
      'Four independent electromechanical flaps driven by Tesla Model 3/S battery packs trim pitch, roll, and yaw.',
      'Atmospheric cross-sectional drag limits terminal velocity to approximately 65 m/s.',
      'At 500m altitude, three center Raptor engines ignite from cryogenic header tanks, gimbaling via TVC to transition Starship vertical for catch.',
    ],
    equationLatex:
      'F_drag = 0.5 * rho * v^2 * C_D * A_belly,  tau_TVC = F_Raptor * L * sin(delta)',
    linkedMissionId: 'starship-belly-flop',
    demoEpochs: 420,
  },
];

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    category: 'Cold-Gas Thrusters',
    question:
      'What working fluid and storage technology powers the Tesla Roadster SpaceX package thrusters?',
    options: [
      'Dry gaseous nitrogen (N2) compressed to 700 bar (10,000 PSI) in dual carbon-overwrapped pressure vessels (COPV)',
      'Refined kerosene (RP-1) burning with liquid oxygen in miniature combustion chambers',
      'Solid propellant ammonium perchlorate grain canisters inside the rocker panels',
      'Compressed liquid helium expanding through ambient heat exchangers',
    ],
    correctIndex: 0,
    explanation:
      'The Roadster SpaceX package utilizes cold-gas nitrogen stored at 700 bar (10,000 PSI) inside aerospace-grade carbon-overwrapped pressure vessels (COPV) inherited from SpaceX Falcon 9 and Dragon RCS hardware.',
    formulaLatex: 'P_copv = 700 bar (10,000 PSI) -> Supersonic de Laval Expansion -> Cryogenic Vapor Plume',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 300,
  },
  {
    id: 'q2',
    category: 'Wall Adhesion Physics',
    question:
      'Which physical condition prevents the Roadster from stalling and falling off at the apex of the inverted loop?',
    options: [
      'Centripetal acceleration (v^2/R) and dorsal cold-gas thruster normal downforce maintaining tire normal force (N > 0)',
      'Electrostatic magnetic attraction between the tires and the steel track surface',
      'Aerodynamic vacuum suction generated by negative ground-effect side skirts alone',
      'Zero-gravity neutral buoyancy induced by cabin atmospheric pressurization',
    ],
    correctIndex: 0,
    explanation:
      'To remain pinned upside-down at the loop apex, the net normal force must remain strictly positive (N > 0). High approach speed generates centripetal acceleration, augmented by dorsal cold-gas thrusters delivering over 15 kN of artificial downforce.',
    formulaLatex: 'N = m * (v^2/R - g * cos(theta)) + F_thruster > 0',
    linkedMissionId: 'roadster-wall-climb',
    linkedEpochDemo: 360,
  },
  {
    id: 'q3',
    category: 'Reinforcement Learning',
    question:
      'In deep reinforcement learning, what is the primary role of training iterations (epochs)?',
    options: [
      'Iterative policy gradient updates adjusting neural network weights to maximize expected cumulative reward',
      'Increasing the graphics rendering resolution and polygon count of the simulation',
      'Modulating the physical tire pressure and aerodynamic drag coefficient of the vehicle',
      'Calibrating the sound frequency synthesizer of the thruster audio engine',
    ],
    correctIndex: 0,
    explanation:
      'Each training epoch executes policy rollouts and computes gradient updates using Proximal Policy Optimization (PPO), driving the policy from high-variance random exploration toward optimal closed-loop trajectory tracking.',
    formulaLatex: 'grad_theta J(theta) = E [ grad_theta log pi(a|s) * A(s,a) ]',
    linkedMissionId: 'roadster-barrel-roll',
    linkedEpochDemo: 360,
  },
  {
    id: 'q4',
    category: 'Starship Belly-Flop & TVC',
    question:
      'How does SpaceX Starship decelerate from terminal atmospheric velocity before landing transition?',
    options: [
      'Holding an 85° angle of attack belly-flop using 4 articulating body flaps, followed by a 3-Raptor TVC flip burn',
      'Deploying supersonic drogue parachutes and ring-slot deceleration chutes from the forward nose cone',
      'Executing a continuous full-duration retrograde propulsive burn from the edge of space',
      'Deploying deployable titanium dive-brakes along the payload bay dorsal spine',
    ],
    correctIndex: 0,
    explanation:
      'Starship holds a high angle-of-attack belly-flop descent where cross-sectional atmospheric drag dissipates kinetic energy for zero propellant cost. At 500m, three center Raptor engines ignite and gimbal through >20° TVC to flip the vehicle vertical.',
    formulaLatex: 'F_drag = 0.5 * rho * v^2 * C_D * A_belly -> 3-Raptor TVC Flip Burn',
    linkedMissionId: 'starship-belly-flop',
    linkedEpochDemo: 420,
  },
  {
    id: 'q5',
    category: 'Reinforcement Learning',
    question:
      'What is the physical effect of increasing the exploration noise parameter in continuous action-space RL?',
    options: [
      'Increases Gaussian variance around policy action means, promoting state-space discovery at the cost of transient stability',
      'Increases physical wind turbulence and Dryden atmospheric gust standard deviation in the physics engine',
      'Reduces the computational clock frequency and simulation timestep integration rate',
      'Disables closed-loop feedback and commands static maximum thruster blowdown',
    ],
    correctIndex: 0,
    explanation:
      'Exploration noise controls the variance of stochastic policy sampling (a ~ N(mu(s), sigma^2)). Higher noise encourages broad trajectory exploration during initial learning, while low noise enables steady-state exploitation.',
    formulaLatex: 'a_t ~ N(mu_theta(s_t), sigma_explore^2 * I)',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 280,
  },
];
