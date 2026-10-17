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
    tag: 'SECRET SUPERPOWER #1',
    title: 'How Can a Car Fly Using Only Air?',
    summary:
      'Have you ever blown up a balloon and let it go so it zooms around the room? The Tesla Roadster does the exact same thing—except its "balloon" is a super-strong carbon tank filled with air squeezed 300 times tighter than normal car tires!',
    deepDivePoints: [
      'When the car opens 4 hidden nozzles under the wheels, air blasts out faster than a jet plane, creating giant white clouds of cold mist.',
      'That downward blast pushes the car up into the sky so it can hover like a flying saucer!',
      'The car battery runs an electric air pump to refill the tank while you drive.',
    ],
    equationLatex:
      'Squeezed Air Tank (10,000 PSI) -> Blasts Downward -> Pushes Car Up!',
    linkedMissionId: 'roadster-hover',
    demoEpochs: 300,
  },
  {
    id: 'wall-adhesion-rl',
    tag: 'SECRET SUPERPOWER #2',
    title: 'How Does the Car Stick Upside-Down on the Giant Loop?',
    summary:
      'Normally, gravity pulls everything down toward the floor. If a slow car drives up a giant Hot-Wheels loop, it falls right off when it goes upside-down!',
    deepDivePoints: [
      'First, the car zooms super fast into the loop so its spin pushes it outward—just like water staying inside a bucket when you swing it in a circle.',
      'Second, the AI brain blasts the top and side air jets to push the car tightly against the track like invisible glue.',
      'At the top of the C-loop, the car flies off into the air, flips right-side-up, and lands on its wheels!',
    ],
    equationLatex:
      'Fast Speed + Air Jet Push > Gravity Pulling Down!',
    linkedMissionId: 'roadster-wall-climb',
    demoEpochs: 380,
  },
  {
    id: 'ppo-sim-to-real',
    tag: 'HOW THE AI BRAIN LEARNS',
    title: 'How Does the AI Learn Without Breaking Real Cars?',
    summary:
      'If a human tried to learn a mid-air car kickflip in real life, they would crash a hundred supercars! Instead, the AI practices inside a computer video game first.',
    deepDivePoints: [
      'At Try #10 (Low Epochs), the AI is like a baby pressing random buttons—it wobbles and crashes.',
      'Every time the car stays level and lands softly, the computer gives the AI "points" (like treats for a puppy!).',
      'By Try #350, the AI has practiced so many times that it knows the exact millisecond to fire every air jet.',
    ],
    equationLatex:
      'Good Stunt = More Points (+Reward) | Crash = Try Again!',
    linkedMissionId: 'roadster-barrel-roll',
    demoEpochs: 380,
  },
  {
    id: 'starship-belly-flop-gfold',
    tag: 'ROCKET MAGIC',
    title: 'Why Does Starship Belly-Flop Like a Skydiver?',
    summary:
      'SpaceX Starship is as tall as a 40-story building! Carrying enough fuel to brake all the way from space would make it way too heavy.',
    deepDivePoints: [
      'Instead, Starship falls flat on its belly and uses 4 big metal flaps like a skydiver’s arms and legs to let the wind slow it down for free.',
      'Right before hitting the ground, it lights 3 fire engines and whips its tail down to stand upright.',
      'Then the giant Launch Paddock Crane Tower reaches out with two metal "Chopstick" arms and catches the rocket in mid-air!',
    ],
    equationLatex:
      'Belly-Flop in the Wind -> Light 3 Fire Engines -> Catch in Chopstick Arms!',
    linkedMissionId: 'starship-belly-flop',
    demoEpochs: 420,
  },
];

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 'q1',
    category: 'Cold-Gas Thrusters',
    question:
      'What comes out of the Tesla Roadster’s thrusters to make it fly and produce white smoke?',
    options: [
      'Super-squeezed cold air from a 10,000 PSI tank inside the car',
      'Hot gasoline flames like a monster truck',
      'Giant magnets hidden inside the tires',
      'Helium balloons inside the trunk',
    ],
    correctIndex: 0,
    explanation:
      'The Roadster uses super-compressed air stored at 10,000 PSI! When released through rocket nozzles, the air expands so fast it gets freezing cold and turns air moisture into thick white clouds.',
    formulaLatex: 'Squeezed Air (10,000 PSI) -> Blasts Down -> Car Flies Up!',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 300,
  },
  {
    id: 'q2',
    category: 'Wall Adhesion Physics',
    question:
      'How does the Roadster stay glued upside-down on the giant Hot-Wheels half-loop without falling?',
    options: [
      'Sticky chewing gum on the tires',
      'Fast loop speed plus air jets pushing the car tightly against the ramp track',
      'It turns off Earth’s gravity switch',
      'A rope pulls it from the ceiling',
    ],
    correctIndex: 1,
    explanation:
      'Going fast creates outward loop force, and the AI fires its cold-air thrusters to press the tires firmly against the curved ramp so gravity cannot pull it down!',
    formulaLatex: 'Loop Speed + Air Jet Push > Gravity Pulling Down!',
    linkedMissionId: 'roadster-wall-climb',
    linkedEpochDemo: 360,
  },
  {
    id: 'q3',
    category: 'Reinforcement Learning',
    question:
      'What does the "Practice Runs (Epochs)" slider do to the AI driver?',
    options: [
      'It changes the paint color of the car',
      'It controls how many times the AI has practiced the stunt—more practice means smoother stunts!',
      'It makes the screen brighter',
      'It adds more wheels to the car',
    ],
    correctIndex: 1,
    explanation:
      'Each Epoch is a round of practice! At 10 practice runs the AI is still guessing and crashing, while at 350+ runs it has learned how to balance and land smoothly.',
    formulaLatex: 'More Practice Runs = Smarter AI Brain!',
    linkedMissionId: 'roadster-barrel-roll',
    linkedEpochDemo: 360,
  },
  {
    id: 'q4',
    category: 'Starship Belly-Flop & TVC',
    question:
      'How does the giant SpaceX Starship slow down before the Paddock Crane Chopsticks catch it?',
    options: [
      'It opens a giant umbrella',
      'It falls flat on its belly like a skydiver, then lights its fire engines at the end to flip upright',
      'It lands in a swimming pool',
      'It bounces on a giant trampoline',
    ],
    correctIndex: 1,
    explanation:
      'Falling flat on its belly uses the air to erase 99% of its speed for free, and then the fire engines flip the rocket upright right into the tower’s catching arms!',
    formulaLatex: 'Belly-Flop in Wind -> Light 3 Fire Engines -> Catch in Chopstick Arms!',
    linkedMissionId: 'starship-belly-flop',
    linkedEpochDemo: 420,
  },
  {
    id: 'q5',
    category: 'Reinforcement Learning',
    question:
      'What happens if you turn "Random Curiosity (Exploration Noise)" all the way up to 100%?',
    options: [
      'The AI tries wild, random jet blasts like a crazy stuntman instead of following its best plan',
      'The car goes to sleep',
      'The sound turns off',
      'The ramp disappears',
    ],
    correctIndex: 0,
    explanation:
      'Exploration Noise makes the AI try random experiments! A little bit helps it discover new tricks, but too much makes it wobble all over the place.',
    formulaLatex: 'Low Curiosity = Steady Pro | High Curiosity = Wild Experiments!',
    linkedMissionId: 'roadster-hover',
    linkedEpochDemo: 280,
  },
];
