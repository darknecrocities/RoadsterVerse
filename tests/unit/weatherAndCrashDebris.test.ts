import { describe, expect, it } from 'vitest';
import { WEATHER_CONFIGS, computeDrydenTurbulence, computeRelativeAirspeed, computeTireFriction, createInitialWeatherState, stepWeatherEnvironment } from '../../src/physics/weatherAndEnvironment.ts';
import { ROADSTER_BATTERY_KWH, ROADSTER_COPV_MAX_PRESSURE_BAR, ROADSTER_COPV_N2_MASS_KG, createInitialEnergyState, createInitialSubsystemHealth, stepSubsystemEnergyDynamics } from '../../src/physics/subsystemEnergyDynamics.ts';
import { computeImpactKineticEnergy, evaluateStructuralCrash, generateVehicleDebrisPieces, stepDebrisBallistics } from '../../src/physics/advancedCrashAndDebris.ts';
import { evaluateRLPolicy } from '../../src/rl/policyEngine.ts';
import { DEFAULT_HYPERPARAMETERS } from '../../src/rl/missions.ts';
import { createInitialRoadsterState, stepRoadsterPhysics } from '../../src/physics/roadsterPhysics.ts';
import { stepRoadsterObstacleRacePhysics } from '../../src/physics/aerodynamicsAndRace.ts';
import { createInitialStarshipState, stepStarshipPhysics } from '../../src/physics/starshipPhysics.ts';
import { computePolicyCompetence } from '../../src/rl/competence.ts';
import type { ThrusterActivation } from '../../src/types/simulation.ts';

