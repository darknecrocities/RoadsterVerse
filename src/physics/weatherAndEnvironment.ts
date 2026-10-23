import type { Vector3D, WeatherPreset, WeatherState } from '../types/simulation.ts';

export const AIR_DENSITY_STANDARD = 1.225; // kg/m^3 (ISA sea level)
export const TIRE_PRESSURE_PSI_DEFAULT = 42.0;

export interface WeatherPresetDescriptor {
  preset: WeatherPreset;
  label: string;
  airDensityKgM3: number;
  baseWindSpeedMs: number;
  baseWindDirectionDeg: number;
  rainIntensityPct: number;
  roadWetnessPct: number;
  baseSurfaceMu: number;
  visibilityM: number;
}

export const WEATHER_CONFIGS: Record<WeatherPreset, WeatherPresetDescriptor> = {
  clear: {
    preset: 'clear',
    label: 'Standard Proving Ground (Dry / Clear)',
    airDensityKgM3: 1.225,
    baseWindSpeedMs: 1.5,
    baseWindDirectionDeg: 35.0,
    rainIntensityPct: 0,
    roadWetnessPct: 0,
    baseSurfaceMu: 1.35,
    visibilityM: 350.0,
  },
  rain: {
    preset: 'rain',
    label: 'Torrential Rain (Wet Tarmac & Standing Water)',
    airDensityKgM3: 1.238,
    baseWindSpeedMs: 9.5,
    baseWindDirectionDeg: 65.0,
    rainIntensityPct: 85,
    roadWetnessPct: 92,
    baseSurfaceMu: 0.72,
    visibilityM: 65.0,
  },
  storm: {
    preset: 'storm',
    label: 'Severe Hurricane Gale (Crosswinds & Lightning)',
    airDensityKgM3: 1.262,
    baseWindSpeedMs: 26.0,
    baseWindDirectionDeg: 82.0,
    rainIntensityPct: 100,
    roadWetnessPct: 100,
    baseSurfaceMu: 0.58,
    visibilityM: 38.0,
  },
  fog: {
    preset: 'fog',
    label: 'Dense Coastal Fog (Low Visibility)',
    airDensityKgM3: 1.228,
    baseWindSpeedMs: 2.2,
    baseWindDirectionDeg: 15.0,
    rainIntensityPct: 15,
    roadWetnessPct: 35,
    baseSurfaceMu: 1.12,
    visibilityM: 20.0,
  },
  'mars-dust': {
    preset: 'mars-dust',
    label: 'Martian Dust Gale (Thin Atmosphere & Red Regolith)',
    airDensityKgM3: 0.02,
    baseWindSpeedMs: 22.0,
    baseWindDirectionDeg: 45.0,
    rainIntensityPct: 0,
    roadWetnessPct: 0,
    baseSurfaceMu: 0.85,
    visibilityM: 45.0,
  },
};

/**
 * Computes Dryden atmospheric turbulence gust components (u_g, v_g, w_g)
 * using band-limited stochastic perturbation.
 */
export function computeDrydenTurbulence(
  windSpeed: number,
  altitudeM: number,
  dt: number,
  elapsedTimeSec: number
): Vector3D {
  const altClamped = Math.max(1.0, altitudeM);
  const turbScale = Math.min(1.0, windSpeed / 20.0);
  const freq1 = 2.4;
  const freq2 = 5.1;
  const freq3 = 1.1;

  const gx =
    (Math.sin(elapsedTimeSec * freq1) * 0.65 +
      Math.sin(elapsedTimeSec * freq2 * 0.7) * 0.35) *
    windSpeed *
    0.28 *
    turbScale;
  const gy =
    Math.sin(elapsedTimeSec * freq3 + 1.2) *
    Math.min(3.5, 0.15 * windSpeed * (10.0 / altClamped));
  const gz =
    (Math.cos(elapsedTimeSec * freq1 * 1.3) * 0.7 +
      Math.sin(elapsedTimeSec * 3.7) * 0.3) *
    windSpeed *
    0.35 *
    turbScale;

  return { x: gx, y: gy, z: gz };
}

/**
 * Creates the initial WeatherState matching a chosen preset.
 */
