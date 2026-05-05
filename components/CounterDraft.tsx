'use client';

import { useState } from 'react';

export default function CounterDraft({ draft, disputeId }: { draft: string; disputeId: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="px-4 py-1.5 text-sm rounded-full bg-accent-pink-strong text-white hover:opacity-90 transition font-medium"
        >
          {copied ? 'Copied' : 'Copy markdown'}
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
