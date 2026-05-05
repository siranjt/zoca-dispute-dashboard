import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zoca Dispute Analyser',
  description: 'Stripe dispute analysis and counter-response drafting for Zoca.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-zoca-border bg-white">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="font-semibold text-zoca-ink text-lg">
                Zoca Dispute Analyser
              </Link>
              <nav className="text-sm text-zoca-muted flex gap-4">
                <Link href="/" className="hover:text-zoca-ink">
                  Disputes
                </Link>
                <a
                  href="https://dashboard.stripe.com/disputes"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zoca-ink"
                >
                  Stripe ↗
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
          </main>
          <footer className="border-t border-zoca-border bg-white py-4">
            <div className="max-w-7xl mx-auto px-6 text-xs text-zoca-muted">
              Internal tool. Counter-response drafts must be reviewed by an account manager before
              submission to Stripe.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
