# Architecture Decisions

This file records important product and technical decisions. Use short Architecture Decision Record entries.

## ADR-0001: Use Supabase for Auth and Database

### Status

Accepted

### Context

ChessCoach Arena needs authentication, user profiles, game records, rooms, ratings, leaderboard data, and Realtime online game sync.

### Decision

Use Supabase as the backend platform for auth and database.

### Consequences

- Supabase Auth is the source of user identity.
- Postgres tables store profiles, games, rooms, and future rating data.
- RLS must be treated as a core security boundary.
- Trusted game and rating mutations should move to server-side RPCs or Edge Functions.

## ADR-0002: Use Cloudflare for Deployment

### Status

Accepted

### Context

The project includes Cloudflare configuration and the target deployment platform is Cloudflare.

### Decision

Deploy the app to Cloudflare later in the project.

### Consequences

- Environment variables must work in Cloudflare runtime.
- Build and SSR behavior must be tested against the Cloudflare target.
- Deployment readiness is a dedicated implementation phase.

## ADR-0003: Use Cursor as the Development Environment

### Status

Accepted

### Context

The project is now Cursor-led and will use Cursor for code review, implementation planning, and engineering execution.

### Decision

Use Cursor as the primary development environment and planning assistant.

### Consequences

- Plans, audits, and decisions must be documented in `docs/`.
- Future changes should be small, reviewable, and phase-aligned.
- Cursor workflow rules are documented in `CURSOR_WORKFLOW.md`.

## ADR-0004: Do Not Use Lovable Going Forward

### Status

Accepted

### Context

The cloned codebase appears to contain Lovable-generated configuration and comments, but Lovable is no longer part of the development plan.

### Decision

Do not use Lovable going forward.

### Consequences

- Lovable-generated code may remain temporarily as legacy implementation detail.
- New decisions and implementation plans should not depend on Lovable.
- Lovable references can be removed gradually when doing so is part of the active phase.

## ADR-0005: AI Game First, Online Multiplayer Hardening Later

### Status

Accepted

### Context

The product priority is AI game first, online multiplayer second, rating third.

### Decision

Prioritize AI game stability and saved game flow before hardening online multiplayer.

### Consequences

- AI game save/review flow should stabilize before deep online game work.
- Online rooms can remain present but should be hardened in later phases.
- Rating changes should be trusted before leaderboard polish.

## ADR-0006: Do Not Add Stockfish Until Core MVP Is Stable

### Status

Accepted

### Context

Stockfish would improve analysis quality but adds complexity around workers, evaluation storage, performance, and UI.

### Decision

Do not add Stockfish until auth, profiles, AI game save flow, reviews, and online-room basics are stable.

### Consequences

- Current reviews can remain beginner-friendly heuristic reviews for MVP.
- Real engine analysis is deferred.
- Phase 3 should focus on saved-game reliability, not engine strength.

## ADR-0007: Standardize Supabase Environment Variable Names

### Status

Accepted

### Context

The initial audit found a mismatch between local `.env` variable names and the browser Supabase client. The app also needs a clear split between browser-exposed values and server-only values for later Cloudflare deployment.

### Decision

Use the following Supabase environment variable names:

- Browser-exposed Vite variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Server-side variables:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
- Server/admin only:
  - `SUPABASE_SERVICE_ROLE_KEY`

Browser code must read only `VITE_*` variables. Server code must read only server-side variables.

### Consequences

- `.env.example` documents all required variables with placeholder values.
- Local `.env` files are ignored by git.
- Cloudflare configuration must provide the server-side variables and any required browser build variables.
- Service-role keys must never be exposed through `VITE_*` variables or browser code.

## ADR-0008: Use npm as the Official Package Manager

### Status

Accepted

### Context

The cloned project had both npm and Bun package-manager files. The user chose npm as the only package manager going forward.

### Decision

Use npm as the official package manager for ChessCoach Arena.

Keep:

- `package.json`
- `package-lock.json`

Remove:

- `bun.lockb`
- `bunfig.toml`

### Consequences

- Use `npm install` to install dependencies.
- Use `npm run dev`, `npm run build`, and `npm run lint` for local work.
- Do not add Bun-specific config or lockfiles.
- Future dependency updates should update `package-lock.json`.

## ADR-0009: Use `vyzglfxxonubnyydhzgf` as the Canonical Supabase Project

### Status

Accepted

### Context

Phase 0 found a mismatch between the local Supabase URL and `supabase/config.toml`. The user confirmed the canonical Supabase project ref.

### Decision

Use Supabase project ref `vyzglfxxonubnyydhzgf` as the canonical project for ChessCoach Arena.

Do not use deprecated project ref `tdzdwfpzbgxputgotcjj` going forward.

### Consequences

- `supabase/config.toml` points at `vyzglfxxonubnyydhzgf`.
- Local and deployment environment variables should use `https://vyzglfxxonubnyydhzgf.supabase.co`.
- Migrations should be applied only to the canonical project unless a future ADR defines staging/production project separation.
- Access to the canonical project is required before CLI migration commands can succeed.

