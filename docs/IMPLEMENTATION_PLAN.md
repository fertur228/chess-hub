# Implementation Plan

This plan is the working roadmap for ChessCoach Arena. Do not add new features outside the active phase unless the plan is explicitly updated first.

## Phase 0: Pre-flight Supabase and Environment Setup

### Goal

Make the project runnable and pointed at the correct Supabase project before changing application behavior.

### Tasks

- Decide the canonical Supabase project.
- Confirmed: canonical Supabase project ref is `vyzglfxxonubnyydhzgf`.
- Align `supabase/config.toml` and local environment variables.
- Fix the Supabase publishable key variable mismatch.
- Create `.env.example`.
- Ensure `.env` is ignored by git.
- Rotate exposed keys if needed.
- Choose one package manager and resolve lockfile drift. Completed in Phase 0.5: npm is the official package manager.
- Confirm migrations are applied to the selected Supabase project.

### Definition of Done

- App can connect to Supabase locally.
- Sign-up creates an auth user and profile row.
- Login works.
- Onboarding can update the profile.
- No secrets are committed.
- Package manager ownership is clear: use npm and `package-lock.json`.

### Risks

- Using the wrong Supabase project can create data and migration drift.
- Accidentally committing `.env` can leak credentials.
- Changing package manager files without agreement can create dependency churn.

### Current Phase 0 Notes

- Environment variable naming convention:
  - Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
  - Server/admin only: `SUPABASE_SERVICE_ROLE_KEY`.
- Browser code must read only `VITE_*` variables.
- Server code must read only server-side variables.
- Local `.env` files are ignored. `.env.example` is committed as the source of required variable names.
- Package manager standardization:
  - npm is the official package manager.
  - `package-lock.json` is kept.
  - Bun is no longer used.
  - `bun.lockb` and `bunfig.toml` were removed.
- Known Supabase project mismatch:
  - Resolved in Phase 0.6.
  - Canonical project ref: `vyzglfxxonubnyydhzgf`.
  - Deprecated project ref: `tdzdwfpzbgxputgotcjj`.
  - `supabase/config.toml` now points at the canonical project.
- Migration status:
  - **Applied successfully** to canonical project `vyzglfxxonubnyydhzgf` (manual Supabase CLI `link` + `db push` completed by project owner).
  - Expected remote objects: tables `profiles`, `games`, `rooms`; RLS enabled on each; Realtime publication includes `rooms` (per repo migrations).

### Migration Instructions After Project Confirmation

The final Supabase project ref is confirmed as `vyzglfxxonubnyydhzgf`. Run these commands from a terminal authenticated to a Supabase account with access to that project.

1. Confirm the Supabase CLI is installed and inspect the current CLI interface:

   ```bash
   supabase --help
   supabase link --help
   supabase db --help
   ```

2. Link the local project to the confirmed Supabase project ref:

   ```bash
   npx supabase login
   npx supabase link --project-ref vyzglfxxonubnyydhzgf
   ```

3. Review the pending migrations in `supabase/migrations/`.

4. Push migrations only after the confirmed project ref matches the intended environment:

   ```bash
   npx supabase db push
   ```

5. Verify the remote schema contains `profiles`, `games`, and `rooms`, and confirm RLS is enabled.

### Manual Supabase Dashboard Verification

If CLI verification is blocked, verify manually in the Supabase Dashboard for project `vyzglfxxonubnyydhzgf`:

