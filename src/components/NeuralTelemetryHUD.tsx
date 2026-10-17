import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Flame,
  Info,
  Minimize2,
} from 'lucide-react';
import type {
  EpochHistoryPoint,
  MissionDefinition,
  NeuralNetworkSnapshot,
} from '../types/simulation.ts';
import { HelpTooltip } from './HelpTooltip.tsx';
import { AnimatedNumber } from './AnimatedText.tsx';

interface NeuralTelemetryHUDProps {
  mission: MissionDefinition;
  nnSnapshot: NeuralNetworkSnapshot;
  epoch: number;
  rewardHistory: EpochHistoryPoint[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const NeuralTelemetryHUD: React.FC<NeuralTelemetryHUDProps> = ({
  mission,
  nnSnapshot,
  epoch,
  rewardHistory,
  collapsed,
  onToggleCollapse,
}) => {
  const [showBrainGraph, setShowBrainGraph] = useState(true);

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
            explain="Watch how the computer brain sees the car's height and tilt on the left, thinks in the middle, and fires the air jets on the right!"
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
        {/* 1. Simple Story Card */}
        <div className="simple-story-card">
          <div className="story-header">
            <Info size={13} />
            <span>HOW THIS STUNT WORKS (SIMPLE GUIDE)</span>
          </div>
          <p className="story-text">{mission.mlTechniqueSummary}</p>
          <div className="story-rule-pill">{mission.physicsFormulaLatex}</div>
        </div>

        {/* 2. Jet / Engine Power Meters */}
        <div className="hud-card-bw">
          <div className="hud-card-header-bw">
            <span>
              <Flame size={13} />{' '}
              {mission.vehicle === 'roadster' ? 'AIR JET POWER' : 'ROCKET ENGINE POWER'}
              <HelpTooltip
                title="Jet & Engine Power Meters"
                explain="Shows how hard each air nozzle or rocket engine is blasting right now from 0% (off) to 100% (full blast)!"
              />
            </span>
            <small>SKILL: {nnSnapshot.stabilityScore}%</small>
          </div>

          <div className="jet-grid-bw">
            {nnSnapshot.outputs.map((outItem) => {
              const pct = Math.round(outItem.value * 100);
              return (
                <div key={outItem.label} className="jet-cell-bw">
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
        </div>

        {/* 3. Collapsible Live Neural Brain Wire Diagram */}
        <div className="hud-card-bw">
          <button
            type="button"
            className="brain-toggle-btn"
            onClick={() => setShowBrainGraph((v) => !v)}
          >
            <span>
              <Cpu size={13} /> LIVE BRAIN WIRES ({showBrainGraph ? 'HIDE' : 'SHOW'})
            </span>
            <strong>
              SCORE: <AnimatedNumber value={nnSnapshot.cumulativeReward} decimals={0} />
            </strong>
          </button>

          {showBrainGraph && (
            <svg viewBox="0 0 284 148" className="nn-svg-bw">
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
                  <g key={`in-${i}`}>
                    <circle
                      cx={inputX}
                      cy={y}
                      r={3.5}
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
                  cx={h1X}
                  cy={getY(i, nnSnapshot.hiddenLayer1.length)}
                  r={2.8}
                  fill="#ffffff"
                  fillOpacity={0.2 + Math.abs(val) * 0.75}
                />
              ))}

              {nnSnapshot.hiddenLayer2.map((val, i) => (
                <circle
                  key={`h2-${i}`}
                  cx={h2X}
                  cy={getY(i, nnSnapshot.hiddenLayer2.length)}
                  r={2.8}
                  fill="#ffffff"
                  fillOpacity={0.2 + Math.abs(val) * 0.75}
                />
              ))}

              {nnSnapshot.outputs.map((outItem, i) => {
                const y = getY(i, nnSnapshot.outputs.length);
                return (
                  <g key={`out-${i}`}>
                    <circle
                      cx={outX}
                      cy={y}
                      r={4}
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
          )}
        </div>

        {/* 4. Practice Score Progress Curve */}
        <div className="hud-card-bw">
          <div className="hud-card-header-bw">
            <span>
              <Activity size={13} /> PRACTICE SCORE CHART
              <HelpTooltip
                title="Practice Score Chart"
                explain="As the line goes UP from left to right, the AI is getting smarter and earning more points on each stunt!"
              />
            </span>
            <small>TRY #{epoch}</small>
          </div>
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
        </div>
      </div>
    </aside>
  );
};
