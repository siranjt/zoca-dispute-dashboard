import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import ZocaLogo from '@/components/ZocaLogo';

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
          <header className="px-4 sm:px-8 py-5 sm:py-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
                <ZocaLogo width={68} height={17} />
                <span className="text-ink-dim hidden sm:inline">·</span>
                <span className="text-sm text-ink-muted group-hover:text-ink transition hidden sm:inline">
                  Dispute Analyser
                </span>
              </Link>
              <nav className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm text-ink-muted">
                <span className="hidden lg:inline">Live data · Stripe + Metabase + Claude</span>
                <span className="text-ink-dim hidden lg:inline">·</span>
                <a
                  href="https://dashboard.stripe.com/disputes"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink transition whitespace-nowrap"
                >
                  Open Stripe ↗
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">{children}</div>
          </main>
          <footer className="border-t border-line-soft py-6 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-ink-dim">
              Internal tool. Counter-response drafts must be reviewed by an account manager before
              submission to Stripe.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
