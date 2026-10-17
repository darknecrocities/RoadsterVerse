import React from 'react';
import { Cpu, Activity, Flame, Compass } from 'lucide-react';
import type {
  EpochHistoryPoint,
  MissionDefinition,
  NeuralNetworkSnapshot,
  RigidBodyState,
} from '../types/simulation.ts';
import { AnimatedNumber } from './AnimatedText.tsx';

interface NeuralTelemetryHUDProps {
  mission: MissionDefinition;
  state: RigidBodyState;
  nnSnapshot: NeuralNetworkSnapshot;
  learningCurve: EpochHistoryPoint[];
  currentEpoch: number;
}

export const NeuralTelemetryHUD: React.FC<NeuralTelemetryHUDProps> = ({
  mission,
  state,
  nnSnapshot,
  learningCurve,
  currentEpoch,
}) => {
  const inputY = (idx: number) => 24 + idx * 27;
  const h1Y = (idx: number) => 16 + idx * 21;
  const h2Y = (idx: number) => 24 + idx * 27;
  const outY = (idx: number) => 24 + idx * 27;

  const chartW = 310;
  const chartH = 95;
  const minR = -220;
  const maxR = 1500;

  const polylinePoints = learningCurve
    .map((pt, idx) => {
      const x = (idx / Math.max(1, learningCurve.length - 1)) * (chartW - 24) + 12;
      const normY = (pt.meanReward - minR) / (maxR - minR);
      const y = chartH - 14 - Math.max(0, Math.min(1, normY)) * (chartH - 26);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <aside className="panel-card" aria-label="Live Neural Network and 6-DoF Telemetry HUD">
      {/* 1. Live Policy Neural Network Activation Graph (Pure Monochrome) */}
      <div className="panel-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Cpu size={15} />
          Live Policy Network (100 Hz)
        </span>
        <span style={{ fontSize: '0.7rem', color: '#ffffff', fontFamily: 'monospace' }}>
          R_inst: {nnSnapshot.instantReward >= 0 ? `+${nnSnapshot.instantReward}` : nnSnapshot.instantReward}
        </span>
      </div>

      <div
        style={{
          background: '#050505',
          border: '1px solid rgba(255, 255, 255, 0.28)',
          borderRadius: '0.45rem',
          padding: '0.4rem',
        }}
      >
        <svg viewBox="0 0 320 182" width="100%" height="176" role="img" aria-label="Neural Network Activations">
          {/* Synaptic Connections: Inputs -> Hidden 1 */}
          {nnSnapshot.inputs.map((inp, i) =>
            nnSnapshot.hiddenLayer1.map((h1, j) => {
              const weightStrength = Math.abs(inp.value * h1);
              return (
                <line
                  key={`i-h1-${i}-${j}`}
                  x1={58}
                  y1={inputY(i)}
                  x2={125}
                  y2={h1Y(j)}
                  stroke={inp.value * h1 >= 0 ? '#ffffff' : '#737373'}
                  strokeOpacity={0.14 + weightStrength * 0.65}
                  strokeWidth={0.6 + weightStrength * 1.4}
                />
              );
            })
          )}

          {/* Synaptic Connections: Hidden 1 -> Hidden 2 */}
          {nnSnapshot.hiddenLayer1.map((h1, i) =>
            nnSnapshot.hiddenLayer2.map((h2, j) => {
              const weightStrength = Math.abs(h1 * h2);
              return (
                <line
                  key={`h1-h2-${i}-${j}`}
                  x1={125}
                  y1={h1Y(i)}
                  x2={195}
                  y2={h2Y(j)}
                  stroke={h1 * h2 >= 0 ? '#e5e5e5' : '#525252'}
                  strokeOpacity={0.16 + weightStrength * 0.55}
                  strokeWidth={0.6 + weightStrength * 1.3}
                />
              );
            })
          )}

          {/* Synaptic Connections: Hidden 2 -> Thruster Outputs */}
          {nnSnapshot.hiddenLayer2.map((h2, i) =>
            nnSnapshot.outputs.map((out, j) => {
              const weightStrength = Math.abs(h2 * out.value);
              return (
                <line
                  key={`h2-o-${i}-${j}`}
                  x1={195}
                  y1={h2Y(i)}
                  x2={258}
                  y2={outY(j)}
                  stroke="#ffffff"
                  strokeOpacity={0.18 + weightStrength * 0.7}
                  strokeWidth={0.7 + weightStrength * 1.6}
                />
              );
            })
          )}

          {/* Input Nodes */}
          {nnSnapshot.inputs.map((inp, i) => (
            <g key={`inp-${inp.label}`}>
              <text x={4} y={inputY(i) + 3} fill="#b3b3b3" fontSize="8.5" fontFamily="monospace">
                {inp.label}
              </text>
              <circle
                cx={58}
                cy={inputY(i)}
                r={5.5}
                fill={inp.value >= 0 ? '#ffffff' : '#404040'}
                stroke="#ffffff"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Hidden Layer 1 Nodes */}
          {nnSnapshot.hiddenLayer1.map((val, i) => (
            <circle
              key={`h1-${i}`}
              cx={125}
              cy={h1Y(i)}
              r={4.5}
              fill={val >= 0 ? '#ffffff' : '#737373'}
              fillOpacity={0.35 + Math.abs(val) * 0.65}
            />
          ))}

          {/* Hidden Layer 2 Nodes */}
          {nnSnapshot.hiddenLayer2.map((val, i) => (
            <circle
              key={`h2-${i}`}
              cx={195}
              cy={h2Y(i)}
              r={5}
              fill={val >= 0 ? '#ffffff' : '#737373'}
              fillOpacity={0.4 + Math.abs(val) * 0.6}
            />
          ))}

          {/* Output Thruster / Flap Action Nodes */}
          {nnSnapshot.outputs.map((out, i) => (
            <g key={`out-${out.label}`}>
              <circle
                cx={258}
                cy={outY(i)}
                r={6}
                fill={out.value > 0.15 ? '#ffffff' : '#171717'}
                stroke="#ffffff"
                strokeWidth={1.2}
              />
              <text x={269} y={outY(i) + 3} fill="#f5f5f5" fontSize="8.5" fontFamily="monospace">
                {out.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 2. Live Thruster / Aero Flap Duty Cycle Bars */}
      <div className="panel-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Flame size={15} />
          {mission.vehicle === 'roadster'
            ? 'COPV White Smoke Valve Duty'
            : 'Raptor Fire & Flap Actuators'}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#9e9e9e' }}>
          Entropy: {nnSnapshot.policyEntropy}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
        {nnSnapshot.outputs.map((act) => {
          const pct = Math.round(act.value * 100);
          return (
            <div
              key={act.label}
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                borderRadius: '0.35rem',
                padding: '0.38rem 0.55rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.7rem',
                  marginBottom: '0.22rem',
                }}
              >
                <span style={{ color: '#d4d4d4' }}>{act.label}</span>
                <span style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 800 }}>
                  {pct}%
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  background: '#1f1f1f',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #9e9e9e, #ffffff)',
                    transition: 'width 0.08s linear',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Epoch Reward Convergence Curve */}
      <div className="panel-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Activity size={15} />
          Reward vs. Epoch Convergence
        </span>
        <span style={{ fontSize: '0.7rem', color: '#ffffff', fontFamily: 'monospace' }}>
          Ep <AnimatedNumber value={currentEpoch} />
        </span>
      </div>

      <div
        style={{
          background: '#050505',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '0.45rem',
          padding: '0.45rem',
        }}
      >
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height="92" role="img" aria-label="Reward Learning Curve">
          <line x1={12} y1={chartH - 14} x2={chartW - 12} y2={chartH - 14} stroke="#333333" strokeWidth={1} />
          <polyline
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.2}
            points={polylinePoints}
          />
          <text x={14} y={14} fill="#9e9e9e" fontSize="8.5" fontFamily="monospace">
            Mean Episode Return (PPO Clipped Objective)
          </text>
        </svg>
      </div>

      {/* 4. ML & Physics Technique Brief Card */}
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '0.45rem',
          padding: '0.65rem',
          fontSize: '0.73rem',
          color: '#d4d4d4',
          lineHeight: 1.45,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: '0.25rem',
          }}
        >
          <Compass size={14} />
          How This Stunt Is Learned:
        </div>
        <p>{mission.mlTechniqueSummary}</p>
        <div
          style={{
            marginTop: '0.45rem',
            padding: '0.35rem 0.5rem',
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '0.35rem',
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            color: '#ffffff',
            overflowX: 'auto',
          }}
        >
          {mission.physicsFormulaLatex}
        </div>
        {state.isOnWall && (
          <div style={{ marginTop: '0.35rem', color: '#ffffff', fontWeight: 800 }}>
            ✓ Active Wall Adhesion: Lateral COPV jet generating{' '}
            {(state.wallContactNormalForceN / 1000).toFixed(1)} kN normal force!
          </div>
        )}
      </div>
    </aside>
  );
};
