# Zoca Dispute Analyser

A Next.js dashboard that pulls disputes live from Stripe, enriches each one with Zoca's BaseSheet + 90 days of communications (App Chat, Email, Phone, SMS, Video), scores eight signals to recommend **FIGHT / REFUND / NEEDS AM CALL**, and generates a draft Stripe counter-response letter you can copy or download.

Signal scoring uses **Claude** (claude-haiku-4-5 by default) when an `ANTHROPIC_API_KEY` is set. If the key is missing or the API call fails, the dashboard transparently falls back to a regex-based scorer so the page still loads.

## Stack

- Next.js 14 (App Router, server components)
- TypeScript + Tailwind CSS
- `stripe` Node SDK
- `papaparse` for Metabase CSV ingest

## Local development

1. Install dependencies:

   ```sh
   npm install
   ```

2. The `.env.local` file is already populated with the Stripe restricted key and the public Metabase URLs. **Do not commit it** — it's in `.gitignore`.

3. Run the dev server:

   ```sh
   npm run dev
   ```

4. Open <http://localhost:3000>.

## Pushing to GitHub

> **Note:** A partial `.git/` directory may exist from sandbox initialisation. Run `rm -rf .git` once before the commands below to start clean.

To create a remote on GitHub and push:

```sh
# Inside the project directory
rm -rf .git              # remove the partial sandbox init
git init -b main
git add -A
git status               # sanity check: .env.local must NOT be listed
git commit -m "Initial dispute analyser dashboard"
gh repo create zoca-dispute-dashboard --private --source=. --remote=origin --push
```

If you don't have the `gh` CLI, create the repo through the web UI, then:

```sh
git remote add origin git@github.com:<your-org>/zoca-dispute-dashboard.git
git branch -M main
git add -A
git commit -m "Initial dispute analyser dashboard"
git push -u origin main
```

## Deploying to Vercel

1. Go to <https://vercel.com/new> and import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `next build` (default). Output directory: leave default.
4. Add **environment variables** under Project Settings → Environment Variables. Copy each row from `.env.example`. The Stripe key value comes from your password manager — do not paste it from `.env.local` to a chat or doc.
   - `STRIPE_SECRET_KEY` (Production + Preview)
   - `ANTHROPIC_API_KEY` (optional — enables Claude-based signal scoring; regex fallback runs if absent)
   - `ANTHROPIC_MODEL` (optional — defaults to `claude-haiku-4-5`)
   - `METABASE_BASESHEET_URL`
   - `METABASE_APPCHAT_URL`
   - `METABASE_EMAIL_URL`
   - `METABASE_PHONE_URL`
   - `METABASE_VIDEO_URL`
   - `METABASE_SMS_URL`
5. Click **Deploy**. Vercel returns a `*.vercel.app` URL.
6. (Recommended) Project Settings → Domains → add a custom subdomain, e.g. `disputes.zoca.tools`.

## Security notes

- The Stripe key is a **restricted key** scoped to read-only on disputes / charges / customers / payment intents. The dashboard never writes to Stripe.
- Submitting evidence to Stripe stays a manual step inside the Stripe dashboard — the tool only drafts the rebuttal letter.
- Public URL has no auth right now (per request). Anyone with the URL sees dispute data. If you need auth later, the most painless path is **Vercel Deployment Protection → Password Protection** (no code changes).
- `.env.local` is gitignored. Do not commit Stripe keys.

## Project layout

```
app/
  layout.tsx            # Header / footer chrome
  page.tsx              # Disputes table (dashboard home)
  dispute/[id]/page.tsx # Per-dispute detail with signals + comms + draft
  globals.css
components/
  CounterDraft.tsx      # Copy/download draft client component
lib/
  stripe.ts             # listDisputes / getDispute helpers
  basesheet.ts          # BaseSheet fetch + customer matching
  comms.ts              # Multi-channel comms loader
  signals.ts            # 8-signal scoring with FIGHT/REFUND/NEEDS AM
  draft.ts              # Markdown rebuttal letter builder
```

## Future work

- Daily digest job (`vercel.json` cron) that posts new `needs_response` disputes to `#dispute-raised` with the recommendation.
- Auth via NextAuth + Google (`@zoca.com` allowlist) once the URL needs to leave the team.
- Hook into Stripe webhooks (`charge.dispute.created`) to push notifications instead of polling.
- Slack canvas export per dispute.
