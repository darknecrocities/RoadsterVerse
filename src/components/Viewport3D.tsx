import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  RotateCcw,
  Wind,
  Disc,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import type {
  CameraMode,
  MissionDefinition,
  NeuralNetworkSnapshot,
  RigidBodyState,
  RLHyperparameters,
  ThrusterActivation,
  WheelSpec,
} from '../types/simulation.ts';
import {
  createInitialRoadsterState,
  stepRoadsterPhysics,
} from '../physics/roadsterPhysics.ts';
import {
  createInitialStarshipState,
  stepStarshipPhysics,
} from '../physics/starshipPhysics.ts';
import { evaluateRLPolicy } from '../rl/policyEngine.ts';
import { ProvingGroundSceneController } from '../three/provingGroundScene.ts';
import type { ProceduralSoundEngine } from '../services/soundEngine.ts';
import { AnimatedDecodeText, AnimatedNumber } from './AnimatedText.tsx';

interface Viewport3DProps {
  mission: MissionDefinition;
  hyperparams: RLHyperparameters;
  soundEngine: ProceduralSoundEngine;
  transitionKey: number;
  onTelemetryFrame: (
    state: RigidBodyState,
    thrusters: ThrusterActivation,
    nn: NeuralNetworkSnapshot
  ) => void;
  onEpisodeComplete: (finalState: RigidBodyState, cumulativeReward: number) => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  mission,
  hyperparams,
  soundEngine,
  transitionKey,
  onTelemetryFrame,
  onEpisodeComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ProvingGroundSceneController | null>(null);

  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [wheelSpec, setWheelSpec] = useState<WheelSpec>('six-spoke');
  const [liveState, setLiveState] = useState<RigidBodyState>(() =>
    mission.vehicle === 'roadster'
      ? createInitialRoadsterState(mission.id, hyperparams)
      : createInitialStarshipState(mission.id)
  );

  const missionRef = useRef(mission);
  missionRef.current = mission;
  const paramsRef = useRef(hyperparams);
  paramsRef.current = hyperparams;

  const primaryStateRef = useRef<RigidBodyState>(liveState);
  const ghostStatesRef = useRef<RigidBodyState[]>([]);
  const windGustRef = useRef<number>(0);
  const resetEpisodeTriggerRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new ProvingGroundSceneController(container);
    controllerRef.current = controller;

    const handleResize = () => {
      if (!mountRef.current || !controllerRef.current) return;
      controllerRef.current.resize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const initEpisode = () => {
      const m = missionRef.current;
      const p = paramsRef.current;
      primaryStateRef.current =
        m.vehicle === 'roadster'
          ? createInitialRoadsterState(m.id, p)
          : createInitialStarshipState(m.id);

      const ghostCount = Math.max(0, Math.min(8, p.ghostSwarmCount - 1));
      ghostStatesRef.current = Array.from({ length: ghostCount }, () =>
        m.vehicle === 'roadster'
          ? createInitialRoadsterState(m.id, p)
          : createInitialStarshipState(m.id)
      );
      controller.triggerWarpTransition();
    };

    resetEpisodeTriggerRef.current = initEpisode;
    initEpisode();

    let animId = 0;
    let lastUiSync = 0;

    const tick = (nowMs: number) => {
      animId = requestAnimationFrame(tick);
      const m = missionRef.current;
      const p = paramsRef.current;
      const dt = 0.016 * Math.min(4, p.simulationSpeed);

      windGustRef.current *= 0.93;

      const { thrusters, nnSnapshot } = evaluateRLPolicy(primaryStateRef.current, m.id, p, 0);
      primaryStateRef.current =
        m.vehicle === 'roadster'
          ? stepRoadsterPhysics(
              primaryStateRef.current,
              thrusters,
              m.id,
              p,
              dt,
              windGustRef.current
            )
          : stepStarshipPhysics(
              primaryStateRef.current,
              thrusters,
              m.id,
              p,
              dt,
              windGustRef.current
            );

      const desiredGhosts = Math.max(0, Math.min(8, p.ghostSwarmCount - 1));
      while (ghostStatesRef.current.length < desiredGhosts) {
        ghostStatesRef.current.push(
          m.vehicle === 'roadster'
            ? createInitialRoadsterState(m.id, p)
            : createInitialStarshipState(m.id)
        );
      }
      if (ghostStatesRef.current.length > desiredGhosts) {
        ghostStatesRef.current.length = desiredGhosts;
      }

      for (let i = 0; i < ghostStatesRef.current.length; i++) {
        const gEval = evaluateRLPolicy(ghostStatesRef.current[i], m.id, p, i + 1);
        ghostStatesRef.current[i] =
          m.vehicle === 'roadster'
            ? stepRoadsterPhysics(ghostStatesRef.current[i], gEval.thrusters, m.id, p, dt, 0)
            : stepStarshipPhysics(ghostStatesRef.current[i], gEval.thrusters, m.id, p, dt, 0);
      }

      soundEngine.update(m.vehicle, thrusters);

      controller.renderFrame(
        m.id,
        m.vehicle,
        primaryStateRef.current,
        thrusters,
        ghostStatesRef.current,
        m.targetPosition,
        0.016
      );

      if (primaryStateRef.current.elapsedTimeSec > 14.0 || primaryStateRef.current.crashed) {
        if (primaryStateRef.current.elapsedTimeSec > 2.0) {
          onEpisodeComplete(primaryStateRef.current, nnSnapshot.cumulativeReward);
        }
        initEpisode();
      }

      if (nowMs - lastUiSync > 90) {
        lastUiSync = nowMs;
        setLiveState({ ...primaryStateRef.current });
        onTelemetryFrame(primaryStateRef.current, thrusters, nnSnapshot);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controller.dispose();
    };
  }, [soundEngine, onTelemetryFrame, onEpisodeComplete]);

