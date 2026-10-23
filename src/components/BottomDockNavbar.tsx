import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronUp,
  CloudRain,
  Disc,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import type { CameraMode, VehicleId, WheelSpec } from '../types/simulation.ts';
import { HelpTooltip } from './HelpTooltip.tsx';

export interface BottomDockNavbarProps {
  cameraMode: CameraMode;
  onSelectCameraMode: (mode: CameraMode) => void;
  vehicle: VehicleId;
  wheelSpec: WheelSpec;
  onToggleWheel: () => void;
  onWindGust: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  envControlsOpen: boolean;
  onToggleEnvControls: () => void;
  isFullScreenZen: boolean;
  onToggleFullScreenZen: () => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  orbit: 'Orbit',
  chase: 'Follow',
  'thruster-cam': 'Jet Cam',
  'tower-cam': 'Wide',
};

export const BottomDockNavbar: React.FC<BottomDockNavbarProps> = ({
  cameraMode,
  onSelectCameraMode,
  vehicle,
  wheelSpec,
  onToggleWheel,
  onWindGust,
  audioEnabled,
  onToggleAudio,
  isPaused,
  onTogglePause,
  onRestart,
  envControlsOpen,
  onToggleEnvControls,
  isFullScreenZen,
  onToggleFullScreenZen,
}) => {
  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false);
  const cameraMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cameraMenuRef.current && !cameraMenuRef.current.contains(e.target as Node)) {
        setIsCameraMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bottom-dock-bw" aria-label="Simulation Controls">
      {/* 1. Camera Perspectives Menu Popover */}
      <div className="dock-popover-wrapper" ref={cameraMenuRef}>
        <button
          type="button"
          className={`dock-btn-bw ${isCameraMenuOpen ? 'active' : ''}`}
          onClick={() => setIsCameraMenuOpen((prev) => !prev)}
          aria-expanded={isCameraMenuOpen}
          aria-haspopup="menu"
          title="Change 3D Camera Vantage Point"
        >
          <Camera size={13} />
          <span>Camera: {CAMERA_LABELS[cameraMode]}</span>
          <ChevronUp size={11} className={`dock-chevron ${isCameraMenuOpen ? 'open' : ''}`} />
        </button>

        {isCameraMenuOpen && (
          <div className="dock-popover-menu" role="menu">
            <div className="dock-popover-header">3D CAMERA VANTAGE</div>
            {(['orbit', 'chase', 'thruster-cam', 'tower-cam'] as CameraMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`dock-popover-item ${cameraMode === mode ? 'active' : ''}`}
                onClick={() => {
                  onSelectCameraMode(mode);
                  setIsCameraMenuOpen(false);
                }}
                role="menuitem"
              >
                <Camera size={12} />
                <span>
                  {mode === 'orbit'
                    ? 'Orbit (360° Free Look)'
                    : mode === 'chase'
                      ? 'Follow (Chase Vehicle)'
                      : mode === 'thruster-cam'
                        ? 'Jet Cam (Nozzle TVC)'
                        : 'Wide (Paddock & Tower)'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dock-pod-separator" />

      {/* 2. Environment & Atmospheric Disturbance */}
      <div className="dock-pod">
        <button
          type="button"
          className={`dock-btn-bw ${envControlsOpen ? 'active' : ''}`}
          onClick={onToggleEnvControls}
          title="Weather, Atmospheric Density & Subsystems"
        >
          <CloudRain size={13} />
          <span>Weather</span>
        </button>

        <button
          type="button"
          className="dock-btn-bw"
          onClick={onWindGust}
          title="Inject Aerodynamic Crosswind Gust"
        >
          <Wind size={13} />
          <span>Gust Wind</span>
          <HelpTooltip
            title="Crosswind Gust Disturbance"
            explain="Blasts the vehicle with a sudden turbulent lateral crosswind impulse to test closed-loop policy stability and RCS recovery."
          />
        </button>
      </div>

      <div className="dock-pod-separator" />

      {/* 3. Core Simulation Playback */}
      <div className="dock-pod">
        <button
          type="button"
          className={`dock-btn-bw ${isPaused ? 'active' : ''}`}
          onClick={onTogglePause}
          title={isPaused ? 'Resume Simulation (Space)' : 'Pause Simulation (Space)'}
        >
          {isPaused ? <Play size={13} /> : <Pause size={13} />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        <button
          type="button"
          className="dock-btn-bw"
          onClick={onRestart}
          title="Restart Current Stunt Attempt"
        >
          <RotateCcw size={13} />
          <span>Restart</span>
        </button>
      </div>

      <div className="dock-pod-separator" />

      {/* 4. Quick Utility Icon Toggles */}
      <div className="dock-pod dock-pod-compact">
        <button
          type="button"
          className={`dock-icon-btn ${!audioEnabled ? 'active-muted' : ''}`}
          onClick={onToggleAudio}
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>

        {vehicle === 'roadster' && (
          <button
            type="button"
            className="dock-icon-btn"
            onClick={onToggleWheel}
            title={wheelSpec === 'six-spoke' ? 'Switch to Aero Carbon Discs' : 'Switch to 6-Spoke Slicks'}
            aria-label="Toggle Wheel Specification"
          >
            <Disc size={13} />
          </button>
        )}

        <button
          type="button"
          className={`dock-icon-btn ${isFullScreenZen ? 'active' : ''}`}
          onClick={onToggleFullScreenZen}
          title={isFullScreenZen ? 'Exit Zen Mode (Show Side Panels)' : 'Enter Zen Fullscreen (Hide Side Panels)'}
          aria-label="Toggle Zen Fullscreen Mode"
        >
          {isFullScreenZen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </nav>
  );
};