## ADR-0010: Finalize AI Training Games via `SECURITY DEFINER` RPC

### Status

Accepted

### Context

AI training games should persist to `games`, update aggregate profile stats (`games_played`, `wins`, `losses`, `draws`), and never change `rating`. Direct client updates to `profiles` are easy to abuse and can desync from saved games.

### Decision

Finalize AI training games only through the Postgres function `public.finalize_ai_training_game`, marked `SECURITY DEFINER`, callable by the `authenticated` role. The function:

- Asserts `auth.uid()` is present and matches a profile row.
- Inserts a single `games` row with `game_type = 'AI Training'`.
- Updates the caller's profile counters in the same transaction.
- Does not modify `rating` or `highest_rating`.

Browser code continues to use the Supabase publishable key only (no service role in the client).

### Consequences

- AI training progress is consistent with rows in `games`.
- Ranked and online game finalization still require separate trusted paths (later phases).
- Migrations must be applied for the RPC to exist in remote environments.
- Optional future hardening: idempotency keys to handle ambiguous network outcomes.

## ADR-0011: Phase 4A room sync — Realtime plus light polling

### Status

Accepted (interim MVP)

### Context

Supabase Realtime `postgres_changes` on `public.rooms` should push updates when guests join or moves sync, but mobile networks or missed events can leave one client stale during demos.

### Decision

Subscribe to **`rooms` updates filtered by `id`** **and** run a periodic **full row refetch** (about every 4.5 seconds) while the room page is mounted. Use this pattern only until server-authoritative game state or stronger sync exists (Phase 5).

### Consequences

- Higher read volume on `rooms` for active sessions.
- Duplicate updates are idempotent (`setRoom`).

## ADR-0012: Join Online Rooms via `SECURITY DEFINER` RPC

### Status

Accepted

### Context

Phase 4A allowed any authenticated user to claim a waiting room by directly updating `rooms` rows with `status = 'waiting' AND guest_user_id IS NULL`. This was a known security risk: the client controlled color assignment, guest identity, and the transition from waiting to playing. Race conditions between concurrent join attempts were handled only by an optimistic post-verify pattern.

### Decision

Move room joining to a `SECURITY DEFINER` Postgres function `public.join_room(p_code text)`:

- Uses `auth.uid()` inside the RPC — no client-supplied user id.
- Locks the target room row with `FOR UPDATE` for atomicity.
- Validates code format (`^[A-Z0-9]{6}$`), room existence, room status, and guest slot availability.
- Handles re-entry (host or existing guest) by returning room info without mutation.
- Assigns colors server-side based on `host_color` (white/black/random).
- Returns a stable `jsonb` object: `room_id`, `room_code`, `status`, `role`, `player_color`.
- Raises structured exceptions: `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_NOT_AVAILABLE`, `ROOM_INVALID_CODE`.

The broad RLS UPDATE policy `(status = 'waiting' AND guest_user_id IS NULL)` is removed. Two focused policies replace it:

- `"Host updates own room"` — host can update/cancel their own rooms.
- `"Guest updates active room"` — guest can update rooms where `status = 'playing'`, with a permissive `WITH CHECK` so resign (setting `status = 'finished'`) is not blocked.

### Consequences

- Arbitrary authenticated users can no longer claim waiting rooms via direct UPDATE.
- Color assignment is consistent and tamper-proof.
- The join race condition is eliminated by `FOR UPDATE` row locking.
- Move validation and game finalization remain client-side for now (Phase 5 scope).
- Migration must be applied: `npx supabase db push`.

## ADR-0013: Public Matchmaking via `SECURITY DEFINER` RPC

### Status

Accepted

### Context

Users wanted a "Find Match" option besides private code-based rooms. The matchmaking logic (find or create a public room, assign guest, determine colors) must be atomic and trusted, not client-driven.

### Decision

Add `public.find_or_create_public_room(p_game_mode, p_host_color)` as a `SECURITY DEFINER` RPC:

- Checks for an existing public waiting room from the same caller first (prevents duplicates on double-click or dev mode StrictMode re-mount).
- Uses `FOR UPDATE SKIP LOCKED` to atomically claim a waiting public room from another user.
- Generates collision-safe room codes server-side with retry loop.
- Rooms have a new `visibility` column (`'private'` | `'public'`). Existing rooms default to `'private'`.

Private room creation remains a client-side `INSERT` (RLS safe) with explicit `visibility: 'private'`.

### Consequences

- Two online play modes: private (code/link) and public (matchmaking).
- Public room waiting UI shows "Finding opponent…" instead of code/link emphasis.
- `join_room` RPC still works by code regardless of visibility (for edge cases), but the UI does not expose public codes.
- Matchmaking is casual + random color only for MVP.

## ADR-0014: Move Validation via Supabase Edge Function

### Status

Accepted

### Context

Previously, clients directly sent `fen` and `pgn` updates to the `rooms` table. Any authorized participant could theoretically send an arbitrary FEN, cheating the game. We needed a server-side arbiter to validate standard chess moves.

### Decision

