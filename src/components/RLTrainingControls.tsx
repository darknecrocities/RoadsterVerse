import React, { useState } from 'react';
import {
  Play,
  Pause,
  Zap,
  Sliders,
  Award,
  Save,
  FolderOpen,
  Gauge,
} from 'lucide-react';
import type {
  MissionDefinition,
  RLHyperparameters,
  SavedCheckpoint,
} from '../types/simulation.ts';

interface RLTrainingControlsProps {
  mission: MissionDefinition;
  hyperparams: RLHyperparameters;
  isAutoTraining: boolean;
  checkpoints: SavedCheckpoint[];
  stabilityScore: number;
  meanReward: number;
  onChangeHyperparams: (next: RLHyperparameters) => void;
  onToggleAutoTrain: () => void;
  onSaveCheckpoint: (name: string) => Promise<void>;
  onLoadCheckpoint: (checkpoint: SavedCheckpoint) => void;
}

export const RLTrainingControls: React.FC<RLTrainingControlsProps> = ({
  mission,
  hyperparams,
  isAutoTraining,
  checkpoints,
  stabilityScore,
  meanReward,
  onChangeHyperparams,
  onToggleAutoTrain,
  onSaveCheckpoint,
  onLoadCheckpoint,
}) => {
  const [checkpointName, setCheckpointName] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const updateField = <K extends keyof RLHyperparameters>(
    key: K,
    value: RLHyperparameters[K]
  ) => {
    onChangeHyperparams({
      ...hyperparams,
      [key]: value,
    });
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = checkpointName.trim();
    if (trimmed.length < 2) {
      setSaveStatus('Enter at least 2 characters for checkpoint name.');
      return;
    }
    try {
      setSaveStatus('Saving policy checkpoint...');
      await onSaveCheckpoint(trimmed);
      setCheckpointName('');
      setSaveStatus('Saved to SQLite!');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <aside className="panel-card" aria-label="No-Code Reinforcement Learning Hyperparameter Controls">
      <div className="panel-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={15} />
          RL Policy &amp; Epoch Trainer
        </span>
        <span style={{ fontSize: '0.72rem', color: '#10b981' }}>
          {stabilityScore.toFixed(0)}% Converged
        </span>
      </div>

      {/* Primary Epoch Training Scrubber & Auto-Train Button */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(34, 211, 238, 0.35)',
          borderRadius: '0.6rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
              Training Progress
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              Epoch {hyperparams.epochs}{' '}
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                / 500
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleAutoTrain}
            className="action-btn primary"
            style={{
              background: isAutoTraining
                ? 'linear-gradient(135deg, #e11d48, #f43f5e)'
                : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
            }}
          >
            {isAutoTraining ? <Pause size={14} /> : <Play size={14} />}
            {isAutoTraining ? 'Pause Training' : 'Live Train Epochs'}
          </button>
        </div>

        <input
          type="range"
          min={1}
          max={500}
          step={1}
          value={hyperparams.epochs}
          aria-label="Training Epochs"
          onChange={(e) => updateField('epochs', Number(e.target.value))}
        />

        {/* Quick-Jump Epoch Stage Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
          <button
            type="button"
            className="action-btn"
            style={{ fontSize: '0.68rem', justifyContent: 'center', padding: '0.3rem' }}
            onClick={() =>
              onChangeHyperparams({
                ...hyperparams,
                epochs: 8,
                explorationNoise: 0.75,
              })
            }
          >
            Ep 8: Chaos
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ fontSize: '0.68rem', justifyContent: 'center', padding: '0.3rem' }}
            onClick={() =>
              onChangeHyperparams({
                ...hyperparams,
                epochs: 75,
                explorationNoise: 0.22,
              })
            }
          >
            Ep 75: Learning
          </button>
          <button
            type="button"
            className="action-btn"
            style={{ fontSize: '0.68rem', justifyContent: 'center', padding: '0.3rem' }}
            onClick={() =>
              onChangeHyperparams({
                ...hyperparams,
                epochs: mission.recommendedEpochs,
                explorationNoise: 0.03,
                learningRate: 0.0004,
              })
            }
          >
            Ep {mission.recommendedEpochs}: Pro
          </button>
        </div>
      </div>

      {/* Hyperparameter Sliders */}
      <div className="panel-title" style={{ marginTop: '0.15rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sliders size={14} />
          PPO / SAC Hyperparameters
        </span>
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Learning Rate (α — Step Size)</span>
          <span className="slider-val">{hyperparams.learningRate.toFixed(4)}</span>
        </div>
        <input
          type="range"
          min={0.0001}
          max={0.025}
          step={0.0001}
          value={hyperparams.learningRate}
          aria-label="Learning Rate Alpha"
          onChange={(e) => updateField('learningRate', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Exploration Noise (ε — Valve Entropy)</span>
          <span className="slider-val">{Math.round(hyperparams.explorationNoise * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.95}
          step={0.01}
          value={hyperparams.explorationNoise}
          aria-label="Exploration Noise Epsilon"
          onChange={(e) => updateField('explorationNoise', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Discount Factor (γ — Horizon Foresight)</span>
          <span className="slider-val">{hyperparams.discountFactor.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min={0.8}
          max={0.999}
          step={0.001}
          value={hyperparams.discountFactor}
          aria-label="Discount Factor Gamma"
          onChange={(e) => updateField('discountFactor', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Parallel Ghost Swarm Agents</span>
          <span className="slider-val">{hyperparams.ghostSwarmCount} Vehicles</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={hyperparams.ghostSwarmCount}
          aria-label="Parallel Ghost Swarm Count"
          onChange={(e) => updateField('ghostSwarmCount', Number(e.target.value))}
        />
      </div>

      {/* Reward Function Shaping */}
      <div className="panel-title" style={{ marginTop: '0.15rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Award size={14} />
          Reward Function Shaper
        </span>
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Target Altitude / Wall-Pin Weight</span>
          <span className="slider-val">{hyperparams.rewardAltitudeWeight.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.2}
          max={3.5}
          step={0.1}
          value={hyperparams.rewardAltitudeWeight}
          aria-label="Reward Altitude Weight"
          onChange={(e) => updateField('rewardAltitudeWeight', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Attitude &amp; Roll Stability Bonus</span>
          <span className="slider-val">{hyperparams.rewardAttitudeWeight.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.2}
          max={3.5}
          step={0.1}
          value={hyperparams.rewardAttitudeWeight}
          aria-label="Reward Attitude Weight"
          onChange={(e) => updateField('rewardAttitudeWeight', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Valve Smoothness (Anti-Chatter)</span>
          <span className="slider-val">{hyperparams.rewardSmoothnessWeight.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.0}
          max={3.0}
          step={0.1}
          value={hyperparams.rewardSmoothnessWeight}
          aria-label="Reward Smoothness Weight"
          onChange={(e) => updateField('rewardSmoothnessWeight', Number(e.target.value))}
        />
      </div>

      {/* Physics Environment Sliders */}
      <div className="panel-title" style={{ marginTop: '0.15rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Gauge size={14} />
          Physics &amp; COPV Blowdown
        </span>
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Gravity Environment</span>
          <span className="slider-val">
            {hyperparams.gravityMultiplier.toFixed(2)} G (
            {hyperparams.gravityMultiplier < 0.25
              ? 'Moon'
              : hyperparams.gravityMultiplier < 0.5
                ? 'Mars'
                : hyperparams.gravityMultiplier <= 1.05
                  ? 'Earth'
                  : 'Hyper-G'}
            )
          </span>
        </div>
        <input
          type="range"
          min={0.16}
          max={1.6}
          step={0.02}
          value={hyperparams.gravityMultiplier}
          aria-label="Gravity Multiplier"
          onChange={(e) => updateField('gravityMultiplier', Number(e.target.value))}
        />
      </div>

      <div className="slider-group">
        <div className="slider-header">
          <span>Initial COPV Tank Pressure</span>
          <span className="slider-val">{hyperparams.initialCopvPsi} PSI</span>
        </div>
        <input
          type="range"
          min={4000}
          max={10000}
          step={250}
          value={hyperparams.initialCopvPsi}
          aria-label="Initial COPV Tank Pressure PSI"
          onChange={(e) => updateField('initialCopvPsi', Number(e.target.value))}
        />
      </div>

      {/* Save / Load Policy Checkpoints (SQLite Backend) */}
      <form onSubmit={handleSaveSubmit} style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
        <input
          type="text"
          value={checkpointName}
          onChange={(e) => setCheckpointName(e.target.value)}
          placeholder="Save policy checkpoint..."
          maxLength={60}
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '0.45rem',
            padding: '0.38rem 0.6rem',
            color: '#f8fafc',
            fontSize: '0.75rem',
          }}
        />
        <button type="submit" className="action-btn" title="Save Policy Checkpoint to SQLite">
          <Save size={14} />
          Save
        </button>
      </form>
      {saveStatus && (
        <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
          {saveStatus} (Mean R: {meanReward.toFixed(0)})
        </div>
      )}

      {checkpoints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <FolderOpen size={12} /> Saved SQLite Policy Checkpoints:
          </div>
          <div style={{ maxHeight: '105px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {checkpoints.slice(0, 5).map((chk) => (
              <button
                key={chk.id}
                type="button"
                onClick={() => onLoadCheckpoint(chk)}
                className="action-btn"
                style={{
                  justifyContent: 'space-between',
                  fontSize: '0.7rem',
                  padding: '0.32rem 0.55rem',
                  textAlign: 'left',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chk.name}
                </span>
                <span style={{ color: '#22d3ee', fontFamily: 'monospace', marginLeft: '0.4rem' }}>
                  Ep {chk.epochs}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
