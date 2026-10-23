import React, { useState } from 'react';
import {
  Activity,
  BatteryCharging,
  CloudRain,
  Flame,
  Gauge,
  Minimize2,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Wind,
  Zap,
} from 'lucide-react';
import type {
  RigidBodyState,
  SubsystemHealthState,
  VehicleEnergyState,
  WeatherPreset,
  WeatherState,
} from '../types/simulation.ts';
import { WEATHER_CONFIGS } from '../physics/weatherAndEnvironment.ts';
import { HelpTooltip } from './HelpTooltip.tsx';

interface EnvironmentAndDamageControlsProps {
  weather: WeatherState;
  energy?: VehicleEnergyState;
  subsystems?: SubsystemHealthState;
  onSelectWeatherPreset: (preset: WeatherPreset) => void;
  onUpdateWeatherParams: (patch: Partial<WeatherState>) => void;
  onTriggerCopvPuncture: () => void;
  onTriggerBatteryOverload: () => void;
  onTriggerImpactDetonation: () => void;
  onResetSubsystems: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const EnvironmentAndDamageControls: React.FC<EnvironmentAndDamageControlsProps> = ({
  weather,
  energy,
  subsystems,
  onSelectWeatherPreset,
  onUpdateWeatherParams,
  onTriggerCopvPuncture,
  onTriggerBatteryOverload,
  onTriggerImpactDetonation,
  onResetSubsystems,
  collapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'weather' | 'energy' | 'stress'>('weather');

  if (collapsed) {
    return null;
  }

  const battHealth = subsystems?.batteryHealthPct ?? 100;
  const copvHealth = subsystems?.copvHealthPct ?? 100;
  const leakRate = subsystems?.leakVentingRateKgS ?? 0;

  return (
    <aside className="env-subsystems-panel">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <CloudRain size={15} />
          <span>ENVIRONMENT & SUBSYSTEMS</span>
          <span className="status-badge-bw">{weather.preset.toUpperCase()}</span>
          <HelpTooltip
            title="Atmosphere & Subsystem Physics"
            explain="Switch between real weather scenarios (Rain, Storm, Fog, Mars) to see dynamic hydroplaning and crosswinds, inspect the 200 kWh battery & 700-bar COPV tanks, and test structural puncture leaks and falling debris!"
          />
        </div>
        <div className="drawer-nav-tabs">
          <button
            type="button"
            className={`tab-btn-bw ${activeTab === 'weather' ? 'active' : ''}`}
            onClick={() => setActiveTab('weather')}
          >
            WEATHER
          </button>
          <button
            type="button"
            className={`tab-btn-bw ${activeTab === 'energy' ? 'active' : ''}`}
            onClick={() => setActiveTab('energy')}
          >
            ENERGY & TANKS
          </button>
          <button
            type="button"
            className={`tab-btn-bw ${activeTab === 'stress' ? 'active' : ''}`}
            onClick={() => setActiveTab('stress')}
          >
            STRESS TEST
          </button>
        </div>
        <button
          type="button"
          className="icon-min-btn"
          onClick={onToggleCollapse}
          title="Minimize Environment Drawer"
        >
          <Minimize2 size={14} />
        </button>
      </div>

      <div className="drawer-body horizontal-drawer-body">
        {activeTab === 'weather' && (
          <div className="hud-card-bw full-width">
            <div className="preset-button-row">
              {(Object.keys(WEATHER_CONFIGS) as WeatherPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`preset-chip-bw ${weather.preset === p ? 'active' : ''}`}
                  onClick={() => onSelectWeatherPreset(p)}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="controls-grid-duo">
              <div className="control-slider-group">
                <div className="control-label-row">
                  <span className="control-name"><Wind size={13} /> WIND SPEED</span>
                  <span className="control-value">{weather.windSpeedMs.toFixed(1)} m/s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="0.5"
                  value={weather.windSpeedMs}
                  onChange={(e) => onUpdateWeatherParams({ windSpeedMs: parseFloat(e.target.value) })}
                  className="hud-slider-bw"
                />
              </div>

              <div className="control-slider-group">
                <div className="control-label-row">
                  <span className="control-name"><CloudRain size={13} /> ROAD WETNESS</span>
                  <span className="control-value">{weather.roadWetnessPct}% (μ = {weather.surfaceFrictionMu.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={weather.roadWetnessPct}
                  onChange={(e) => onUpdateWeatherParams({ roadWetnessPct: parseInt(e.target.value, 10) })}
                  className="hud-slider-bw"
                />
              </div>
            </div>

            <div className="telemetry-bar-row">
              <span className="meta-tag">AIR DENSITY: {weather.airDensityKgM3.toFixed(3)} kg/m³</span>
              <span className="meta-tag">VISIBILITY: {weather.visibilityM.toFixed(0)} m</span>
              <span className="meta-tag">GUST: [{weather.windVector.x.toFixed(1)}, {weather.windVector.z.toFixed(1)}] m/s</span>
            </div>
          </div>
        )}

        {activeTab === 'energy' && (
          <div className="hud-card-bw full-width">
            <div className="subsystem-gauges-grid">
              <div className="gauge-box">
                <div className="gauge-header">
                  <BatteryCharging size={13} />
                  <span>200 KWH BATTERY PACK</span>
                </div>
                <div className="gauge-metrics">
                  <div>SOC: <strong>{energy?.batterySocPct ?? 100}%</strong></div>
                  <div>DRAW: <strong>{energy?.batteryDrawKw ?? 0} kW</strong></div>
                  <div>VOLTS: <strong>{energy?.batteryVoltageV ?? 800} V</strong></div>
                  <div>TEMP: <strong>{energy?.batteryTempC ?? 30}°C</strong></div>
                  <div>HEALTH: <strong>{battHealth}%</strong></div>
                </div>
              </div>

              <div className="gauge-box">
                <div className="gauge-header">
                  <Gauge size={13} />
                  <span>700-BAR COPV TANKS (N2)</span>
                </div>
                <div className="gauge-metrics">
                  <div>PRESSURE: <strong>{energy?.copvPressureBar ?? 700} bar</strong></div>
                  <div>MASS: <strong>{energy?.copvPropellantMassKg ?? 63.5} kg</strong></div>
                  <div>FLOW: <strong>{energy?.copvMassFlowKgS ?? 0} kg/s</strong></div>
                  <div>HEALTH: <strong>{copvHealth}%</strong></div>
                  <div>LEAK: <strong className={leakRate > 0 ? 'text-warn' : ''}>{leakRate.toFixed(2)} kg/s</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="hud-card-bw full-width">
            <div className="stress-actions-row">
              <button
                type="button"
                className="action-btn-danger"
                onClick={onTriggerCopvPuncture}
                title="Punctures COPV tank causing parasitic torque"
              >
                <Flame size={13} />
                PUNCTURE COPV TANK
              </button>
              <button
                type="button"
                className="action-btn-danger"
                onClick={onTriggerBatteryOverload}
                title="Induces battery internal resistance overheat"
              >
                <Zap size={13} />
                BATTERY OVERLOAD
              </button>
              <button
                type="button"
                className="action-btn-danger"
                onClick={onTriggerImpactDetonation}
                title="Simulates 45 kJ impact and spawns falling shrapnel debris"
              >
                <ShieldAlert size={13} />
                DETONATE CRASH IMPACT
              </button>
              <button
                type="button"
                className="action-btn-neutral"
                onClick={onResetSubsystems}
                title="Restores 100% subsystem health"
              >
                <RotateCcw size={13} />
                RESTORE HEALTH
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
