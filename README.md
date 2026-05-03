# ChessCoach Arena

Beginner-first chess practice and online play — a **startup-style MVP** for the **nFactorial Incubator 2026** technical assignment.

---

## Submission links

| | Link |
|---|------|
| **Live demo** | [https://chess-hub.almaz-bukayev.workers.dev/](https://chess-hub.almaz-bukayev.workers.dev/) |
| **GitHub** | [https://github.com/fertur228/chess-hub](https://github.com/fertur228/chess-hub) |

---

## Product summary

**ChessCoach Arena** is a modern web chess platform where people learn through play. Users can **sign in**, **onboard**, **play AI training games**, **play online** with friends or matchmade opponents (**casual** or **ranked**), see **legal-move hints** and board feedback (last move, check), **save** finished games, **review** them with readable coach-style summaries, and track **rating** plus **leaderboard** placement. A **cosmetic store** lets players spend **Arena Coins** on **board skins** and **avatar frames** (demo economy — see [Monetization](#monetization-philosophy)).

---

## More than a chessboard

This is **not** only an 8×8 widget. It is a **full-stack product**: authentication, persisted profiles and games, client-side rules with **server-validated** online moves, **Realtime** room sync (with polling resilience), **trusted** game end and **ranked rating** logic on the backend, **matchmaking**, **draw offers**, **promotion picker**, **history**, **reviews**, and a **business-model prototype** (cosmetic coins) — aimed at **retention** and **learning**, not only moving pieces.

---

## Who it is for

- **Beginners** who want guidance and a calmer surface than “expert-only” sites.
- **Casual players** who want simple online chess without friction.
- **Friends** who prefer **private invite-code** rooms.
- **Competitive players** who want **ranked** play via **public matchmaking** (private rooms stay casual by design).

---

## Approach and story

I started from a **limited tournament chess background**, which pushed me to study the rules seriously and look at how established platforms serve different audiences. That research steered the product **toward beginners who need guidance**, not just a bare board. To ship a credible MVP quickly, I used an **AI-assisted / vibe coding** workflow (e.g. **Cursor**, **ChatGPT/Codex**) on top of strong primitives (**Supabase**, **TanStack**, **Cloudflare**). The goal was not a static demo — a **coherent, deployable prototype** that could grow into a real service.

---

## Key features

### Auth and profile

- Email/password auth (**Supabase Auth**), **onboarding**, **profiles**, **settings** (preferences UI), **public profiles**.

### AI training

- **Play vs AI** with difficulty tiers; training games **do not change ranked Elo**; games can be **saved** and **reviewed**.

### Board UX

- **Legal-move hints** (dots / capture rings), **last-move** highlight, **check** highlight, **pawn promotion** picker (queen / rook / bishop / knight).

### Online play

- **Private rooms** (create + join by **code** or link).
- **Public Find Match**: **casual** and **ranked** queues.
- **Draw offers** (offer / accept / decline) via **trusted RPCs**.
- **Resign** and **leave / abandon** flows via **Edge Functions** where applicable.

### Progress and competition

- **Game history**, **saved reviews** (readable summaries — not engine deep analysis).
- **Rating** and **leaderboard**; **ranked** games are **not** created from **private** rooms (reduces rating farming).

### Cosmetics and economy

- **Arena Coins** (starting grant + **mock** “purchase” packs), **board skins**, **avatar frames**, equip loadout; **mock checkout only** — **no Stripe**, **no real payment processing** in this MVP.

### Deployment

- **Cloudflare Workers** (SSR + static assets), not Pages-only static hosting.

---

## Monetization philosophy

- **Core learning stays free** in spirit: **AI training**, **online play**, **rating**, **leaderboard**, and **reviews** are **not** paywalled behind a subscription in this build.
- **Monetization is cosmetic-only**: skins, frames, and **Arena Coins** as a **support-the-product** lane, **not** pay-to-win.
- The live app includes a **demo store**: **mock checkout** records transactions in the database; **no real money** is charged. A future production version could connect a real payment provider **without** gating chess education.

---

## Security and trust

- **Online moves** are validated **server-side** (**Edge Function**), not trusted from the browser alone.
- **Game finish**, **forfeits**, and **ranked outcomes** flow through **Supabase RPCs / Edge Functions** with **idempotent** patterns where designed — clients do not arbitrarily `UPDATE` room state or ratings.
- **Ranked private rooms are disabled** (database + product rule): **ranked** play is **public matchmaking only**, which **reduces intentional rating abuse**.
- **Sensitive writes** (profiles, wallets, cosmetics, draws, etc.) use **RLS** plus **SECURITY DEFINER RPCs** (or functions) instead of wide-open table updates from the client.
- **Service role** keys belong in **server/Edge** contexts only — **never** in `VITE_*` or the browser bundle.

---

## Tech stack

| Area | Choice |
|------|--------|
| App | **React** · **TanStack Start** / **TanStack Router** · **Vite** · **TypeScript** |
| UI | **Tailwind CSS** · **shadcn-style** / **Radix** primitives |
| Chess | **chess.js** · **react-chessboard** |
| Backend | **Supabase** — **Auth**, **Postgres**, **Row Level Security**, **Realtime**, **Edge Functions** |
| Deploy | **Cloudflare Workers** (`wrangler` · `wrangler.jsonc` / generated worker config) |
| Package manager | **npm** (`package-lock.json`) |

---

## Architecture overview

- **Frontend**: file-based routes under `src/routes/`, shared UI in `src/components/`, auth context in `src/lib/auth.tsx`.
- **Backend**: Supabase **Postgres** schema in `supabase/migrations/`, **RLS**, **RPCs** for trusted mutations.
- **Realtime**: Supabase **channels** on `rooms` for live games; client may **poll** as a fallback.
- **Edge Functions**: `record-move`, `forfeit-game` (deploy separately to your Supabase project).
- **Deployment**: `vite build` outputs **`dist/client`** (assets) and **`dist/server`** (Worker bundle); Wrangler deploy uses the generated **`dist/server/wrangler.json`**.

---

## Local development

**Prerequisites:** Node.js **18+**, **npm**, a **Supabase** project with migrations applied.

```bash
npm install
cp .env.example .env   # then fill placeholders — never commit secrets
npm run dev
npm run build
```

### Environment variables (no secrets here)

Copy **`.env.example`** → **`.env`**. At minimum:

| Variable | Role |
|----------|------|
| `VITE_SUPABASE_URL` | Browser bundle (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser bundle (publishable / anon key only) |
| `SUPABASE_URL` | Worker / server runtime |
| `SUPABASE_PUBLISHABLE_KEY` | Worker / server runtime |

Never put the **service role** key in `VITE_*`. See **`.env.example`** for Edge CLI and optional admin notes.

---

## Deployment (Cloudflare Workers)

This app deploys as a **Worker** with SSR — **not** static Pages-only hosting.

```bash
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Or: `npm run deploy` (build + deploy). Set **`SUPABASE_URL`** and **`SUPABASE_PUBLISHABLE_KEY`** on the Worker; supply **`VITE_*`** during **`npm run build`** so the client bundle points at the right project. Deploy **Supabase Edge Functions** (`record-move`, `forfeit-game`, …) to the same Supabase project the app uses.

---

## Implemented vs roadmap

### Implemented (MVP / prototype)

- AI training · online multiplayer · private + public matchmaking · ranked rating + leaderboard · draw offers · promotion picker · history · coach-style reviews · **cosmetic store + Arena Coins (mock payments)** · Cloudflare deployment

### Future (explicitly not claimed here)

- **Stockfish** (or similar) deep analysis
- **Real** payment provider (e.g. production checkout)
- City / club leaderboards
- Chess **clocks** / standard time controls
- Rich **avatar uploads** (beyond initials / frames)
- Mobile-native polish
- **Automated** test suite in CI
- **Heartbeat / timeout** for silent hard disconnects

---

## nFactorial level alignment

This submission targets the **Strong** bar and reaches toward **Great**: **Supabase** persistence and auth, **AI** play, **online** multiplayer (links + realtime), **public matchmaking**, AI-**style** review (not engine-backed), **leaderboard / rating**, a **business-model prototype** (cosmetics + mock coins), and a **live Cloudflare** deployment. It is a **prototype**, not a finished consumer product — but it is **architected** like one.

---

## Final note

**ChessCoach Arena** is my attempt to turn a chess assignment into a **real product**: **beginner-friendly**, **fair**, **security-conscious**, and **monetizable** without locking learning behind a paywall.

---

## More documentation

Engineering detail: **`docs/`** — implementation plan, changelog, smoke tests, architecture decisions (`docs/README.md`).
