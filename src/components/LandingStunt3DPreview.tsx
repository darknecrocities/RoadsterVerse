import React, { useEffect, useRef, useState } from 'react';
import type {
  MissionId,
  RigidBodyState,
  RLHyperparameters,
} from '../types/simulation.ts';
import { DEFAULT_HYPERPARAMETERS, MISSIONS } from '../rl/missions.ts';
import { evaluateRLPolicy } from '../rl/policyEngine.ts';
import {
  createInitialRoadsterState,
  stepRoadsterPhysics,
} from '../physics/roadsterPhysics.ts';
import {
  createInitialStarshipState,
  stepStarshipPhysics,
} from '../physics/starshipPhysics.ts';
import { ProvingGroundSceneController } from '../three/provingGroundScene.ts';
import { soundEngine } from '../services/soundEngine.ts';

interface LandingStunt3DPreviewProps {
  missionId: MissionId;
  isUntrainedMode: boolean;
}

export const LandingStunt3DPreview: React.FC<LandingStunt3DPreviewProps> = ({
  missionId,
  isUntrainedMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ProvingGroundSceneController | null>(null);
  const stateRef = useRef<RigidBodyState | null>(null);
  const cooldownRef = useRef(0);
  const wasCrashedRef = useRef(false);

  const missionRef = useRef(missionId);
  missionRef.current = missionId;
  const untrainedRef = useRef(isUntrainedMode);
  untrainedRef.current = isUntrainedMode;

  const [telemetry, setTelemetry] = useState<{
    speedMps: number;
    altitudeM: number;
    pitchDeg: number;
    crashed: boolean;
    crashReason?: string;
    epochs: number;
  }>({
    speedMps: 0,
    altitudeM: 0,
    pitchDeg: 0,
    crashed: false,
    crashReason: undefined,
    epochs: 360,
  });

  const getPreviewParams = (mId: MissionId, untrained: boolean): RLHyperparameters => {
    const targetMission = MISSIONS[mId];
    if (untrained) {
      return {
        ...DEFAULT_HYPERPARAMETERS,
        epochs: 8,
        explorationNoise: 0.65,
        learningRate: 0.006,
        rewardAltitudeWeight: 0.8,
        rewardAttitudeWeight: 0.8,
      };
    }
    return {
      ...DEFAULT_HYPERPARAMETERS,
      epochs: targetMission.recommendedEpochs,
      explorationNoise: 0.02,
      learningRate: 0.0005,
      rewardAltitudeWeight: targetMission.vehicle === 'starship' ? 2.5 : 2.0,
      rewardAttitudeWeight: 2.4,
    };
  };

  const resetSimulation = () => {
    const mId = missionRef.current;
    const isUntrained = untrainedRef.current;
    const m = MISSIONS[mId];
    const previewParams = getPreviewParams(mId, isUntrained);

    if (m.vehicle === 'roadster') {
      stateRef.current = createInitialRoadsterState(mId, previewParams);
    } else {
      stateRef.current = createInitialStarshipState(mId);
    }
    cooldownRef.current = 0;
    wasCrashedRef.current = false;
  };

  useEffect(() => {
    resetSimulation();
  }, [missionId, isUntrainedMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const sceneCtrl = new ProvingGroundSceneController(el);
    controllerRef.current = sceneCtrl;
    resetSimulation();

    const handleResize = () => {
      if (containerRef.current) {
        sceneCtrl.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let lastTime = performance.now();
    let uiSyncCount = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.045, (now - lastTime) / 1000);
      lastTime = now;

      const mId = missionRef.current;
      const isUntrained = untrainedRef.current;
      const m = MISSIONS[mId];
      const previewParams = getPreviewParams(mId, isUntrained);

      if (!stateRef.current) {
        resetSimulation();
      }
      let curState = stateRef.current;
      if (!curState) return;

      const { thrusters } = evaluateRLPolicy(curState, mId, previewParams, 0);

      if (m.vehicle === 'roadster') {
        curState = stepRoadsterPhysics(curState, thrusters, mId, previewParams, dt);
      } else {
        curState = stepStarshipPhysics(curState, thrusters, mId, previewParams, dt);
      }
      stateRef.current = curState;

      // Render 3D frame via Three.js controller
      sceneCtrl.renderFrame(
        mId,
        m.vehicle,
        curState,
        thrusters,
        m.targetPosition,
        dt
      );

      // Synchronize vehicle audio & crash sounds
      soundEngine.update(m.vehicle, thrusters, curState);
      if (curState.crashed && !wasCrashedRef.current) {
        soundEngine.triggerCrash(m.vehicle, curState.crashType);
      }
      wasCrashedRef.current = curState.crashed;

      // Reset cycle condition for continuous dynamic stunt playback
      const maxDurationSec =
        mId === 'starship-booster-catch'
          ? 14.0
          : mId === 'roadster-obstacle-race'
            ? 18.0
            : mId === 'starship-pod-orbit'
              ? 16.0
              : 10.0;
      const reachedObstacleFinish =
        mId === 'roadster-obstacle-race' && curState.position.x >= 1000.0;
      const isBoosterCaught =
        mId === 'starship-booster-catch' && curState.isGrounded && !curState.crashed;
      const isSatelliteMorphed =
        mId === 'starship-pod-orbit' && (curState.solarArrayDeployPct ?? 0) >= 100;

      if (
        curState.crashed ||
        curState.elapsedTimeSec > maxDurationSec ||
        reachedObstacleFinish ||
        isBoosterCaught ||
        isSatelliteMorphed
      ) {
        cooldownRef.current += dt;
        const waitTime = curState.crashed
          ? 1.4
          : isBoosterCaught || isSatelliteMorphed
            ? 3.2
            : reachedObstacleFinish
              ? 2.5
              : 0.8;
        if (cooldownRef.current > waitTime) {
          resetSimulation();
        }
      }

      uiSyncCount++;
      if (uiSyncCount % 6 === 0) {
        const vel = curState.velocity;
        const spd = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        setTelemetry({
          speedMps: spd,
          altitudeM: Math.max(0, curState.position.y),
          pitchDeg: (curState.attitude.pitch * 180) / Math.PI,
          crashed: curState.crashed,
          crashReason: curState.crashReason,
          epochs: previewParams.epochs,
        });
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      sceneCtrl.dispose();
    };
  }, []);

  return (
    <div className="landing-stunt-3d-root">
      {/* 3D WebGL Canvas Layer */}
      <div ref={containerRef} className="landing-stunt-3d-viewport" />

      {/* Atmospheric Vignette & Contrast Gradients */}
      <div className="landing-stunt-vignette" />

      {/* Physics & Neural Network Verification Badge */}
      <div className="landing-stunt-telemetry-pill">
        <div className="pill-status-dot" data-crashed={telemetry.crashed} />
        <span className="pill-mono-label">
          {telemetry.crashed
            ? telemetry.crashReason || '6-DOF FLIGHT FAILURE // CRASH DETECTED'
            : isUntrainedMode
              ? `UNTRAINED RL POLICY // EPOCH #${telemetry.epochs}`
              : `CALIBRATED 6-DOF RL // EPOCH #${telemetry.epochs} OPTIMAL`}
        </span>
        <span className="pill-metric">
          ALT: {telemetry.altitudeM.toFixed(1)}m | VEL: {(telemetry.speedMps * 3.6).toFixed(0)} km/h
        </span>
      </div>
    </div>
  );
};
