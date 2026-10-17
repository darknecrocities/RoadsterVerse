import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HelpTooltipProps {
  title: string;
  explain: string;
  tip?: string;
}

/**
 * Interactive "?" badge button that explains any configuration setting
 * in simple "Explain Like I'm 5" (ELI5) language.
 * Uses a fixed-position React Portal so the tooltip card overlays the sidebar
 * and is never clipped by scrollable drawer containers.
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, explain, tip }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 80, left: 24 });
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 248;
    const tooltipHeight = 128;

    let left = rect.left + rect.width / 2 - 24;
    if (left + tooltipWidth > window.innerWidth - 14) {
      left = Math.max(14, window.innerWidth - tooltipWidth - 14);
    }
    if (left < 14) {
      left = 14;
    }

    let top = rect.bottom + 8;
    if (top + tooltipHeight > window.innerHeight - 14) {
      top = Math.max(14, rect.top - tooltipHeight - 8);
    }

    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const popoverNode = open ? (
    <span
      className="help-popover"
      role="tooltip"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
    >
      <strong className="help-popover-title">{title}</strong>
      <span className="help-popover-body">{explain}</span>
      {tip && <span className="help-popover-tip">💡 {tip}</span>}
    </span>
  ) : null;

  return (
    <span
      className="help-tooltip-wrap"
      onMouseEnter={() => {
        updatePosition();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className={`help-q-btn ${open ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          updatePosition();
          setOpen((prev) => !prev);
        }}
        aria-label={`What is ${title}?`}
        title={`What is ${title}?`}
      >
        ?
      </button>

      {open &&
        (typeof document !== 'undefined' && document.body
          ? createPortal(popoverNode, document.body)
          : popoverNode)}
    </span>
  );
};
