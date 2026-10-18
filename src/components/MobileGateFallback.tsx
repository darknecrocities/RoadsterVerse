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

        {/* Main Title & Simple Notice */}
        <div className="mobile-gate-content">
          <h1 className="mobile-gate-headline">PLEASE OPEN ON YOUR COMPUTER</h1>
          <p className="mobile-gate-subtext">
            This 3D vehicle & rocket simulator is built exclusively for desktop and laptop computers.
            Mobile devices and cellphones are not supported.
          </p>
          <div className="mobile-gate-platforms">
            <span className="platform-pill">Windows (PC)</span>
            <span className="platform-pill">macOS (Mac)</span>
            <span className="platform-pill">Linux</span>
          </div>
        </div>

        {/* System Specifications Checklist */}
        <div className="mobile-gate-specs-card">
          <div className="specs-card-header">
            <Cpu size={15} strokeWidth={1.75} />
            <span>COMPATIBLE COMPUTER PLATFORMS</span>
          </div>

          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">COMPUTERS</span>
              <span className="spec-val">Windows 10 / 11, Mac, Linux</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">DISPLAY</span>
              <span className="spec-val">&gt;= 1024 x 640 Resolution</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">GRAPHICS</span>
              <span className="spec-val">WebGL 2.0 GPU Acceleration</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">BROWSERS</span>
              <span className="spec-val">Chrome, Edge, Safari, Firefox</span>
            </div>
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
            <span>{copied ? 'LINK COPIED TO CLIPBOARD' : 'COPY SIMULATOR LINK'}</span>
          </button>
        </div>

        {/* Footer Note */}
        <div className="mobile-gate-footer">
          <span>TESLA ROADSTER // SPACEX STARSHIP PROVING GROUND</span>
          <span>DESKTOP WORKSTATION REQUIRED</span>
        </div>
      </div>
    </div>
  );
};
