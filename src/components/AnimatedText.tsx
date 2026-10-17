import React, { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789//[]#_+-=';

interface AnimatedDecodeTextProps {
  text: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Kinetic typography component that scrambles and decodes characters left-to-right
 * whenever the target text changes.
 */
export const AnimatedDecodeText: React.FC<AnimatedDecodeTextProps> = ({
  text,
  durationMs = 420,
  className,
  style,
}) => {
  const [displayed, setDisplayed] = useState(text);

  useEffect(() => {
    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const lockCount = Math.floor(progress * text.length);

      let nextStr = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ' || i < lockCount) {
          nextStr += ch;
        } else {
          const randIdx = Math.floor(Math.random() * GLYPHS.length);
          nextStr += GLYPHS[randIdx];
        }
      }

      setDisplayed(nextStr);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayed(text);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [text, durationMs]);

  return (
    <span className={className} style={style}>
      {displayed}
    </span>
  );
};

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

/**
 * Physics spring-damped number counter that smoothly interpolates numeric telemetry changes.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
}) => {
  const [rendered, setRendered] = useState(value);
  const currentRef = useRef(value);
  const velocityRef = useRef(0);

  useEffect(() => {
    let rafId = 0;
    const stiffness = 0.22;
    const damping = 0.68;

    const animate = () => {
      const displacement = value - currentRef.current;
      velocityRef.current = velocityRef.current * damping + displacement * stiffness;
      currentRef.current += velocityRef.current;

      if (Math.abs(displacement) < 0.01 && Math.abs(velocityRef.current) < 0.01) {
        currentRef.current = value;
        setRendered(value);
        return;
      }

      setRendered(currentRef.current);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return (
    <span>
      {prefix}
      {rendered.toFixed(decimals)}
      {suffix}
    </span>
  );
};
