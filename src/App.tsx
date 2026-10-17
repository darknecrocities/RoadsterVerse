import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Car,
  Home,
  Maximize2,
  Minimize2,
  Rocket,
  RotateCcw,
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
import { generateEpochLearningCurve } from './rl/policyEngine.ts';
import {
  fetchCheckpoints,
  saveCheckpointApi,
} from './services/apiClient.ts';
import { Viewport3D } from './components/Viewport3D.tsx';
import { RLTrainingControls } from './components/RLTrainingControls.tsx';
import { NeuralTelemetryHUD } from './components/NeuralTelemetryHUD.tsx';
import { KnowledgeAndTriviaModal } from './components/KnowledgeAndTriviaModal.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';

export const App: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [missionId, setMissionId] = useState<MissionId>('roadster-wall-climb');
  const [params, setParams] = useState<RLHyperparameters>(DEFAULT_HYPERPARAMETERS);
  const [resetSignal, setResetSignal] = useState(0);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const [checkpoints, setCheckpoints] = useState<SavedCheckpoint[]>([]);

  const [nnSnapshot, setNnSnapshot] = useState<NeuralNetworkSnapshot>({
    inputs: [
      { label: 'Height', value: 0.1 },
      { label: 'Speed Y', value: 0.05 },
      { label: 'Roll', value: 0.02 },
      { label: 'Pitch', value: -0.04 },
      { label: 'Spin', value: 0.01 },
      { label: 'Air PSI', value: 0.9 },
    ],
    hiddenLayer1: [0.5, -0.3, 0.7, 0.2, -0.6, 0.4, 0.8, -0.2],
    hiddenLayer2: [0.6, 0.4, -0.5, 0.7, 0.3, -0.4],
    outputs: [
      { label: 'FL Jet', value: 0.55 },
      { label: 'FR Jet', value: 0.55 },
      { label: 'RL Jet', value: 0.56 },
      { label: 'RR Jet', value: 0.56 },
      { label: 'Loop Jet', value: 0.12 },
      { label: 'Rear Jet', value: 0.1 },
    ],
    instantReward: 1.8,
    cumulativeReward: 145,
    policyEntropy: 0.12,
    stabilityScore: 88,
  });

  const activeMission = MISSIONS[missionId];
  const isFullScreenZen = leftCollapsed && rightCollapsed;

  const rewardHistory = useMemo(
    () => generateEpochLearningCurve(missionId, params),
    [missionId, params]
  );

  useEffect(() => {
    void fetchCheckpoints().then(setCheckpoints).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAutoTraining) return;
    const timer = window.setInterval(() => {
      setParams((prev) => {
        if (prev.epochs >= 500) {
          setIsAutoTraining(false);
          return prev;
        }
        const nextEpochs = Math.min(500, prev.epochs + 6);
        const cooledNoise = Math.max(0.02, Number((0.45 * Math.exp(-nextEpochs / 110)).toFixed(2)));
        return { ...prev, epochs: nextEpochs, explorationNoise: cooledNoise };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [isAutoTraining]);

  const handleChangeParams = useCallback((patch: Partial<RLHyperparameters>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectMission = (nextId: MissionId) => {
    const target = MISSIONS[nextId];
    setMissionId(nextId);
    setParams((prev) => ({
      ...prev,
      epochs: target.recommendedEpochs,
      explorationNoise: 0.04,
    }));
    setResetSignal((n) => n + 1);
  };

  const handleApplyPreset = (preset: 'untrained' | 'mid' | 'converged') => {
    if (preset === 'untrained') {
      setParams((prev) => ({ ...prev, epochs: 8, explorationNoise: 0.65 }));
    } else if (preset === 'mid') {
      setParams((prev) => ({ ...prev, epochs: 75, explorationNoise: 0.22 }));
    } else {
      setParams((prev) => ({
        ...prev,
        epochs: activeMission.recommendedEpochs,
        explorationNoise: 0.03,
      }));
    }
    setResetSignal((n) => n + 1);
  };

  const handleTelemetryUpdate = useCallback(
    (_state: RigidBodyState, nextNn: NeuralNetworkSnapshot) => {
      setNnSnapshot(nextNn);
    },
    []
  );

  const handleSaveCheckpoint = async (name: string) => {
    try {
      const created = await saveCheckpointApi({
        name,
        vehicle: activeMission.vehicle,
        missionId: activeMission.id,
        epochs: params.epochs,
        learningRate: params.learningRate,
        explorationNoise: params.explorationNoise,
        discountFactor: params.discountFactor,
        rewardAltitudeWeight: params.rewardAltitudeWeight,
        rewardAttitudeWeight: params.rewardAttitudeWeight,
        rewardFuelWeight: params.rewardFuelWeight,
        rewardSmoothnessWeight: params.rewardSmoothnessWeight,
        meanReward: nnSnapshot.cumulativeReward,
        stabilityScore: nnSnapshot.stabilityScore,
      });
      if (created) {
        const updated = await fetchCheckpoints();
        setCheckpoints(updated);
      }
    } catch {
      // Offline fallback ignored
    }
  };

  const handleLoadCheckpoint = (ckpt: SavedCheckpoint) => {
    setMissionId(ckpt.missionId);
    setParams((prev) => ({
      ...prev,
      epochs: ckpt.epochs,
      learningRate: ckpt.learningRate,
      explorationNoise: ckpt.explorationNoise,
      discountFactor: ckpt.discountFactor,
      rewardAltitudeWeight: ckpt.rewardAltitudeWeight,
      rewardAttitudeWeight: ckpt.rewardAttitudeWeight,
      rewardFuelWeight: ckpt.rewardFuelWeight,
      rewardSmoothnessWeight: ckpt.rewardSmoothnessWeight,
    }));
    setResetSignal((n) => n + 1);
  };

  const handleToggleFullScreenZen = () => {
    if (isFullScreenZen) {
      setLeftCollapsed(false);
      setRightCollapsed(false);
    } else {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  };

  if (showWelcome) {
    return (
      <WelcomeScreen
        selectedMissionId={missionId}
        onSelectMissionAndEnter={(mId) => {
          handleSelectMission(mId);
          setShowWelcome(false);
        }}
        onEnterPlayground={() => setShowWelcome(false)}
      />
    );
  }

  return (
    <div className="app-fullscreen-root">
      {/* Minimalist Top Bar */}
      <header className="top-minimal-bar">
        <div className="top-left-group">
          <button
            type="button"
            className="nav-pill-btn"
            onClick={() => setShowWelcome(true)}
            title="Back to RoadsterVerse Landing Page"
          >
            <Home size={14} />
            <span>HOME</span>
          </button>
          <span className="brand-mini-title">ROADSTERVERSE</span>
        </div>

        {/* 6 Stunt Selector Pills */}
        <nav className="stunt-pill-strip" aria-label="Stunt Selector">
          {MISSION_LIST.map((m) => {
            const active = m.id === missionId;
            const shortLabel =
              m.id === 'roadster-hover'
                ? '01 Hover'
                : m.id === 'roadster-wall-climb'
                  ? '02 Half-Loop'
                  : m.id === 'roadster-barrel-roll'
                    ? '03 Kickflip'
                    : m.id === 'starship-launch'
                      ? '04 Stage Release'
                      : m.id === 'starship-belly-flop'
                        ? '05 Crane Catch'
                        : '06 Booster Catch';
            return (
              <button
                key={m.id}
                type="button"
                className={`stunt-pill-btn ${active ? 'active' : ''}`}
                onClick={() => handleSelectMission(m.id)}
              >
                {m.vehicle === 'roadster' ? <Car size={13} /> : <Rocket size={13} />}
                <span>{shortLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="top-right-group">
          <button
            type="button"
            className="nav-pill-btn"
            onClick={() => setResetSignal((n) => n + 1)}
            title="Restart Stunt"
          >
            <RotateCcw size={13} />
            <span>Restart</span>
          </button>

          <button
            type="button"
            className="nav-pill-btn"
            onClick={handleToggleFullScreenZen}
            title="Hide or Show Side Panels"
          >
            {isFullScreenZen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullScreenZen ? 'Show UI' : 'Full Screen'}</span>
          </button>

          <button
            type="button"
            className="nav-pill-btn primary"
            onClick={() => setIsKnowledgeModalOpen(true)}
          >
            <BookOpen size={13} />
            <span>Kid Guide & Quiz</span>
          </button>
        </div>
      </header>

      {/* Full-Screen 3D Playground */}
      <Viewport3D
        mission={activeMission}
        params={params}
        resetSignal={resetSignal}
        isFullScreenZen={isFullScreenZen}
        onToggleFullScreenZen={handleToggleFullScreenZen}
        onTelemetryUpdate={handleTelemetryUpdate}
        onAutoResetAfterCrash={() => setResetSignal((n) => n + 1)}
      />

      {/* Collapsible Floating Left Drawer (AI Controls) */}
      <RLTrainingControls
        mission={activeMission}
        params={params}
        stabilityScore={nnSnapshot.stabilityScore}
        isAutoTraining={isAutoTraining}
        collapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed((c) => !c)}
        onChangeParams={handleChangeParams}
        onToggleAutoTrain={() => setIsAutoTraining((a) => !a)}
        onApplyPreset={handleApplyPreset}
        checkpoints={checkpoints}
        onSaveCheckpoint={handleSaveCheckpoint}
        onLoadCheckpoint={handleLoadCheckpoint}
      />

      {/* Collapsible Floating Right Drawer (Inside the AI Brain) */}
      <NeuralTelemetryHUD
        mission={activeMission}
        nnSnapshot={nnSnapshot}
        epoch={params.epochs}
        rewardHistory={rewardHistory}
        collapsed={rightCollapsed}
        onToggleCollapse={() => setRightCollapsed((c) => !c)}
      />

      {/* Kid-Friendly Guide & Quiz Modal */}
      <KnowledgeAndTriviaModal
        isOpen={isKnowledgeModalOpen}
        initialTab="knowledge"
        onClose={() => setIsKnowledgeModalOpen(false)}
        onSimulateConcept={(targetMissionId, demoEpochs) => {
          setMissionId(targetMissionId);
          setParams((prev) => ({
            ...prev,
            epochs: demoEpochs,
            explorationNoise: 0.03,
          }));
          setResetSignal((n) => n + 1);
        }}
      />
    </div>
  );
};
