import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Rocket,
  Car,
  BookOpen,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  MissionId,
  NeuralNetworkSnapshot,
  RigidBodyState,
  RLHyperparameters,
  SavedCheckpoint,
} from './types/simulation.ts';
import {
  DEFAULT_HYPERPARAMETERS,
  MISSION_LIST,
  MISSIONS,
} from './rl/missions.ts';
import { createInitialRoadsterState } from './physics/roadsterPhysics.ts';
import {
  evaluateRLPolicy,
  generateEpochLearningCurve,
} from './rl/policyEngine.ts';
import { Viewport3D } from './components/Viewport3D.tsx';
import { RLTrainingControls } from './components/RLTrainingControls.tsx';
import { NeuralTelemetryHUD } from './components/NeuralTelemetryHUD.tsx';
import { KnowledgeAndTriviaModal } from './components/KnowledgeAndTriviaModal.tsx';
import { AnimatedDecodeText } from './components/AnimatedText.tsx';
import { ProceduralSoundEngine } from './services/soundEngine.ts';
import {
  fetchCheckpoints,
  recordSimulationRunApi,
  saveCheckpointApi,
} from './services/apiClient.ts';

export const App: React.FC = () => {
  const [selectedMissionId, setSelectedMissionId] = useState<MissionId>('roadster-hover');
  const [transitionKey, setTransitionKey] = useState<number>(0);
  const [hyperparams, setHyperparams] = useState<RLHyperparameters>(DEFAULT_HYPERPARAMETERS);
  const [isAutoTraining, setIsAutoTraining] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'knowledge' | 'trivia'>('knowledge');
  const [checkpoints, setCheckpoints] = useState<SavedCheckpoint[]>([]);

  const soundEngineRef = useRef<ProceduralSoundEngine>(new ProceduralSoundEngine());

  const currentMission = MISSIONS[selectedMissionId];

  const [telemetryState, setTelemetryState] = useState<RigidBodyState>(() =>
    createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS)
  );
  const [nnSnapshot, setNnSnapshot] = useState<NeuralNetworkSnapshot>(() => {
    const init = createInitialRoadsterState('roadster-hover', DEFAULT_HYPERPARAMETERS);
    return evaluateRLPolicy(init, 'roadster-hover', DEFAULT_HYPERPARAMETERS).nnSnapshot;
  });

  useEffect(() => {
    fetchCheckpoints(selectedMissionId)
      .then((items) => setCheckpoints(items))
      .catch(() => {});
  }, [selectedMissionId]);

  useEffect(() => {
    if (!isAutoTraining) return;
    const interval = setInterval(() => {
      setHyperparams((prev) => {
        if (prev.epochs >= 500) {
          setIsAutoTraining(false);
          return prev;
        }
        const nextEpoch = Math.min(500, prev.epochs + 4);
        const decayedNoise = Math.max(0.02, Number((prev.explorationNoise * 0.96).toFixed(2)));
        return {
          ...prev,
          epochs: nextEpoch,
          explorationNoise: decayedNoise,
        };
      });
    }, 240);
    return () => clearInterval(interval);
  }, [isAutoTraining]);

  const learningCurve = useMemo(
    () => generateEpochLearningCurve(selectedMissionId, hyperparams),
    [selectedMissionId, hyperparams]
  );

  const switchMissionWithTransition = (nextMissionId: MissionId) => {
    if (nextMissionId === selectedMissionId) return;
    setSelectedMissionId(nextMissionId);
    setTransitionKey((k) => k + 1);
  };

  const handleTelemetryFrame = useCallback(
    (state: RigidBodyState, _thrusters: unknown, nn: NeuralNetworkSnapshot) => {
      setTelemetryState(state);
      setNnSnapshot(nn);
    },
    []
  );

  const handleEpisodeComplete = useCallback(
    (finalState: RigidBodyState, cumulativeReward: number) => {
      void recordSimulationRunApi({
        missionId: selectedMissionId,
        vehicle: MISSIONS[selectedMissionId].vehicle,
        epochs: hyperparams.epochs,
        cumulativeReward,
        maxGForce: finalState.gForce,
        peakWallNormalForceN: finalState.wallContactNormalForceN,
        finalCopvPsi: finalState.copvPressurePsi,
        succeeded: !finalState.crashed,
      }).catch(() => {});
    },
    [selectedMissionId, hyperparams.epochs]
  );

  const handleSaveCheckpoint = async (name: string) => {
    const latestPoint = learningCurve[learningCurve.length - 1];
    const saved = await saveCheckpointApi({
      name,
      missionId: selectedMissionId,
      vehicle: currentMission.vehicle,
      epochs: hyperparams.epochs,
      learningRate: hyperparams.learningRate,
      explorationNoise: hyperparams.explorationNoise,
      discountFactor: hyperparams.discountFactor,
      rewardAltitudeWeight: hyperparams.rewardAltitudeWeight,
      rewardAttitudeWeight: hyperparams.rewardAttitudeWeight,
      rewardFuelWeight: hyperparams.rewardFuelWeight,
      rewardSmoothnessWeight: hyperparams.rewardSmoothnessWeight,
      meanReward: latestPoint ? latestPoint.meanReward : nnSnapshot.cumulativeReward,
      stabilityScore: nnSnapshot.stabilityScore,
    });
    setCheckpoints((prev) => [saved, ...prev]);
  };

  const handleLoadCheckpoint = (chk: SavedCheckpoint) => {
    switchMissionWithTransition(chk.missionId);
    setHyperparams((prev) => ({
      ...prev,
      epochs: chk.epochs,
      learningRate: chk.learningRate,
      explorationNoise: chk.explorationNoise,
      discountFactor: chk.discountFactor,
      rewardAltitudeWeight: chk.rewardAltitudeWeight,
      rewardAttitudeWeight: chk.rewardAttitudeWeight,
      rewardFuelWeight: chk.rewardFuelWeight,
      rewardSmoothnessWeight: chk.rewardSmoothnessWeight,
    }));
  };

  const handleSimulateConcept = (missionId: MissionId, epochs: number) => {
    setSelectedMissionId(missionId);
    setTransitionKey((k) => k + 1);
    setHyperparams((prev) => ({
      ...prev,
      epochs,
      explorationNoise: epochs < 50 ? 0.55 : 0.03,
    }));
  };

  const handleSoundToggle = () => {
    const next = soundEngineRef.current.toggle();
    setSoundEnabled(next);
  };

  return (
    <div className="app-shell">
      {/* Top Navigation & Mission Selector Header (Pure Monochrome) */}
      <header className="top-header">
        <div className="brand-block">
          <span className="brand-badge">RL // 6-DoF LAB</span>
          <div>
            <h1 className="brand-title">
              <AnimatedDecodeText text="THRUST // WEIGHT" durationMs={520} />
            </h1>
            <div className="brand-subtitle">
              <AnimatedDecodeText text={currentMission.subtitle} durationMs={380} />
            </div>
          </div>
        </div>

        {/* 5 Interactive Stunt & Rocket Launch Mission Tabs */}
        <nav className="mission-tabs" aria-label="Stunt and Launch Scenarios">
          {MISSION_LIST.map((m) => {
            const isActive = m.id === selectedMissionId;
            const activeClass = isActive
              ? m.vehicle === 'roadster'
                ? 'active-roadster'
                : 'active-starship'
              : '';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMissionWithTransition(m.id)}
                className={`mission-tab ${activeClass}`}
              >
                {m.vehicle === 'roadster' ? <Car size={14} /> : <Rocket size={14} />}
                {m.title.replace(/^(Stunt|Mission) \d+ \/\/ /, '')}
              </button>
            );
          })}
        </nav>

        {/* Knowledge Hub, Trivia & Sound Synthesizer Buttons */}
        <div className="header-actions">
          <button
            type="button"
            onClick={() => {
              setModalTab('knowledge');
              setModalOpen(true);
            }}
            className="action-btn"
          >
            <BookOpen size={14} />
            ML Knowledge Lab
          </button>
          <button
            type="button"
            onClick={() => {
              setModalTab('trivia');
              setModalOpen(true);
            }}
            className="action-btn primary"
          >
            <HelpCircle size={14} />
            Trivia Challenge
          </button>
          <button
            type="button"
            onClick={handleSoundToggle}
            className="action-btn"
            aria-label="Toggle Thruster Audio Synthesizer"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? 'Audio ON' : 'Audio'}
          </button>
        </div>
      </header>

      {/* Main 3-Column Interactive Simulation Workbench */}
      <main className="workspace-grid">
        <RLTrainingControls
          mission={currentMission}
          hyperparams={hyperparams}
          isAutoTraining={isAutoTraining}
          checkpoints={checkpoints}
          stabilityScore={nnSnapshot.stabilityScore}
          meanReward={learningCurve[learningCurve.length - 1]?.meanReward ?? 0}
          onChangeHyperparams={setHyperparams}
          onToggleAutoTrain={() => setIsAutoTraining((v) => !v)}
          onSaveCheckpoint={handleSaveCheckpoint}
          onLoadCheckpoint={handleLoadCheckpoint}
        />

        <Viewport3D
          mission={currentMission}
          hyperparams={hyperparams}
          soundEngine={soundEngineRef.current}
          transitionKey={transitionKey}
          onTelemetryFrame={handleTelemetryFrame}
          onEpisodeComplete={handleEpisodeComplete}
        />

        <NeuralTelemetryHUD
          mission={currentMission}
          state={telemetryState}
          nnSnapshot={nnSnapshot}
          learningCurve={learningCurve}
          currentEpoch={hyperparams.epochs}
        />
      </main>

      <KnowledgeAndTriviaModal
        isOpen={modalOpen}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
        onSimulateConcept={handleSimulateConcept}
      />
    </div>
  );
};