export function createInitialWeatherState(preset: WeatherPreset = 'clear'): WeatherState {
  const config = WEATHER_CONFIGS[preset] ?? WEATHER_CONFIGS.clear;
  const rad = (config.baseWindDirectionDeg * Math.PI) / 180;
  const wx = Math.cos(rad) * config.baseWindSpeedMs;
  const wz = Math.sin(rad) * config.baseWindSpeedMs;

  return {
    preset,
    airDensityKgM3: config.airDensityKgM3,
    windSpeedMs: config.baseWindSpeedMs,
    windDirectionDeg: config.baseWindDirectionDeg,
    windVector: { x: wx, y: 0, z: wz },
    rainIntensityPct: config.rainIntensityPct,
    roadWetnessPct: config.roadWetnessPct,
    surfaceFrictionMu: config.baseSurfaceMu,
    visibilityM: config.visibilityM,
    lightningFlashIntensity: 0,
  };
}

/**
 * Updates dynamic weather in time: steps gusts, storm lightning bursts, and road wetness.
 */
export function stepWeatherEnvironment(
  current: WeatherState,
  dt: number,
  elapsedTimeSec: number,
  altitudeM = 1.0
): WeatherState {
  const config = WEATHER_CONFIGS[current.preset] ?? WEATHER_CONFIGS.clear;
  const rad = (current.windDirectionDeg * Math.PI) / 180;
  const baseWx = Math.cos(rad) * current.windSpeedMs;
  const baseWz = Math.sin(rad) * current.windSpeedMs;

  const gust = computeDrydenTurbulence(current.windSpeedMs, altitudeM, dt, elapsedTimeSec);
  const netWindVector: Vector3D = {
    x: baseWx + gust.x,
    y: gust.y,
    z: baseWz + gust.z,
  };

  // Lightning flashes in storm mode
  let lightning = 0;
  if (current.preset === 'storm') {
    const flashPhase = (elapsedTimeSec * 0.35) % 1.0;
    if (flashPhase > 0.94) {
      const pulse = (flashPhase - 0.94) / 0.06;
      lightning = Math.sin(pulse * Math.PI * 4) * 0.5 + 0.5;
    }
  }

  return {
    ...current,
    airDensityKgM3: config.airDensityKgM3,
    windVector: netWindVector,
    lightningFlashIntensity: lightning,
  };
}

/**
 * Computes the relative aerodynamic airspeed vector:
 * v_rel = v_vehicle - v_wind
 */
export function computeRelativeAirspeed(
  vehicleVelocity: Vector3D,
  windVector: Vector3D
): Vector3D {
  return {
    x: vehicleVelocity.x - windVector.x,
    y: vehicleVelocity.y - windVector.y,
    z: vehicleVelocity.z - windVector.z,
  };
}

/**
 * Dynamic tire friction calculation accounting for:
 * 1) Surface wetness attenuation.
 * 2) Dynamic hydroplaning: at speed > v_hydro, water film floats tire, dropping mu to ~0.18.
 * Formula for hydroplaning speed: v_hydro = 10.35 * sqrt(tire_pressure_psi) in km/h -> converted to m/s.
 */
export function computeTireFriction(
  vehicleSpeedMs: number,
  roadWetnessPct: number,
  normalForceN: number,
  tirePressurePsi = TIRE_PRESSURE_PSI_DEFAULT
): number {
  const wetFrac = Math.max(0, Math.min(1.0, roadWetnessPct / 100));
  // Hydroplaning critical speed in m/s: 10.35 * sqrt(p_psi) * (1000/3600)
  const vHydroKmh = 10.35 * Math.sqrt(tirePressurePsi);
  const vHydroMs = (vHydroKmh * 1000) / 3600; // ~18.6 m/s (~67 km/h) for 42 PSI

  const baseMu = 1.35 * (1.0 - 0.44 * wetFrac);

  if (wetFrac > 0.35 && vehicleSpeedMs > vHydroMs) {
    const hydroExcess = Math.min(1.0, (vehicleSpeedMs - vHydroMs) / 14.0);
    // Severe drop in traction when tire planes over standing water
    return Math.max(0.16, baseMu * (1.0 - hydroExcess * 0.76));
  }

  // Load sensitivity: high normal force increases grip, but saturation occurs
  const loadSensitivity = Math.min(1.15, Math.max(0.85, 1.0 - (normalForceN - 18000) * 0.000008));
  return Math.max(0.2, baseMu * loadSensitivity);
}