Implement a **Supabase Edge Function** (`record-move`) using Deno instead of a pure Postgres RPC:
- Reuses the existing robust `npm:chess.js` library for move validation and end-game detection (checkmate, draw).
- Validates the user's JWT (`Authorization` header) to ensure the move comes from the player whose turn it actually is.
- Bypasses RLS utilizing the Service Role Key exclusively for the final write after all validation passes.
- Clients optimistically update the UI, but revert if the API call fails or is rejected (HTTP 400/500).

### Consequences

- Moving pieces is now cryptographically secure and strictly follows chess rules.
- Adds an external API dependency to the game loop (client -> Edge Function -> Postgres), slightly increasing end-to-end move latency compared to direct GraphQL/PostgREST inserts, but providing essential security.
- We still need to migrate `resign` functionality before we can completely disable client-side UPDATE access to the `rooms` table.


## ADR-0015: Online Resignation and Abandonment uses Trusted Edge Function

### Status

Accepted

### Context

During an active game, terminating the game via the Resign button was making a direct PostgREST mutation to `rooms.result/end_reason`. Additionally, navigating away simply unmounted the current view without ending the game state on the server, leaving opponent waiting indefinitely.

### Decision

- Route changes intercepted via TanStack Router's `useBlocker`. A warning modals displays: "Leave game? This will count as a resignation".
- If confirmed (or via explicit Resign), the `forfeit-game` Edge Function is invoked.
- `forfeit-game` Edge Function establishes winner based on JWT vs participant roles and securely sets the `result`, `status='finished'`, and `end_reason='abandon'/'resignation'` utilizing the Service Role Key.
- Tab closures natively warn user via `beforeunload`.

### Consequences
- Guaranteed robust forfeit security natively handling who wins if you leave, blocking immediate cheaters.
- Rage quits (force killing browser and avoiding `beforeunload`) remain unhandled until periodic heartbeat/presence timeouts are instituted.


## ADR-0016: Browser clients no longer directly update rooms; trusted RPCs and Edge Functions own room mutation

### Status

Accepted

### Context

Historically, the client was directly invoking `.update({ fen, pgn })` and `.update({ status, result })` to run matches. This carried immense anti-cheat risks.

### Decision

- All real-time active gaming transactions are securely verified natively on the Edge (e.g. `record-move`).
- Room lifecycle mutations (Joining, Cancelling, Abandoning) map to trusted RPCs executing underneath the explicit `auth.uid()` constraints.
- The `rooms` database table now formally denies all inbound arbitrary UPDATEs directly mapped from browser REST queries via standard Supabase Row Level Security configurations.

### Consequences
- Guaranteed zero local mutation hijacking natively locking hackers out of `FEN` cheating loops.


## ADR-0017: Server-Authoritative Rating Computations via Postgres RPC and Idempotency Flags

### Status

Proposed

### Context

Historically, Elo calculation logic fired client-side, persisting data via the `supabase-js` adapter directly into `games` and `profiles`. As rooms were locked down (Phase 5C), the rating mechanism became the final security breach exposing Leaderboards to synthetic manipulation.

### Decision

- Rather than splitting Elo calculations redundantly across multiple Edge Functions (like `record-move` and `forfeit-game`), an atomic Postgres RPC (`finalize_online_room`) will execute rating and counter updates (`wins`, `losses`, `draws`, `games_played`) autonomously.
- **Idempotency** is mathematically guaranteed by appending a UNIQUE `source_room_id` column identically onto the `games` table. The RPC wraps natively around this insert constraint and halts metric increments inherently if duplicated.

### Consequences
- Guarantees bulletproof Leaderboard integrity without external network calls or fragile client synchronizations.


## ADR-0018: Strict UI Security Isolation via Single-Point RPC Methods

### Status

Adopted

### Context

Because Elo rankings natively function mathematically atop `public.profiles`, the generic `Users update own profile` Row-Level Security policy universally permitted malicious end-users to forge metrics payloads directly effectively rendering rankings moot natively.

### Decision

We universally drop arbitrary REST updates atop `profiles` entirely globally instead routing legitimate UI edits seamlessly strictly across a new `update_my_profile` `SECURITY DEFINER` endpoint ignoring all protected computational inputs explicitly natively.

### Consequences
- Metrics limits locked permanently natively.


## ADR-0019: Ranked Games Only Through Public Matchmaking

### Status

Accepted

### Context

Private rooms are useful for friends, teaching, and quick games by code, but allowing private ranked games creates a rating abuse path: two users can intentionally trade wins or feed one account.

### Decision

- Private rooms are casual-only.
- Ranked online games are available only through public Find Match.
- Find Match supports both Casual Match and Ranked Match.
- Ranked matchmaking uses the current user's profile rating to prefer nearby public ranked waiting rooms before falling back to any available ranked opponent.
- The database enforces private rooms as casual with a room constraint, not only UI copy.

### Consequences

- Friends can still play privately, but those games do not affect rating.
- Ranked games continue to use the existing server-side finalization and rating logic.
- Public matchmaking reduces easy rating farming but does not fully prevent coordinated queue abuse.