  useEffect(() => {
    resetEpisodeTriggerRef.current();
  }, [mission.id]);

  const handleCameraChange = (mode: CameraMode) => {
    setCameraMode(mode);
    controllerRef.current?.setCameraMode(mode);
    controllerRef.current?.triggerWarpTransition();
  };

  const handleWheelToggle = () => {
    const nextSpec: WheelSpec = wheelSpec === 'six-spoke' ? 'aero-disc' : 'six-spoke';
    setWheelSpec(nextSpec);
    controllerRef.current?.setWheelSpec(nextSpec);
  };

  const triggerWindGust = () => {
    windGustRef.current = (Math.random() > 0.5 ? 1 : -1) * 9500;
  };

  return (
    <section className="viewport-container" aria-label="3D Physics and Reinforcement Learning Viewport">
      {/* Shutter Wipe Transition on Mission Switch */}
      {transitionKey > 0 && (
        <div key={transitionKey} className="shutter-wipe-overlay">
          RECONFIGURING 6-DoF TELEMETRY // {mission.badge}
        </div>
      )}

      {/* Top Overlay: Monochrome Mission Briefing & Live Telemetry Pill Bar */}
      <div className="hud-overlay-top">
        <div
          style={{
            background: 'rgba(5, 5, 5, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '0.45rem',
            padding: '0.6rem 0.85rem',
            maxWidth: '440px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
            <Sparkles size={14} color="#ffffff" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.09em' }}>
              {mission.badge} • EPOCH <AnimatedNumber value={hyperparams.epochs} />
            </span>
          </div>
          <h2 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff' }}>
            <AnimatedDecodeText text={mission.title} />
          </h2>
          <p style={{ fontSize: '0.73rem', color: '#b3b3b3', marginTop: '0.2rem', lineHeight: 1.35 }}>
            {mission.targetDescription}
          </p>
        </div>

        <div className="telemetry-pill-bar">
          <div className="telemetry-stat">
            <span className="stat-label">Altitude (Y)</span>
            <span className="stat-value">
              <AnimatedNumber value={liveState.position.y} decimals={2} suffix=" m" />
            </span>
          </div>
          <div className="telemetry-stat">
            <span className="stat-label">Pitch / Roll</span>
            <span className="stat-value">
              {((liveState.attitude.pitch * 180) / Math.PI).toFixed(0)}° /{' '}
              {((liveState.attitude.roll * 180) / Math.PI).toFixed(0)}°
            </span>
          </div>
          <div className="telemetry-stat">
            <span className="stat-label">
              {mission.vehicle === 'roadster' ? 'COPV Tank' : 'Header Tank'}
            </span>
            <span className="stat-value">
              <AnimatedNumber value={liveState.copvPressurePsi} decimals={0} suffix=" PSI" />
            </span>
          </div>
          {mission.id === 'roadster-wall-climb' && (
            <div className="telemetry-stat">
              <span className="stat-label">Wall Normal Force</span>
              <span className="stat-value">
                {(liveState.wallContactNormalForceN / 1000).toFixed(1)} kN
              </span>
            </div>
          )}
          <div className="telemetry-stat">
            <span className="stat-label">Peak Load</span>
            <span className="stat-value">{liveState.gForce.toFixed(2)} G</span>
          </div>
          <div className="telemetry-stat">
            <span className="stat-label">Status</span>
            <span
              className="stat-value"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: '#ffffff',
              }}
            >
              {liveState.crashed ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
              {liveState.crashed
                ? 'TUMBLED'
                : liveState.isOnWall
                  ? 'WALL PINNED'
                  : `${liveState.missionProgressPct}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="canvas-mount" />

      {/* Bottom Overlay: Monochrome Camera & Disturbance Controls */}
      <div className="hud-overlay-bottom">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {(
            [
              { id: 'orbit', label: 'Orbit Cam' },
              { id: 'thruster-cam', label: 'Plume / Smoke Cam' },
              { id: 'chase', label: 'Stunt Chase Cam' },
              { id: 'tower-cam', label: 'Paddock Crane / Ramp Cam' },
            ] as { id: CameraMode; label: string }[]
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => handleCameraChange(cam.id)}
              className={`action-btn ${cameraMode === cam.id ? 'primary' : ''}`}
            >
              <Camera size={13} />
              {cam.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {mission.vehicle === 'roadster' && (
            <button
              type="button"
              onClick={handleWheelToggle}
              className="action-btn"
              title="Switch between Image 1 6-Spoke Track Rims and Image 2 Aero-Disc Covers"
            >
              <Disc size={14} />
              Wheels: {wheelSpec === 'six-spoke' ? '6-Spoke Track' : 'Carbon Aero-Disc'}
            </button>
          )}
          <button
            type="button"
            onClick={triggerWindGust}
            className="action-btn"
          >
            <Wind size={14} />
            Inject Lateral Wind Gust
          </button>
          <button
            type="button"
            onClick={() => resetEpisodeTriggerRef.current()}
            className="action-btn primary"
          >
            <RotateCcw size={14} />
            Respawn Vehicle
          </button>
        </div>
      </div>
    </section>
  );
};
