'use client';

import { useEffect, useState } from 'react';

const CHANNEL_COLORS: Record<string, string> = {
  app_chat: '#EC4899',
  email: '#8B5CF6',
  phone: '#F59E0B',
  sms: '#10B981',
  video: '#2D5BFF',
};
const CHANNEL_LABEL: Record<string, string> = {
  app_chat: 'App chat',
  email: 'Email',
  phone: 'Phone',
  sms: 'SMS',
  video: 'Video',
};

export default function ChannelMixBar({ counts }: { counts: Record<string, number> }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const channels = ['app_chat', 'email', 'phone', 'sms', 'video'];
  const total = Math.max(1, channels.reduce((sum, c) => sum + (counts[c] || 0), 0));

  return (
    <div className="space-y-3">
      <div className="flex h-2 rounded-full overflow-hidden bg-elevated/30">
        {channels.map((c, i) => {
          const value = counts[c] || 0;
          const pct = (value / total) * 100;
          return (
            <div
              key={c}
              style={{
                background: CHANNEL_COLORS[c],
                width: `${pct * progress}%`,
                transition: `width 1.1s cubic-bezier(0.4, 0, 0.2, 1) ${i * 80}ms`,
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        {channels.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: CHANNEL_COLORS[c] }}
            />
            <span>{CHANNEL_LABEL[c]}</span>
            <span className="text-ink tabular-nums">{counts[c] || 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
