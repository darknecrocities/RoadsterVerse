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
    title: 'Mission 04 // Full-Stack Launch & Stage Landing',
    subtitle: 'Blast off with both rocket halves, release the Ship to space, and land the Booster slowly!',
    badge: '2-STAGE RELEASE & LANDING',
    targetDescription:
      'Light all 33 fire engines to launch the giant 2-part rocket past the Crane Tower, release the top Starship so it blasts into space, then fire the bottom Booster engines to land vertically slowly and softly!',
    targetPosition: { x: 0, y: 0.6, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 300,
    mlTechniqueSummary:
      'The rocket has two halves! First the bottom Booster pushes the top Ship high into the sky and lets it go. Then the AI catches the falling Booster with its fire engines and lowers it back down like a gentle elevator!',
    physicsFormulaLatex:
      'RULE: Launch full stack -> Release top Ship -> Brake Booster slowly to 0 m/s!',
  },
  'starship-belly-flop': {
    id: 'starship-belly-flop',
    vehicle: 'starship',
    title: 'Mission 05 // Skydiver Flip & Slow Landing',
    subtitle: 'Fall flat like a skydiver, swing upright with fire engines, and land vertically slowly!',
    badge: 'BELLY-FLOP & FLIP BURN',
    targetDescription:
      'Fall through the sky belly-first using 4 wing flaps like a skydiver, light the fire engines to swing upright, and throttle the engines so the Starship descends slowly into the Launch Tower arms!',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 420,
    mlTechniqueSummary:
      'First the top Starship falls flat on its belly so the air slows it down for free. Near the ground, the AI lights the fire engines, swings the tail down, and hovers down super slowly!',
    physicsFormulaLatex:
      'RULE: Belly-flop to slow down, then flip upright and brake gently to zero speed!',
  },
  'starship-booster-catch': {
    id: 'starship-booster-catch',
    vehicle: 'starship',
    title: 'Mission 06 // Booster Boostback & Tower Catch',
    subtitle: 'Launch at an angle, release the top Ship, flip the Booster back, and catch it on the Tower!',
    badge: 'MECHAZILLA BOOSTER CATCH',
    targetDescription:
      'Launch the full 2-stage rocket downrange, release the top Starship into orbit, flip the giant Super Heavy Booster in mid-air to fly back to the tower, and hover-land slowly inside the giant Chopstick arms!',
    targetPosition: { x: 0, y: 1.5, z: 0 },
    targetAttitude: { roll: 0, pitch: 0, yaw: 0 },
    recommendedEpochs: 380,
    mlTechniqueSummary:
      'After dropping off the top spaceship high in the sky, the bottom Booster is far away from the pad! The AI flips the Booster around in mid-air, fires its engines to fly back home, and lands slowly inside the giant robot arms!',
    physicsFormulaLatex:
      'RULE: Release top Ship -> Flip Booster back toward Tower -> Hover-land slowly!',
  },
};

export const MISSION_LIST: MissionDefinition[] = Object.values(MISSIONS);