1. Open Table Editor and confirm `profiles`, `games`, and `rooms` exist.
2. Open Authentication and confirm new signups can create users.
3. Open SQL Editor and run:

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
     and tablename in ('profiles', 'games', 'rooms');
   ```

   Expected: all three rows have `rowsecurity = true`.

4. Open Database > Publications or Realtime settings and confirm `rooms` is enabled for Realtime changes.

## Phase 0.7: Local Smoke Test

### Goal

Confirm the app talks to the canonical Supabase project end-to-end before Phase 1 feature hardening.

### Current Status

Partially complete.

Completed:

- `npm run dev` starts locally at `http://localhost:8080/`.
- Public routes respond over HTTP: `/`, `/login`, `/signup`, `/dashboard`, `/play/ai`.
- Anonymous public reads work for `profiles`, `games`, and `rooms`.
- Remote RLS verification passed: `profiles`, `games`, and `rooms` have RLS enabled.
- Remote Realtime verification passed: `rooms` is in the `supabase_realtime` publication.
- Signup reaches Supabase Auth for project `vyzglfxxonubnyydhzgf`.
- Signup creates a `profiles` row via `handle_new_user` with default values:
  - `rating`: `800`
  - `games_played`: `0`
  - `wins`: `0`
  - `losses`: `0`
  - `draws`: `0`
  - `onboarded`: `false`
- `npm run build` passes.

Blocked:

- Login for generated smoke-test accounts returns `Email not confirmed`.
- Authenticated browser flows cannot be fully verified until the test user is confirmed or email confirmation is temporarily disabled for local testing.

Not yet verified because login is blocked:

- Onboarding update from the UI.
- Authenticated dashboard profile load.
- Authenticated empty-game dashboard state.
- AI game save through the app UI.
- Review page opening from an AI game.
- History/profile pages showing the saved AI game.
- Whether AI games update profile counters in the real UI flow.

### Tasks

- From project root, ensure `.env` matches `.env.example` names and points at `https://vyzglfxxonubnyydhzgf.supabase.co` for URL vars.
- Run `npm install` if needed, then `npm run dev`.
- Sign up a test user; confirm in Supabase Dashboard (Authentication) that the user exists.
- Confirm Table Editor shows a `profiles` row for that user (trigger `handle_new_user`).
- Log in; reach `/dashboard` and confirm profile loads without console errors.
- Complete or skip `/onboarding`; confirm `profiles` updates (`skill_level`, `goal`, `onboarded`).
- Optional: open `/leaderboard` or run a quick `profiles` select in SQL Editor to confirm read path.
- Do not treat online rooms, rating changes, or full AI flows as required for 0.7 unless you want extra confidence.

### Definition of Done

