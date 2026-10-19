import React from 'react';
import type { CrashFailureRecord, MissionId, RLHyperparameters } from '../types/simulation.ts';
import { MISSIONS } from '../rl/missions.ts';

interface CrashTelemetryCardProps {
  record: CrashFailureRecord;
  missionId: MissionId;
  params: RLHyperparameters;
  onReset: () => void;
  onAutoTuneAndStep: () => void;
  onClose: () => void;
}

export const CrashTelemetryCard: React.FC<CrashTelemetryCardProps> = ({
  record,
  missionId,
  params,
  onReset,
  onAutoTuneAndStep,
  onClose,
}) => {
  const mission = MISSIONS[missionId];

  return (
    <div className="crash-modal-backdrop" onClick={onClose}>
      <div
        className="crash-glass-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="crash-title"
        aria-modal="true"
      >
        <div className="crash-card-header">
          <div className="crash-card-title-col">
            <div className="crash-badge-row">
              <span className="crash-code-pill">{record.code}</span>
              <span className="crash-cat-pill">{record.category.toUpperCase()} FAILURE</span>
              <span className="crash-stunt-pill">{mission?.badge || missionId.toUpperCase()}</span>
            </div>
            <h2 id="crash-title" className="crash-headline">
              {record.title}
            </h2>
          </div>
          <button
            type="button"
            className="crash-close-btn"
            onClick={onClose}
            aria-label="Close crash telemetry"
          >
            [ESC]
          </button>
        </div>

        <div className="crash-diagnostic-banner">
          <span className="crash-diag-label">FAILURE DIAGNOSIS:</span>
          <span className="crash-diag-text">{record.diagnosticMessage}</span>
        </div>

        <div className="crash-details-grid">
          <div className="crash-detail-box">
            <span className="crash-box-label">PHYSICAL FLIGHT TRIGGER</span>
            <p className="crash-box-text">{record.physicalTrigger}</p>
          </div>

          <div className="crash-detail-box">
            <span className="crash-box-label">ML / RL CONFIGURATION ROOT CAUSE</span>
            <p className="crash-box-text">{record.mlConfigCause}</p>
          </div>

          <div className="crash-detail-box">
            <span className="crash-box-label">ENVIRONMENTAL STIMULUS</span>
            <p className="crash-box-text">{record.environmentalCause}</p>
          </div>

          <div className="crash-detail-box highlight">
            <span className="crash-box-label">RECOMMENDED RL REMEDIATION</span>
            <p className="crash-box-text">{record.remedyRecommendation}</p>
          </div>
        </div>

        <div className="crash-telemetry-strip">
          <div className="crash-strip-item">
            <span className="strip-key">ACTIVE EPOCH</span>
            <span className="strip-val">{params.epochs} / {mission?.recommendedEpochs || 300}</span>
          </div>
          <div className="crash-strip-item">
            <span className="strip-key">LEARNING RATE</span>
            <span className="strip-val">{params.learningRate.toFixed(4)}</span>
          </div>
          <div className="crash-strip-item">
            <span className="strip-key">EXPLORATION NOISE</span>
            <span className="strip-val">{(params.explorationNoise * 100).toFixed(0)}%</span>
          </div>
          <div className="crash-strip-item">
            <span className="strip-key">SEVERITY INDEX</span>
            <span className="strip-val">{(record.severity * 100).toFixed(0)}% CRITICAL</span>
          </div>
        </div>

        <div className="crash-actions-row">
          <button
            type="button"
            className="btn-crash-secondary"
            onClick={onReset}
          >
            RE-RUN STUNT
          </button>
          <button
            type="button"
            className="btn-crash-primary"
            onClick={onAutoTuneAndStep}
          >
            APPLY RL REMEDY (+5 EPOCHS)
          </button>
          <button
            type="button"
            className="btn-crash-ghost"
            onClick={onClose}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
