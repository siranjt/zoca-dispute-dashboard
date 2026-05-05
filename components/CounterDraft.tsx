'use client';

import { useRef, useState } from 'react';

const CONFETTI_COLORS = ['#EC4899', '#A78BFA', '#FDE047', '#4ADE80', '#F0A5CE'];

export default function CounterDraft({ draft, disputeId }: { draft: string; disputeId: string }) {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function spawnConfetti() {
    const host = containerRef.current;
    const btn = buttonRef.current;
    if (!host || !btn) return;
    const hostRect = host.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const cx = btnRect.left - hostRect.left + btnRect.width / 2;
    const cy = btnRect.top - hostRect.top + btnRect.height / 2;
    for (let i = 0; i < 16; i++) {
      const piece = document.createElement('div');
      piece.style.position = 'absolute';
      piece.style.width = '6px';
      piece.style.height = '10px';
      piece.style.left = cx + 'px';
      piece.style.top = cy + 'px';
      piece.style.pointerEvents = 'none';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.zIndex = '50';
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.6;
      const dist = 70 + Math.random() * 70;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 30;
      const rot = Math.random() * 720 - 360;
      piece.style.setProperty('--dx', `${dx}px`);
      piece.style.setProperty('--dy', `${dy}px`);
      piece.style.setProperty('--rot', `${rot}deg`);
      piece.style.animation = 'confetti-fly 1.2s ease-out forwards';
      host.appendChild(piece);
      window.setTimeout(() => piece.remove(), 1300);
    }
  }

  function copy() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      spawnConfetti();
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function download() {
    const blob = new Blob([draft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${disputeId}-rebuttal.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={containerRef} className="relative space-y-3">
      <div className="flex gap-2">
        <button
          ref={buttonRef}
          onClick={copy}
          className="px-4 py-1.5 text-sm rounded-full bg-accent-pink-strong text-white hover:opacity-90 active:scale-95 transition font-medium"
          style={{ transition: 'transform 0.15s, opacity 0.15s' }}
        >
          {copied ? 'Copied!' : 'Copy markdown'}
        </button>
        <button
          onClick={download}
          className="px-4 py-1.5 text-sm rounded-full border border-line bg-elevated/50 text-ink hover:bg-elevated transition"
        >
          Download .md
        </button>
      </div>
      <pre className="bg-canvas border border-line-soft rounded-xl p-4 text-xs whitespace-pre-wrap overflow-x-auto max-h-96 text-ink-muted font-mono leading-relaxed">
        {draft}
      </pre>
      <p className="text-xs text-ink-dim">
        Drafts are template-generated. Always have an account manager review and tailor before
        submitting evidence to Stripe.
      </p>
    </div>
  );
}
