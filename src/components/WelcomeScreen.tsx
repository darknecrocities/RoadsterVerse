import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Cpu, Play } from 'lucide-react';
import type { MissionId } from '../types/simulation.ts';
import { MISSION_LIST, MISSIONS } from '../rl/missions.ts';
import { AnimatedDecodeText } from './AnimatedText.tsx';

interface WelcomeScreenProps {
  selectedMissionId: MissionId;
  onSelectMissionAndEnter: (missionId: MissionId) => void;
  onEnterPlayground: () => void;
}

const SPACEX_HEADLINES: Record<MissionId, { dateTag: string; heroTitle: string }> = {
  'starship-booster-catch': {
    dateTag: 'OCTOBER 17, 2026 // FLIGHT 14 MISSION',
    heroTitle: 'STARSHIP FLIGHT 14',
  },
  'starship-launch': {
    dateTag: 'OCTOBER 17, 2026 // ORBITAL ASCENT & STAGE RELEASE',
    heroTitle: 'HOT-STAGE & BOOSTER RETURN',
  },
  'starship-belly-flop': {
    dateTag: 'OCTOBER 17, 2026 // TERMINAL FLIP & MECHAZILLA CATCH',
    heroTitle: 'STARSHIP TOWER CATCH',
  },
  'roadster-wall-climb': {
    dateTag: 'OCTOBER 17, 2026 // SPACEX COLD-GAS THRUSTER PACKAGE',
    heroTitle: 'ROADSTER HALF-LOOP FLIGHT',
  },
  'roadster-barrel-roll': {
    dateTag: 'OCTOBER 17, 2026 // 10,000 PSI COPV AEROBATICS',
    heroTitle: 'ROADSTER 360° KICKFLIP',
  },
  'roadster-obstacle-race': {
    dateTag: 'OCTOBER 17, 2026 // HIGH-SPEED AERO GAUNTLET & THRUSTER JUMP',
    heroTitle: 'ROADSTER OBSTACLE RACE',
  },
  'roadster-hover': {
    dateTag: 'OCTOBER 17, 2026 // 6-DoF COLD-GAS HOVER TEST',
    heroTitle: 'ROADSTER SUPERSONIC HOVER',
  },
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  selectedMissionId,
  onSelectMissionAndEnter,
  onEnterPlayground,
}) => {
  const [previewMissionId, setPreviewMissionId] = useState<MissionId>(selectedMissionId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const burstsRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }>>([]);

  const activeMission = MISSIONS[previewMissionId];
  const heroMeta = SPACEX_HEADLINES[previewMissionId];

  // Mouse move and click particle interaction
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onClickCanvas = (e: MouseEvent) => {
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        burstsRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 24 + Math.random() * 18,
          size: 2 + Math.random() * 4,
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClickCanvas);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClickCanvas);
    };
  }, []);

  // Full-bleed 60fps SpaceX Flight 14 & Roadster Stunt Monochrome Canvas Backdrop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth * Math.min(window.devicePixelRatio, 2);
      canvas.height = window.innerHeight * Math.min(window.devicePixelRatio, 2);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.016;

      // Smooth mouse parallax lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;
      const px = mouseRef.current.x * 28;
      const py = mouseRef.current.y * 18;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5 + px;

      // 1. Deep Stratosphere Monochrome Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0.0, '#050505');
      skyGrad.addColorStop(0.48, '#171717');
      skyGrad.addColorStop(0.78, '#262626');
      skyGrad.addColorStop(1.0, '#070707');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Diagonal High-Altitude Contrail Streak (with parallax)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = Math.max(2, w * 0.004);
      ctx.beginPath();
      ctx.moveTo(w * 0.18 + px * 0.4, h * 0.06 + py * 0.4);
      ctx.quadraticCurveTo(w * 0.48 + px * 0.7, h * 0.34 + py * 0.7, w * 0.86 + px, h * 0.68 + py);
      ctx.stroke();
      ctx.restore();

      // 3. Lower Horizon Cumulus Cloud Banks (lit by plume glow)
      for (let i = 0; i < 9; i++) {
        const cloudX = (w * (i + 0.3)) / 8.5 + Math.sin(t * 0.25 + i) * 18 + px * 0.3;
        const cloudY = h * (0.76 + (i % 3) * 0.06) + py * 0.3;
        const cloudR = Math.max(w, h) * (0.11 + (i % 2) * 0.05);
        const cg = ctx.createRadialGradient(cloudX, cloudY, cloudR * 0.1, cloudX, cloudY, cloudR);
        cg.addColorStop(0, 'rgba(212, 212, 212, 0.22)');
        cg.addColorStop(0.55, 'rgba(82, 82, 82, 0.12)');
        cg.addColorStop(1, 'rgba(10, 10, 10, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, cloudR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (activeMission.vehicle === 'starship') {
        // 4A. Center Ascending 2-Stage SpaceX Starship + Super Heavy Booster Silhouette & Plume
        const bobY = Math.sin(t * 2.2) * 6 + py;
        const rocketTopY = h * 0.24 + bobY;
        const shipH = h * 0.17;
        const boosterH = h * 0.26;
        const radius = Math.max(11, w * 0.0095);

        // Supersonic Raptor Mach-Diamond Plume Column below Booster
        const plumeTopY = rocketTopY + shipH + boosterH;
        const plumeGrad = ctx.createLinearGradient(cx, plumeTopY, cx, h * 0.98);
        plumeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
        plumeGrad.addColorStop(0.25, 'rgba(245, 245, 245, 0.78)');
        plumeGrad.addColorStop(0.65, 'rgba(163, 163, 163, 0.32)');
        plumeGrad.addColorStop(1.0, 'rgba(23, 23, 23, 0)');
        ctx.fillStyle = plumeGrad;
        ctx.beginPath();
        ctx.moveTo(cx - radius * 0.95, plumeTopY);
        ctx.lineTo(cx + radius * 0.95, plumeTopY);
        ctx.lineTo(cx + radius * 2.8, h * 0.98);
        ctx.lineTo(cx - radius * 2.8, h * 0.98);
        ctx.closePath();
        ctx.fill();

        // Pulsing Mach Diamonds in Plume
        for (let m = 0; m < 5; m++) {
          const dy = plumeTopY + (m + 1) * 36 + Math.sin(t * 8 + m) * 4;
          if (dy < h * 0.88) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.beginPath();
            ctx.arc(cx, dy, radius * 0.55 - m * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Super Heavy Booster (White/Silver Cryogenic Frost Cladding + Grid Fins)
        ctx.fillStyle = '#e5e5e5';
        ctx.fillRect(cx - radius, rocketTopY + shipH, radius * 2, boosterH);
        ctx.fillStyle = '#262626';
        ctx.fillRect(cx - radius, rocketTopY + shipH, radius * 2, 6); // Hot-stage ring
        ctx.fillRect(cx - radius * 1.7, rocketTopY + shipH + 10, radius * 0.7, 5); // Left grid fin
        ctx.fillRect(cx + radius, rocketTopY + shipH + 10, radius * 0.7, 5); // Right grid fin
        ctx.fillRect(cx - radius * 0.22, rocketTopY + shipH + boosterH * 0.55, radius * 0.44, boosterH * 0.45); // Chine

        // Upper Stage Starship (Dark Windward TPS + Stainless Edge + Aft & Fwd Flaps)
        ctx.fillStyle = '#171717';
        ctx.beginPath();
        ctx.moveTo(cx, rocketTopY);
        ctx.quadraticCurveTo(cx + radius, rocketTopY + shipH * 0.22, cx + radius, rocketTopY + shipH * 0.35);
        ctx.lineTo(cx + radius, rocketTopY + shipH);
        ctx.lineTo(cx - radius, rocketTopY + shipH);
        ctx.lineTo(cx - radius, rocketTopY + shipH * 0.35);
        ctx.quadraticCurveTo(cx - radius, rocketTopY + shipH * 0.22, cx, rocketTopY);
        ctx.closePath();
        ctx.fill();

        // Aft & Forward Aero Flaps
        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.moveTo(cx - radius, rocketTopY + shipH * 0.68);
        ctx.lineTo(cx - radius * 1.85, rocketTopY + shipH * 0.92);
        ctx.lineTo(cx - radius, rocketTopY + shipH * 0.96);
        ctx.moveTo(cx + radius, rocketTopY + shipH * 0.68);
        ctx.lineTo(cx + radius * 1.85, rocketTopY + shipH * 0.92);
        ctx.lineTo(cx + radius, rocketTopY + shipH * 0.96);
        ctx.fill();
      } else {
        // 4B. Center 2026 Tesla Roadster Coupé Firing Cold-Gas Jets Over Stunt Track
        const carY = h * 0.46 + Math.sin(t * 2.8) * 10 + py;
        const carW = Math.max(220, w * 0.22);
        const carH = carW * 0.28;

        // Cold-Gas Supersonic White Plume Jets under all 4 corners
        for (const ox of [-carW * 0.32, carW * 0.32]) {
          const jg = ctx.createLinearGradient(cx + ox, carY + carH * 0.3, cx + ox, carY + carH * 1.9);
          jg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          jg.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = jg;
          ctx.beginPath();
          ctx.moveTo(cx + ox - 12, carY + carH * 0.3);
          ctx.lineTo(cx + ox + 12, carY + carH * 0.3);
          ctx.lineTo(cx + ox + 36, carY + carH * 1.85);
          ctx.lineTo(cx + ox - 36, carY + carH * 1.85);
          ctx.closePath();
          ctx.fill();
        }

        // Sleek White 2026 Roadster Coupé Silhouette + Rear Wing
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.moveTo(cx - carW * 0.5, carY + carH * 0.25);
        ctx.lineTo(cx - carW * 0.46, carY - carH * 0.12);
        ctx.quadraticCurveTo(cx - carW * 0.1, carY - carH * 0.58, cx + carW * 0.16, carY - carH * 0.15);
        ctx.lineTo(cx + carW * 0.5, carY + carH * 0.12);
        ctx.lineTo(cx + carW * 0.48, carY + carH * 0.28);
        ctx.closePath();
        ctx.fill();
      }

      // 5. Interactive Click Particles
      const bursts = burstsRef.current;
      for (let b = bursts.length - 1; b >= 0; b--) {
        const pt = bursts[b];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        const alpha = Math.max(0, 1 - pt.life / pt.maxLife);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1 - pt.life / pt.maxLife), 0, Math.PI * 2);
        ctx.fill();
        if (pt.life >= pt.maxLife) {
          bursts.splice(b, 1);
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [activeMission.vehicle]);

  const cycleNextMission = () => {
    const idx = MISSION_LIST.findIndex((m) => m.id === previewMissionId);
    const next = MISSION_LIST[(idx + 1) % MISSION_LIST.length];
    setPreviewMissionId(next.id);
  };

  return (
    <div className="sx-landing-root">
      <canvas ref={canvasRef} className="sx-hero-canvas" />
      <div className="sx-vignette-overlay" />

      {/* Frameless SpaceX Top Navigation Bar */}
      <header className="sx-frameless-navbar">
        <div className="sx-nav-left">
          <button
            type="button"
            className="sx-wordmark-btn"
            onClick={() => onSelectMissionAndEnter(previewMissionId)}
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
                  title={`Preview Stunt 0${idx + 1}: ${m.title}`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Rectangular SpaceX Dropdown Selector */}
        <div className="sx-nav-right">
          <div className="sx-dropdown-wrap">
            <button
              type="button"
              className="sx-upcoming-btn"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <span>UPCOMING STUNTS ({MISSION_LIST.length})</span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div className="sx-dropdown-menu">
                {MISSION_LIST.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`sx-dropdown-item ${m.id === previewMissionId ? 'active' : ''}`}
                    onClick={() => {
                      setDropdownOpen(false);
                      onSelectMissionAndEnter(m.id);
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
            )}
          </div>
        </div>
      </header>

      {/* Bottom-Left SpaceX Flight 14 Mission Headline & Rectangular Ghost Button */}
      <main className="sx-bottom-left-hero">
        <div className="sx-date-eyebrow">{heroMeta.dateTag}</div>
        <h1 className="sx-hero-headline">
          <AnimatedDecodeText text={heroMeta.heroTitle} durationMs={420} />
        </h1>
        <p className="sx-hero-subtitle">
          {activeMission.subtitle} — Train the neural brain from{' '}
          <strong>Epoch #8 (Clumsy Failure)</strong> to{' '}
          <strong>Epoch #{activeMission.recommendedEpochs} (Stunt Master)</strong> under real 6-DoF
          gravity.
        </p>

        <div className="sx-cta-row">
          <button
            type="button"
            className="sx-watch-btn"
            onClick={() => onSelectMissionAndEnter(previewMissionId)}
          >
            <span>WATCH &amp; TRAIN</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            className="sx-watch-btn secondary"
            onClick={onEnterPlayground}
          >
            <Cpu size={14} />
            <span>ENTER SIMULATOR</span>
          </button>
        </div>
      </main>

      {/* Bottom-Right Picture-in-Picture Mission Preview Card (matching SpaceX bottom-right video card) */}
      <aside className="sx-pip-preview-card" aria-label="Mission Preview Switcher">
        <div
          className="sx-pip-screen"
          onClick={() => onSelectMissionAndEnter(previewMissionId)}
          role="button"
          tabIndex={0}
        >
          <div className="sx-pip-top-row">
            <span className="sx-pip-badge">{activeMission.badge}</span>
            <span className="sx-pip-play">
              <Play size={11} /> LIVE 3D
            </span>
          </div>

          <div className="sx-pip-center-art">
            <strong>{activeMission.title}</strong>
            <span>TARGET EPOCH: #{activeMission.recommendedEpochs}</span>
          </div>

          <div className="sx-pip-bottom-row">
            <span>{ heroMeta.heroTitle }</span>
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
