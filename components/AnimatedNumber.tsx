'use client';

import { useEffect, useRef, useState } from 'react';

export default function AnimatedNumber({
  value,
  duration = 1100,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  delay = 0,
  startFromZero = true,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  delay?: number;
  startFromZero?: boolean;
}) {
  const [display, setDisplay] = useState(startFromZero ? 0 : value);
  const prevValue = useRef(startFromZero ? 0 : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = prevValue.current;
    const to = value;
    if (from === to) return;
    let startTs = 0;
    const startDelay = delay;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts + startDelay;
      const t = Math.min(1, Math.max(0, (ts - startTs) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValue.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay]);

  return <span className={className}>{format(display)}</span>;
}
