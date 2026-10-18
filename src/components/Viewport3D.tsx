import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Disc,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import type {
  CameraMode,
  MissionDefinition,
  MissionId,
  NeuralNetworkSnapshot,
  RigidBodyState,
  RLHyperparameters,
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
import { soundEngine } from '../services/soundEngine.ts';
import { AnimatedDecodeText, AnimatedNumber } from './AnimatedText.tsx';
import { HelpTooltip } from './HelpTooltip.tsx';

interface Viewport3DProps {
  mission: MissionDefinition;
  params: RLHyperparameters;
  resetSignal: number;
  isPaused: boolean;
  onTogglePause: () => void;
  isFullScreenZen: boolean;
  onToggleFullScreenZen: () => void;
  onTelemetryUpdate: (
    state: RigidBodyState,
    nnSnapshot: NeuralNetworkSnapshot
  ) => void;
  onAutoResetAfterCrash: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  mission,
  params,
  resetSignal,
  isPaused,
  onTogglePause,
  isFullScreenZen,
  onToggleFullScreenZen,
  onTelemetryUpdate,
  onAutoResetAfterCrash,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ProvingGroundSceneController | null>(null);
  const wasCrashedRef = useRef(false);

  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [wheelSpec, setWheelSpec] = useState<WheelSpec>('six-spoke');
  const [audioEnabled, setAudioEnabled] = useState(() => soundEngine.isEnabled());
  const [shutterTransition, setShutterTransition] = useState(false);
  const [statusMinimized, setStatusMinimized] = useState(false);
  const [hudState, setHudState] = useState<RigidBodyState>(() =>
    createInitialRoadsterState('roadster-hover', params)
  );

  const primaryStateRef = useRef<RigidBodyState>(
    createInitialRoadsterState('roadster-hover', params)
  );
  const windImpulseRef = useRef<number>(0);
  const prevMissionRef = useRef<MissionId>(mission.id);
  const crashCooldownRef = useRef<number>(0);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const missionRef = useRef(mission);
  missionRef.current = mission;
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;

  useEffect(() => {
    const m = missionRef.current;
    if (prevMissionRef.current !== m.id) {
      prevMissionRef.current = m.id;
      setShutterTransition(true);
      controllerRef.current?.triggerWarpTransition();
      const t = window.setTimeout(() => setShutterTransition(false), 360);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [mission.id]);

  useEffect(() => {
    return soundEngine.subscribe(setAudioEnabled);
  }, []);

  useEffect(() => {
    const p = paramsRef.current;
    const m = missionRef.current;
    primaryStateRef.current =
      m.vehicle === 'roadster'
        ? createInitialRoadsterState(m.id, p)
        : createInitialStarshipState(m.id);
    crashCooldownRef.current = 0;
    wasCrashedRef.current = false;
  }, [mission.id, resetSignal]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const sceneCtrl = new ProvingGroundSceneController(el);
    controllerRef.current = sceneCtrl;

    const handleResize = () => {
      if (containerRef.current) {
        sceneCtrl.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTime = performance.now();
    let uiSyncCounter = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const activeMission = missionRef.current;
      const activeParams = paramsRef.current;
      const simDt = pausedRef.current ? 0 : rawDt * activeParams.simulationSpeed;

      const { thrusters, nnSnapshot } = evaluateRLPolicy(
        primaryStateRef.current,
        activeMission.id,
        activeParams,
        0
      );

      if (simDt > 0) {
        windImpulseRef.current *= Math.max(0, 1 - 3.5 * simDt);

        if (activeMission.vehicle === 'roadster') {
          primaryStateRef.current = stepRoadsterPhysics(
            primaryStateRef.current,
            thrusters,
            activeMission.id,
            activeParams,
            simDt,
            windImpulseRef.current
          );
        } else {
          primaryStateRef.current = stepStarshipPhysics(
            primaryStateRef.current,
            thrusters,
            activeMission.id,
            activeParams,
            simDt,
            windImpulseRef.current
          );
        }
        soundEngine.update(activeMission.vehicle, thrusters, primaryStateRef.current);
        if (primaryStateRef.current.crashed && !wasCrashedRef.current) {
          soundEngine.triggerCrash(activeMission.vehicle, primaryStateRef.current.crashType);
        }
        wasCrashedRef.current = primaryStateRef.current.crashed;

        const maxMissionTime =
          activeMission.id === 'roadster-obstacle-race' ? 18.0 : 13.5;
        const reachedFinish =
          activeMission.id === 'roadster-obstacle-race' &&
          primaryStateRef.current.position.x >= 1000.0;

        if (
          primaryStateRef.current.crashed ||
          primaryStateRef.current.elapsedTimeSec > maxMissionTime ||
          reachedFinish
        ) {
          crashCooldownRef.current += rawDt;
          const waitTime = reachedFinish ? 2.8 : 1.75;
          if (crashCooldownRef.current > waitTime) {
            crashCooldownRef.current = 0;
            onAutoResetAfterCrash();
          }
        }
      }

      sceneCtrl.renderFrame(
        activeMission.id,
        activeMission.vehicle,
        primaryStateRef.current,
        thrusters,
        activeMission.targetPosition,
        rawDt
      );

      uiSyncCounter++;
      if (uiSyncCounter % 6 === 0) {
        const s = primaryStateRef.current;
        setHudState({ ...s });
        onTelemetryUpdate(s, nnSnapshot);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      sceneCtrl.dispose();
    };
  }, []);

  const handleCameraChange = (mode: CameraMode) => {
    setCameraMode(mode);
    controllerRef.current?.setCameraMode(mode);
  };

  const handleToggleWheel = () => {
    const next: WheelSpec = wheelSpec === 'six-spoke' ? 'aero-disc' : 'six-spoke';
    setWheelSpec(next);
    controllerRef.current?.setWheelSpec(next);
  };

  const handleWindGust = () => {
    windImpulseRef.current = (Math.random() > 0.5 ? 1 : -1) * 16500;
  };

  const handleToggleAudio = () => {
    soundEngine.toggle();
  };

  return (
    <main className="viewport-fullscreen">
      <div ref={containerRef} className="webgl-canvas-container" />
      <div className={`shutter-wipe-overlay ${shutterTransition ? 'active' : ''}`} />

      {/* Minimalist Top-Center Glassmorphic Stunt Status Card (Minimizable) */}
      <div className={`stunt-status-float ${statusMinimized ? 'minimized' : ''}`}>
        <div className="stunt-status-top">
          <span className="stunt-badge-bw">
            <AnimatedDecodeText text={mission.badge} durationMs={320} />
          </span>
          <strong className="stunt-title-bw">
            <AnimatedDecodeText text={mission.title} durationMs={400} />
          </strong>
          <HelpTooltip
            title={mission.title}
            explain={mission.targetDescription}
            tip="Use the Practice Runs slider on the left to watch the AI improve!"
          />
          <button
            type="button"
            className="icon-min-btn"
            onClick={() => setStatusMinimized((v) => !v)}
            title={statusMinimized ? 'Expand Stunt Telemetry' : 'Minimize Stunt Telemetry'}
          >
            {statusMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>

        {!statusMinimized && (
          <div className="stunt-metrics-strip">
            {mission.id === 'roadster-obstacle-race' ? (
              <>
                <div className="metric-mini">
                  <span>10KM RUNWAY</span>
                  <strong>
                    <AnimatedNumber
                      value={(Math.min(1000, Math.max(0, hudState.position.x)) / 1000) * 10.0}
                      decimals={2}
                      suffix=" km"
                    />
                  </strong>
                </div>
                <div className="metric-mini">
                  <span>SPEED</span>
                  <strong>
                    <AnimatedNumber
                      value={
                        Math.sqrt(
                          hudState.velocity.x ** 2 +
                            hudState.velocity.y ** 2 +
                            hudState.velocity.z ** 2
                        ) * 3.6
                      }
                      decimals={0}
                      suffix=" km/h"
                    />
                  </strong>
                </div>
              </>
            ) : mission.id === 'starship-pod-orbit' ? (
              <>
                <div className="metric-mini">
                  <span>ORBIT ALT</span>
                  <strong>
                    <AnimatedNumber value={hudState.position.y} decimals={1} suffix=" km" />
                  </strong>
                </div>
                <div className="metric-mini">
                  <span>SOLAR WINGS</span>
                  <strong>{Math.round(hudState.solarArrayDeployPct ?? 0)}%</strong>
                </div>
              </>
            ) : (
              <>
                <div className="metric-mini">
                  <span>HEIGHT</span>
                  <strong>
                    <AnimatedNumber value={hudState.position.y} decimals={1} suffix=" m" />
                  </strong>
                </div>
                <div className="metric-mini">
                  <span>TILT / FLIP</span>
                  <strong>
                    {Math.round((hudState.attitude.pitch * 180) / Math.PI)}° /{' '}
                    {Math.round((hudState.attitude.roll * 180) / Math.PI)}°
                  </strong>
                </div>
              </>
            )}
            <div className="metric-mini">
              <span>{mission.vehicle === 'roadster' ? 'AIR TANK' : mission.vehicle === 'orbital-pod' ? 'RCS N2' : 'FUEL'}</span>
              <strong>
                {mission.vehicle === 'roadster' || mission.vehicle === 'orbital-pod' ? (
                  <AnimatedNumber value={hudState.copvPressurePsi} decimals={0} suffix=" PSI" />
                ) : (
                  `${hudState.propellantRemainingPct}%`
                )}
              </strong>
            </div>
            <div className="metric-mini">
              <span>STATUS</span>
              <strong className={hudState.crashed ? 'status-crash' : 'status-ok'}>
                {isPaused
                  ? 'PAUSED'
                  : hudState.crashed
                    ? hudState.crashReason || 'EXPLODED!'
                    : mission.id === 'starship-pod-orbit'
                      ? (hudState.solarArrayDeployPct ?? 0) >= 100
                        ? 'SATELLITE MORPH COMPLETE'
                        : 'MICRO-G ATTITUDE HOLD'
                      : hudState.position.x >= 995.0 && mission.id === 'roadster-obstacle-race'
                        ? '10KM CLEARED!'
                        : mission.id === 'starship-booster-catch' && hudState.isGrounded
                          ? 'BOOSTER CAUGHT IN MID-AIR!'
                          : hudState.isOnWall || hudState.isGrounded
                            ? 'ON RAMP / ROAD'
                            : 'MID-AIR JETS'}
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Minimalist Bottom Control Dock */}
      <div className="bottom-dock-bw">
        <div className="dock-group">
          {(['orbit', 'chase', 'thruster-cam', 'tower-cam'] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`dock-btn-bw ${cameraMode === mode ? 'active' : ''}`}
              onClick={() => handleCameraChange(mode)}
            >
              <Camera size={13} />
              <span>
                {mode === 'orbit'
                  ? 'Orbit'
                  : mode === 'chase'
                    ? 'Follow'
                    : mode === 'thruster-cam'
                      ? 'Jet Cam'
                      : 'Wide'}
              </span>
            </button>
          ))}
        </div>

        <div className="dock-group">
          {mission.vehicle === 'roadster' && (
            <button type="button" className="dock-btn-bw" onClick={handleToggleWheel}>
              <Disc size={13} />
              <span>{wheelSpec === 'six-spoke' ? '6-Spoke Rims' : 'Carbon Discs'}</span>
            </button>
          )}

          <button type="button" className="dock-btn-bw" onClick={handleWindGust}>
            <Wind size={13} />
            <span>Push With Wind</span>
            <HelpTooltip
              title="Push With Wind Gust"
              explain="Blasts the vehicle sideways with a strong gust of wind so you can see if the AI is smart enough to catch itself!"
            />
          </button>

          <button type="button" className="dock-btn-bw" onClick={handleToggleAudio}>
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{audioEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            className={`dock-btn-bw ${isPaused ? 'active' : ''}`}
            onClick={onTogglePause}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            type="button"
            className="dock-btn-bw"
            onClick={onAutoResetAfterCrash}
            title="Restart Stunt"
          >
            <RotateCcw size={13} />
            <span>Restart</span>
          </button>

          <button
            type="button"
            className={`dock-btn-bw ${isFullScreenZen ? 'active' : ''}`}
            onClick={onToggleFullScreenZen}
            title="Toggle Full-Screen Zen Mode (Hide Side Panels)"
          >
            {isFullScreenZen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullScreenZen ? 'Show Panels' : 'Full Screen'}</span>
          </button>
        </div>
      </div>
    </main>
  );
};
