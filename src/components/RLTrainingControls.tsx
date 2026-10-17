import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Minimize2,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type {
  MissionDefinition,
  RLHyperparameters,
  SavedCheckpoint,
} from '../types/simulation.ts';
import { HelpTooltip } from './HelpTooltip.tsx';

interface RLTrainingControlsProps {
  mission: MissionDefinition;
  params: RLHyperparameters;
  stabilityScore: number;
  isAutoTraining: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onChangeParams: (next: Partial<RLHyperparameters>) => void;
  onToggleAutoTrain: () => void;
  onApplyPreset: (preset: 'untrained' | 'mid' | 'converged') => void;
  checkpoints: SavedCheckpoint[];
  onSaveCheckpoint: (name: string) => void;
  onLoadCheckpoint: (ckpt: SavedCheckpoint) => void;
}

type AccordionSection = 'practice' | 'brain' | 'goals' | 'world' | 'save';

export const RLTrainingControls: React.FC<RLTrainingControlsProps> = ({
  mission,
  params,
  stabilityScore,
  isAutoTraining,
  collapsed,
  onToggleCollapse,
  onChangeParams,
  onToggleAutoTrain,
  onApplyPreset,
  checkpoints,
  onSaveCheckpoint,
  onLoadCheckpoint,
}) => {
  const [checkpointName, setCheckpointName] = useState('');
  const [openSection, setOpenSection] = useState<AccordionSection>('practice');

  if (collapsed) {
    return (
      <button
        type="button"
        className="floating-Collapsed-pill left"
        onClick={onToggleCollapse}
        title="Open AI Controls"
      >
        <Sliders size={15} />
        <span>AI CONTROLS (TRY #{params.epochs})</span>
      </button>
    );
  }

  const toggleSection = (sec: AccordionSection) => {
    setOpenSection((prev) => (prev === sec ? 'practice' : sec));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const label =
      checkpointName.trim() || `${mission.id.toUpperCase()} // Try ${params.epochs}`;
    onSaveCheckpoint(label);
    setCheckpointName('');
  };

  const skillBadge =
    stabilityScore >= 82
      ? 'STUNT PRO'
      : stabilityScore >= 45
        ? 'LEARNING'
        : 'CLUMSY BABY';

  return (
    <aside className="floating-drawer left-drawer">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <Sliders size={15} />
          <span>AI STUNT CONTROLS</span>
          <span className="status-badge-bw">{skillBadge}</span>
        </div>
        <button
          type="button"
          className="icon-min-btn"
          onClick={onToggleCollapse}
          title="Minimize Controls"
        >
          <Minimize2 size={14} />
        </button>
      </div>

      <div className="drawer-body">
        {/* SECTION 1: AI PRACTICE RUNS */}
        <div className="accordion-box">
          <button
            type="button"
            className="accordion-header active"
            onClick={() => toggleSection('practice')}
          >
            <span>1. Practice Runs (AI Skill)</span>
            {openSection === 'practice' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {openSection === 'practice' && (
            <div className="accordion-content">
              <div className="epoch-top-row">
                <div>
                  <div className="simple-label">
                    Practice Try #{params.epochs}
                    <HelpTooltip
                      title="Practice Runs (Epochs)"
                      explain="How many times the AI has practiced this stunt! At Try #10, it acts like a clumsy baby and crashes. At Try #350+, it's a master stunt driver!"
                      tip="Drag left to watch it fail, or right to watch it master the stunt."
                    />
                  </div>
                  <div className="epoch-big-num">
                    {params.epochs} <small>/ 500 tries</small>
                  </div>
                </div>

                <button
                  type="button"
                  className={`train-btn-bw ${isAutoTraining ? 'active' : ''}`}
                  onClick={onToggleAutoTrain}
                >
                  {isAutoTraining ? <RotateCcw size={14} /> : <Play size={14} />}
                  <span>{isAutoTraining ? 'Stop Practice' : 'Auto-Practice'}</span>
                </button>
              </div>

              <input
                type="range"
                min={0}
                max={500}
                step={1}
                value={params.epochs}
                onChange={(e) => onChangeParams({ epochs: Number(e.target.value) })}
                className="bw-slider"
              />

              <div className="preset-row-bw">
                <button
                  type="button"
                  className="preset-btn-bw"
                  onClick={() => onApplyPreset('untrained')}
                >
                  Baby (Try 8)
                </button>
                <button
                  type="button"
                  className="preset-btn-bw"
                  onClick={() => onApplyPreset('mid')}
                >
                  Learner (Try 75)
                </button>
                <button
                  type="button"
                  className="preset-btn-bw"
                  onClick={() => onApplyPreset('converged')}
                >
                  <Sparkles size={12} /> Stunt Pro (Try 360)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: AI BRAIN SETTINGS */}
        <div className="accordion-box">
          <button
            type="button"
            className={`accordion-header ${openSection === 'brain' ? 'active' : ''}`}
            onClick={() => toggleSection('brain')}
          >
            <span>2. AI Brain Settings</span>
            {openSection === 'brain' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {openSection === 'brain' && (
            <div className="accordion-content">
              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Brain Speed (Learning Rate)
                    <HelpTooltip
                      title="Brain Speed (Learning Rate)"
                      explain="How big of a change the AI makes after each mistake. Too high makes the AI hyper and shaky; a gentle speed helps it learn smoothly!"
                      tip="Keep around 0.0005 for smooth stunts."
                    />
                  </span>
                  <strong>{params.learningRate.toFixed(4)}</strong>
                </div>
                <input
                  type="range"
                  min={0.0001}
                  max={0.01}
                  step={0.0001}
                  value={params.learningRate}
                  onChange={(e) => onChangeParams({ learningRate: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Random Curiosity (Try New Tricks)
                    <HelpTooltip
                      title="Random Curiosity (Exploration Noise)"
                      explain="How often the AI presses random air-jet buttons just to see what happens! Low = careful and steady; High = wild and crazy!"
                      tip="Set to 5% for clean landings, or 50%+ for wild chaos."
                    />
                  </span>
                  <strong>{Math.round(params.explorationNoise * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={params.explorationNoise}
                  onChange={(e) => onChangeParams({ explorationNoise: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Look-Ahead Memory
                    <HelpTooltip
                      title="Look-Ahead Memory (Discount Factor)"
                      explain="Does the AI only care about the next 1 second, or does it plan ahead for the landing at the end of the jump?"
                      tip="0.99 means the AI plans ahead for a safe landing!"
                    />
                  </span>
                  <strong>{params.discountFactor.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={0.999}
                  step={0.005}
                  value={params.discountFactor}
                  onChange={(e) => onChangeParams({ discountFactor: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Ghost Practice Cars
                    <HelpTooltip
                      title="Ghost Practice Cars"
                      explain="Shows see-through ghost copies of the vehicle practicing slightly different moves at the exact same time!"
                      tip="Set to 0 to see only the main car, or up to 8 for a swarm."
                    />
                  </span>
                  <strong>{params.ghostSwarmCount}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={params.ghostSwarmCount}
                  onChange={(e) => onChangeParams({ ghostSwarmCount: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: AI SCORE RULES */}
        <div className="accordion-box">
          <button
            type="button"
            className={`accordion-header ${openSection === 'goals' ? 'active' : ''}`}
            onClick={() => toggleSection('goals')}
          >
            <span>3. AI Score Rules (Rewards)</span>
            {openSection === 'goals' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {openSection === 'goals' && (
            <div className="accordion-content">
              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Reach Target Height / Loop Stick
                    <HelpTooltip
                      title="Reach Target Goal Points"
                      explain="How many treat points the AI gets for floating at the right height or sticking tightly to the Hot-Wheels loop!"
                    />
                  </span>
                  <strong>{params.rewardAltitudeWeight.toFixed(1)}x</strong>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={4.0}
                  step={0.1}
                  value={params.rewardAltitudeWeight}
                  onChange={(e) =>
                    onChangeParams({ rewardAltitudeWeight: Number(e.target.value) })
                  }
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Stay Flat & Level Bonus
                    <HelpTooltip
                      title="Stay Flat & Level Bonus"
                      explain="Rewards the AI for keeping the car level so it doesn't land upside-down!"
                    />
                  </span>
                  <strong>{params.rewardAttitudeWeight.toFixed(1)}x</strong>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={4.0}
                  step={0.1}
                  value={params.rewardAttitudeWeight}
                  onChange={(e) =>
                    onChangeParams({ rewardAttitudeWeight: Number(e.target.value) })
                  }
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Smoothness (No Jitter)
                    <HelpTooltip
                      title="Smoothness Bonus"
                      explain="Stops the AI from slamming the air jets on and off like a jackhammer!"
                    />
                  </span>
                  <strong>{params.rewardSmoothnessWeight.toFixed(1)}x</strong>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  value={params.rewardSmoothnessWeight}
                  onChange={(e) =>
                    onChangeParams({ rewardSmoothnessWeight: Number(e.target.value) })
                  }
                  className="bw-slider"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: PLANET GRAVITY & AIR TANK */}
        <div className="accordion-box">
          <button
            type="button"
            className={`accordion-header ${openSection === 'world' ? 'active' : ''}`}
            onClick={() => toggleSection('world')}
          >
            <span>4. Planet Gravity & Air Tank</span>
            {openSection === 'world' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {openSection === 'world' && (
            <div className="accordion-content">
              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Planet Pull (Gravity)
                    <HelpTooltip
                      title="Planet Pull (Gravity)"
                      explain="How hard the ground pulls the car down! 0.16G is the Moon (super floaty!), 0.38G is Mars, and 1.00G is Earth."
                    />
                  </span>
                  <strong>
                    {params.gravityMultiplier.toFixed(2)} G{' '}
                    {params.gravityMultiplier < 0.25
                      ? '(Moon)'
                      : params.gravityMultiplier < 0.5
                        ? '(Mars)'
                        : '(Earth)'}
                  </strong>
                </div>
                <input
                  type="range"
                  min={0.16}
                  max={1.8}
                  step={0.02}
                  value={params.gravityMultiplier}
                  onChange={(e) => onChangeParams({ gravityMultiplier: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>

              <div className="control-item-bw">
                <div className="control-label-bw">
                  <span>
                    Air Tank Pressure (PSI)
                    <HelpTooltip
                      title="Air Tank Pressure (COPV PSI)"
                      explain="How much squeezed air is inside the Roadster's tank! 10,000 PSI gives maximum jet power; low pressure makes the jets weak."
                    />
                  </span>
                  <strong>{params.initialCopvPsi} PSI</strong>
                </div>
                <input
                  type="range"
                  min={3000}
                  max={10000}
                  step={250}
                  value={params.initialCopvPsi}
                  onChange={(e) => onChangeParams({ initialCopvPsi: Number(e.target.value) })}
                  className="bw-slider"
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: SAVED AI BRAINS */}
        <div className="accordion-box">
          <button
            type="button"
            className={`accordion-header ${openSection === 'save' ? 'active' : ''}`}
            onClick={() => toggleSection('save')}
          >
            <span>5. Saved AI Brains ({checkpoints.length})</span>
            {openSection === 'save' ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {openSection === 'save' && (
            <div className="accordion-content">
              <form className="save-row-bw" onSubmit={handleSave}>
                <input
                  type="text"
                  placeholder="Name your AI brain..."
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  maxLength={50}
                />
                <button type="submit" className="save-btn-bw">
                  <Save size={13} /> Save
                </button>
              </form>

              <div className="ckpt-list-bw">
                {checkpoints.map((c) => (
                  <div key={c.id} className="ckpt-item-bw" onClick={() => onLoadCheckpoint(c)}>
                    <div className="ckpt-info-bw">
                      <strong>{c.name}</strong>
                      <span>Try #{c.epochs}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
