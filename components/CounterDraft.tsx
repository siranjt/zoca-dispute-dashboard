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
          className="px-3 py-1.5 text-sm bg-zoca-brand text-white rounded-md hover:bg-indigo-700 transition"
        >
          {copied ? 'Copied!' : 'Copy markdown'}
        </button>
        <button
          onClick={download}
          className="px-3 py-1.5 text-sm bg-white border border-zoca-border text-zoca-ink rounded-md hover:bg-zoca-subtle transition"
        >
          Download .md
        </button>
      </div>
      <pre className="bg-zoca-subtle border border-zoca-border rounded-md p-4 text-xs whitespace-pre-wrap overflow-x-auto max-h-96">
        {draft}
      </pre>
      <p className="text-xs text-zoca-muted">
        Drafts are template-generated. Always have an account manager review and tailor before
        submitting evidence to Stripe.
      </p>
    </div>
  );
}
