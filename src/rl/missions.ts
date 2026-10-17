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
    title: 'Stunt 01 // Flying Car Hover',
    subtitle: 'Float in mid-air on 4 super-strong air jets without tipping over!',
    badge: 'TESLA ROADSTER // AIR JETS',
    targetDescription:
      'Blast cold compressed air out of the bottom of the car so it floats 4 meters up in the air like a flying saucer—even when big wind gusts try to push it!',
    targetPosition: { x: 0, y: 3.8, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 260,
    mlTechniqueSummary:
      'Think of riding a bike with no hands: at first you wobble and fall, but after hundreds of practice tries, your brain knows exactly how much to lean. The AI does the same thing with 4 air jets under the wheels!',
    physicsFormulaLatex:
      'RULE: Upward Air Push must equal Gravity pulling the car down!',
  },
  'roadster-wall-climb': {
    id: 'roadster-wall-climb',
    vehicle: 'roadster',
    title: 'Stunt 02 // Hot-Wheels Giant Half-Loop',
    subtitle: 'Stick upside-down on a giant C-shaped loop ramp and flip off the top!',
    badge: 'HOT-WHEELS LOOP STUNT',
    targetDescription:
      'Zoom up the giant C-shaped loop ramp, fire the air jets to glue the tires upside-down so gravity cannot pull the car down, then launch off the top lip and flip onto all 4 wheels!',
    targetPosition: { x: 3.5, y: 12.2, z: 0 },
    targetAttitude: { roll: 0, pitch: 2.48, yaw: 0 },
    recommendedEpochs: 340,
    mlTechniqueSummary:
      'When a toy car goes slowly up a loop, gravity pulls it down and it falls! The AI learns to drive super fast AND blast air jets upward to press the tires into the loop track until it flies off the top.',
    physicsFormulaLatex:
      'RULE: Speed + Air Jet Push must beat Gravity when upside-down!',
  },
  'roadster-barrel-roll': {
    id: 'roadster-barrel-roll',
    vehicle: 'roadster',
    title: 'Stunt 03 // Ramp Jump & 360° Kickflip',
    subtitle: 'Launch off the curved steel ramp, spin a full 360° flip in mid-air, and land softly!',
    badge: '360° KICKFLIP JUMP',
    targetDescription:
      'Race up the curved steel launch ramp, pop high into the sky, fire the left air jets harder than the right jets to spin a full 360° skateboard kickflip, and fire all 4 jets at the bottom for a pillow-soft landing!',
    targetPosition: { x: 4.5, y: 0.48, z: 0 },
    targetAttitude: { roll: Math.PI * 2, pitch: 0, yaw: 0 },
    recommendedEpochs: 360,
    mlTechniqueSummary:
      'Just like doing a skateboard kickflip: Step 1 is jumping high off the ramp, Step 2 is spinning fast in the air, and Step 3 is stopping the spin right before your wheels touch the ground!',
    physicsFormulaLatex:
      'RULE: Push one side to spin 360°, then push the other side to stop level!',
  },
  'starship-launch': {
    id: 'starship-launch',
    vehicle: 'starship',
    title: 'Mission 04 // Giant Rocket Launch',
    subtitle: 'Blast off from the Launch Paddock Crane Tower with 33 fire engines!',
    badge: 'SPACEX STARSHIP // LAUNCH',
    targetDescription:
      'Light up 33 giant fire engines at the bottom of the rocket, clear the tall Crane Tower without bumping into it, and drop the bottom booster high in the sky!',
    targetPosition: { x: 4.5, y: 26.0, z: 0 },
    targetAttitude: { roll: 0, pitch: -0.18, yaw: 0 },
    recommendedEpochs: 300,
    mlTechniqueSummary:
      'Have you ever tried balancing a tall broomstick upright on your palm? You have to move your hand underneath it constantly. The AI wiggles the rocket engines at the bottom to keep the giant skyscraper rocket balanced!',
    physicsFormulaLatex:
      'RULE: Wiggle the fire engines underneath the rocket to keep it pointing up!',
  },
  'starship-belly-flop': {
    id: 'starship-belly-flop',
    vehicle: 'starship',
    title: 'Mission 05 // Skydiver Flip & Crane Catch',
    subtitle: 'Fall flat like a skydiver, flip upright with fire engines, and get caught by giant chopsticks!',
    badge: 'CHOPSTICK TOWER CATCH',
    targetDescription:
      'Fall through the sky belly-first using 4 wing flaps like a skydiver, light the fire engines at the last second to swing upright, and let the giant Paddock Crane Chopstick arms catch the rocket!',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 420,
    mlTechniqueSummary:
      'First the rocket falls flat on its belly so the air slows it down for free. Right before the ground, the AI lights the fire engines and swings the tail down so it stops right inside the giant catching arms!',
    physicsFormulaLatex:
      'RULE: Belly-flop to slow down, then flip upright and brake gently to zero speed!',
  },
};

export const MISSION_LIST: MissionDefinition[] = Object.values(MISSIONS);
