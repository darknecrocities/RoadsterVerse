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
    tag: 'PROPULSION HARDWARE',
    title: '10,000 PSI COPV Cold-Air Thrusters & Mach Shock Diamonds',
    summary:
      'Instead of burning liquid propellant on public roads, the Roadster SpaceX Package replaces the rear seats with a Carbon Overwrapped Pressure Vessel (COPV) storing compressed air at 10,000 PSI (689 bar), replenished by an electric compressor powered by the Plaid battery pack.',
    deepDivePoints: [
      'De Laval Converging-Diverging Nozzles accelerate compressed ambient air past Mach 2.5, creating visible Mach shock diamonds and condensing atmospheric moisture into dense white plumes.',
      '4 corner vertical nozzles provide >1.8G of upward lift for supersonic hops and active suspension load-leveling.',
      'Proportional solenoid valves respond in <5 milliseconds, allowing a neural network policy to modulate attitude faster than any mechanical sway bar.',
    ],
    equationLatex:
      'F_{\\text{thrust}} = \\dot{m} v_e + (P_e - P_{\\text{amb}}) A_e, \\quad P_{\\text{COPV}}(t) = P_0 e^{-t / \\tau_{\\text{blowdown}}}',
    linkedMissionId: 'roadster-hover',
    demoEpochs: 300,
  },
  {
    id: 'wall-adhesion-rl',
    tag: 'NONLINEAR CONTROL & PHYSICS',
    title: 'How a Car Sticks to a 90° Vertical Concrete Wall',
    summary:
      'On flat asphalt, gravity (mg) presses the tires into the road to generate friction. On a 90° vertical wall (Image 3), gravity acts parallel to the wall, reducing gravitational normal force to zero.',
    deepDivePoints: [
      'As the Roadster transitions up the curved concrete mega-ramp, the RL policy fires the outward lateral/dorsal cold-gas thrusters to push the chassis horizontally into the concrete wall.',
      'With Michelin Cup 2R slick tires (mu ~ 1.35), generating 14,000 N of thruster normal force yields nearly 19,000 N of vertical tire traction—enough to overcome the 18,148 N weight of the car!',
      'At low training epochs (<40), the policy fails to coordinate lateral thruster timing with the ramp curvature, causing the car to peel off the wall.',
    ],
    equationLatex:
      'N_{\\text{wall}} = F_{\\text{thruster},\\perp} + \\frac{mv^2}{R}, \\quad \\mu_{\\text{tire}} N_{\\text{wall}} > mg \\sin(90^\\circ)',
    linkedMissionId: 'roadster-wall-climb',
    demoEpochs: 380,
  },
  {
    id: 'ppo-sim-to-real',
    tag: 'REINFORCEMENT LEARNING',
    title: 'PPO, Reward Shaping & Sim-to-Real Domain Randomization',
    summary:
      'Training a physical vehicle or rocket via trial-and-error in the real world would destroy hundreds of prototypes. Engineers train policies across thousands of GPU-accelerated parallel simulations before transferring weights to flight hardware.',
    deepDivePoints: [
      'Proximal Policy Optimization (PPO) clips policy ratio updates so a single noisy trajectory cannot collapse an already stable hover controller.',
      'Reward Shaping balances competing objectives: if the Altitude weight is high but Smoothness/Fuel weights are zero, the policy learns aggressive "bang-bang" valve slamming that drains the COPV in seconds.',
      'Domain Randomization varies vehicle mass, wind gusts, tire friction, and valve latency each episode so the policy generalizes to real-world disturbances.',
    ],
    equationLatex:
      'L^{\\text{CLIP}}(\\theta) = \\hat{\\mathbb{E}}_t \\left[ \\min\\left( r_t(\\theta)\\hat{A}_t, \\; \\text{clip}(r_t(\\theta), 1-\\epsilon, 1+\\epsilon)\\hat{A}_t \\right) \\right]',
    linkedMissionId: 'roadster-barrel-roll',
    demoEpochs: 360,
  },
  {
    id: 'starship-belly-flop-gfold',
    tag: 'AEROSPACE GUIDANCE',
    title: 'Starship 304L Stainless Steel, Hex TPS Tiles & Belly-Flop Flip',
    summary:
      'Starship descends horizontally ("belly-flop") to maximize atmospheric drag across its black hexagonal silica TPS heat-shield tiles, using 4 independent stainless-steel flaps like a skydiver\'s arms and legs before executing a last-second 3-Raptor flip-and-burn.',
    deepDivePoints: [
      'During the horizontal skydiver phase, the 2 forward and 2 aft flaps modulate center-of-pressure to hold trim at ~85° angle of attack without burning propellant.',
      'At the flip altitude, 3 center Raptor engines ignite and gimbal 15° while the forward flaps extend and aft flaps fold, whipping the 50m tall ship vertical in ~5 seconds.',
      'Convex optimization (G-FOLD) combined with neural aerodynamic residual models guarantees fuel-optimal pinpoint touchdown at zero velocity.',
    ],
    equationLatex:
      'I_{yy}\\ddot{\\theta} = \\sum_{k=1}^{4} L_{\\text{flap},k}(\\delta_k, \\alpha) - d_{\\text{TVC}} T_{\\text{Raptor}} \\sin(\\delta_{\\text{gimbal}})',
    linkedMissionId: 'starship-belly-flop',
    demoEpochs: 440,
  },
];

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    category: 'Cold-Gas Thrusters',
    question:
      'Why do the Roadster’s cold-gas thrusters produce glowing white/blue plumes and ground clouds (Images 2 & 3) even though no fuel is being burned?',
    options: [
      'Isentropic expansion of 10,000 PSI air through a De Laval nozzle drops static temperature below -100°C, instantly condensing atmospheric water vapor into supersonic shock-diamond mist.',
      'Liquid nitrogen is mixed with kerosene inside the wheel wells.',
      'The tires are burning rubber in mid-air from induction heating.',
      'Exhaust smoke is piped from a diesel generator in the frunk.',
    ],
    correctIndex: 0,
    explanation:
      'When 10,000 PSI compressed air expands supersonically through a converging-diverging nozzle, adiabatic cooling plunges the jet temperature far below the dew point, creating visible Mach shock diamonds and dense condensation clouds!',
    formulaLatex: 'T_e = T_0 \\left(1 + \\frac{\\gamma - 1}{2} M_e^2 \\right)^{-1}',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 300,
  },
  {
    id: 'q2',
    category: 'Wall Adhesion Physics',
    question:
      'In Image 3, the Roadster fires a horizontal cold-gas thruster out of its side next to a 90° vertical concrete wall. What physical role does that thruster serve?',
    options: [
      'It cools down the concrete wall so the paint does not melt.',
      'It pushes the car into the vertical wall to create artificial Normal Force (N), enabling tire friction (mu * N) to hold and drive the car vertically against gravity.',
      'It cancels out Earth’s magnetic field around the chassis.',
      'It only acts as a visual turn signal for the stunt driver.',
    ],
    correctIndex: 1,
    explanation:
      'On a 90° vertical wall, gravity provides zero normal force against the surface. Firing the outward cold-gas thruster pins the car into the concrete wall with force F_perp, generating tire friction mu * F_perp > m * g.',
    formulaLatex: 'F_{\\text{max\\_traction}} = \\mu_{\\text{tire}} F_{\\text{thruster},\\perp} > mg',
    linkedMissionId: 'roadster-wall-climb',
    linkedEpochDemo: 380,
  },
  {
    id: 'q3',
    category: 'Reinforcement Learning',
    question:
      'What happens in our 6-DoF simulator if you set the RL Learning Rate (alpha) way too high (e.g., 0.04) or set Smoothness Penalty weight to 0?',
    options: [
      'The vehicle immediately teleports to Mars.',
      'The neural network policy overshoots optimal weights and exhibits violent "bang-bang" thruster chattering and attitude oscillation.',
      'The gravity of Earth permanently decreases by 50%.',
      'The 3D polygon count doubles automatically.',
    ],
    correctIndex: 1,
    explanation:
      'Excessive learning rates cause policy gradient steps to overshoot the trust region, while zero action-smoothness penalty encourages rapid 0%-to-100% valve slamming that destabilizes pitch and roll.',
    formulaLatex: '\\theta_{k+1} = \\theta_k + \\alpha \\nabla_\\theta J(\\theta_k)',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 25,
  },
  {
    id: 'q4',
    category: 'Starship Belly-Flop & TVC',
    question:
      'Why do the black hexagonal TPS heat-shield tiles on Starship (Image 5) only cover one side (the windward belly) with a jagged stepped boundary?',
    options: [
      'SpaceX ran out of black paint for the back side.',
      'Starship re-enters at a ~60–85° belly-first angle of attack, so plasma heating concentrates on the windward belly while the leeward 304L stainless steel spine remains cool enough bare.',
      'The tiles are solar panels that only face the sun during launch.',
      'Hexagonal tiles are magnetic and only stick to half the cylinder.',
    ],
    correctIndex: 1,
    explanation:
      'Because Starship enters belly-first and 304L stainless steel retains structural strength up to ~800°C, only the windward side facing the hypersonic shockwave requires silica TPS tiles, saving tons of dry mass!',
    formulaLatex: 'q_{\\text{conv}} \\propto \\rho_{\\infty}^{0.5} v_{\\infty}^3',
    linkedMissionId: 'starship-belly-flop',
    linkedEpochDemo: 420,
  },
  {
    id: 'q5',
    category: 'Starship Belly-Flop & TVC',
    question:
      'During the Starship full-stack launch (Image 4), why is there a vented gap ring between the Super Heavy booster and the upper-stage Ship?',
    options: [
      'It is a passenger observation deck with panoramic windows.',
      'It is the Hot-Staging Interstage ring that vents the upper-stage Raptor exhaust outward as the Ship ignites before booster separation completes, boosting payload to orbit by ~10%.',
      'It holds parachutes for the Roadster.',
      'It is an air intake for jet engines.',
    ],
    correctIndex: 1,
    explanation:
      'Hot-staging eliminates the zero-G coast phase during stage separation so gravity never steals upward momentum, increasing payload mass to orbit by roughly 10%.',
    formulaLatex: '\\Delta v_{\\text{gravity\\_loss}} = \\int g \\cos\\gamma \\, dt',
    linkedMissionId: 'starship-launch',
    linkedEpochDemo: 340,
  },
  {
    id: 'q6',
    category: 'Reinforcement Learning',
    question:
      'If an RL agent has a very low Discount Factor (gamma = 0.80) during the Roadster Hover or Starship Landing task, what suboptimal behavior emerges?',
    options: [
      'The agent becomes myopic (short-sighted): it burns all its COPV air or fuel immediately for short-term altitude reward without saving propellant for the final landing!',
      'The agent refuses to ignite any thrusters at all.',
      'The agent flies backward in time.',
      'The agent ignores gravity completely.',
    ],
    correctIndex: 0,
    explanation:
      'A low discount factor heavily discounts rewards more than a few seconds into the future, causing the policy to greedily maximize immediate altitude while ignoring future propellant depletion.',
    formulaLatex: 'G_t = \\sum_{k=0}^{\\infty} \\gamma^k R_{t+k+1}',
    linkedMissionId: 'roadster-barrel-roll',
    linkedEpochDemo: 60,
  },
];
