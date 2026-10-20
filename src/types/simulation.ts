export type VehicleId = 'roadster' | 'starship' | 'orbital-pod';

export type MissionId =
  | 'roadster-hover'
  | 'roadster-wall-climb'
  | 'roadster-barrel-roll'
  | 'roadster-obstacle-race'
  | 'starship-launch'
  | 'starship-belly-flop'
  | 'starship-booster-catch'
  | 'starship-pod-orbit';

export type CrashType =
  // Stunt 01 Hover
  | 'hover-blowdown-ground-slam'
  | 'hover-attitude-flip'
  | 'hover-boundary-impact'
  // Stunt 02 Loop
  | 'loop-apex-gravity-stall'
  | 'loop-curvature-smash'
  | 'loop-inverted-exit-flat-spin'
  // Stunt 03 Kickflip
  | 'kickflip-under-rotation-nose-dive'
  | 'kickflip-over-rotation-roof-crush'
  | 'ramp-lip-strike'
  // Stunt 04 Gauntlet Race
  | 'obstacle-concrete-chicane-impact'
  | 'obstacle-cyber-drone-collision'
  | 'laser-wall-clip'
  | 'post-jump-cartwheel'
  // Stunt 05 Launch
  | 'orbital-pad-mount-strike'
  | 'max-q-aerodynamic-breakup'
  | 'hot-stage-collision'
  // Stunt 06 Belly-Flop
  | 'skydive-flat-spin'
  | 'flip-failure-belly-slam'
  | 'flip-over-rotation-tail-strike'
  // Stunt 07 Booster Catch
  | 'tower-chopstick-miss'
  | 'chopstick-arm-collision'
  | 'catch-hard-landing-over-g'
  // Stunt 08 Pod Orbit
  | 'orbital-deployment-tumble'
  | 'zero-g-thruster-depletion-drift'
  | 'orbital-debris-collision';

export type WheelSpec = 'aero-disc' | 'six-spoke';

export type CameraMode = 'orbit' | 'chase' | 'thruster-cam' | 'tower-cam';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface EulerAngles {
  roll: number;   // phi (rad)
  pitch: number;  // theta (rad)
  yaw: number;    // psi (rad)
}

export interface ThrusterActivation {
  frontLeftLift: number;   // [0..1] vertical cold-gas nozzle FL
  frontRightLift: number;  // [0..1] vertical cold-gas nozzle FR
  rearLeftLift: number;    // [0..1] vertical cold-gas nozzle RL
  rearRightLift: number;   // [0..1] vertical cold-gas nozzle RR
  lateralLeft: number;     // [0..1] side thruster firing left (pushes right)
  lateralRight: number;    // [0..1] side thruster firing right (pushes left/wall-pin)
  rearBoost: number;       // [0..1] longitudinal SpaceX COPV main boost
  activeWingAngle: number; // [0..1] active aero rear spoiler angle
  // Starship specific channels
  raptorThrottle: number;  // [0..1] 33-Raptor or 3-Raptor collective thrust
  gimbalPitch: number;     // [-1..1] TVC pitch gimbal
  gimbalYaw: number;       // [-1..1] TVC yaw gimbal
  flapFrontLeft: number;   // [0..1] forward left aero flap deflection
  flapFrontRight: number;  // [0..1] forward right aero flap deflection
  flapAftLeft: number;     // [0..1] aft left aero flap deflection
  flapAftRight: number;    // [0..1] aft right aero flap deflection
  hotStageSeparated: boolean;
  // Orbital pod specific channels
  podRcsBottom?: number;   // [0..1] bottom orbital RCS nozzles
  podRcsLateral?: number;  // [0..1] lateral orbital RCS nozzles
  podSolarDeployCmd?: number; // [0..1] satellite transformation command
}

export interface RigidBodyState {
  position: Vector3D;
  velocity: Vector3D;
  attitude: EulerAngles;
  angularVelocity: Vector3D;
  copvPressurePsi: number;      // Roadster: 3,000 - 10,000 PSI
  propellantRemainingPct: number; // 0 - 100%
  gForce: number;
  wallContactNormalForceN: number; // Normal force against the 90-deg curved wall
  isOnWall: boolean;
  isGrounded: boolean;
  crashed: boolean;
  crashType?: CrashType;
  crashReason?: string;
  solarArrayDeployPct?: number; // 0 - 100% for satellite transformation
  missionProgressPct: number;
  elapsedTimeSec: number;
}

export interface RLHyperparameters {
  epochs: number;              // 1 - 500
  learningRate: number;        // 0.0001 - 0.05
  explorationNoise: number;    // 0.0 - 1.0 (epsilon)
  discountFactor: number;      // 0.80 - 0.999 (gamma)
  rewardAltitudeWeight: number; // 0.1 - 3.0
  rewardAttitudeWeight: number; // 0.1 - 3.0
  rewardFuelWeight: number;     // 0.0 - 2.0
  rewardSmoothnessWeight: number; // 0.0 - 2.0
  gravityMultiplier: number;   // 0.16 (Moon), 0.38 (Mars), 1.0 (Earth), 1.5 (Hyper-G)
  initialCopvPsi: number;      // 3000 - 10000 PSI
  ghostSwarmCount: number;     // 1 - 10 parallel agents
  simulationSpeed: number;     // 1x, 2x, 5x, 10x
  sensorLatencyMs: number;     // 0 - 250 ms (signal delay in control loop)
}

export interface NeuralNetworkSnapshot {
  inputs: { label: string; value: number }[];
  hiddenLayer1: number[];
  hiddenLayer2: number[];
  outputs: { label: string; value: number }[];
  instantReward: number;
  cumulativeReward: number;
  policyEntropy: number;
  stabilityScore: number; // 0 - 100%
  sensorLatencyMs?: number;
  sensorDelayDeg?: number;
}

export interface EpochHistoryPoint {
  epoch: number;
  meanReward: number;
  survivalRatePct: number;
  maxAltitudeM: number;
  attitudeErrorDeg: number;
}

export interface MissionDefinition {
  id: MissionId;
  vehicle: VehicleId;
  title: string;
  subtitle: string;
  badge: string;
  targetDescription: string;
  targetPosition: Vector3D;
  targetAttitude: EulerAngles;
  recommendedEpochs: number;
  mlTechniqueSummary: string;
  physicsFormulaLatex: string;
}

export interface SavedCheckpoint {
  id: string;
  name: string;
  missionId: MissionId;
  vehicle: VehicleId;
  epochs: number;
  learningRate: number;
  explorationNoise: number;
  discountFactor: number;
  rewardAltitudeWeight: number;
  rewardAttitudeWeight: number;
  rewardFuelWeight: number;
  rewardSmoothnessWeight: number;
  sensorLatencyMs?: number;
  meanReward: number;
  stabilityScore: number;
  createdAt: string;
}

export interface TriviaQuestion {
  id: string;
  category: 'Cold-Gas Thrusters' | 'Wall Adhesion Physics' | 'Reinforcement Learning' | 'Starship Belly-Flop & TVC';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  formulaLatex: string;
  linkedMissionId: MissionId;
  linkedEpochDemo: number;
}
