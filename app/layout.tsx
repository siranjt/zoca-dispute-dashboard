import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zoca · Dispute Analyser',
  description: 'Stripe dispute analysis and counter-response drafting for Zoca.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="px-8 py-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <span className="text-2xl font-extrabold tracking-tight text-ink">
                  zoca
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-pink-strong ml-0.5 align-top mt-3"></span>
                </span>
                <span className="text-ink-dim">·</span>
                <span className="text-sm text-ink-muted group-hover:text-ink transition">
                  Dispute Analyser
                </span>
              </Link>
              <nav className="flex items-center gap-5 text-sm text-ink-muted">
                <span className="hidden sm:inline">Live data · Stripe + Metabase + Claude</span>
                <span className="text-ink-dim">·</span>
                <a
                  href="https://dashboard.stripe.com/disputes"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink transition"
                >
                  Open Stripe ↗
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-8 pb-16">{children}</div>
          </main>
          <footer className="border-t border-line-soft py-6 mt-8">
            <div className="max-w-7xl mx-auto px-8 text-xs text-ink-dim">
              Internal tool. Counter-response drafts must be reviewed by an account manager before
              submission to Stripe.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