- Sign up and login work against project `vyzglfxxonubnyydhzgf`.
- Profile row exists and updates from onboarding.
- No missing-env errors for `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Risks

- Email confirmation settings in Supabase can block immediate login after sign-up.
- Wrong `.env` still pointed at another project would pass UI but write to the wrong backend.

## Phase 1: Auth and Profile Hardening

### Goal

Make authentication and profile flows reliable, secure, and predictable.

### Phase 1A Status

In progress.

Completed in Phase 1A:

- Auth provider now treats profile loading as part of authenticated loading state.
- Authenticated routes now use a client-side onboarding redirect when `profile.onboarded` is false.
- `/onboarding` no longer forces already-onboarded users through setup again.
- Onboarding completion saves `skill_level`, `goal`, and `onboarded`, then refreshes profile state and redirects to `/dashboard`.
- `/login` and `/signup` redirect already-authenticated users to `/dashboard` or `/onboarding` depending on profile status.
- Sign out clears local auth state and redirects to `/login`.
- Dashboard and profile pages render loading skeletons while auth/profile data is settling.
- Dashboard and profile pages render empty states when no games exist.
- `npm run build` passes.

Still pending in broader Phase 1:

- Forgot-password and reset-password flows.
- Dedicated email-confirmation UX.
- Server/loader-level route protection if needed for Cloudflare SSR hardening.
- Form validation cleanup with the installed form tooling.

### Tasks

- Add forgot-password and reset-password flows.
- Add an email-confirmation handling flow if Supabase email confirmation is enabled.
- Enforce onboarding when `profile.onboarded` is false.
- Improve auth route guards.
- Add consistent form validation with existing form tooling.
- Centralize profile-related types and helpers.

### Definition of Done

- Users can sign up, confirm if required, log in, reset password, complete onboarding, and reach dashboard.
- Protected pages reliably redirect unauthenticated users.
- Profile state refreshes correctly after edits and onboarding.

### Risks

- Supabase Auth behavior depends on project settings.
- Client-only guards can create SSR and redirect edge cases.

## Phase 2: Dashboard/Profile/History Real Data Cleanup

### Goal

Clean up existing real-data pages without changing product behavior.

### Tasks

- Centralize game/profile query helpers.
- Replace repeated ad hoc Supabase reads with consistent data hooks or query helpers.
- Remove route-to-route imports for shared game row logic.
- Replace `any` with generated Supabase table types.
- Add loading, empty, and error states consistently.
- Add database indexes for frequent game-history queries if needed.

### Definition of Done

- Dashboard, profile, history, leaderboard, public profile, and review pages use shared typed data access.
- No page imports reusable business logic from another route module.
- Query failure states are visible to users.

### Risks

- Refactoring data access can accidentally change route behavior.
- Query helper changes can affect multiple pages at once.

## Phase 3: AI Game Save/Profile Counters/Review Stability

### Goal

Make AI games reliably saved and reflected in user progress.

### Current status (Phase 3A)

Completed in repo (apply migration remotely):

- Single-save AI end flow with saving UI and retry on failure; review link enabled only after successful RPC.
- Trusted `finalize_ai_training_game` RPC inserts the game row and updates profile aggregate stats without touching rating.
- Review, history, dashboard, and profile consume the same `games` / `profiles` data; profile refresh after AI game updates in-app stats.

Remaining for later Phase 3 scope (if any): broader review persistence, non-AI games, idempotency keys for ambiguous network responses.

### Tasks

- Ensure completed AI games save once.
- Update profile counters for AI games through a trusted server-side path.
- Stabilize end-of-game UI so review links appear after the game row is saved.
- Improve review persistence and loading.
- Keep Stockfish out of scope until the MVP is stable.

### Definition of Done

- AI game completion creates a game row.
- AI game completion updates appropriate profile counters.
- User can always open the review after a saved AI game.
- No client can directly award arbitrary progress.

### Risks

- Direct profile updates from the client can be abused.
- Duplicate game saves can corrupt history and counters.

## Phase 3B: Chess board legal-move hints and beginner-friendly board UX

### Goal

Help beginners see legal moves, last move, and check on the shared `ChessBoard` (AI and online).

### Current status

- `ChessBoard` uses `chess.js` `moves({ square, verbose: true })` for hints; `squareStyles` for dots, capture rings, selection, last move, and king-in-check.
- Wired for `/game/ai` and `/room/$roomId` online play.
- Hints clear on `fen` change and when `disabled` (not your turn, AI thinking, game over).

### Definition of done

- Select own piece on your turn: legal targets show (dot = quiet, ring = capture).
- Click empty / illegal square: hints clear; opponent pieces do not show hints.
- Drag-and-drop still works; illegal drops rejected by existing `onMove` logic.

### Risks

- `react-chessboard` square style merging may need tuning on some themes.
- Online games rely on parent `lastMove` derived from PGN after sync.

## Phase 4: Online Room Hardening

### Goal

Make online room creation and joining secure and predictable.

### Phase 4A status (MVP demo flow)

Completed — see CHANGELOG Phase 4A entry.

### Phase 4B status (Room join RPC + RLS hardening)

Completed — see CHANGELOG Phase 4B entry.

### Phase 4C status (Private rooms + public matchmaking — current)

Completed and verified via manual smoke test:

- `rooms.visibility` column (`'private'` / `'public'`) added with CHECK constraint and partial index.
- `find_or_create_public_room` SECURITY DEFINER RPC: duplicate-room guard, `FOR UPDATE SKIP LOCKED` matchmaking, collision-safe code generation.
- Play lobby: 4 cards (AI, Find Match, Create Private Room, Join by Code).
- `/play/find` route calls matchmaking RPC with `startedRef` guard.
- Room waiting UI is visibility-aware (public: "Finding opponent…", private: code + invite link).
- Private room creation sets `visibility: 'private'` explicitly.
- Migration: `20260504100000_public_matchmaking.sql`.

### Phase 5A status (Server-Side Move Validation)

Completed in repo:
- Supabase Edge Function `record-move` created in `supabase/functions/record-move`.
- Validates moves securely using `npm:chess.js` and `Deno.serve`.
- Verifies JWT, turn ownership, room state, and computes checkmate/draw.
- Uses Service Role Key to update the `rooms` table, providing a secure backend.
- `room.$roomId.tsx` uses `supabase.functions.invoke("record-move")` with optimistic UX and failure rollback.
- Client no longer mutates `fen`/`pgn` directly for normal moves.
- **Note (Phase 5A.1)**: Testing Edge Functions locally requires Docker Desktop. If Docker is unavailable, the hosted deploy testing acts as the fallback.

**Still deferred to Phase 5B**: Game finalization RPC/Function for Resign and Draw Offers so client RLS can be locked down completely.

### Phase 5B Plan: Leave Confirmation & Trusted Game Forfeit

#### Current State Findings
- **Resign Path**: The explicit "Resign" button currently functions by making a direct `.update({ status: 'finished', result: ..., end_reason: 'resignation' })` call to PostgREST.
- **Navigation Path**: `app-shell.tsx` uses `<Link>` from `@tanstack/react-router`. TanStack Router v1.x provides a `useBlocker` hook to reliably intercept all in-app client-side routing.
- **Interception Strategy**: We will use `useBlocker(shouldBlock)` when `isOver === false` and `myTurn !== undefined` (meaning the caller is an active participant). We will manage a custom modal (`AlertDialog`) when the blocker triggers. 
- **Limitations**: Browser-level close/refresh actions cannot predictably run asynchronous API calls (`supabase.functions.invoke`). We must rely on native `beforeunload` warnings for tab-closing, while keeping the application robust against actual disconnects via Realtime presence (Phase 5/6+ scope).

#### Recommended Architecture: `forfeit-game` Edge Function
We will implement an Edge Function to secure game finalization:
- **API**: `POST /functions/v1/forfeit-game` with `{ room_id, reason: 'resign' | 'abandon' }`
- **Logic**: It will mimic `record-move` but strictly for finalizing `status = 'finished'`, setting the `end_reason`, and dictating the loser securely via `supabase-admin` Service Role Key.
- **Frontend Changes**:
  - `resign` function swaps to `invoke("forfeit-game")`.
  - The `useBlocker` modal calls `invoke("forfeit-game", { body: { reason: 'abandon' } })` if "Leave and resign" is clicked, and then proceeds using `blocker.proceed()`.
  - Add native `window.addEventListener('beforeunload', ...)` for tab closes.
  - Updates via Realtime will flawlessly sync the existing opponent UX, which simply watches `update` events on `rooms`.
### Tasks

- Tighten RLS for room updates.
- Move room joining into a trusted RPC or server-controlled function.
- Auto-fill join code from invite links.
- Improve waiting-room state and error handling.
- Add cancellation constraints so only authorized users can cancel.

### Definition of Done

- A host can create a room.
- A guest can join with a code or invite link.
- Unauthorized users cannot mutate waiting rooms.
- Waiting-room UI correctly reflects room status.

### Risks

- Overly strict RLS can block valid joins.
- Overly broad RLS can allow room hijacking.

## Phase 5: Online Game Sync Hardening

### Goal

Make online gameplay server-authoritative enough for MVP reliability.

### Tasks

- Move move validation and room state updates to a trusted server-side path.
- Make game finalization idempotent.
- Save completed online games exactly once.
- Update rating and profile counters atomically.
- Add reconnection handling for stale room state.
- Add draw-offer support if still in MVP scope.

### Definition of Done

- Either player can make legal moves only on their turn.
- Illegal or forged room updates are rejected.
- Finished games produce one game record.
- Rating/profile updates happen once and are tied to a saved game.

### Risks

- Realtime concurrency bugs can be hard to reproduce.
- Client-side finalization can fail if the responsible player disconnects.

## Phase 6: Rating and Leaderboard Hardening

### Goal

Make ratings trustworthy and leaderboards accurate.

### Tasks

- Move Elo calculation to a trusted server-side path.
- Prevent direct client mutation of protected profile stats.
- Add rating history if product needs progress charts.
- Improve leaderboard query performance and ordering.
- Define rules for ranked vs casual vs AI games.

### Definition of Done

- Users cannot directly set their own rating.
- Ranked game results update rating through trusted logic.
- Leaderboard reflects trusted profile data.

### Risks

- Existing permissive profile policies can allow stat manipulation.
- Rating changes must be idempotent to avoid duplicate updates.

## Phase 7: Cloudflare Deployment Readiness

### Goal

Prepare the app for Cloudflare deployment.

### Phase 7A status (readiness checklist)

Completed in repo:

- **Build path verified:** `npm.cmd run build` produces `dist/client` (static assets) and `dist/server` (Worker entry + generated `dist/server/wrangler.json`).
- **Platform:** Cloudflare **Workers** (full-stack SSR) with assets binding to `dist/client`; **not** Pages-only static hosting.
- **`wrangler.jsonc`:** `main` = `@tanstack/react-start/server-entry`, `nodejs_compat`, `observability.enabled` documented for operators.
- **Deploy command:** after build, `npx wrangler deploy --config dist/server/wrangler.json` (or `npm run deploy`). Dry-run validates bundling locally.
- **Env documentation:** `.env.example` sections for Vite client (build-time) vs Worker runtime vs Edge Function local keys; README covers build-time requirement for `VITE_*`.

Still requires operator action outside the repo:

- Set Worker vars `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` on the deployed Worker.
- Ensure CI/build environment provides `VITE_SUPABASE_*` during `npm run build`.
- Replace README placeholder links with actual **workers.dev**/custom URL and GitHub URL.
- Log in Cloudflare CLI (`wrangler login`) before first deploy; apply Supabase Edge Function deploys for the linked project (`record-move`, `forfeit-game`, etc.).

### Tasks

- Verify TanStack Start Cloudflare build path.
- Configure Cloudflare environment variables and secrets.
- Confirm Supabase URLs and publishable keys for deployment.
- Run production build locally.
- Document deployment commands and rollback process.
- Confirm runtime compatibility with browser and worker environments.

### Definition of Done

- Production build succeeds.
- Required env vars are documented in `.env.example`.
- Cloudflare deployment path is documented.
- App can authenticate and query Supabase in deployed environment.

### Risks

- Browser-only assumptions can fail in SSR/worker contexts.
- Missing Cloudflare secrets can create production-only failures.
- If `npm run build` runs in CI **without** `VITE_*` variables, the client bundle may omit Supabase URLs/keys (`import.meta.env` replacements); always set build-time vars in Workers Builds / CI when applicable.

## Phase 8: Polish

### Goal

Improve user experience, maintainability, and production quality after the MVP is stable.

### Phase 8A: Promotion picker

**Status:** Implemented.

- `ChessBoard` detects pawn promotion using **chess.js verbose legal moves** (`promotion` on `Move`). When more than one legal promotion exists, a **Dialog** offers Queen / Rook / Bishop / Knight; **Cancel** or closing the dialog leaves the position unchanged.
- **Click-to-move** and **drag-and-drop** both open the picker for promotion targets; drag returns `false` until a piece is chosen so the piece snaps back until the user confirms.
- **AI** (`game.ai`) and **online** (`room.$roomId`) unchanged except they already forward `promotion` to `chess.move` / `record-move`.
- No schema, rating, Edge Function, or Wrangler changes.

### Phase 8B: Draw offers (online)

**Status:** Implemented (migration + `room.$roomId` UI + `supabase.rpc` only).

- **`offer_draw` / `respond_draw_offer`** SECURITY DEFINER RPCs; **`finalize_online_room`** split into **`finalize_online_room_impl`** (internal) + existing service_role wrapper for Edge Functions.
- Accept path sets **`end_reason = draw_agreement`**, **`result = draw`**, then **`finalize_online_room_impl`** (same rating/counter rules as other finishes; idempotent via **`finalized_at`** / **`source_room_id`**).
- Trigger clears **`draw_offer_by`** when **`fen`** changes while **`playing`** (move cancels offer).
- Frontend: Offer / Accept / Decline; toasts; game-over copy for agreement draws.

### Phase 8C: Mock coins + cosmetic store

**Status:** Implemented.

- Migration **`20260506120000_phase_8c_cosmetic_store.sql`**: tables **`cosmetic_items`**, **`user_wallets`**, **`coin_transactions`**, **`user_cosmetics`**, **`user_cosmetic_loadouts`**; seed catalog; wallet backfill **500** + **`starting_grant`**; **`handle_new_user`** creates wallet + loadout + grant; RPCs **`ensure_my_wallet`**, **`mock_purchase_coins`**, **`purchase_cosmetic`**, **`equip_cosmetic`** (`REVOKE PUBLIC`, **`GRANT authenticated`**).
- Frontend: **`/store`** (mock packs, buy/equip), **`CosmeticWalletProvider`** inside **`AppShell`** (single **`ensure_my_wallet`** per session), nav link + coin hint; **`ChessBoard`** optional **`boardSkinSlug`**; profile/sidebar avatar **frame** from loadout.
- **No** Stripe; **no** client wallet `UPDATE` or transaction **`INSERT`**; gameplay and rating logic untouched.

### Tasks

- Add persistent settings.
- Improve board UX, highlights, and sounds (beyond promotion).
- Add avatar upload if needed.
- Improve game review UI.
- Add test coverage for critical flows.
- Remove remaining template or Lovable references.
- Improve README and developer onboarding.

### Definition of Done

- Core flows feel stable and beginner-friendly.
- Documentation reflects the current system.
- Remaining technical debt is tracked and prioritized.

### Risks

- Polish can expand scope if not tied to stable MVP flows.
- Visual improvements can hide unresolved data or security issues.

### Completion audit snapshot (nFactorial, 2026-05-03)

Phase-by-phase implementation status, deferred items, and submission blockers: see **`docs/ENGINEERING_AUDIT.md`** section *nFactorial project completion audit*.


### Phase 5B Completed (Leave Confirmation & Trusted Game Forfeit)
- `forfeit-game` Edge Function created.
- `room.$roomId.tsx` uses `useBlocker` (TanStack Router) to handle in-app navigation.
- Explicit `resign` button securely delegates to the edge function.
- Manual testing for navigation blocking and forfeit behavior passed successfully on 2026-05-04.


### Phase 5C Completed (RLS lockdown for room pieces and states)
- Removed generic `rooms` UPDATE policies.
- Replaced `cancel` operation with `cancel_room` RPC.
- Cleaned temporary files and verified 100% Edge Function / RPC mutation exclusivity on the game board data.

Passed manual tests verifying zero direct unauthorized updates natively traversing user space.

- Phase 5C manual verification passed. (Rooms RLS locked down).
  - **Known Limitations:**
    - Hard disconnects (rage-quits avoiding `beforeunload`) remain unhandled. Deferred to heartbeat/presence tracking.
    - Ratings and Leaderboards computation is still client-sided and vulnerable. Deferred to Phase 6.


## Phase 6A/6B: Server-side rating and leaderboard

### Current Discoveries
- `eloChange` math is executed entirely by the client inside a `room.$roomId.tsx` `useEffect` hook upon game termination. The client directly executes `profiles` updates which breaches game state integrity.
- Leaderboards simply execute `.select("*").order("rating")` against `profiles`, requiring absolute trust in the `profiles` data.
- Currently, a player could bypass the React flow or hijack the payload to push synthetic rating inflations.

### Recommended Architecture (PostgreSQL RPC)
1. Establish `public.finalize_online_room(p_room_id uuid)` as a SECURITY DEFINER RPC handling holistic atomic finalization.
2. **Idempotency**: Append a `source_room_id UUID UNIQUE REFERENCES rooms(id)` flag directly to `public.games`. Attempting to register the game will trap `UNIQUE` violations recursively securing the metric states perfectly against double-clicks or duplicated edge function delays.
3. The backend math applies standard Elo (k=32) mapping precisely to the local schema without any external dependency overheads.
4. **Integration**: Edge Functions `record-move` and `forfeit-game` automatically call this RPC using their Service Role Key after persisting a `finished` status.

- Phase 6B Execution Verified: All structural RPC transitions successfully map safely. Idempotency guarantees are flawlessly enforced against external UI hijacks.

- Phase 6C Execution Complete: All RLS bypasses stripped seamlessly binding native metrics exclusively through restricted `update_my_profile` procedures safely rendering explicit metrics inviolable.

### Phase 6D: Ranked matchmaking abuse prevention

### Goal

Prevent friends from creating ranked private rooms and intentionally feeding rating. Ranked online games must enter through public Find Match only.

### Tasks

- Make private room creation casual-only in the UI.
- Enforce private rooms as casual-only in the database.
- Keep Find Match as the only ranked entry point.
- Let Find Match create or join either casual or ranked public rooms.
- For ranked public rooms, prefer opponents close to the current user's profile rating.

### Definition of Done

- `/play/create` has no Ranked option and creates `game_mode = 'casual'`, `visibility = 'private'`.
- `/play/find` offers Casual Match and Ranked Match.
- `find_or_create_public_room` returns existing public waiting rooms instead of creating duplicates.
- Ranked matchmaking uses `FOR UPDATE SKIP LOCKED` and rating proximity buckets: +/-200, +/-400, then any.
- Ranked finalization still uses the existing Phase 6B server-side rating RPC.

### Risks

- Existing private ranked rooms must be normalized to casual by migration.
- Direct SQL/API inserts are blocked by the private-room casual check, but already-created public ranked waiting rooms remain valid.

### Phase 6D ranked forfeit rating bugfix status

Verified after running:

- `npx supabase db push`
- `npx supabase gen types typescript --project-id vyzglfxxonubnyydhzgf --schema public > src/integrations/supabase/types.ts`
- `npx supabase functions deploy forfeit-game`
- `npm.cmd run build`

Manual verification passed:

- Ranked explicit Resign makes the leaver lose rating and the opponent gain rating.
- Ranked Leave and resign through sidebar/back makes the leaver lose rating and the opponent gain rating.
- One `games` row is created with `source_room_id`.
- `rating_events` has two rows for ranked games.
- Refresh/reopen does not apply rating twice.
- Casual resign/leave updates counters but rating remains unchanged.
- Leaderboard reflects ranked rating changes.

### Recommended next step

Run a pre-deploy gameplay integrity sweep before Cloudflare deployment, covering all trusted game-ending paths and the UI/database surfaces that depend on them: room status/result, game save, rating events, profile stats, leaderboard, history, and review links.

### Pre-deploy sweep bugfix

The pre-deploy gameplay integrity sweep found that `record-move` did not capture `finalize_online_room` errors after terminal moves. This meant checkmate/stalemate/draw could finish the room while returning success with `game_id = null` if finalization failed.

Fix applied:

- `record-move` now mirrors `forfeit-game` by destructuring `finalizeError`.
- On finalization failure, it logs room/result/end-reason context and returns `GAME_FINALIZATION_FAILED`.
- Requires `npx supabase functions deploy record-move`.
