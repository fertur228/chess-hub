# ChessCoach Arena

Beginner-focused chess practice and online play built for the **nFactorial Incubator 2026** technical assignment submission.

---

## Submission links

| Item | Link |
|------|------|
| **Live app** | `https://YOUR_DEPLOYMENT.workers.dev` (replace after Cloudflare deploy) |
| **Source** | `https://github.com/YOUR_ORG/YOUR_REPO` |

---

## What we built

**ChessCoach Arena** is a full-stack chess web app where new and casual players can sign up, complete a short onboarding, play against a built-in AI coach, find public opponents or invite friends to private rooms, and track progress with ratings and history. Completed games link to lightweight, coach-style reviews designed for readability—not engine depth.

## Who it is for

- People learning chess who want a gentle place to play and see progress.
- Casual players who want simple online rooms and a lightweight rating loop.
- Friends who prefer private invite links over open ladders.

## Why it stands out

- **Beginner-first UX**: legal-move hints, last-move and check visuals on the shared board, and readable post-game summaries.
- **Trust boundaries**: sensitive online moves, forfeits, and ranked outcomes flow through Supabase Edge Functions and database RPCs so clients cannot freely rewrite board state or ratings.
- **Clear separation of modes**: AI training updates practice stats without touching Elo; ranked results only come from public matchmaking paths, with private rooms reserved for casual play.

## Features

- Supabase authentication, profiles, and onboarding.
- Dashboard, history, profile, leaderboard, and public profiles.
- AI games with difficulty levels and deterministic client AI (no external engine binary).
- Online play: create private rooms, join by code, public **Find Match** (casual or ranked).
- Supabase Realtime for room sync; server-validated moves and trusted game end flows.
- Post-game reviews for saved games.

## Tech stack

| Layer | Choice |
|--------|--------|
| App framework | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) on [Vite 7](https://vite.dev/) |
| UI | React 19, Tailwind CSS v4, Radix/shadcn-style primitives |
| Chess rules / board | [chess.js](https://github.com/jhlywa/chess.js), [react-chessboard](https://github.com/Clariity/react-chessboard) |
| Backend | [Supabase](https://supabase.com/) (Postgres, Auth, Realtime, Edge Functions) |
| Deployment target | [Cloudflare Workers](https://developers.cloudflare.com/workers/) with static assets (`@cloudflare/vite-plugin`) |

Configuration entry point: `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` (TanStack Start + Cloudflare integration). There is no separate `app.config.ts` in this repo.

## Security and product decisions (high level)

- **Publishable vs service role**: the browser uses only `VITE_SUPABASE_*`. The Supabase **service role** key must never appear in `VITE_*` variables or client bundles. Edge Functions hold their own secrets in Supabase.
- **Online integrity**: moves go through the `record-move` function; resign/abandon routes through `forfeit-game`; game and rating finalization uses server-side RPCs with idempotency guards where designed.
- **Ranked abuse reduction**: ranked play is tied to public matchmaking; private rooms are casual-only at the UI and database level.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (project standard; use `package-lock.json`)
- A **Supabase** project with migrations applied (`supabase/migrations`)

## Run locally

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` → `.env` and fill in your Supabase project URL and publishable key (and optional keys documented in `.env.example`).

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Default URL is documented in project smoke tests (`docs/SMOKE_TEST.md`).

4. Production build:

   ```bash
   npm run build
   ```

## Environment variables

### Required for production

| Scope | Variables | Notes |
|------|-----------|--------|
| **Vite client (build-time)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Must be set when running `npm run build` so the browser bundle embeds correct Supabase settings. Cloudflare Workers Builds should expose these as build environment variables (see Cloudflare docs on [`CLOUDFLARE_INCLUDE_PROCESS_ENV`](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#build-settings) if needed). |
| **Worker runtime** | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Used by TanStack Start server code (e.g. Supabase middleware). Configure as Worker vars or secrets in the Cloudflare dashboard. |

### Optional / special cases

| Variable | Use |
|---------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Only if server code imports the admin client in `src/integrations/supabase/client.server.ts`. Not used by current routes; **never** expose to the browser. |
| `SUPABASE_ANON_KEY` | Primarily for local Supabase Edge Function development with the CLI. |

Full template: `.env.example`.

## Deploy to Cloudflare (Workers)

This app is **not** Cloudflare Pages-only static hosting: it deploys as a **Worker** with **`dist/client`** as static assets and **`dist/server`** as the SSR bundle. After `vite build`, Wrangler reads the generated **`dist/server/wrangler.json`**.

Exact commands:

```bash
npm install
# Set Supabase URLs/keys for the build (CI or local shell)
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Or use the npm script:

```bash
npm run deploy
```

Operational checklist:

1. Log in once: `npx wrangler login`
2. In the Cloudflare dashboard (or Wrangler), set **`SUPABASE_URL`** and **`SUPABASE_PUBLISHABLE_KEY`** on the Worker.
3. Ensure **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_PUBLISHABLE_KEY`** are available during **`npm run build`** in CI.
4. Deploy Supabase Edge Functions separately: `npx supabase functions deploy record-move`, `forfeit-game`, etc., against your Supabase project.

Optional sanity check without uploading:

```bash
npm run build
npx wrangler deploy --config dist/server/wrangler.json --dry-run
```

## Repository layout

- `src/routes/` — file-based routes
- `src/integrations/supabase/` — browser + server Supabase helpers
- `supabase/` — migrations and Edge Functions
- `docs/` — engineering plans, changelog, smoke tests

## Documentation

Detailed context lives under [`docs/README.md`](docs/README.md) (implementation plan, changelog, smoke tests, decisions).

## Future roadmap (not in MVP scope)

- Email confirmation UX, forgot-password flows, and loader-level route hardening (see `docs/IMPLEMENTATION_PLAN.md`).
- Optional Stockfish-backed analysis later; optional monetization Stripe—explicitly **out of scope** for this assignment pass.

---

**Submission reminder:** Replace the placeholder **Live app** and **Source** URLs at the top of this file with your real Cloudflare Workers URL (`*.workers.dev` or custom domain) and GitHub repository URL before sending the assignment.
