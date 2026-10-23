import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  MissionDefinition,
  NeuralNetworkSnapshot,
  RLHyperparameters,
} from '../types/simulation.ts';
import { createInitialRoadsterState, stepRoadsterPhysics } from '../physics/roadsterPhysics.ts';
import { createInitialStarshipState, stepStarshipPhysics } from '../physics/starshipPhysics.ts';
import { computePolicyCompetence, evaluateRLPolicy } from '../rl/policyEngine.ts';

export interface SelectedBrainNode {
  layer: 'input' | 'h1' | 'h2' | 'output';
  index: number;
}

interface NeuralNetworkModalProps {
  isOpen: boolean;
  mission: MissionDefinition;
  params: RLHyperparameters;
  liveSnapshot: NeuralNetworkSnapshot;
  initialSelectedNode?: SelectedBrainNode;
  onClose: () => void;
  onApplyEpochToSimulator: (targetEpoch: number) => void;
}

const H1_LABELS = [
  'Alt-Error Gate',
  'Gravity Compensator',
  'Roll Rate Detector',
  'Pitch Horizon Cell',
  'Centripetal Loop Memory',
  'Touchdown Brake Trigger',
  'Aero/Gimbal Mixer',
  'Blowdown PSI Regulator',
];

const H2_LABELS = [
  'Lift Cushion Synth',
  'Roll Torque Driver',
  'Pitch Trim Coordinator',
  'Lateral Pinning Synth',
  'Retro-Burn Timing Gate',
  'Stage & Fin Sequencer',
];

