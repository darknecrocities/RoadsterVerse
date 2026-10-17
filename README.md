# RoadsterVerse

RoadsterVerse is a full-stack, interactive 3D reinforcement learning proving ground and rigid-body physics simulator for the 2026 Tesla Roadster (SpaceX Cold-Gas Thruster Package) and the 2-Stage Full-Stack SpaceX Starship & Super Heavy Booster.

Built with React 19, TypeScript, Three.js, Express, and SQLite, the application lets users train, inspect, pause, and test deep reinforcement learning control policies in real time across six aerospace and stunt maneuvers. Every visual component adheres strictly to a pure monochrome grayscale palette (`#000000` to `#ffffff`) inspired by SpaceX mission control and telemetry interfaces.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Capabilities](#2-core-capabilities)
3. [Simulated Vehicles and Missions](#3-simulated-vehicles-and-missions)
4. [Physics Engine and Mathematical Models](#4-physics-engine-and-mathematical-models)
5. [Reinforcement Learning Policy and Neural Network Inspector](#5-reinforcement-learning-policy-and-neural-network-inspector)
6. [System Architecture and Directory Structure](#6-system-architecture-and-directory-structure)
7. [Getting Started and Local Development](#7-getting-started-and-local-development)
8. [Testing, Verification, and Engineering Guardrails](#8-testing-verification-and-engineering-guardrails)
9. [REST API Specification](#9-rest-api-specification)
10. [Docker Deployment](#10-docker-deployment)

---

## 1. System Overview

RoadsterVerse bridges interactive 3D rigid-body physics and reinforcement learning (Proximal Policy Optimization curriculum simulation). Instead of writing code to tune a controller, users adjust training hyperparameters directly in the interface:

- **Practice Epochs (`1` to `500`)**: Controls how many training iterations the policy network has completed. Low epoch counts (`Epoch 10` to `Epoch 25`) exhibit high exploration noise, uncoordinated thruster firing, and stunt crashes. High epoch counts (`Epoch 300+`) exhibit converged, phase-locked thruster coordination and smooth landings.
- **Exploration Noise (`sigma`)**: Controls policy action variance during rollout.
- **Learning Rate (`alpha`)**: Controls how rapidly policy competence scales with training epochs.
- **Gravity (`g`)**: Adjusts environmental gravity from Lunar (`1.62 m/s^2`) and Martian (`3.72 m/s^2`) to Earth (`9.81 m/s^2`) and high-G proving ground conditions (`18.0 m/s^2`).
- **Thruster Power Multiplier (`0.5x` to `2.0x`)**: Scales cold-gas nozzle force and Raptor engine thrust relative to vehicle weight.

---

## 2. Core Capabilities

### 2.1 SpaceX-Style Frameless Monochrome Interface
- **Full-Bleed Frameless Landing Page (`src/components/WelcomeScreen.tsx`)**: Replicates the SpaceX Flight Mission layout with a transparent frameless navigation bar, real-time 60fps canvas backdrop, bottom-left mission headline and primary action trigger, and a bottom-right picture-in-picture stunt selector.
- **Strict Monochrome Enforcement**: All stylesheets and UI components are verified via automated unit tests (`tests/unit/physics.test.ts`) to contain only pure grayscale hex values (`R === G === B`).
- **Collapsible Glassmorphic Drawers**: Both the left Training Configuration drawer and right AI Brain Telemetry drawer can be minimized into floating pills or hidden completely for unobstructed full-screen 3D viewing.

### 2.2 Surface-Accurate 3D Vehicle Rigs and Volumetric Particle Physics
- **2026 Tesla Roadster SpaceX Package (`src/three/roadsterModel.ts`)**:
  - Features a full fastback glass roof canopy, cab-forward silhouette, full-width front LED lightblade, rear diffuser, deployable active rear aero wing, carbon-ceramic brake calipers, and selectable 6-spoke star wheels or carbon aero-disc covers.
  - Configured with `CAR_RIDE_HEIGHT = 0.39 m` and an internal `-0.39 m` center-of-mass offset so the front (`0.38 m` radius) and rear (`0.41 m` radius) tires sit physically flush on the Stunt Road and curved ramps with zero floating gap while rotating around the vehicle's true center of mass during mid-air 360-degree kickflips.
  - Equipped with 7 supersonic cold-gas nitrogen nozzles: 4 underbody wheel-well lift nozzles, 2 left/right side rocker lateral nozzles, and 1 rear license-plate COPV main thruster. There are zero roof-mounted smoke emitters.
  - **Mid-Air-Only Thruster and Smoke Activation**: While driving on the flat Stunt Road or climbing the Quarter-Pipe Launch Ramp and 180-degree Half-Loop, the Roadster accelerates exclusively via its Tri-Motor Plaid Electric AWD wheel motors with zero cold-gas thruster plumes or smoke. Cold-gas thrusters and volumetric smoke trigger only when the vehicle leaves the road or ramp into mid-air.
- **2-Stage Full-Stack SpaceX Starship & Super Heavy Booster (`src/three/starshipModel.ts`)**:
  - Modeled as two independent stage groups (`boosterGroup` and `shipGroup`) that separate dynamically during flight.
  - Uses disjoint 180-degree half-cylinders (`[0, pi]` for the windward black TPS heat-shield tiles and `[pi, 2*pi]` for the leeward mirror-brushed stainless steel hull) to prevent WebGL depth-buffer z-fighting.
  - All Super Heavy Booster meshes reside at non-negative local `y` coordinates (`0.0 m` to `+4.75 m`) above the Orbital Launch Mount (`y = 1.35 m`), preventing underground clipping at liftoff or landing.
- **Volumetric Smoke, Raptor Plume, and 3D Crash Explosion Solver (`src/three/plumeAndSmokeFX.ts`)**:
  - Uses camera-facing multi-lobe FBM vapor cloud sprites (`createVolumetricSmokeCloudTexture`) to render realistic billowing white nitrogen smoke in mid-air and thermal combustion plumes from Starship Raptor engines.
  - **3D Crash Explosion and Debris System**: Whenever the vehicle crashes or lands upside-down or sideways, the simulator detonates an expanding ground shockwave ring, a high-intensity flash light, 72+ high-velocity fireball-to-soot explosion clouds, and 16 physical flying debris shards (including 4 detached spinning wheels that bounce across the asphalt under real gravity).

### 2.3 Global Pause, Resume, and Ghost Policy Rollouts
- **Pause and Resume**: Users can pause and resume the 60Hz physics integrator at any millisecond using the top frameless navbar button, the bottom 3D control dock, or the `Spacebar` shortcut while orbiting the 3D camera freely.
- **Parallel Ghost Rollouts**: Displays 3 semi-transparent ghost vehicles in dedicated non-overlapping lateral lanes (`z = -5.2 m, +4.8 m, -9.2 m`) to compare noisy exploratory rollouts against the primary policy.

---

## 3. Simulated Vehicles and Missions

RoadsterVerse includes 6 physics-based missions defined in `src/rl/missions.ts`:

| Mission Code | Vehicle | Title | Physics & Control Objective |
| :--- | :--- | :--- | :--- |
| `01` (`roadster-hover`) | Tesla Roadster | SpaceX Thruster Hover | Balance 4 underbody cold-gas lift jets to hover at `3.2 m` altitude with zero roll or pitch drift as COPV tank pressure blows down. |
| `02` (`roadster-barrel-roll`) | Tesla Roadster | Ramp Launch & 360 Kickflip | Accelerate up the Curved Steel Quarter-Pipe Launch Ramp, launch into the air, fire left/right side rocker thrusters to execute a 360-degree mid-air kickflip (`2*pi rad`), and cushion touchdown on the road. |
| `03` (`roadster-wall-climb`) | Tesla Roadster | Hot-Wheels 180 Half-Loop | Sprint into the 180-degree vertical half-loop (`R = 7.0 m`), pin tires to the overhead track using centripetal force and side thrusters, exit inverted into mid-air with zero artificial levitation, execute an axial half-twist kickflip (`2*pi rad`), and land back near the starting zone. |
| `04` (`starship-launch`) | SpaceX Starship | Full-Stack Launch & Stage Release | Ignite 33 Super Heavy Raptor engines from the Starbase Orbital Launch Mount, ascend to staging altitude, execute Hot-Stage Separation to release the Starship Upper Stage to orbit, and guide the Super Heavy Booster back for a slow vertical landing burn. |
| `05` (`starship-belly-flop`) | SpaceX Starship | Belly-Flop Skydiver Flip | Descend horizontally at `86 deg` pitch using 4 body flaps for aerodynamic skydiver trim, then gimbal 3 landing Raptors to whip the hull vertical (`0 deg`) for a soft retro-propulsive touchdown. |
| `06` (`starship-booster-catch`) | SpaceX Starship | Hot-Stage & Mechazilla Catch | Release the Starship Upper Stage at altitude, flip the Super Heavy Booster via a boostback pitch maneuver, steer downrange with 4 Titanium waffle grid fins, and hover softly into the Starbase Chopstick catch arms. |

---

## 4. Physics Engine and Mathematical Models

### 4.1 6-DoF Rigid-Body Kinematics (`src/physics/roadsterPhysics.ts`, `src/physics/starshipPhysics.ts`)
At each time step `dt` (clamped to `<= 0.05 s` for numerical stability), linear and angular states are updated via semi-implicit Euler integration:

```
v(t + dt) = (v(t) + (F_net / m(t)) * dt) * d_linear
x(t + dt) = x(t) + v(t + dt) * dt

omega(t + dt) = (omega(t) + alpha_net * dt) * d_angular
theta(t + dt) = theta(t) + omega(t + dt) * dt
```

where `F_net` sums gravity (`-m * g`), cold-gas or Raptor thrust vectors transformed into world coordinates, aerodynamic drag (`-0.5 * rho * C_d * A * |v| * v`), and active rear wing downforce (`C_L * alpha_wing * v_x^2`).

### 4.2 COPV Cold-Gas Blowdown and Raptor Mass Depletion
- **Roadster COPV Tank**: Initialized at `10,000 PSI`. Firing the 7 cold-gas valves depletes pressure proportionally to total valve duty cycle, reducing available thrust as tank pressure drops below `3,500 PSI`.
- **Starship Propellant**: Initialized at `100%` propellant fraction. Firing the Raptor engines reduces total vehicle mass `m(t)`, dynamically increasing thrust-to-weight ratio (`TWR`) during the landing burn.

### 4.3 Analytical Curved Ramp and Half-Loop Geometry (`src/physics/rampGeometry.ts`)
- **Curved Quarter-Pipe Kickflip Ramp**: Parameterized over `x in [-7.5 m, -1.2 m]` using a smooth cubic-square blend `u^2.2` rising to `1.85 m` elevation with analytical surface tangent `dy/dx` and normal vectors so the Roadster's pitch and wheel contact track the ramp curvature without clipping.
- **Hot-Wheels 180-Degree Half-Loop**: Parameterized by loop angle `theta in [0, pi]` around center `(x = 3.5 m, y = 7.04 m)` with radius `R = 7.0 m`. Tire adhesion requires sufficient centripetal acceleration `v_t^2 / R` plus thruster pinning force to overcome the radial component of gravity `g * cos(theta - pi/2)`.

---

## 5. Reinforcement Learning Policy and Neural Network Inspector

### 5.1 4-Layer Policy Architecture (`src/rl/policyEngine.ts`)
The onboard policy network processes a 6-dimensional normalized observation vector at 60Hz:
1. **Input Layer (6 Neurons)**:
   - Roadster: `Alt Err`, `Vel Y`, `Roll`, `Pitch`, `Vel X`, `COPV PSI`.
   - Starship: `Alt Err`, `Vel Y`, `Pitch`, `Pitch Rate`, `Error X`, `Fuel %`.
2. **Hidden Layer 1 (8 Neurons, `tanh` activation)**: Spatial and gravitational feature extractors (`Alt-Error Gate`, `Gravity Compensator`, `Roll Rate Detector`, `Pitch Horizon Cell`, `Centripetal Loop Memory`, `Touchdown Brake Trigger`, `Aero/Gimbal Mixer`, `Blowdown PSI Regulator`).
3. **Hidden Layer 2 (6 Neurons, `tanh` activation)**: Multi-actuator policy coordinators (`Lift Cushion Synth`, `Kickflip Torque Driver`, `Pitch Trim Coordinator`, `Lateral Pinning Synth`, `Retro-Burn Timing Gate`, `Stage & Fin Sequencer`).
4. **Output Layer (6 Neurons, `[0, 1]` or `[-1, 1]` command range)**:
   - Roadster: `FL Lift`, `FR Lift`, `RL Lift`, `RR Lift`, `Side Jets`, `Rear COPV`.
   - Starship: `Raptor Thr`, `Gimbal Pitch`, `Gimbal Yaw`, `Fwd Flaps`, `Aft Flaps`, `Grid Fins`.

### 5.2 Interactive Full Neural Network & Epoch Node Previewer (`src/components/NeuralNetworkModal.tsx`)
Clicking the **Live Brain Wires** card or any neuron in the right telemetry drawer opens the full-screen **Neural Network & Epoch Node Previewer**:
- Displays all 26 neurons across all 4 layers and all 132 synaptic connections.
- Clicking any node highlights its incoming and outgoing synapses, displays its functional role and live activation value, and plots its activation waveform.
- Includes an interactive **Epoch Regime Scrubber (`Epoch 1..500`)** and preset buttons (`Epoch 10 Crash`, `Epoch 20 Failing`, `Epoch 85 Wobbling`, `Epoch 220 Learning`, `Epoch 380 Mastered`) that run a fast-time 180-step trajectory rollout so users can visually compare how a neuron and vehicle path fail at Epoch 20 versus how they converge at Epoch 380.
- Clicking **TEST EPOCH #X IN LIVE 3D** immediately applies that epoch to the live 3D proving ground.

---

## 6. System Architecture and Directory Structure

```text
.
├── .env.example                           # Environment variable template
├── .github/workflows/ci.yml               # Automated CI pipeline (line-limit, typecheck, test, build)
├── Dockerfile                             # Multi-stage production container (non-root user)
├── docker-compose.yml                     # Container orchestration with healthcheck and SQLite volume
├── index.html                             # Application entry HTML
├── package.json                           # Scripts and dependencies
├── scripts/
│   └── check_source_line_limits.py        # Enforces <= 500 physical lines per source file
├── server/
│   ├── app.ts                             # Express REST API, Zod validation, and TTL cache
│   ├── db.ts                              # Native node:sqlite persistence layer (WAL mode)
│   ├── index.ts                           # HTTP server entrypoint with graceful shutdown
│   └── schemas.ts                         # Zod request/response schemas
├── src/
│   ├── App.tsx                            # Root application state, keyboard hotkeys, and layout
│   ├── main.tsx                           # React DOM mount
│   ├── styles.css                         # Pure monochrome grayscale stylesheet
│   ├── api/
│   │   └── checkpointClient.ts            # Resilient HTTP client (timeouts, TTL cache, backoff)
│   ├── components/
│   │   ├── HelpTooltip.tsx                # Fixed-viewport glassmorphic '?' popover
│   │   ├── KnowledgeAndTriviaModal.tsx    # Physics whitepapers and interactive trivia deck
│   │   ├── NeuralNetworkModal.tsx         # Full 4-layer neural network & epoch node previewer
│   │   ├── NeuralTelemetryHUD.tsx         # Right collapsible AI brain telemetry drawer
│   │   ├── RLTrainingControls.tsx         # Left collapsible hyperparameter & checkpoint drawer
│   │   ├── Viewport3D.tsx                 # Full-screen Three.js 60Hz simulation viewport
│   │   └── WelcomeScreen.tsx              # SpaceX-inspired frameless landing page
│   ├── data/
│   │   └── knowledgeAndTrivia.ts          # Engineering formulas and trivia questions
│   ├── physics/
│   │   ├── rampGeometry.ts                # Analytical quarter-pipe and 180-deg half-loop geometry
│   │   ├── roadsterPhysics.ts             # 6-DoF Tesla Roadster cold-gas & ramp physics solver
│   │   └── starshipPhysics.ts             # 6-DoF 2-stage SpaceX Starship & Booster physics solver
│   ├── rl/
│   │   ├── missions.ts                    # 6 mission definitions and default hyperparameters
│   │   └── policyEngine.ts                # 4-layer RL policy evaluator and reward generator
│   ├── three/
│   │   ├── plumeAndSmokeFX.ts             # Volumetric white nitrogen smoke & Raptor fire plume solver
│   │   ├── proceduralTextures.ts          # Procedural carbon weave, asphalt, and steel textures
│   │   ├── provingGroundScene.ts          # 3D scene manager, ramps, Starbase tower, and camera rig
│   │   ├── roadsterModel.ts               # 2026 Tesla Roadster 3D mesh and 7-nozzle rig
│   │   └── starshipModel.ts               # 2-Stage Starship & Super Heavy Booster 3D mesh rig
│   └── types/
│       └── simulation.ts                  # Shared TypeScript interfaces
└── tests/
    ├── integration/
    │   └── api.test.ts                    # Express + SQLite CRUD and Zod validation tests
    └── unit/
        ├── physics.test.ts                # Roadster, Starship, ramp, and monochrome audit tests
        ├── rlPolicy.test.ts               # RL competence, reward curve, and policy tests
        └── sceneAndSmokePhysics.test.ts   # 3D rigs, tire contact, booster height, and smoke tests
```

---

## 7. Getting Started and Local Development

### Prerequisites
- **Node.js**: `v22.5.0+` (uses native built-in `node:sqlite`)
- **npm**: `v10+`
- **Python 3**: Used to run the `scripts/check_source_line_limits.py` guardrail script

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/darknecrocities/RoadsterVerse.git
   cd RoadsterVerse
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start both the Vite frontend (`http://localhost:5173`) and Express + SQLite telemetry server (`http://localhost:8788`):
   ```bash
   npm run dev
   ```

---

## 8. Testing, Verification, and Engineering Guardrails

Run the complete verification pipeline before committing or deploying:

```bash
# 1. Verify all source files comply with the 500-line physical limit
python3 scripts/check_source_line_limits.py --path .

# 2. Run strict TypeScript typechecking
npm run typecheck

# 3. Run unit and integration test suites (Vitest)
npm test

# 4. Build production client bundle
npm run build
```

### What the Automated Test Suite Verifies
- **`tests/unit/physics.test.ts`**:
  - Roadster hover stabilization and crash detection under untrained vs. converged policies.
  - Roadster 180-degree Hot-Wheels Half-Loop climb, inverted exit without mid-air levitation, 360-degree axial kickflip, and smooth touchdown at `y = 0.43 m`.
  - Roadster Curved Quarter-Pipe launch with zero ramp clipping (`position.y >= rampSample.carCenterY`).
  - Starship Mission 04 full-stack launch, hot-stage separation, and slow vertical booster landing (`< 1.5 m/s` touchdown speed).
  - Starship Mission 05 horizontal belly-flop to vertical landing flip.
  - Starship Mission 06 boostback flip and Starbase Chopstick tower catch.
  - Static source audit confirming 100% pure grayscale hex colors (`R === G === B`) across all stylesheets and React components.
- **`tests/unit/sceneAndSmokePhysics.test.ts`**:
  - Verifies all 7 Roadster cold-gas nozzles emit white smoke independently, confirms zero roof thrusters exist, and verifies all 4 wheels touch local `y = -0.39 m` (`CAR_RIDE_HEIGHT = 0.39 m`).
  - Verifies all Super Heavy Booster meshes inside `boosterGroup` sit at local `y >= 0.0 m` (never buried underground) and verifies 2-stage separation visibility and thermal fire plumes.
  - Runs all 6 missions across 4 epoch regimes (`5, 80, 240, 420`) to verify zero `NaN` states.
- **`tests/unit/rlPolicy.test.ts`**:
  - Verifies monotonic competence growth with training epochs, learning rate sensitivity, and reward curve generation.
- **`tests/integration/api.test.ts`**:
  - Verifies end-to-end SQLite persistence, Zod validation rejection on malformed payloads, checkpoint creation, listing, and deletion.

---

## 9. REST API Specification

The backend server (`server/app.ts`) runs on port `8788` by default and persists trained RL checkpoints to `data/checkpoints.db` in SQLite WAL mode.

### `GET /api/health`
Returns server health status and timestamp.

### `GET /api/checkpoints?missionId=<optional>`
Returns up to 50 saved RL policy checkpoints ordered by `createdAt DESC`. Responses are cached in memory for 5 seconds and automatically invalidated on write or delete operations.

### `POST /api/checkpoints`
Creates and persists a new RL policy checkpoint. Validated via `CreateCheckpointSchema` (`server/schemas.ts`):
```json
{
  "name": "Roadster Kickflip Master Ep380",
  "missionId": "roadster-barrel-roll",
  "vehicle": "roadster",
  "epochs": 380,
  "learningRate": 0.001,
  "explorationNoise": 0.02,
  "gravity": 9.81,
  "thrusterMultiplier": 1.2,
  "peakReward": 298.5,
  "successRate": 0.96
}
```

### `DELETE /api/checkpoints/:id`
Deletes a saved checkpoint by integer ID and invalidates the in-memory checkpoint cache.

### `GET /api/stats`
Returns aggregate checkpoint count, best recorded reward, and average success rate across all saved runs.

---

## 10. Docker Deployment

RoadsterVerse includes a production-hardened multi-stage `Dockerfile` running under an unprivileged `appuser` account and a `docker-compose.yml` with persistent volume mounting and health checks:

```bash
docker compose up --build -d
```

Once running, the application and API are served on `http://localhost:8788`.
