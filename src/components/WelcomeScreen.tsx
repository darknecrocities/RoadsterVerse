import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Cpu, Github, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import type { MissionId } from '../types/simulation.ts';
import { MISSION_LIST, MISSIONS } from '../rl/missions.ts';
import { AnimatedDecodeText } from './AnimatedText.tsx';
import { LandingStunt3DPreview } from './LandingStunt3DPreview.tsx';

interface WelcomeScreenProps {
  selectedMissionId: MissionId;
  audioEnabled: boolean;
  onToggleAudio: () => void;
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
  'starship-pod-orbit': {
    category: 'PROJECT ROADSTERVERSE // ORBITAL MICROGRAVITY',
    heroTitle: 'ORBITAL INSERTION & SATELLITE DEPLOYMENT',
    tagline: 'Microgravity RCS Attitude Hold & Solar Array Articulation',
    description:
      'Low Earth orbit deployment mechanics where 8-nozzle cold-gas nitrogen RCS thrusters arrest stage separation tumble, stabilizing spacecraft attitude before deploying articulated photovoltaic arrays.',
    badge: 'MISSION 08',
  },
  'starship-booster-catch': {
    category: 'PROJECT ROADSTERVERSE // TOWER RECOVERY DYNAMICS',
    heroTitle: 'SUPER HEAVY BOOSTER TOWER CATCH',
    tagline: 'Grid Fin Aerodynamic Steering & Tower Catch Arm Capture',
    description:
      'Atmospheric booster entry steered by 4 cast-titanium grid fins. Center Raptors throttle and gimbal to decelerate the 71m booster to 0 m/s between the Orbital Launch and Catch Tower Arms to engage structural catch pins.',
    badge: 'MISSION 07',
  },
  'starship-launch': {
    category: 'PROJECT ROADSTERVERSE // FULL-STACK FLIGHT PROFILE',
    heroTitle: 'ORBITAL LIFTOFF & HOT-STAGE JETTISON',
    tagline: '33-Raptor Ascent, Vented Ring Separation & Boostback',
    description:
      'Full-stack orbital ascent powered by 33 Raptor engines producing 74 MN thrust. A closed-loop neural guidance policy executes vented hot-staging ring separation followed by booster boostback return.',
    badge: 'MISSION 05',
  },
  'starship-belly-flop': {
    category: 'PROJECT ROADSTERVERSE // TERMINAL AERODYNAMICS',
    heroTitle: 'TERMINAL ENTRY & RAPTOR FLIP BURN',
    tagline: 'Body Flap Skydive Deceleration to 3-Raptor TVC Relight',
    description:
      'Subsonic atmospheric entry holding an 85° angle of attack using 4 independent electromechanical body flaps for aerodynamic trim, followed by an explosive 3-Raptor TVC flip burn for vertical landing.',
    badge: 'MISSION 06',
  },
  'roadster-wall-climb': {
    category: 'PROJECT ROADSTERVERSE // TRACTION & AERODYNAMICS',
    heroTitle: 'INVERTED PARABOLIC LOOP & DOWNFORCE',
    tagline: 'Gas-Dynamic Active Ground Effect (N > 0)',
    description:
      'Continuous aerodynamic downforce and vectored cold-gas thrust generation pinning the 2026 Roadster chassis against vertical parabolic ramps without wheel slip or inverted gravity stall.',
    badge: 'STUNT 02',
  },
  'roadster-barrel-roll': {
    category: 'PROJECT ROADSTERVERSE // 6-DOF ROTATIONAL AEROBATICS',
    heroTitle: 'BALLISTIC LAUNCH & 360° RCS ROLL',
    tagline: 'Quarter-Pipe Trajectory & Thruster-Assisted Roll Rate',
    description:
      'High-velocity quarter-pipe ramp takeoff into ballistic flight. Asymmetric cold-gas RCS impulse bursts impart roll torque to complete a full 360° rotation before retro-thrust vertical cushion touchdown.',
    badge: 'STUNT 03',
  },
  'roadster-obstacle-race': {
    category: 'PROJECT ROADSTERVERSE // PROVING GROUND TEST TRACK',
    heroTitle: 'PROVING GROUND SLALOM & BARRIER LEAP',
    tagline: 'Predictive Trajectory Planning, Downforce & Cold-Gas Vault',
    description:
      'Tri-motor AWD Plaid acceleration across a wide 24-meter, 10km proving ground test track. Neural look-ahead radar navigates concrete chicanes before a synchronized 4-nozzle cold-gas impulse vault over an 8.8km test barrier.',
    badge: 'STUNT 04',
  },
  'roadster-hover': {
    category: 'PROJECT ROADSTERVERSE // COLD-GAS PROPULSION',
    heroTitle: 'QUAD-NOZZLE COLD-GAS HOVER',
    tagline: 'Dual 700-bar COPV Closed-Loop Altitude Stabilization',
    description:
      'Sub-millimeter altitude stabilization using 4 supersonic cold-gas nitrogen thrusters fed by dual 700-bar carbon-overwrapped pressure vessels (COPV) under closed-loop PPO attitude control.',
    badge: 'STUNT 01',
  },
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  selectedMissionId,
  audioEnabled,
  onToggleAudio,
  onSelectMissionAndEnter,
  onEnterPlayground,
}) => {
  const [previewMissionId, setPreviewMissionId] = useState<MissionId>(selectedMissionId);
  const [isUntrainedMode, setIsUntrainedMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeMission = MISSIONS[previewMissionId];
  const meta = ROADSTERVERSE_STUNT_DETAILS[previewMissionId];

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
            <img src="/favicon.svg" alt="RoadsterVerse Logo" className="sx-wordmark-icon" />
            <span className="sx-wordmark-text">ROADSTERVERSE</span>
          </button>

          <nav className="sx-nav-links" aria-label="Mission Navigation">
            {MISSION_LIST.map((m, idx) => {
              const isSelected = m.id === previewMissionId;
              const label =
                m.id === 'roadster-hover'
                  ? '01 HOVER'
                  : m.id === 'roadster-wall-climb'
                    ? '02 LOOP'
                    : m.id === 'roadster-barrel-roll'
                      ? '03 ROLL'
                      : m.id === 'roadster-obstacle-race'
                        ? '04 SLALOM'
                        : m.id === 'starship-launch'
                          ? '05 LIFTOFF'
                          : m.id === 'starship-belly-flop'
                            ? '06 FLIP'
                            : m.id === 'starship-booster-catch'
                              ? '07 CATCH'
                              : '08 ORBIT';
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

        {/* Right Action Controls: GitHub Repo Link, Sound Button & All Stunts Dropdown */}
        <div className="sx-nav-right">
          <a
            href="https://github.com/darknecrocities/RoadsterVerse"
            target="_blank"
            rel="noopener noreferrer"
            className="sx-upcoming-btn sx-github-nav-btn"
            title="View RoadsterVerse on GitHub"
            aria-label="GitHub Repository"
          >
            <Github size={13} />
            <span>GITHUB</span>
          </a>

          <button
            type="button"
            className={`sx-upcoming-btn sx-sound-toggle-btn ${audioEnabled ? 'active' : ''}`}
            onClick={onToggleAudio}
            title={audioEnabled ? 'Mute Vehicle & Rocket Sound' : 'Turn On Vehicle & Rocket Sound'}
          >
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{audioEnabled ? 'SOUND ON' : 'MUTED'}</span>
          </button>

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
                ? '02 LOOP'
                : m.id === 'roadster-barrel-roll'
                  ? '03 ROLL'
                  : m.id === 'roadster-obstacle-race'
                    ? '04 SLALOM'
                    : m.id === 'starship-launch'
                      ? '05 LIFTOFF'
                      : m.id === 'starship-belly-flop'
                        ? '06 FLIP'
                        : m.id === 'starship-booster-catch'
                          ? '07 CATCH'
                          : '08 ORBIT';
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
    </div>
  );
};