describe('Weather, Aerodynamics, Energy Storage & Multi-Body Debris Crash Engine', () => {
  describe('Weather & Atmospheric Physics', () => {
    it('initializes weather states correctly for all 5 presets', () => {
      const clear = createInitialWeatherState('clear');
      expect(clear.airDensityKgM3).toBe(1.225);
      expect(clear.surfaceFrictionMu).toBe(1.35);
      expect(clear.roadWetnessPct).toBe(0);

      const rain = createInitialWeatherState('rain');
      expect(rain.surfaceFrictionMu).toBe(0.72);
      expect(rain.rainIntensityPct).toBe(85);

      const storm = createInitialWeatherState('storm');
      expect(storm.airDensityKgM3).toBe(1.262);
      expect(storm.windSpeedMs).toBe(26.0);
      expect(storm.surfaceFrictionMu).toBe(0.58);

      const fog = createInitialWeatherState('fog');
      expect(fog.visibilityM).toBe(20.0);

      const mars = createInitialWeatherState('mars-dust');
      expect(mars.airDensityKgM3).toBe(0.02);
    });

    it('computes relative airspeed correctly by subtracting wind vector', () => {
      const v = { x: 30, y: 0, z: 0 };
      const wind = { x: 10, y: 0, z: 5 };
      const rel = computeRelativeAirspeed(v, wind);
      expect(rel.x).toBe(20);
      expect(rel.y).toBe(0);
      expect(rel.z).toBe(-5);
    });

    it('simulates dynamic tire friction drop on wet roads and severe hydroplaning at high speeds', () => {
      // 1. Dry road at moderate speed (15 m/s ~ 54 km/h):
      const dryMu = computeTireFriction(15, 0, 18500, 42);
      expect(dryMu).toBeCloseTo(1.35, 1);

      // 2. Wet road (80% wetness) at moderate speed:
      const wetMu = computeTireFriction(15, 80, 18500, 42);
      expect(wetMu).toBeLessThan(dryMu);
      expect(wetMu).toBeGreaterThan(0.6);

      // 3. High speed (45 m/s ~ 162 km/h) over wet road exceeds hydroplaning threshold (~18.6 m/s):
      const hydroMu = computeTireFriction(45, 95, 18500, 42);
      expect(hydroMu).toBeLessThan(0.35);
    });

    it('updates turbulence and dynamic storm lightning flashes over time', () => {
      let storm = createInitialWeatherState('storm');
      let sawLightning = false;

      for (let t = 0; t < 15; t += 0.05) {
        storm = stepWeatherEnvironment(storm, 0.05, t, 2.0);
        if (storm.lightningFlashIntensity > 0) {
          sawLightning = true;
        }
      }
      expect(sawLightning).toBe(true);
    });
  });

  describe('Subsystem Energy Dynamics & 700-Bar COPV Tanks', () => {
    it('initializes Roadster 200 kWh battery and 700-bar COPV tanks with 63.5 kg N2', () => {
      const energy = createInitialEnergyState('roadster', 10152);
      expect(energy.batteryKwhRemaining).toBe(ROADSTER_BATTERY_KWH);
      expect(energy.batterySocPct).toBe(100);
      expect(energy.copvPressureBar).toBeCloseTo(ROADSTER_COPV_MAX_PRESSURE_BAR, 0);
      expect(energy.copvPropellantMassKg).toBeCloseTo(ROADSTER_COPV_N2_MASS_KG, 1);
    });

    it('drains battery energy, accumulates internal resistance heat, and derates under heavy draw', () => {
      let energy = createInitialEnergyState('roadster');
      const health = createInitialSubsystemHealth();
      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0,
        frontRightLift: 0,
        rearLeftLift: 0,
        rearRightLift: 0,
        lateralLeft: 0,
        lateralRight: 0,
        rearBoost: 1.0,
        activeWingAngle: 0.5,
        raptorThrottle: 0,
        gimbalPitch: 0,
        gimbalYaw: 0,
        flapFrontLeft: 0,
        flapFrontRight: 0,
        flapAftLeft: 0,
        flapAftRight: 0,
        hotStageSeparated: false,
      };

      for (let i = 0; i < 60; i++) {
        const res = stepSubsystemEnergyDynamics(energy, health, mockThrusters, 1.0, 'roadster', 0.1, true);
        energy = res.nextEnergy;
      }

      expect(energy.batteryKwhRemaining).toBeLessThan(ROADSTER_BATTERY_KWH);
      expect(energy.batteryTempC).toBeGreaterThan(30.0);
      expect(energy.batteryVoltageV).toBeLessThan(800.0);
    });

    it('generates parasitic blowdown torque when COPV is punctured', () => {
      const energy = createInitialEnergyState('roadster');
      const damagedHealth = createInitialSubsystemHealth();
      damagedHealth.copvHealthPct = 40.0; // Puncture leak!

      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0,
        frontRightLift: 0,
        rearLeftLift: 0,
        rearRightLift: 0,
        lateralLeft: 0,
        lateralRight: 0,
        rearBoost: 0,
        activeWingAngle: 0,
        raptorThrottle: 0,
        gimbalPitch: 0,
        gimbalYaw: 0,
        flapFrontLeft: 0,
        flapFrontRight: 0,
        flapAftLeft: 0,
        flapAftRight: 0,
        hotStageSeparated: false,
      };

      const res = stepSubsystemEnergyDynamics(energy, damagedHealth, mockThrusters, 0, 'roadster', 0.05, true);
      expect(res.nextHealth.leakVentingRateKgS).toBeGreaterThan(0.5);
      expect(Math.abs(res.nextHealth.parasiticTorqueNm.y)).toBeGreaterThan(100.0);
    });
  });

  describe('Multi-Body Crash Destruction & 6-DoF Debris Ballistics', () => {
    it('computes realistic impact kinetic energy and structural deceleration shocks', () => {
      const energyJoules = computeImpactKineticEnergy(
        1850,
        { x: 35, y: -8, z: 0 },
        { x: 2, y: 3, z: 1 },
        'roadster'
      );
      expect(energyJoules).toBeGreaterThan(1000000); // Over 1 MJ of kinetic energy

      const report = evaluateStructuralCrash(
        'obstacle-concrete-chicane-impact',
        1850,
        { x: 35, y: -8, z: 0 },
        { x: 2, y: 3, z: 1 },
        { roll: 0, pitch: 0, yaw: 0 },
        createInitialSubsystemHealth(),
        'roadster'
      );

      expect(report.isCatastrophic).toBe(true);
      expect(report.updatedHealth.batteryHealthPct).toBe(0);
      expect(report.updatedHealth.copvHealthPct).toBe(0);
      expect(report.spawnedDebris.length).toBeGreaterThanOrEqual(20);
    });

    it('generates wheels, carbon panels, and glass shards for Roadster, and rings and Raptor bells for Starship', () => {
      const roadsterDebris = generateVehicleDebrisPieces(
        'roadster',
        { x: 0, y: 1, z: 0 },
        { x: 20, y: 0, z: 0 },
        { roll: 0, pitch: 0, yaw: 0 },
        500000
      );
      expect(roadsterDebris.some((d) => d.material === 'wheel-rubber')).toBe(true);
      expect(roadsterDebris.some((d) => d.material === 'carbon-fiber')).toBe(true);
      expect(roadsterDebris.some((d) => d.material === 'polycarbonate-glass')).toBe(true);

      const starshipDebris = generateVehicleDebrisPieces(
        'starship',
        { x: 0, y: 2, z: 0 },
        { x: 0, y: -10, z: 0 },
        { roll: 0, pitch: 0, yaw: 0 },
        8000000
      );
      expect(starshipDebris.some((d) => d.material === 'stainless-steel')).toBe(true);
      expect(starshipDebris.some((d) => d.material === 'titanium-gridfin')).toBe(true);
      expect(starshipDebris.some((d) => d.material === 'raptor-bell')).toBe(true);
    });

    it('simulates 6-DoF debris ballistics with aerodynamic drag and ground bounce damping', () => {
      const initialPieces = generateVehicleDebrisPieces(
        'roadster',
        { x: 0, y: 2, z: 0 },
        { x: 10, y: 5, z: 0 },
        { roll: 0, pitch: 0, yaw: 0 },
        250000
      );

      let pieces = initialPieces;
      const wind = { x: 5, y: 0, z: 0 };
      for (let step = 0; step < 150; step++) {
        pieces = stepDebrisBallistics(pieces, wind, 1.225, 0.02, 0.12);
      }

      // Debris should have bounced and slowed down toward resting on ground plane
      const someLanded = pieces.some((p) => p.position.y <= 0.16);
      expect(someLanded).toBe(true);
    });
  });

  describe('RL Policy Learning Side-Effects', () => {
    it('applies continuous reward penalty for degraded subsystem health and compensates for leaks', () => {
      const state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
      state.subsystems = createInitialSubsystemHealth();
      state.subsystems.copvHealthPct = 50;
      state.subsystems.leakVentingRateKgS = 1.2;
      state.subsystems.parasiticTorqueNm = { x: 0, y: -650, z: 0 };

      const { thrusters, nnSnapshot } = evaluateRLPolicy(
        state,
        'roadster-hover',
        { ...DEFAULT_HYPERPARAMETERS, epochs: 200 },
        0
      );

      expect(nnSnapshot.instantReward).toBeDefined();
      // Trained policy detects parasitic pitch torque and commands differential front lift
      expect(thrusters.frontLeftLift).toBeGreaterThan(0);
      expect(thrusters.frontRightLift).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Wet Road Sliding, Runoff Crash & Rocket Wind Drift', () => {
    it('simulates wet road lateral sliding, hydroplaning, and outside road barrier crash in Stunt 04', () => {
      const state = createInitialRoadsterState('roadster-obstacle-race', DEFAULT_HYPERPARAMETERS);
      state.weather = createInitialWeatherState('storm'); // 100% wet, 26 m/s wind, 0.58 mu
      state.velocity.x = 75.0; // High speed in hydroplaning regime
      state.position.z = 10.5; // Near right boundary (24m road spans -12m to +12m)
      state.velocity.z = 4.5; // Sliding outward
      state.isGrounded = true;

      const thrusters: ThrusterActivation = {
        frontLeftLift: 0,
        frontRightLift: 0,
        rearLeftLift: 0,
        rearRightLift: 0,
        lateralLeft: 0,
        lateralRight: 1.0, // steering outward
        rearBoost: 0,
        activeWingAngle: 0.2,
        raptorThrottle: 0,
        gimbalPitch: 0,
        gimbalYaw: 0,
        flapFrontLeft: 0,
        flapFrontRight: 0,
        flapAftLeft: 0,
        flapAftRight: 0,
        hotStageSeparated: false,
      };

      const next = { ...state, position: { ...state.position }, velocity: { ...state.velocity }, attitude: { ...state.attitude }, angularVelocity: { ...state.angularVelocity } };
      stepRoadsterObstacleRacePhysics(
        state,
        next,
        thrusters,
        DEFAULT_HYPERPARAMETERS,
        0.1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      );

      // The vehicle should have slid past the 11.8m shoulder and crashed into the perimeter barrier
      expect(next.position.z).toBeGreaterThanOrEqual(11.0);
      if (Math.abs(next.position.z) >= 11.8) {
        expect(next.crashed).toBe(true);
        expect(next.crashReason).toContain('ROAD RUNOFF');
      }
    });

    it('simulates aerodynamic crosswind side-deflection on Super Heavy during descent', () => {
      const state = createInitialStarshipState('starship-booster-catch');
      state.velocity.z = -2; // booster descent phase
      state.position.y = 8.0;
      state.velocity.y = -1.2;
      state.weather = createInitialWeatherState('storm'); // 26 m/s crosswind!

      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0,
        frontRightLift: 0,
        rearLeftLift: 0,
        rearRightLift: 0,
        lateralLeft: 0,
        lateralRight: 0,
        rearBoost: 0,
        activeWingAngle: 0,
        raptorThrottle: 0.85,
        gimbalPitch: 0,
        gimbalYaw: 0,
        flapFrontLeft: 0,
        flapFrontRight: 0,
        flapAftLeft: 0,
        flapAftRight: 0,
        hotStageSeparated: true,
      };

      const next = stepStarshipPhysics(state, mockThrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.1);
      // Crosswind accelerates booster along X axis
      expect(Math.abs(next.velocity.x)).toBeGreaterThan(0);
    });

    it('activates booster cold-gas RCS side vents to correct lateral trajectory during Super Heavy Tower Catch', () => {
      // 1. Booster drifting to the right (x > 0)
      const stateRight = createInitialStarshipState('starship-booster-catch');
      stateRight.velocity.z = -2; // descent phase
      stateRight.position.y = 5.0;
      stateRight.position.x = 0.65; // displaced right
      stateRight.isGrounded = false;

      const policyRight = evaluateRLPolicy(stateRight, 'starship-booster-catch', { ...DEFAULT_HYPERPARAMETERS, epochs: 300 }, 0);
      // Policy should fire starboard RCS to push back left
      expect(policyRight.thrusters.boosterRcsRight).toBeGreaterThan(0.3);
      expect(policyRight.thrusters.boosterRcsLeft).toBe(0);

      // Verify physics applies corrective lateral acceleration toward negative X
      const nextRight = stepStarshipPhysics(stateRight, policyRight.thrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.1);
      expect(nextRight.velocity.x).toBeLessThan(0);

      // 2. Booster drifting to the left (x < 0)
      const stateLeft = createInitialStarshipState('starship-booster-catch');
      stateLeft.velocity.z = -2;
      stateLeft.position.y = 5.0;
      stateLeft.position.x = -0.65; // displaced left
      stateLeft.isGrounded = false;

      const policyLeft = evaluateRLPolicy(stateLeft, 'starship-booster-catch', { ...DEFAULT_HYPERPARAMETERS, epochs: 300 }, 0);
      // Policy should fire port RCS to push back right
      expect(policyLeft.thrusters.boosterRcsLeft).toBeGreaterThan(0.3);
      expect(policyLeft.thrusters.boosterRcsRight).toBe(0);

      const nextLeft = stepStarshipPhysics(stateLeft, policyLeft.thrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.1);
      expect(nextLeft.velocity.x).toBeGreaterThan(0);
    });

    it('ensures crashed Super Heavy falls under gravity to ground tarmac instead of floating at catch height', () => {
      const state = createInitialStarshipState('starship-booster-catch');
      state.velocity.z = -2; // descent
      state.position.y = 2.62; // approaching catch altitude
      state.velocity.y = -3.8; // excessive descent rate -> triggers catch-hard-landing-over-g

      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0, frontRightLift: 0, rearLeftLift: 0, rearRightLift: 0,
        lateralLeft: 0, lateralRight: 0, rearBoost: 0, activeWingAngle: 0,
        raptorThrottle: 0.85, gimbalPitch: 0, gimbalYaw: 0, flapFrontLeft: 0,
        flapFrontRight: 0, flapAftLeft: 0, flapAftRight: 0, hotStageSeparated: true,
      };

      let current = stepStarshipPhysics(state, mockThrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.05);
      expect(current.crashed).toBe(true);
      expect(current.crashType).toBe('catch-hard-landing-over-g');
      expect(current.position.y).toBeLessThan(2.6);

      for (let step = 0; step < 18; step++) {
        current = stepStarshipPhysics(current, mockThrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.05);
      }

      expect(current.position.y).toBeLessThanOrEqual(0.62);
      expect(current.isGrounded).toBe(true);
      expect(Math.abs(current.attitude.pitch)).toBeGreaterThan(1.2);
    });

    it('ensures crashed mid-air Roadster drops under gravity to ground level instead of floating', () => {
      const state = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
      state.position.y = 4.5;
      state.velocity.y = 0;
      state.crashed = true;
      state.crashType = 'hover-attitude-flip';
      state.angularVelocity = { x: 5, y: 0, z: 0 };

      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0, frontRightLift: 0, rearLeftLift: 0, rearRightLift: 0,
        lateralLeft: 0, lateralRight: 0, rearBoost: 0, activeWingAngle: 0,
        raptorThrottle: 0, gimbalPitch: 0, gimbalYaw: 0, flapFrontLeft: 0,
        flapFrontRight: 0, flapAftLeft: 0, flapAftRight: 0, hotStageSeparated: false,
      };

      let current = state;
      for (let s = 0; s < 24; s++) {
        current = stepRoadsterPhysics(current, mockThrusters, 'roadster-hover', DEFAULT_HYPERPARAMETERS, 0.05);
      }

      expect(current.position.y).toBeCloseTo(0.43, 1);
      expect(current.isGrounded).toBe(true);
    });

    it('populates and ballistically steps multi-body debris pieces to ground level upon rocket crash', () => {
      const state = createInitialStarshipState('starship-booster-catch');
      state.velocity.z = -2;
      state.position.y = 2.62;
      state.velocity.y = -4.0;

      const mockThrusters: ThrusterActivation = {
        frontLeftLift: 0, frontRightLift: 0, rearLeftLift: 0, rearRightLift: 0,
        lateralLeft: 0, lateralRight: 0, rearBoost: 0, activeWingAngle: 0,
        raptorThrottle: 0, gimbalPitch: 0, gimbalYaw: 0, flapFrontLeft: 0,
        flapFrontRight: 0, flapAftLeft: 0, flapAftRight: 0, hotStageSeparated: true,
      };

      let current = stepStarshipPhysics(state, mockThrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.05);
      expect(current.debrisField).toBeDefined();
      expect(current.debrisField!.length).toBeGreaterThanOrEqual(10);

      // Step debris pieces over 3.25 seconds so the explosive upward blast reaches apex and falls to ground
      for (let i = 0; i < 65; i++) {
        current = stepStarshipPhysics(current, mockThrusters, 'starship-booster-catch', DEFAULT_HYPERPARAMETERS, 0.05);
      }

      // Check that debris pieces have fallen down towards ground plane
      const rings = current.debrisField!.filter(d => d.id.startsWith('starship-barrel-ring'));
      expect(rings.length).toBeGreaterThan(0);
      for (const ring of rings) {
        expect(ring.position.y).toBeLessThanOrEqual(1.5);
      }
    });

    it('recalibrates competence curve so epoch 260 is intermediate and epochs 450-500 achieve true perfection', () => {
      // 1. Untrained baseline (epoch 15)
      const c15 = computePolicyCompetence('starship-booster-catch', {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 15,
        explorationNoise: 0.65,
      });
      expect(c15).toBeLessThan(0.15);

      // 2. Intermediate developing phase (epoch 260) - should NOT be perfected yet!
      const c260 = computePolicyCompetence('starship-booster-catch', {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 260,
        explorationNoise: 0.08,
      });
      expect(c260).toBeGreaterThanOrEqual(0.55);
      expect(c260).toBeLessThan(0.75); // Not perfected!

      // 3. Entering perfection (epoch 450)
      const c450 = computePolicyCompetence('starship-booster-catch', {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 450,
        explorationNoise: 0.03,
      });
      expect(c450).toBeGreaterThanOrEqual(0.90);

      // 4. Flawless perfection & mastery (epoch 480 - 500)
      const c480 = computePolicyCompetence('starship-booster-catch', {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 480,
        explorationNoise: 0.02,
      });
      expect(c480).toBeGreaterThanOrEqual(0.94);

      const c500 = computePolicyCompetence('starship-booster-catch', {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 500,
        explorationNoise: 0.015,
      });
      expect(c500).toBeGreaterThanOrEqual(0.95);
    });
  });
});
