import React from 'react';
import { ArrowUpRight, Car, Compass, Flame, HelpCircle, Rocket, Sparkles } from 'lucide-react';
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
    <div className="rv-landing">
      {/* Subtle Architectural Grid & Orbital Halo Backdrop */}
      <div className="rv-grid-backdrop" />
      <div className="rv-orbital-ring rv-ring-outer" />
      <div className="rv-orbital-ring rv-ring-inner" />

      {/* Minimalist Top Bar */}
      <header className="rv-top-nav">
        <div className="rv-brand-mark">
          <span className="rv-dot" />
          <span className="rv-brand-name">ROADSTERVERSE</span>
          <span className="rv-brand-tag">v5.0 // 6-DoF ROCKET LAB</span>
        </div>

        <div className="rv-nav-telemetry">
          <span>10,000 PSI COLD-GAS</span>
          <span className="rv-sep">/</span>
          <span>2-STAGE RELEASE &amp; CATCH</span>
          <span className="rv-sep">/</span>
          <span>REAL GRAVITY</span>
        </div>

        <button type="button" className="rv-nav-cta" onClick={onEnterPlayground}>
          <span>LAUNCH SANDBOX</span>
          <ArrowUpRight size={14} />
        </button>
      </header>

      {/* Center Minimalist Hero */}
      <main className="rv-hero-center">
        <div className="rv-pill-eyebrow">
          <Sparkles size={12} />
          <span>2026 TESLA ROADSTER COUPÉ &amp; SPACEX STARSHIP AI PLAYGROUND</span>
        </div>

        <h1 className="rv-hero-title">
          <AnimatedDecodeText text="RoadsterVerse" durationMs={560} />
        </h1>

        <p className="rv-hero-lead">
          Train a live neural brain to fly a{' '}
          <strong>Cold-Gas Rocket Roadster Coupé</strong>, release a{' '}
          <strong>2-Stage SpaceX Starship</strong>, and thrust slow vertical landings under real
          gravity. Slide from <strong>Try #8 (Clumsy Crash)</strong> to{' '}
          <strong>Try #380 (Stunt Master)</strong>.
        </p>

        {/* Primary Action Row */}
        <div className="rv-hero-actions">
          <button type="button" className="rv-primary-btn" onClick={onEnterPlayground}>
            <span>ENTER ROADSTERVERSE</span>
            <ArrowUpRight size={17} />
          </button>

          <div className="rv-mini-badges">
            <span className="rv-glass-chip">
              <Flame size={12} /> 2-Stage Booster Release &amp; Slow Landing
            </span>
            <span className="rv-glass-chip">
              <Compass size={12} /> Side-Jet Kickflips &amp; Boostback Flips
            </span>
            <span className="rv-glass-chip">
              <HelpCircle size={12} /> Kid-Friendly &ldquo;?&rdquo; Guides
            </span>
          </div>
        </div>

        {/* Minimalist Glassmorphic Stunt Selector Strip */}
        <section className="rv-stunt-deck" aria-label="Select Stunt Arena">
          <div className="rv-deck-header">
            <span>SELECT A STUNT ARENA TO LAUNCH IMMEDIATELY</span>
            <span>01 — 06</span>
          </div>

          <div className="rv-stunt-grid">
            {MISSION_LIST.map((m, idx) => {
              const active = m.id === selectedMissionId;
              const cleanName = m.title.replace(/^Stunt \d+ \/\/ |^Mission \d+ \/\/ /, '');
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`rv-stunt-card ${active ? 'active' : ''}`}
                  onClick={() => onSelectMissionAndEnter(m.id)}
                >
                  <div className="rv-stunt-card-top">
                    <span className="rv-stunt-num">0{idx + 1}</span>
                    {m.vehicle === 'roadster' ? <Car size={14} /> : <Rocket size={14} />}
                  </div>
                  <div className="rv-stunt-card-title">{cleanName}</div>
                  <div className="rv-stunt-card-sub">{m.subtitle}</div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Minimalist Bottom Footnote */}
      <footer className="rv-footer">
        <span>PURE MONOCHROME EDITION</span>
        <span>•</span>
        <span>CLICK ANY &ldquo;?&rdquo; BADGE INSIDE FOR SIMPLE KID-FRIENDLY EXPLANATIONS</span>
        <span>•</span>
        <span>GLASSMORPHIC MINIMIZABLE HUD</span>
      </footer>
    </div>
  );
};
