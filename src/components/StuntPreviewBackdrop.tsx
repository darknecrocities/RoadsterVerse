import React, { useEffect, useRef } from 'react';
import type { MissionId } from '../types/simulation.ts';

interface StuntPreviewBackdropProps {
  missionId: MissionId;
  isUntrainedMode: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
}

export const StuntPreviewBackdrop: React.FC<StuntPreviewBackdropProps> = ({
  missionId,
  isUntrainedMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

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

    const spawnSmoke = (x: number, y: number, count: number, speed: number, dirY = 1) => {
      for (let i = 0; i < count; i++) {
        const angle = dirY > 0 ? Math.PI * 0.5 + (Math.random() - 0.5) * 0.8 : -Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
        const spd = (0.5 + Math.random() * 1.5) * speed;
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 12,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0,
          maxLife: 28 + Math.random() * 24,
          size: 4 + Math.random() * 8,
          alpha: 0.7,
        });
      }
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.016;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;

      // 1. Stratosphere Gradient Background (100% Monochrome Grayscale)
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0.0, '#050505');
      sky.addColorStop(0.5, '#121212');
      sky.addColorStop(0.82, '#1f1f1f');
      sky.addColorStop(1.0, '#080808');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Grid horizon line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.78);
      ctx.lineTo(w, h * 0.78);
      ctx.stroke();

      // Atmospheric high-altitude contrail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = Math.max(2, w * 0.003);
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.15);
      ctx.quadraticCurveTo(w * 0.45, h * 0.4, w * 0.9, h * 0.65);
      ctx.stroke();

      // 2. Mission-Specific Live Stunt Animation
      const cycle = isUntrainedMode ? (t % 4.5) / 4.5 : (t % 6.0) / 6.0;

      switch (missionId) {
        case 'roadster-hover': {
          // Stunt 01: 2026 Roadster Cold-Gas Supersonic Hover
          const hoverY = isUntrainedMode
            ? h * 0.55 + Math.sin(t * 7) * 22 + (cycle > 0.6 ? (cycle - 0.6) * 180 : 0)
            : h * 0.48 + Math.sin(t * 2.2) * 8;
          const tilt = isUntrainedMode ? Math.sin(t * 6) * 0.35 : Math.sin(t * 1.5) * 0.04;
          const carW = Math.max(200, w * 0.18);
          const carH = carW * 0.28;

          ctx.save();
          ctx.translate(cx, hoverY);
          ctx.rotate(tilt);

          // 4 Cold-Gas Nitrogen Thruster Jets
          if (!isUntrainedMode || cycle < 0.65) {
            for (const ox of [-carW * 0.32, carW * 0.32]) {
              const jg = ctx.createLinearGradient(ox, carH * 0.3, ox, carH * 1.8);
              jg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
              jg.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.fillStyle = jg;
              ctx.beginPath();
              ctx.moveTo(ox - 8, carH * 0.3);
              ctx.lineTo(ox + 8, carH * 0.3);
              ctx.lineTo(ox + 22, carH * 1.7);
              ctx.lineTo(ox - 22, carH * 1.7);
              ctx.closePath();
              ctx.fill();
              spawnSmoke(cx + ox, hoverY + carH * 0.5, 1, 2);
            }
          }

          // Roadster Body
          drawRoadsterBody(ctx, carW, carH);
          ctx.restore();
          break;
        }

        case 'roadster-wall-climb': {
          // Stunt 02: Inverted 180° Half-Loop Arc
          const loopRadius = Math.min(w * 0.18, h * 0.26);
          const loopCenterY = h * 0.52;
          const angle = isUntrainedMode
            ? cycle < 0.45 ? -Math.PI * 0.5 + cycle * Math.PI : -Math.PI * 0.05 // falls off at 0.45
            : -Math.PI * 0.5 + cycle * Math.PI * 1.8;

          // Draw the overhanging C-Loop track arc
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(cx, loopCenterY, loopRadius, -Math.PI * 0.5, Math.PI * 0.7);
          ctx.stroke();

          let carX = cx + Math.cos(angle) * loopRadius;
          let carY = loopCenterY + Math.sin(angle) * loopRadius;
          let carRot = angle + Math.PI * 0.5;

          if (isUntrainedMode && cycle >= 0.45) {
            // Falls off loop under gravity!
            const fallTime = cycle - 0.45;
            carX += fallTime * 140;
            carY += fallTime * fallTime * 800;
            carRot += fallTime * 6;
          }

          ctx.save();
          ctx.translate(carX, carY);
          ctx.rotate(carRot);
          drawRoadsterBody(ctx, 160, 44);
          ctx.restore();
          break;
        }

        case 'roadster-barrel-roll': {
          // Stunt 03: Ramp-Launched 360° Kickflip
          const carW = 170;
          const carH = 46;
          let carX = cx - w * 0.25 + cycle * w * 0.5;
          let carY = h * 0.72;
          let carRoll = 0;

          if (cycle > 0.25 && cycle < 0.8) {
            const mid = (cycle - 0.25) / 0.55;
            carY = h * 0.72 - Math.sin(mid * Math.PI) * (h * 0.32);
            carRoll = isUntrainedMode ? mid * Math.PI * 1.1 : mid * Math.PI * 2.0; // Untrained under-rotates
            spawnSmoke(carX, carY, 2, 2.5);
          }

          // Curved ramp profile
          ctx.fillStyle = '#262626';
          ctx.beginPath();
          ctx.moveTo(cx - w * 0.15, h * 0.78);
          ctx.quadraticCurveTo(cx - w * 0.08, h * 0.78, cx - w * 0.04, h * 0.65);
          ctx.lineTo(cx - w * 0.04, h * 0.78);
          ctx.closePath();
          ctx.fill();

          ctx.save();
          ctx.translate(carX, carY);
          ctx.rotate(carRoll);
          drawRoadsterBody(ctx, carW, carH);
          ctx.restore();
          break;
        }

        case 'roadster-obstacle-race': {
          // Stunt 04: Slalom Gauntlet & Thruster Jump
          const carW = 165;
          const carH = 45;
          const progress = (t * 0.45) % 1;
          const carX = cx - w * 0.24 + progress * w * 0.48;
          let carY = h * 0.72;

          // Road obstacles
          for (let ob = 0; ob < 3; ob++) {
            const obX = cx - w * 0.1 + ob * (w * 0.1);
            ctx.fillStyle = '#737373';
            ctx.fillRect(obX - 10, h * 0.72 - 32, 20, 36);
          }

          // Jump over barrier #2
          if (progress > 0.48 && progress < 0.75) {
            const jumpFrac = (progress - 0.48) / 0.27;
            carY = h * 0.72 - Math.sin(jumpFrac * Math.PI) * 90;
            spawnSmoke(carX, carY + 20, 2, 3);
          }

          ctx.save();
          ctx.translate(carX, carY);
          drawRoadsterBody(ctx, carW, carH);
          ctx.restore();
          break;
        }

        case 'starship-launch': {
          // Stunt 05: Hot-Stage Separation & Return
          const rocketW = Math.max(22, w * 0.016);
          const shipH = h * 0.15;
          const boosterH = h * 0.24;

          let rocketY = isUntrainedMode
            ? cycle < 0.45
              ? h * 0.7 - cycle * h * 0.35 // Lifts off then falls down!
              : h * 0.55 + (cycle - 0.45) * (cycle - 0.45) * 1200
            : h * 0.7 - cycle * h * 0.48;

          const tilt = isUntrainedMode && cycle > 0.3 ? (cycle - 0.3) * 1.8 : 0;

          // Pad mount
          ctx.fillStyle = '#171717';
          ctx.fillRect(cx - 36, h * 0.74, 72, 40);

          ctx.save();
          ctx.translate(cx, rocketY);
          ctx.rotate(tilt);

          // 33 Raptor Plume
          const plumeH = boosterH * 0.85;
          const pg = ctx.createLinearGradient(0, boosterH + shipH, 0, boosterH + shipH + plumeH);
          pg.addColorStop(0, '#ffffff');
          pg.addColorStop(0.3, 'rgba(240, 240, 240, 0.8)');
          pg.addColorStop(1, 'rgba(20, 20, 20, 0)');
          ctx.fillStyle = pg;
          ctx.fillRect(-rocketW * 0.9, boosterH + shipH, rocketW * 1.8, plumeH);
          spawnSmoke(cx, rocketY + boosterH + shipH + 10, 3, 4);

          drawStarshipStack(ctx, rocketW, shipH, boosterH, cycle > 0.55 && !isUntrainedMode);
          ctx.restore();

          // Explosion on untrained crash impact
          if (isUntrainedMode && cycle >= 0.7) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(cx, h * 0.74, (cycle - 0.7) * 260, 0, Math.PI * 2);
            ctx.fill();
            spawnSmoke(cx, h * 0.74, 8, 8);
          }
          break;
        }

        case 'starship-belly-flop': {
          // Stunt 06: Aero Flap Belly-Flop & Flip-and-Burn
          const rocketW = Math.max(20, w * 0.015);
          const shipH = h * 0.22;
          const descentY = h * 0.25 + cycle * h * 0.45;
          const isFlip = cycle > 0.65;
          const pitch = isFlip ? (cycle - 0.65) * 2.8 * Math.PI * 0.5 : Math.PI * 0.5;

          ctx.save();
          ctx.translate(cx, descentY);
          ctx.rotate(pitch);

          if (isFlip) {
            // Relit Raptor engines
            const pg = ctx.createLinearGradient(0, shipH, 0, shipH + 80);
            pg.addColorStop(0, '#ffffff');
            pg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = pg;
            ctx.fillRect(-rocketW * 0.7, shipH, rocketW * 1.4, 75);
            spawnSmoke(cx, descentY + 20, 3, 3);
          }

          drawUpperStageStarship(ctx, rocketW, shipH);
          ctx.restore();
          break;
        }

        case 'starship-booster-catch': {
          // Stunt 07: Super Heavy Mechazilla Tower Catch
          const boosterW = Math.max(22, w * 0.016);
          const boosterH = h * 0.32;
          const targetCatchY = h * 0.58;
          const boosterY = h * 0.2 + cycle * (targetCatchY - h * 0.2);

          // Mechazilla Launch Tower and Chopstick Catch Arms
          ctx.fillStyle = '#262626';
          ctx.fillRect(cx + boosterW * 1.5, h * 0.22, 18, h * 0.56); // Tower lattice
          ctx.fillStyle = '#e5e5e5';
          ctx.fillRect(cx - boosterW * 1.8, targetCatchY, boosterW * 3.6, 10); // Chopsticks

          ctx.save();
          ctx.translate(cx, boosterY);

          // Landing Burn
          const pg = ctx.createLinearGradient(0, boosterH, 0, boosterH + 90);
          pg.addColorStop(0, '#ffffff');
          pg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = pg;
          ctx.fillRect(-boosterW * 0.65, boosterH, boosterW * 1.3, 85);
          spawnSmoke(cx, boosterY + boosterH, 2, 3);

          drawBooster(ctx, boosterW, boosterH);
          ctx.restore();
          break;
        }
      }

      // 3. Render Smoke & Plume Particles
      const pts = particlesRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.size *= 1.02;
        const alpha = Math.max(0, p.alpha * (1 - p.life / p.maxLife));
        ctx.fillStyle = `rgba(240, 240, 240, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.life >= p.maxLife) {
          pts.splice(i, 1);
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [missionId, isUntrainedMode]);

  return <canvas ref={canvasRef} className="sx-hero-canvas" />;
};

function drawRoadsterBody(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Pure monochrome sleek 2026 Roadster Coupé
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.25);
  ctx.lineTo(-w * 0.46, -h * 0.12);
  ctx.quadraticCurveTo(-w * 0.1, -h * 0.58, w * 0.16, -h * 0.15);
  ctx.lineTo(w * 0.5, h * 0.12);
  ctx.lineTo(w * 0.48, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Glass canopy & wheels
  ctx.fillStyle = '#171717';
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, -h * 0.08);
  ctx.quadraticCurveTo(-w * 0.05, -h * 0.45, w * 0.12, -h * 0.1);
  ctx.closePath();
  ctx.fill();

  // Tires
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(-w * 0.32, h * 0.28, h * 0.28, 0, Math.PI * 2);
  ctx.arc(w * 0.32, h * 0.28, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarshipStack(
  ctx: CanvasRenderingContext2D,
  w: number,
  shipH: number,
  boosterH: number,
  separated: boolean
) {
  // Upper Stage Starship
  const shipOffsetY = separated ? -45 : 0;
  ctx.save();
  ctx.translate(0, shipOffsetY);
  drawUpperStageStarship(ctx, w, shipH);
  ctx.restore();

  // Booster
  drawBooster(ctx, w, boosterH, shipH);
}

function drawUpperStageStarship(ctx: CanvasRenderingContext2D, w: number, shipH: number) {
  ctx.fillStyle = '#171717';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(w, shipH * 0.25, w, shipH * 0.35);
  ctx.lineTo(w, shipH);
  ctx.lineTo(-w, shipH);
  ctx.lineTo(-w, shipH * 0.35);
  ctx.quadraticCurveTo(-w, shipH * 0.25, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Flaps
  ctx.fillStyle = '#262626';
  ctx.fillRect(-w * 1.5, shipH * 0.65, w * 0.5, shipH * 0.28);
  ctx.fillRect(w, shipH * 0.65, w * 0.5, shipH * 0.28);
}

function drawBooster(
  ctx: CanvasRenderingContext2D,
  w: number,
  boosterH: number,
  offsetY = 0
) {
  ctx.fillStyle = '#e5e5e5';
  ctx.fillRect(-w, offsetY, w * 2, boosterH);
  // Grid fins
  ctx.fillStyle = '#262626';
  ctx.fillRect(-w * 1.6, offsetY + 12, w * 0.6, 6);
  ctx.fillRect(w, offsetY + 12, w * 0.6, 6);
}
