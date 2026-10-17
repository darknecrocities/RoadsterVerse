import React, { useState } from 'react';
import { Monitor, Cpu, ShieldAlert, Copy, Check, Terminal } from 'lucide-react';

export const MobileGateFallback: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <div className="mobile-gate-root">
      <div className="mobile-gate-container">
        {/* Top Header Badge */}
        <div className="mobile-gate-header">
          <div className="mobile-gate-brand">
            <span className="brand-dot" />
            <span className="brand-title">ROADSTERVERSE // AUTONOMOUS PROVING GROUND</span>
          </div>
          <span className="mobile-gate-tag">DESKTOP WORKSTATION ONLY</span>
        </div>

        {/* Central Graphic */}
        <div className="mobile-gate-icon-wrapper">
          <div className="mobile-gate-icon-frame">
            <Monitor size={42} strokeWidth={1.5} />
          </div>
          <div className="mobile-gate-pulse-ring" />
        </div>

        {/* Main Title & Notice */}
        <div className="mobile-gate-content">
          <h1 className="mobile-gate-headline">DESKTOP WORKSTATION REQUIRED</h1>
          <p className="mobile-gate-subtext">
            This simulator executes full 6-DoF numerical rigid-body mechanics, real-time COPV cold-gas
            thruster dynamics, aerodynamic lift/drag vectors, and real-time neural network tensor updates.
          </p>
          <p className="mobile-gate-subtext-muted">
            To preserve 60 FPS computation and accommodate multi-panel telemetry instrumentation, mobile
            and handheld touch displays are strictly redirected to desktop clients.
          </p>
        </div>

        {/* System Specifications Checklist */}
        <div className="mobile-gate-specs-card">
          <div className="specs-card-header">
            <Cpu size={15} strokeWidth={1.75} />
            <span>COMPATIBLE WORKSTATION PLATFORMS</span>
          </div>

          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">OPERATING SYSTEM</span>
              <span className="spec-val">Windows 10 / 11, macOS, Linux</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">MINIMUM RESOLUTION</span>
              <span className="spec-val">&gt;= 1024 x 640 Screen Space</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">ACCELERATION</span>
              <span className="spec-val">WebGL 2.0 / Hardware GPU</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">DESKTOP BROWSERS</span>
              <span className="spec-val">Chrome, Edge, Firefox, Safari</span>
            </div>
          </div>
        </div>

        {/* Diagnostic Command Line Box */}
        <div className="mobile-gate-cli-box">
          <div className="cli-header">
            <Terminal size={12} strokeWidth={1.5} />
            <span>DIAGNOSTIC STATUS // ENV_CHECK</span>
          </div>
          <div className="cli-body">
            <code>[WARN] Mobile viewport detected: {window.innerWidth}x{window.innerHeight}</code>
            <code>[INFO] Platform redirection active: Simulator entry blocked.</code>
            <code>[INFO] Please open this URL on a Windows, macOS, or Linux computer.</code>
          </div>
        </div>

        {/* Action Button */}
        <div className="mobile-gate-actions">
          <button
            type="button"
            className="mobile-gate-copy-btn"
            onClick={handleCopyLink}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'URL COPIED TO CLIPBOARD' : 'COPY SIMULATOR URL'}</span>
          </button>
        </div>

        {/* Footer Note */}
        <div className="mobile-gate-footer">
          <span>TESLA ROADSTER &bull; SPACEX STARSHIP PROVING GROUND</span>
          <span>STRICT MONOCHROME COMPUTATION ARCHITECTURE</span>
        </div>
      </div>
    </div>
  );
};
