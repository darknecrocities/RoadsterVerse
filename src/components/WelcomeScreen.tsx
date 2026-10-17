import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Cpu, Play, Sparkles, X } from 'lucide-react';
import type { MissionId } from '../types/simulation.ts';
import { MISSION_LIST, MISSIONS } from '../rl/missions.ts';
import { AnimatedDecodeText } from './AnimatedText.tsx';
import { LandingStunt3DPreview } from './LandingStunt3DPreview.tsx';

interface WelcomeScreenProps {
  selectedMissionId: MissionId;
  onSelectMissionAndEnter: (missionId: MissionId) => void;
  onEnterPlayground: () => void;
}

export interface RoadsterVerseStuntMeta {
  category: string;
  heroTitle: string;
  tagline: string;
  description: string;
  badge: string;
}

export const ROADSTERVERSE_STUNT_DETAILS: Record<MissionId, RoadsterVerseStuntMeta> = {
  'starship-booster-catch': {
    category: 'PROJECT ROADSTERVERSE // TOWER RECOVERY DYNAMICS',
    heroTitle: 'SUPER HEAVY MECHAZILLA CATCH',
    tagline: 'Precision TVC Raptor Gimbaling & Tower Chopstick Capture',
    description:
      'Deep reinforcement learning guidance for full-scale Super Heavy booster return. Calibrated TVC Raptor gimbaling and grid-fin aerodynamics decelerate the booster from supersonic descent to 0 m/s inside Mechazilla catch arms.',
    badge: 'STUNT 07',
  },
  'starship-launch': {
    category: 'PROJECT ROADSTERVERSE // FULL-STACK FLIGHT PROFILE',
    heroTitle: 'HOT-STAGE SEPARATION & DESCENT',
    tagline: '33-Raptor Ascent, Ring Jettison & Vertical Recovery',
    description:
      'Full-stack orbital ascent powered by 33 Raptor engines up to stage separation altitude. A neural attitude policy executes hot-staging ring release followed by booster boostback and vertical landing burn.',
    badge: 'STUNT 05',
  },
  'starship-belly-flop': {
    category: 'PROJECT ROADSTERVERSE // TERMINAL AERODYNAMICS',
    heroTitle: 'AERO FLAP BELLY-FLOP & FLIP-BURN',
    tagline: 'Skydiver Deceleration to 3-Raptor Vertical Relight',
    description:
      'Active aerodynamic skydive attitude control using 4 independent articulating flaps during terminal atmospheric entry, transitioning into an explosive 3-Raptor flip maneuver for vertical recovery.',
    badge: 'STUNT 06',
  },
  'roadster-wall-climb': {
    category: 'PROJECT ROADSTERVERSE // DOWNFORCE & TRACTION',
    heroTitle: 'INVERTED 180° VERTICAL HALF-LOOP',
    tagline: 'Supersonic Cold-Gas Downforce Over Inverted Parabolic Arc',
    description:
      'Continuous aerodynamic downforce and vectored cold-gas thrust generation pinning the 2026 Roadster chassis against vertical parabolic ramps without wheel stall or mid-air levitation.',
    badge: 'STUNT 02',
  },
  'roadster-barrel-roll': {
    category: 'PROJECT ROADSTERVERSE // 6-DOF ROTATIONAL AEROBATICS',
    heroTitle: 'RAMP-LAUNCHED 360° KICKFLIP',
    tagline: 'Quarter-Pipe Trajectory & Thruster-Assisted Roll',
    description:
      'High-velocity ramp launch into mid-air roll thruster burst. Active neural attitude correction completes a full 360-degree rotation and executes a cushioned 4-point landing.',
    badge: 'STUNT 03',
  },
  'roadster-obstacle-race': {
    category: 'PROJECT ROADSTERVERSE // HIGH-SPEED OBSTACLE GAUNTLET',
    heroTitle: 'SLALOM GAUNTLET & THRUSTER JUMP',
    tagline: 'AWD Plaid Slalom & Mid-Air Cold-Gas Barrier Leap',
    description:
      'Tri-motor AWD Plaid acceleration through dynamic track pylons and barricades, timing mid-air nitrogen jumps over high-risk collision zones at 180+ MPH with zero grounded thruster waste.',
    badge: 'STUNT 04',
  },
  'roadster-hover': {
    category: 'PROJECT ROADSTERVERSE // COLD-GAS PROPULSION',
    heroTitle: 'QUAD-NOZZLE COLD-GAS HOVER',
    tagline: '10,000 PSI COPV Altitude Stabilization',
    description:
      'Sub-millimeter altitude stabilization using 4 cold-gas nitrogen thrusters fed by a 10,000 PSI carbon-overwrapped pressure vessel (COPV) replacing the rear seats under closed-loop PPO control.',
    badge: 'STUNT 01',
  },
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  selectedMissionId,
  onSelectMissionAndEnter,
  onEnterPlayground,
}) => {
  const [previewMissionId, setPreviewMissionId] = useState<MissionId>(selectedMissionId);
  const [isUntrainedMode, setIsUntrainedMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeMission = MISSIONS[previewMissionId];
  const meta = ROADSTERVERSE_STUNT_DETAILS[previewMissionId];

  const cycleNextMission = () => {
    const idx = MISSION_LIST.findIndex((m) => m.id === previewMissionId);
    const next = MISSION_LIST[(idx + 1) % MISSION_LIST.length];
    setPreviewMissionId(next.id);
  };

  return (
    <div className="sx-landing-root">
      {/* Live Working 60fps 3D Physics Stunt Preview */}
      <LandingStunt3DPreview
        missionId={previewMissionId}
        isUntrainedMode={isUntrainedMode}
      />
      <div className="sx-vignette-overlay" />

      {/* Frameless Top Navigation Bar — Responsive & Decluttered */}
      <header className="sx-frameless-navbar">
        <div className="sx-nav-left">
          <button
            type="button"
            className="sx-wordmark-btn"
            onClick={() => onSelectMissionAndEnter(previewMissionId)}
            title="RoadsterVerse Home"
          >
            <span className="sx-wordmark-text">ROADSTERVERSE</span>
          </button>

          <nav className="sx-nav-links" aria-label="Mission Navigation">
            {MISSION_LIST.map((m, idx) => {
              const isSelected = m.id === previewMissionId;
              const label =
                m.id === 'roadster-hover'
                  ? '01 HOVER'
                  : m.id === 'roadster-wall-climb'
                    ? '02 HALF-LOOP'
                    : m.id === 'roadster-barrel-roll'
                      ? '03 KICKFLIP'
                      : m.id === 'roadster-obstacle-race'
                        ? '04 OBSTACLE RACE'
                        : m.id === 'starship-launch'
                          ? '05 STAGE RELEASE'
                          : m.id === 'starship-belly-flop'
                            ? '06 CRANE CATCH'
                            : '07 BOOSTER CATCH';
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`sx-nav-link ${isSelected ? 'active' : ''}`}
                  onClick={() => setPreviewMissionId(m.id)}
                  onDoubleClick={() => onSelectMissionAndEnter(m.id)}
                  title={`Live Preview Stunt 0${idx + 1}: ${m.title}`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Action Controls: All Stunts Dropdown */}
        <div className="sx-nav-right">
          <div className="sx-dropdown-wrap">
            <button
              type="button"
              className="sx-upcoming-btn"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <span>ALL STUNTS ({MISSION_LIST.length})</span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="sx-dropdown-backdrop"
                  onClick={() => setDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div className="sx-dropdown-menu">
                  <div className="sx-dropdown-header">
                    <div className="sx-dropdown-header-title">
                      <strong>ALL STUNTS ({MISSION_LIST.length})</strong>
                      <span>SELECT TO PREVIEW LIVE 6-DOF PHYSICS</span>
                    </div>
                    <button
                      type="button"
                      className="sx-dropdown-close-btn"
                      onClick={() => setDropdownOpen(false)}
                      title="Close Stunts Menu"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {MISSION_LIST.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`sx-dropdown-item ${m.id === previewMissionId ? 'active' : ''}`}
                      onClick={() => {
                        setDropdownOpen(false);
                        setPreviewMissionId(m.id);
                      }}
                    >
                      <small>0{i + 1}</small>
                      <div>
                        <strong>{m.title.replace(/^Stunt \d+ \/\/ |^Mission \d+ \/\/ /, '')}</strong>
                        <span>{m.subtitle}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Quick-Select Chip Strip */}
      <nav className="sx-mobile-chips-bar" aria-label="Mobile Stunts Bar">
        {MISSION_LIST.map((m) => {
          const isSelected = m.id === previewMissionId;
          const shortName =
            m.id === 'roadster-hover'
              ? '01 HOVER'
              : m.id === 'roadster-wall-climb'
                ? '02 HALF-LOOP'
                : m.id === 'roadster-barrel-roll'
                  ? '03 KICKFLIP'
                  : m.id === 'roadster-obstacle-race'
                    ? '04 RACE'
                    : m.id === 'starship-launch'
                      ? '05 ASCENT'
                      : m.id === 'starship-belly-flop'
                        ? '06 SKYDIVE'
                        : '07 TOWER CATCH';
          return (
            <button
              key={m.id}
              type="button"
              className={`sx-mobile-chip ${isSelected ? 'active' : ''}`}
              onClick={() => setPreviewMissionId(m.id)}
            >
              {shortName}
            </button>
          );
        })}
      </nav>

      {/* Bottom-Left RoadsterVerse Mission Headline & Action Buttons */}
      <main className="sx-bottom-left-hero">
        <div className="sx-date-eyebrow">{meta.category}</div>
        <h1 className="sx-hero-headline">
          <AnimatedDecodeText text={meta.heroTitle} durationMs={420} />
        </h1>
        <p className="sx-hero-subtitle">
          {meta.description}
        </p>

        {/* Live Stunt Working Preview Policy Toggle */}
        <div className="sx-preview-policy-toggle-row">
          <span className="sx-toggle-label">PREVIEW POLICY:</span>
          <button
            type="button"
            className={`sx-policy-pill ${!isUntrainedMode ? 'active' : ''}`}
            onClick={() => setIsUntrainedMode(false)}
            title="Preview Mastered Policy (Epoch #380 Flawless Execution)"
          >
            <Sparkles size={12} />
            <span>MASTERED (#380)</span>
          </button>
          <button
            type="button"
            className={`sx-policy-pill ${isUntrainedMode ? 'active' : ''}`}
            onClick={() => setIsUntrainedMode(true)}
            title="Preview Untrained Policy (Epoch #8 Exploration Noise & Failures)"
          >
            <span>UNTRAINED (#8 FAIL)</span>
          </button>
        </div>

        <div className="sx-cta-row">
          <button
            type="button"
            className="sx-watch-btn"
            onClick={() => onSelectMissionAndEnter(previewMissionId)}
          >
            <span>LAUNCH SIMULATOR</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="sx-watch-btn secondary"
            onClick={onEnterPlayground}
          >
            <Cpu size={14} />
            <span>TRAINING SANDBOX</span>
          </button>
        </div>
      </main>

      {/* Bottom-Right Working Stunt Preview HUD Card */}
      <aside className="sx-pip-preview-card" aria-label="Mission Preview Switcher">
        <div
          className="sx-pip-screen"
          onClick={() => onSelectMissionAndEnter(previewMissionId)}
          role="button"
          tabIndex={0}
        >
          <div className="sx-pip-top-row">
            <span className="sx-pip-badge">{meta.badge}</span>
            <span className="sx-pip-play">
              <Play size={11} /> LIVE PREVIEW
            </span>
          </div>

          <div className="sx-pip-center-art">
            <strong>{activeMission.title}</strong>
            <span>
              STATUS: {isUntrainedMode ? 'CLUMSY / FAILING NOISE' : 'FLAWLESS 6-DOF GUIDANCE'}
            </span>
          </div>

          <div className="sx-pip-bottom-row">
            <span>{meta.tagline}</span>
            <button
              type="button"
              className="sx-pip-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                cycleNextMission();
              }}
            >
              NEXT STUNT →
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
