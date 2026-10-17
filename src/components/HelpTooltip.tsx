import React, { useState } from 'react';

interface HelpTooltipProps {
  title: string;
  explain: string;
  tip?: string;
}

/**
 * Interactive "?" badge button that explains any configuration setting
 * in simple "Explain Like I'm 5" (ELI5) language.
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, explain, tip }) => {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="help-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={`help-q-btn ${open ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`What is ${title}?`}
        title={`What is ${title}?`}
      >
        ?
      </button>

      {open && (
        <span className="help-popover" role="tooltip">
          <strong className="help-popover-title">{title}</strong>
          <span className="help-popover-body">{explain}</span>
          {tip && <span className="help-popover-tip">💡 {tip}</span>}
        </span>
      )}
    </span>
  );
};
