import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Cpu,
  Flame,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type {
  EpochHistoryPoint,
  MissionDefinition,
  NeuralNetworkSnapshot,
} from '../types/simulation.ts';
import type { SelectedBrainNode } from './NeuralNetworkModal.tsx';
import { HelpTooltip } from './HelpTooltip.tsx';
import { AnimatedNumber } from './AnimatedText.tsx';

interface NeuralTelemetryHUDProps {
  mission: MissionDefinition;
  nnSnapshot: NeuralNetworkSnapshot;
  epoch: number;
  rewardHistory: EpochHistoryPoint[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenFullBrain: (node?: SelectedBrainNode) => void;
}

export const NeuralTelemetryHUD: React.FC<NeuralTelemetryHUDProps> = ({
  mission,
  nnSnapshot,
  epoch,
  rewardHistory,
  collapsed,
  onToggleCollapse,
  onOpenFullBrain,
}) => {
  const [showStoryCard, setShowStoryCard] = useState(true);
  const [showJetsCard, setShowJetsCard] = useState(true);
  const [showBrainGraph, setShowBrainGraph] = useState(true);
  const [showScoreChart, setShowScoreChart] = useState(true);

  if (collapsed) {
    return (
      <button
        type="button"
        className="floating-Collapsed-pill right"
        onClick={onToggleCollapse}
        title="Open AI Brain View"
      >
        <Cpu size={15} />
        <span>AI BRAIN ({nnSnapshot.stabilityScore}%)</span>
      </button>
    );
  }

  const inputX = 48;
  const h1X = 112;
  const h2X = 172;
  const outX = 236;

  const getY = (idx: number, total: number, height = 148) => {
    const pad = 16;
    const usable = height - pad * 2;
    return pad + (idx / Math.max(1, total - 1)) * usable;
  };

  return (
    <aside className="floating-drawer right-drawer">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <Cpu size={15} />
          <span>INSIDE THE AI BRAIN</span>
          <HelpTooltip
            title="Live AI Brain View"
            explain="Watch how the computer brain sees the car's height and tilt on the left, thinks in the middle, and fires the air jets on the right! Click LIVE BRAIN WIRES to inspect every neuron!"
          />
        </div>
        <button
          type="button"
          className="icon-min-btn"
          onClick={onToggleCollapse}
          title="Minimize Brain Panel"
        >
          <Minimize2 size={14} />
        </button>
      </div>

      <div className="drawer-body">
        {/* 1. Minimizable Simple Story Card */}
        <div className="hud-card-bw">
          <div
            className="hud-card-header-bw clickable"
            onClick={() => setShowStoryCard((v) => !v)}
            role="button"
            tabIndex={0}
          >
            <span className="hud-header-left">
              <Info size={13} />
              <span>HOW THIS STUNT WORKS</span>
            </span>
            {showStoryCard ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          {showStoryCard && (
            <div className="hud-card-collapse-body">
              <p className="story-text">{mission.mlTechniqueSummary}</p>
              <div className="story-rule-pill">{mission.physicsFormulaLatex}</div>
            </div>
          )}
        </div>

        {/* 2. Minimizable Jet / Engine Power Meters */}
        <div className="hud-card-bw">
          <div
            className="hud-card-header-bw clickable"
            onClick={() => setShowJetsCard((v) => !v)}
            role="button"
            tabIndex={0}
          >
            <span className="hud-header-left">
              <Flame size={13} />{' '}
              {mission.vehicle === 'roadster' ? 'AIR JET POWER' : 'ROCKET ENGINE POWER'}
              <HelpTooltip
                title="Jet & Engine Power Meters"
                explain="Shows how hard each air nozzle or rocket engine is blasting right now from 0% (off) to 100% (full blast)!"
              />
            </span>
            <span className="hud-header-right">
              {nnSnapshot.sensorLatencyMs !== undefined && nnSnapshot.sensorLatencyMs > 0 && (
                <small title="Sensor signal delay and estimated attitude phase lag" style={{ marginRight: '6px' }}>
                  LAG: {nnSnapshot.sensorLatencyMs}ms ({nnSnapshot.sensorDelayDeg ?? 0}°)
                </small>
              )}
              <small>SKILL: {nnSnapshot.stabilityScore}%</small>
              {showJetsCard ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>

          {showJetsCard && (
            <div className="jet-grid-bw">
              {nnSnapshot.outputs.map((outItem, idx) => {
                const pct = Math.round(outItem.value * 100);
                return (
                  <div
                    key={outItem.label}
                    className="jet-cell-bw clickable"
                    onClick={() => onOpenFullBrain({ layer: 'output', index: idx })}
                    title="Click to inspect this thruster output neuron in the Full Neural Network"
                  >
                    <div className="jet-cell-top">
                      <span>{outItem.label}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="jet-bar-track">
                      <div className="jet-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Minimizable & Clickable Live Neural Brain Wire Diagram */}
        <div className="hud-card-bw">
          <button
            type="button"
            className="brain-toggle-btn"
            onClick={() => setShowBrainGraph((v) => !v)}
          >
            <span className="hud-header-left">
              <Cpu size={13} /> LIVE BRAIN WIRES
            </span>
            <span className="hud-header-right">
              <strong>
                SCORE: <AnimatedNumber value={nnSnapshot.cumulativeReward} decimals={0} />
              </strong>
              {showBrainGraph ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {showBrainGraph && (
            <div className="brain-mini-interactive-wrap">
              <svg
                viewBox="0 0 284 148"
                className="nn-svg-bw clickable-brain-svg"
                onClick={() => onOpenFullBrain()}
              >
                {nnSnapshot.inputs.map((inItem, i) =>
                  nnSnapshot.hiddenLayer1.map((h1Val, j) => {
                    const strength = Math.min(1, Math.abs(inItem.value * h1Val));
                    return (
                      <line
                        key={`l1-${i}-${j}`}
                        x1={inputX}
                        y1={getY(i, nnSnapshot.inputs.length)}
                        x2={h1X}
                        y2={getY(j, nnSnapshot.hiddenLayer1.length)}
                        stroke="#ffffff"
                        strokeOpacity={0.05 + strength * 0.32}
                        strokeWidth={0.5 + strength * 1.1}
                      />
                    );
                  })
                )}

                {nnSnapshot.hiddenLayer1.map((h1Val, i) =>
                  nnSnapshot.hiddenLayer2.map((h2Val, j) => {
                    const strength = Math.min(1, Math.abs(h1Val * h2Val));
                    return (
                      <line
                        key={`l2-${i}-${j}`}
                        x1={h1X}
                        y1={getY(i, nnSnapshot.hiddenLayer1.length)}
                        x2={h2X}
                        y2={getY(j, nnSnapshot.hiddenLayer2.length)}
                        stroke="#d4d4d4"
                        strokeOpacity={0.05 + strength * 0.35}
                        strokeWidth={0.5 + strength * 1.1}
                      />
                    );
                  })
                )}

                {nnSnapshot.hiddenLayer2.map((h2Val, i) =>
                  nnSnapshot.outputs.map((outItem, j) => {
                    const strength = Math.min(1, Math.abs(h2Val * outItem.value));
                    return (
                      <line
                        key={`l3-${i}-${j}`}
                        x1={h2X}
                        y1={getY(i, nnSnapshot.hiddenLayer2.length)}
                        x2={outX}
                        y2={getY(j, nnSnapshot.outputs.length)}
                        stroke="#ffffff"
                        strokeOpacity={0.07 + strength * 0.5}
                        strokeWidth={0.6 + strength * 1.3}
                      />
                    );
                  })
                )}

                {nnSnapshot.inputs.map((inItem, i) => {
                  const y = getY(i, nnSnapshot.inputs.length);
                  return (
                    <g
                      key={`in-${i}`}
                      className="nn-clickable-node"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFullBrain({ layer: 'input', index: i });
                      }}
                    >
                      <circle
                        cx={inputX}
                        cy={y}
                        r={3.8}
                        fill={Math.abs(inItem.value) > 0.25 ? '#ffffff' : '#171717'}
                        stroke="#a3a3a3"
                        strokeWidth={1.1}
                      />
                      <text x={3} y={y + 3} fill="#a3a3a3" fontSize="6.5" fontFamily="monospace">
                        {inItem.label}
                      </text>
                    </g>
                  );
                })}

                {nnSnapshot.hiddenLayer1.map((val, i) => (
                  <circle
                    key={`h1-${i}`}
                    className="nn-clickable-node"
                    cx={h1X}
                    cy={getY(i, nnSnapshot.hiddenLayer1.length)}
                    r={3.2}
                    fill="#ffffff"
                    fillOpacity={0.2 + Math.abs(val) * 0.75}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFullBrain({ layer: 'h1', index: i });
                    }}
                  />
                ))}

                {nnSnapshot.hiddenLayer2.map((val, i) => (
                  <circle
                    key={`h2-${i}`}
                    className="nn-clickable-node"
                    cx={h2X}
                    cy={getY(i, nnSnapshot.hiddenLayer2.length)}
                    r={3.2}
                    fill="#ffffff"
                    fillOpacity={0.2 + Math.abs(val) * 0.75}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFullBrain({ layer: 'h2', index: i });
                    }}
                  />
                ))}

                {nnSnapshot.outputs.map((outItem, i) => {
                  const y = getY(i, nnSnapshot.outputs.length);
                  return (
                    <g
                      key={`out-${i}`}
                      className="nn-clickable-node"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFullBrain({ layer: 'output', index: i });
                      }}
                    >
                      <circle
                        cx={outX}
                        cy={y}
                        r={4.2}
                        fill="#ffffff"
                        fillOpacity={0.18 + outItem.value * 0.82}
                        stroke="#ffffff"
                        strokeWidth={1.1}
                      />
                      <text x={outX + 7} y={y + 3} fill="#f5f5f5" fontSize="6.5" fontFamily="monospace">
                        {outItem.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <button
                type="button"
                className="expand-full-brain-btn"
                onClick={() => onOpenFullBrain()}
              >
                <Maximize2 size={12} />
                <span>CLICK ANY WIRE OR NODE // EXPAND FULL NEURAL NETWORK &amp; EPOCH PREVIEW</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Minimizable Practice Score Progress Curve */}
        <div className="hud-card-bw">
          <div
            className="hud-card-header-bw clickable"
            onClick={() => setShowScoreChart((v) => !v)}
            role="button"
            tabIndex={0}
          >
            <span className="hud-header-left">
              <Activity size={13} /> PRACTICE SCORE CHART
              <HelpTooltip
                title="Practice Score Chart"
                explain="As the line goes UP from left to right, the AI is getting smarter and earning more points on each stunt!"
              />
            </span>
            <span className="hud-header-right">
              <small>TRY #{epoch}</small>
              {showScoreChart ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
          {showScoreChart && (
            <svg viewBox="0 0 280 68" className="reward-svg-bw">
              {rewardHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  points={rewardHistory
                    .map((pt, idx) => {
                      const x = 8 + (idx / Math.max(1, rewardHistory.length - 1)) * 264;
                      const normY = Math.max(0, Math.min(1, (pt.meanReward + 80) / 280));
                      const y = 58 - normY * 46;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          )}
        </div>
      </div>
    </aside>
  );
};
