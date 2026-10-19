import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Cpu,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
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
import { generateEpochLearningCurve } from './rl/policyEngine.ts';
import {
  fetchCheckpoints,
  saveCheckpointApi,
} from './services/apiClient.ts';
import { soundEngine } from './services/soundEngine.ts';
import { Viewport3D } from './components/Viewport3D.tsx';
import { RLTrainingControls } from './components/RLTrainingControls.tsx';
import { NeuralTelemetryHUD } from './components/NeuralTelemetryHUD.tsx';
import {
  NeuralNetworkModal,
  type SelectedBrainNode,
} from './components/NeuralNetworkModal.tsx';
import { KnowledgeAndTriviaModal } from './components/KnowledgeAndTriviaModal.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { MobileGateFallback } from './components/MobileGateFallback.tsx';

const checkIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isTouchMobileUserAgent = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const isNarrowScreen = window.innerWidth < 768;
  return isTouchMobileUserAgent || isNarrowScreen;
};

export const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobile());
  const [showWelcome, setShowWelcome] = useState(true);
  const [missionId, setMissionId] = useState<MissionId>('starship-booster-catch');
  const [isMissionMenuOpen, setIsMissionMenuOpen] = useState(false);
  const [params, setParams] = useState<RLHyperparameters>(DEFAULT_HYPERPARAMETERS);
  const [resetSignal, setResetSignal] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [selectedBrainNode, setSelectedBrainNode] = useState<SelectedBrainNode | undefined>(
    undefined
  );
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => soundEngine.isEnabled());

  useEffect(() => {
    return soundEngine.subscribe(setAudioEnabled);
  }, []);

  const handleToggleAudio = useCallback(() => {
    soundEngine.toggle();
  }, []);

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

  // Spacebar Pause / Resume keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showWelcome || isKnowledgeModalOpen || isBrainModalOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showWelcome, isKnowledgeModalOpen, isBrainModalOpen]);

  useEffect(() => {
    if (!isAutoTraining || isPaused) return;
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
  }, [isAutoTraining, isPaused]);

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
    setIsPaused(false);
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
    setIsPaused(false);
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
    setIsPaused(false);
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

  const handleOpenFullBrain = (node?: SelectedBrainNode) => {
    setSelectedBrainNode(node);
    setIsBrainModalOpen(true);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return <MobileGateFallback />;
  }

  if (showWelcome) {
    return (
      <WelcomeScreen
        selectedMissionId={missionId}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
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
      {/* Frameless SpaceX Top Navigation Bar */}
      <header className="sx-frameless-navbar in-app">
        <div className="sx-nav-left">
          <button
            type="button"
            className="sx-wordmark-btn"
            onClick={() => setShowWelcome(true)}
            title="Return to SpaceX-Style RoadsterVerse Landing Page"
          >
            <img src="/favicon.svg" alt="RoadsterVerse Logo" className="sx-wordmark-icon" />
            <span className="sx-wordmark-text">ROADSTERVERSE</span>
          </button>

          {/* Decluttered In-App Compact Mission Switcher Pill */}
          <div className="sx-inapp-mission-selector">
            <button
              type="button"
              className="sx-inapp-mission-pill"
              onClick={() => setIsMissionMenuOpen((o) => !o)}
              title="Switch Active Mission"
            >
              <span className="sx-mission-badge">{activeMission.badge}</span>
              <span className="sx-mission-title">
                {activeMission.title.replace(/^Stunt \d+ \/\/ |^Mission \d+ \/\/ /, '')}
              </span>
              <ChevronDown
                size={13}
                className={`sx-dropdown-icon ${isMissionMenuOpen ? 'open' : ''}`}
              />
            </button>

            {isMissionMenuOpen && (
              <div className="sx-inapp-mission-menu">
                {MISSION_LIST.map((m) => {
                  const active = m.id === missionId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`sx-inapp-menu-item ${active ? 'active' : ''}`}
                      onClick={() => {
                        handleSelectMission(m.id);
                        setIsMissionMenuOpen(false);
                      }}
                    >
                      <span className="badge">{m.badge}</span>
                      <span className="title">
                        {m.title.replace(/^Stunt \d+ \/\/ |^Mission \d+ \/\/ /, '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Rectangular SpaceX Action Controls */}
        <div className="sx-nav-right">
          <button
            type="button"
            className={`sx-action-btn ${audioEnabled ? 'active' : ''}`}
            onClick={handleToggleAudio}
            title={audioEnabled ? 'Mute Simulation Sound' : 'Turn On Simulation Sound'}
          >
            {audioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            <span>{audioEnabled ? 'SOUND ON' : 'MUTED'}</span>
          </button>

          <button
            type="button"
            className={`sx-action-btn ${isPaused ? 'active' : ''}`}
            onClick={() => setIsPaused((p) => !p)}
            title="Pause or Resume 6-DoF Simulation (Spacebar)"
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            type="button"
            className="sx-action-btn"
            onClick={() => {
              setIsPaused(false);
              setResetSignal((n) => n + 1);
            }}
            title="Restart Stunt"
          >
            <RotateCcw size={12} />
            <span>RESTART</span>
          </button>

          <button
            type="button"
            className="sx-action-btn"
            onClick={() => handleOpenFullBrain()}
            title="Open Full Neural Network & Epoch Node Previewer"
          >
            <Cpu size={12} />
            <span>BRAIN NET</span>
          </button>

          <button
            type="button"
            className="sx-action-btn"
            onClick={handleToggleFullScreenZen}
            title="Hide or Show Side Panels"
          >
            {isFullScreenZen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{isFullScreenZen ? 'SHOW HUD' : 'FULL SCREEN'}</span>
          </button>

          <button
            type="button"
            className="sx-action-btn primary"
            onClick={() => setIsKnowledgeModalOpen(true)}
          >
            <BookOpen size={12} />
            <span>KID GUIDE</span>
          </button>
        </div>
      </header>

      {/* Full-Screen 3D Playground */}
      <Viewport3D
        mission={activeMission}
        params={params}
        resetSignal={resetSignal}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
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
        onOpenFullBrain={handleOpenFullBrain}
      />

      {/* Interactive Full Neural Network & Epoch Failure/Success Node Previewer */}
      <NeuralNetworkModal
        isOpen={isBrainModalOpen}
        mission={activeMission}
        params={params}
        liveSnapshot={nnSnapshot}
        initialSelectedNode={selectedBrainNode}
        onClose={() => setIsBrainModalOpen(false)}
        onApplyEpochToSimulator={(targetEpoch) => {
          setParams((prev) => ({
            ...prev,
            epochs: targetEpoch,
            explorationNoise:
              targetEpoch < 25 ? 0.58 : targetEpoch < 90 ? 0.24 : 0.03,
          }));
          setIsPaused(false);
          setResetSignal((n) => n + 1);
        }}
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
          setIsPaused(false);
          setResetSignal((n) => n + 1);
        }}
      />
    </div>
  );
};