export const NeuralNetworkModal: React.FC<NeuralNetworkModalProps> = ({
  isOpen,
  mission,
  params,
  liveSnapshot,
  initialSelectedNode,
  onClose,
  onApplyEpochToSimulator,
}) => {
  const [previewEpoch, setPreviewEpoch] = useState<number>(params.epochs);
  const [selectedNode, setSelectedNode] = useState<SelectedBrainNode>(
    initialSelectedNode ?? { layer: 'output', index: 0 }
  );

  useEffect(() => {
    if (isOpen) {
      setPreviewEpoch(params.epochs);
      if (initialSelectedNode) setSelectedNode(initialSelectedNode);
    }
  }, [isOpen, params.epochs, initialSelectedNode]);

  const rolloutPreview = useMemo(() => {
    const simParams: RLHyperparameters = {
      ...params,
      epochs: previewEpoch,
      explorationNoise: previewEpoch < 25 ? 0.58 : previewEpoch < 90 ? 0.24 : 0.02,
    };
    const competence = computePolicyCompetence(mission.id, simParams, previewEpoch);
    let state =
      mission.vehicle === 'roadster'
        ? createInitialRoadsterState(mission.id, simParams)
        : createInitialStarshipState(mission.id);

    const pathPoints: { x: number; y: number }[] = [];
    const nodeWaveform: number[] = [];
    let finalSnapshot = liveSnapshot;
    let maxAlt = state.position.y;
    const totalSteps = 180;
    const dt = 0.03;

    for (let step = 0; step < totalSteps; step++) {
      const { thrusters, nnSnapshot } = evaluateRLPolicy(state, mission.id, simParams, 0);
      if (step === Math.floor(totalSteps * 0.45)) finalSnapshot = nnSnapshot;

      const nodeVal =
        selectedNode.layer === 'input'
          ? (nnSnapshot.inputs[selectedNode.index]?.value ?? 0)
          : selectedNode.layer === 'h1'
            ? (nnSnapshot.hiddenLayer1[selectedNode.index] ?? 0)
            : selectedNode.layer === 'h2'
              ? (nnSnapshot.hiddenLayer2[selectedNode.index] ?? 0)
              : (nnSnapshot.outputs[selectedNode.index]?.value ?? 0);

      if (step % 3 === 0) {
        nodeWaveform.push(nodeVal);
        pathPoints.push({ x: state.position.x, y: state.position.y });
      }

      state =
        mission.vehicle === 'roadster'
          ? stepRoadsterPhysics(state, thrusters, mission.id, simParams, dt)
          : stepStarshipPhysics(state, thrusters, mission.id, simParams, dt);

      if (state.position.y > maxAlt) maxAlt = state.position.y;
    }

    const isFailing = state.crashed || competence < 0.42;
    const isLearning = !isFailing && competence < 0.78;
    const statusLabel = isFailing
      ? 'FAILING // CRASH OR STUNT ABORT'
      : isLearning
        ? 'LEARNING // WOBBLY CONTROL'
        : 'CONVERGED // STUNT MASTERED';

    return {
      competencePct: Math.round(competence * 100),
      isFailing,
      isLearning,
      statusLabel,
      maxAlt: Number(maxAlt.toFixed(1)),
      pathPoints,
      nodeWaveform,
      snapshot: finalSnapshot,
    };
  }, [mission.id, mission.vehicle, params, previewEpoch, selectedNode, liveSnapshot]);

  if (!isOpen) return null;

  const snap = rolloutPreview.snapshot;
  const colX = { input: 95, h1: 255, h2: 425, output: 585 };
  const svgH = 330;
  const getY = (idx: number, count: number) => 32 + (idx / Math.max(1, count - 1)) * (svgH - 64);

  const selectedNodeInfo = (() => {
    if (selectedNode.layer === 'input') {
      const item = snap.inputs[selectedNode.index] ?? snap.inputs[0];
      return {
        title: `Sensor Input #${selectedNode.index + 1}: ${item.label}`,
        layerTag: 'LAYER 1 // 6-DoF SENSOR',
        value: item.value,
        role: `Measures live ${item.label} at 60Hz and feeds it into all 8 Hidden Layer 1 feature neurons.`,
      };
    }
    if (selectedNode.layer === 'h1') {
      const val = snap.hiddenLayer1[selectedNode.index] ?? 0;
      const name = H1_LABELS[selectedNode.index] ?? `Feature #${selectedNode.index + 1}`;
      return {
        title: `Hidden Layer 1 #${selectedNode.index + 1}: ${name}`,
        layerTag: 'LAYER 2 // FEATURE EXTRACTOR (tanh)',
        value: val,
        role: `Combines height, speed, and tilt sensors to detect if the ${mission.vehicle === 'roadster' ? 'Roadster' : 'Starship'} is stable or tipping over.`,
      };
    }
    if (selectedNode.layer === 'h2') {
      const val = snap.hiddenLayer2[selectedNode.index] ?? 0;
      const name = H2_LABELS[selectedNode.index] ?? `Policy #${selectedNode.index + 1}`;
      return {
        title: `Hidden Layer 2 #${selectedNode.index + 1}: ${name}`,
        layerTag: 'LAYER 3 // POLICY COORDINATOR (tanh)',
        value: val,
        role: `Coordinates multi-thruster timing for ${mission.title} so the jets fire together smoothly.`,
      };
    }
    const out = snap.outputs[selectedNode.index] ?? snap.outputs[0];
    return {
      title: `Actuator Output #${selectedNode.index + 1}: ${out.label}`,
      layerTag: 'LAYER 4 // THRUSTER / RAPTOR VALVE',
      value: out.value,
      role: `Directly commands the ${out.label} actuator from 0% (off) to 100% (full thrust).`,
    };
  })();

  const renderSynapses = (
    fromVals: number[],
    toVals: number[],
    fromLayer: SelectedBrainNode['layer'],
    toLayer: SelectedBrainNode['layer'],
    x1: number,
    x2: number
  ) =>
    fromVals.map((v1, i) =>
      toVals.map((v2, j) => {
        const hi =
          (selectedNode.layer === fromLayer && selectedNode.index === i) ||
          (selectedNode.layer === toLayer && selectedNode.index === j);
        const w = Math.min(1, Math.abs(v1 * v2));
        return (
          <line
            key={`${fromLayer}-${toLayer}-${i}-${j}`}
            x1={x1}
            y1={getY(i, fromVals.length)}
            x2={x2}
            y2={getY(j, toVals.length)}
            stroke="#ffffff"
            strokeOpacity={hi ? 0.88 : 0.08 + w * 0.3}
            strokeWidth={hi ? 1.9 : 0.6 + w * 1.1}
          />
        );
      })
    );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog nn-inspector-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Full Neural Network and Epoch Node Previewer"
      >
        <header className="nn-modal-header">
          <div className="nn-modal-title-group">
            <span className="nn-modal-eyebrow">
              <Cpu size={13} /> INTERACTIVE DEEP RL POLICY NETWORK ({mission.title.toUpperCase()})
            </span>
            <h2 className="nn-modal-title">FULL NEURAL NETWORK &amp; EPOCH NODE PREVIEWER</h2>
          </div>
          <button type="button" className="icon-min-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </header>

        <div className="nn-epoch-bar">
          <div className="nn-epoch-presets">
            <span className="nn-epoch-label">PRESET EPOCH REGIME:</span>
            {[
              { ep: 10, label: 'Epoch 10 (Crash)' },
              { ep: 20, label: 'Epoch 20 (Failing)' },
              { ep: 85, label: 'Epoch 85 (Wobbling)' },
              { ep: 220, label: 'Epoch 220 (Learning)' },
              { ep: 380, label: 'Epoch 380 (Mastered)' },
            ].map((p) => (
              <button
                key={p.ep}
                type="button"
                className={`nn-epoch-pill ${previewEpoch === p.ep ? 'active' : ''}`}
                onClick={() => setPreviewEpoch(p.ep)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="nn-epoch-slider-wrap">
            <span>SCRUB EPOCH: #{previewEpoch}</span>
            <input
              type="range"
              min={1}
              max={500}
              value={previewEpoch}
              onChange={(e) => setPreviewEpoch(Number(e.target.value))}
            />
            <strong>SKILL: {rolloutPreview.competencePct}%</strong>
          </div>
        </div>

        <div className="nn-modal-grid">
          <div className="nn-graph-panel">
            <div className="nn-panel-subhead">
              <span>6 SENSORS → 8 HIDDEN 1 → 6 HIDDEN 2 → 6 THRUSTER OUTPUTS</span>
              <span>CLICK ANY NODE TO INSPECT</span>
            </div>
            <svg viewBox={`0 0 680 ${svgH}`} className="nn-full-svg">
              {renderSynapses(
                snap.inputs.map((n) => n.value),
                snap.hiddenLayer1,
                'input',
                'h1',
                colX.input,
                colX.h1
              )}
              {renderSynapses(snap.hiddenLayer1, snap.hiddenLayer2, 'h1', 'h2', colX.h1, colX.h2)}
              {renderSynapses(
                snap.hiddenLayer2,
                snap.outputs.map((n) => n.value),
                'h2',
                'output',
                colX.h2,
                colX.output
              )}

              {snap.inputs.map((inItem, i) => {
                const y = getY(i, snap.inputs.length);
                const act = selectedNode.layer === 'input' && selectedNode.index === i;
                return (
                  <g
                    key={`in-${i}`}
                    className="nn-node-group"
                    onClick={() => setSelectedNode({ layer: 'input', index: i })}
                  >
                    <circle
                      cx={colX.input}
                      cy={y}
                      r={act ? 10 : 7.5}
                      fill={act ? '#ffffff' : '#171717'}
                      stroke="#ffffff"
                      strokeWidth={act ? 2.5 : 1.3}
                    />
                    <text x={colX.input - 13} y={y + 3} textAnchor="end" fill="#ffffff" fontSize="9.5" fontFamily="monospace">
                      {inItem.label} ({inItem.value.toFixed(2)})
                    </text>
                  </g>
                );
              })}

              {snap.hiddenLayer1.map((val, i) => {
                const y = getY(i, snap.hiddenLayer1.length);
                const act = selectedNode.layer === 'h1' && selectedNode.index === i;
                return (
                  <g key={`h1-${i}`} className="nn-node-group" onClick={() => setSelectedNode({ layer: 'h1', index: i })}>
                    <circle
                      cx={colX.h1}
                      cy={y}
                      r={act ? 10 : 7}
                      fill="#ffffff"
                      fillOpacity={act ? 1 : 0.2 + Math.abs(val) * 0.75}
                      stroke="#ffffff"
                      strokeWidth={act ? 2.5 : 1.1}
                    />
                    <text x={colX.h1} y={y - 11} textAnchor="middle" fill="#a3a3a3" fontSize="8.5" fontFamily="monospace">
                      H1.{i + 1} ({val.toFixed(2)})
                    </text>
                  </g>
                );
              })}

              {snap.hiddenLayer2.map((val, i) => {
                const y = getY(i, snap.hiddenLayer2.length);
                const act = selectedNode.layer === 'h2' && selectedNode.index === i;
                return (
                  <g key={`h2-${i}`} className="nn-node-group" onClick={() => setSelectedNode({ layer: 'h2', index: i })}>
                    <circle
                      cx={colX.h2}
                      cy={y}
                      r={act ? 10 : 7}
                      fill="#ffffff"
                      fillOpacity={act ? 1 : 0.2 + Math.abs(val) * 0.75}
                      stroke="#ffffff"
                      strokeWidth={act ? 2.5 : 1.1}
                    />
                    <text x={colX.h2} y={y - 11} textAnchor="middle" fill="#a3a3a3" fontSize="8.5" fontFamily="monospace">
                      H2.{i + 1} ({val.toFixed(2)})
                    </text>
                  </g>
                );
              })}

              {snap.outputs.map((outItem, i) => {
                const y = getY(i, snap.outputs.length);
                const act = selectedNode.layer === 'output' && selectedNode.index === i;
                return (
                  <g key={`out-${i}`} className="nn-node-group" onClick={() => setSelectedNode({ layer: 'output', index: i })}>
                    <circle
                      cx={colX.output}
                      cy={y}
                      r={act ? 10.5 : 8}
                      fill="#ffffff"
                      fillOpacity={act ? 1 : 0.2 + outItem.value * 0.8}
                      stroke="#ffffff"
                      strokeWidth={act ? 2.6 : 1.3}
                    />
                    <text x={colX.output + 13} y={y + 3} textAnchor="start" fill="#ffffff" fontSize="9.5" fontFamily="monospace">
                      {outItem.label} ({Math.round(outItem.value * 100)}%)
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="nn-node-detail-box">
              <div className="nn-node-detail-top">
                <strong>{selectedNodeInfo.title}</strong>
                <span className="nn-node-layer-tag">{selectedNodeInfo.layerTag}</span>
              </div>
              <p className="nn-node-detail-desc">{selectedNodeInfo.role}</p>
            </div>
          </div>

          <div className="nn-preview-panel">
            <div className={`nn-status-banner ${rolloutPreview.isFailing ? 'failing' : 'mastered'}`}>
              {rolloutPreview.isFailing ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <div>
                <strong>
                  EPOCH #{previewEpoch}: {rolloutPreview.statusLabel}
                </strong>
                <p>
                  {rolloutPreview.isFailing
                    ? `At Epoch #${previewEpoch}, the AI brain has only ${rolloutPreview.competencePct}% skill — noisy weights fire the thrusters unevenly and the stunt fails!`
                    : `At Epoch #${previewEpoch}, neural weights have converged (${rolloutPreview.competencePct}% skill) to execute ${mission.title} smoothly!`}
                </p>
              </div>
            </div>

            <div className="nn-panel-subhead">
              <span>
                <Activity size={12} /> SIMULATED FLIGHT PATH &amp; NODE SIGNAL AT EPOCH #{previewEpoch}
              </span>
              <span>PEAK ALT: {rolloutPreview.maxAlt}m</span>
            </div>

            <svg viewBox="0 0 320 120" className="nn-traj-svg">
              <line x1="12" y1="100" x2="308" y2="100" stroke="#525252" strokeDasharray="3 3" />
              <polyline
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeDasharray={rolloutPreview.isFailing ? '4 3' : undefined}
                points={rolloutPreview.pathPoints
                  .map((pt, idx) => {
                    const px = 16 + (idx / Math.max(1, rolloutPreview.pathPoints.length - 1)) * 288;
                    const py = 96 - Math.min(82, Math.max(0, pt.y * 4.2));
                    return `${px.toFixed(1)},${py.toFixed(1)}`;
                  })
                  .join(' ')}
              />
              <polyline
                fill="none"
                stroke="#a3a3a3"
                strokeWidth="1.3"
                points={rolloutPreview.nodeWaveform
                  .map((v, idx) => {
                    const px = 16 + (idx / Math.max(1, rolloutPreview.nodeWaveform.length - 1)) * 288;
                    const py = 56 - Math.max(-1, Math.min(1, v)) * 32;
                    return `${px.toFixed(1)},${py.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            </svg>

            <div className="nn-preview-metrics">
              <div className="nn-metric-box">
                <span>NODE SIGNAL</span>
                <strong>{selectedNodeInfo.value.toFixed(2)}</strong>
              </div>
              <div className="nn-metric-box">
                <span>WEIGHT STATE</span>
                <strong>{rolloutPreview.isFailing ? 'NOISY' : rolloutPreview.isLearning ? 'TUNING' : 'LOCKED'}</strong>
              </div>
              <div className="nn-metric-box">
                <span>STUNT OUTCOME</span>
                <strong>{rolloutPreview.isFailing ? 'CRASH / FAIL' : 'LANDED OK'}</strong>
              </div>
            </div>

            <button
              type="button"
              className="action-btn primary nn-apply-btn"
              onClick={() => {
                onApplyEpochToSimulator(previewEpoch);
                onClose();
              }}
            >
              <Play size={14} />
              <span>
                TEST EPOCH #{previewEpoch} ({rolloutPreview.isFailing ? 'WATCH FAILURE' : 'WATCH MASTERY'}) IN LIVE 3D
              </span>
              <Sparkles size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
