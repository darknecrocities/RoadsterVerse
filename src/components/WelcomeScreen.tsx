import React from 'react';
import { ArrowRight, Car, HelpCircle, Rocket, Sparkles, Zap } from 'lucide-react';
import type { MissionId } from '../types/simulation.ts';
import { MISSION_LIST } from '../rl/missions.ts';
import { AnimatedDecodeText } from './AnimatedText.tsx';

interface WelcomeScreenProps {
  selectedMissionId: MissionId;
  onSelectMissionAndEnter: (missionId: MissionId) => void;
  onEnterPlayground: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  selectedMissionId,
  onSelectMissionAndEnter,
  onEnterPlayground,
}) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-grid-bg" />

      <div className="welcome-container">
        <div className="welcome-badge-row">
          <span className="mono-pill">INTERACTIVE 3D AI STUNT LAB</span>
          <span className="mono-pill">SIMPLE KID-FRIENDLY MODE</span>
        </div>

        <h1 className="welcome-hero-title">
          <AnimatedDecodeText text="THRUST // WEIGHT" durationMs={520} />
        </h1>

        <p className="welcome-hero-subtitle">
          Watch a computer brain learn how to fly a{' '}
          <strong>2026 Tesla Roadster with Cold-Air Rocket Jets</strong> and catch a{' '}
          <strong>SpaceX Starship</strong>—one practice try at a time!
        </p>

        {/* Simple 3-Step Kid-Friendly Guide */}
        <div className="welcome-steps-grid">
          <div className="welcome-step-card">
            <div className="welcome-step-num">01</div>
            <h3>
              <Zap size={15} /> Pick a Cool Stunt
            </h3>
            <p>
              Hover like a UFO, drive upside-down on a giant Hot-Wheels loop, jump a ramp for a
              360° kickflip, or launch a giant rocket!
            </p>
          </div>

          <div className="welcome-step-card">
            <div className="welcome-step-num">02</div>
            <h3>
              <Sparkles size={15} /> Slide the Practice Bar
            </h3>
            <p>
              At <strong>10 Practice Runs</strong>, the AI is like a clumsy baby and crashes! Slide
              it to <strong>350+ Practice Runs</strong> and watch it become a stunt pro.
            </p>
          </div>

          <div className="welcome-step-card">
            <div className="welcome-step-num">03</div>
            <h3>
              <HelpCircle size={15} /> Tap Any &ldquo;?&rdquo; Button
            </h3>
            <p>
              Every button and slider has a <strong>?</strong> helper that explains what it does in
              super simple words anyone can understand.
            </p>
          </div>
        </div>

        {/* Choose Your Starting Stunt */}
        <div className="welcome-stunt-section">
          <div className="welcome-section-label">CHOOSE A STUNT TO START PLAYING:</div>
          <div className="welcome-mission-grid">
            {MISSION_LIST.map((m, idx) => {
              const active = m.id === selectedMissionId;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`welcome-mission-card ${active ? 'active' : ''}`}
                  onClick={() => onSelectMissionAndEnter(m.id)}
                >
                  <div className="welcome-mission-top">
                    <span className="welcome-mission-idx">0{idx + 1}</span>
                    {m.vehicle === 'roadster' ? <Car size={15} /> : <Rocket size={15} />}
                  </div>
                  <div className="welcome-mission-name">
                    {m.title.replace(/^Stunt \d+ \/\/ |^Mission \d+ \/\/ /, '')}
                  </div>
                  <div className="welcome-mission-desc">{m.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="welcome-cta-row">
          <button type="button" className="welcome-enter-btn" onClick={onEnterPlayground}>
            <span>ENTER 3D STUNT PLAYGROUND</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
