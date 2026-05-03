# Changelog

All meaningful engineering changes should be recorded here.

## 2026-05-02

### Changed

- Started Phase 0 Supabase and environment pre-flight.
- Standardized Supabase environment variable naming:
  - Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
  - Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
  - Server/admin only: `SUPABASE_SERVICE_ROLE_KEY`.
- Updated browser Supabase client to read only browser-safe `VITE_*` variables.
- Updated Supabase server error messages to remove Lovable references.
- Added `.env.example` with placeholder values only.
- Updated `.gitignore` so local env files are ignored while `.env.example` remains committed.
- Documented and later resolved Supabase project-ref alignment and migrations (Phase 0.6).
- Started Phase 0.5 package-manager standardization.
- Standardized the project on npm as the only package manager.
- Removed Bun-specific project files.
- Safely removed `.env` from git tracking while keeping the local file.
- Updated documentation to record npm as the official package manager.
- Verified `npm install` and `npm run build`.
- Ran `npm run lint`; it fails on existing Prettier/line-ending issues and existing explicit `any` violations outside this cleanup scope.
- Started Phase 0.6 Supabase project alignment.
- Confirmed canonical Supabase project ref: `vyzglfxxonubnyydhzgf`.
- Deprecated old Supabase project ref: `tdzdwfpzbgxputgotcjj`.
- Updated `supabase/config.toml` to the canonical project ref.
- Updated local `.env` Supabase URL variables to the canonical project URL without committing secrets.
- Inspected migrations and confirmed they do not contain project-specific refs.
- Attempted `npx supabase link --project-ref vyzglfxxonubnyydhzgf`; migration application was initially blocked by Supabase account/project privileges (resolved by manual CLI setup).
- Verified `npm run build` after project-ref alignment.
- **Phase 0.6 migrations (manual):** Supabase CLI was completed for canonical project `vyzglfxxonubnyydhzgf`. Remote migrations applied successfully.
- **Expected remote schema:** tables `profiles`, `games`, `rooms`; RLS enabled on those tables; Realtime enabled for `rooms` (per migration design).

### Added

- Initial codebase audit completed.
- Documentation structure created under `docs/`.
- Project context documented for Cursor-led development.
- Implementation phases documented.
- Initial architecture decisions documented.
- Cursor workflow rules documented.

### Next

- **Phase 0.7:** Local smoke test against canonical project `vyzglfxxonubnyydhzgf` (auth, profile, read/write to Supabase). See `docs/IMPLEMENTATION_PLAN.md`.

## 2026-05-03

### Changed

- Started Phase 0.7 local Supabase smoke test.
- Verified `npm run dev` starts locally at `http://localhost:8080/`.
- Verified public app routes respond over HTTP: `/`, `/login`, `/signup`, `/dashboard`, and `/play/ai`.
- Verified anonymous public table reads succeed for `profiles`, `games`, and `rooms`.
- Verified remote RLS state via Supabase CLI: `profiles`, `games`, and `rooms` have RLS enabled.
- Verified `rooms` is present in the `supabase_realtime` publication.
- Verified signup reaches Supabase Auth and creates a user for project `vyzglfxxonubnyydhzgf`.
- Verified the `handle_new_user` trigger creates a `profiles` row with default values: rating `800`, `games_played` `0`, `wins` `0`, `losses` `0`, `draws` `0`, `onboarded` `false`.
- Found blocker: login is blocked for generated test accounts because Supabase email confirmation is enabled (`Email not confirmed`).
- Because login is blocked, authenticated browser flows remain unverified: onboarding, dashboard authenticated data, AI game save, review page, history, and profile page.
- Verified `npm run build` passes after smoke-test setup.

### Next

- Resolve the email-confirmation smoke-test blocker by confirming the test user's email or temporarily disabling email confirmation for local testing.
- Rerun Phase 0.7 authenticated browser flow after login succeeds.

## 2026-05-03 Phase 1A

### Changed

- Started Phase 1A authenticated app flow hardening.
- Improved auth provider session/profile loading so authenticated pages wait for the profile fetch instead of rendering with a transient `null` profile.
- Added client-side onboarding enforcement to authenticated routes using `RequireAuth`.
- Updated `/onboarding` so already-onboarded users are redirected to `/dashboard` and onboarding save errors are surfaced.
- Updated `/signup` and `/login` redirects for already-authenticated users, including users who still need onboarding.
- Updated signup behavior for email-confirmation projects: if Supabase does not return a session, users are guided back to login after confirming email.
- Updated login error handling to show the Supabase error message instead of a generic invalid-password message.
- Updated app-shell sign out to clear auth state and redirect to `/login`.
- Added resilient dashboard/profile loading skeletons and no-games empty states.
- Verified edited files with targeted IDE diagnostics.
- Verified `npm run build` passes.

### Next

- Manually test: sign up or log in, complete onboarding, open dashboard/profile, sign out, sign in again, confirm dashboard still works.

## 2026-05-03 Phase 3A

### Added

- Supabase migration defining `public.finalize_ai_training_game`: `SECURITY DEFINER` RPC inserts one **AI Training** row and updates `profiles.games_played` / `wins` / `losses` / `draws` without changing `rating`.
- `docs/SMOKE_TEST.md` with Phase 3A manual checklist.

### Changed

- AI game end flow (`/game/ai`) calls the RPC once per game with a client guard against duplicate finalization; end modal shows saving state, error + **Retry save**, and enables **View game review** only after a successful save; refreshes profile after save.
- Game review route loads with error handling, safe `key_moments` parsing, and fallback coach/moment copy when data is missing.
- History page handles failed game list fetches without leaving the UI stuck.
- Regenerated Supabase TypeScript `Functions` entry for `finalize_ai_training_game`.

### Next

- Apply new migration to the remote project: `npx supabase db push`.
- Run Phase 3A checklist in `docs/SMOKE_TEST.md`; continue with Phase 3 follow-ups or Phase 4 (online rooms) per `IMPLEMENTATION_PLAN.md`.

## 2026-05-03 — Play nested routes / AI launch

### Fixed

- `/play/ai`, `/play/create`, and `/play/join` did not render their components because `play.tsx` had no `<Outlet />` for child routes. `play.tsx` is now a layout with `Outlet`; the lobby lives in `play.index.tsx`.
- Play lobby cards no longer nest a `<button>` inside a `<Link>` (invalid HTML); the CTA uses `buttonVariants` styling on a non-interactive child.
- Child play routes no longer double-wrap `RequireAuth` / `AppShell` (handled by the `/play` layout).
- `/game/ai` search params normalize case for `difficulty` and `color` with safe defaults (`Easy`, `white`).

## 2026-05-03 Phase 3B

### Added

- Chess board UX: legal-move hints (radial dot for quiet squares, inset ring for captures), selected-square highlight, last-move tint, king-in-check highlight; click-to-move completes moves (promotion defaults to queen, consistent with drag).
- `playerColor` and optional `lastMove` props on `ChessBoard`; `canDragPiece` restricts dragging to the current player’s pieces on their turn.

### Changed

- `game.ai.tsx` and `room.$roomId.tsx` pass `playerColor`, `lastMove`, and use the enhanced board.

### Next

- Manual checks: `docs/SMOKE_TEST.md` Phase 3B; optional polish (e.g. promotion picker) in a later phase.

## 2026-05-03 Phase 4A

### Added

- Join route **`validateSearch`** for `code` query string; prefills uppercase code and shows “Join room **CODE**” context.
- **`WaitingGuestHint`** for non-hosts hitting a **waiting** room by UUID (`/room/$id`): directs to **`/play/join` `search={{ code }}`**.
- Participant vs spectator guard on **playing/finished** rooms; room **missing/error** panels.
- **Polling** (~4.5s) alongside Supabase Realtime on `rooms` updates for `$roomId`.
- Optimistic **`guest_user_id`** join with `.eq(status,"waiting").is("guest_user_id",null)` plus post-update verify.

### Changed

- Waiting host copy mentions auto-update + polling fallback; invite URL encodes **`code`**; cancel uses **`status = waiting`** filter.
- Online game sidebar: explicit **White/Black** “you play” line.
- Join flow: **`try/finally`** for busy state; clearer errors; re-entry if already **`white/black`** participant.

### Next

- Run `docs/SMOKE_TEST.md` Phase 4A checklist; Phase 4: RLS/RPC join hardening.

## 2026-05-04 Phase 4B

### Added

- Supabase migration `20260504000000_join_room_rpc.sql`:
  - `public.join_room(p_code text)` — `SECURITY DEFINER` RPC with `SET search_path = public`. Validates code format, locks row with `FOR UPDATE`, handles host/guest re-entry without mutation, assigns colors server-side, atomically claims waiting rooms. Returns stable `jsonb` with `room_id`, `room_code`, `status`, `role`, `player_color`. Raises structured exception codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_NOT_AVAILABLE`, `ROOM_INVALID_CODE`.
  - Replaced broad `"Participants update rooms"` RLS UPDATE policy with two focused policies:
    - `"Host updates own room"` — `USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id)`.
    - `"Guest updates active room"` — `USING (auth.uid() = guest_user_id AND status = 'playing') WITH CHECK (auth.uid() = guest_user_id)`.
  - `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated` on `join_room`.

### Changed

- `/play/join` (`play.join.tsx`): replaced client-side `.update()` join path with `supabase.rpc("join_room")`. Removed client-side color assignment logic. Error handling maps structured exception messages to user-friendly toasts. Removed unused `profile` dependency.
- `types.ts`: added `join_room` function entry (`Args: { p_code: string }, Returns: Json`).
- `docs/SMOKE_TEST.md`: added Phase 4B manual checklist.
- `docs/DECISIONS.md`: added ADR-0012 for join via SECURITY DEFINER RPC.
- `docs/IMPLEMENTATION_PLAN.md`: updated Phase 4 status.
- `docs/ENGINEERING_AUDIT.md`: updated Current Risks and Existing Supabase Integration sections.

### Next

- Apply migration: `npx supabase db push`.
- Run Phase 4B smoke test checklist.
- Phase 5: server-side move validation.

## 2026-05-04 Phase 4C

### Added

- Supabase migration `20260504100000_public_matchmaking.sql`:
  - `rooms.visibility` column (`text NOT NULL DEFAULT 'private'`) with CHECK constraint (`private` / `public`).
  - Partial index `rooms_public_waiting_idx` on `(created_at) WHERE visibility='public' AND status='waiting' AND guest_user_id IS NULL`.
  - `public.find_or_create_public_room(p_game_mode, p_host_color)` — `SECURITY DEFINER` RPC with `SET search_path = public`:
    - Duplicate-room guard: returns existing public waiting room if caller already has one (`action:'existing'`).
    - Matchmaking: `FOR UPDATE SKIP LOCKED` on oldest waiting public room from another host → joins and starts game (`action:'joined'`).
    - Creation: collision-safe 6-char code generation (10 retries) → creates new public waiting room (`action:'created'`).
    - `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`.
- New route `/play/find` (`play.find.tsx`): calls `find_or_create_public_room` RPC on mount with `startedRef` guard against double-execution. Shows spinner, handles joined/created/existing/error states.

### Changed

- Play lobby (`play.index.tsx`): 4 cards in 2×2 grid — Play vs AI, Find Match, Create Private Room, Join by Code.
- Create room page (`play.create.tsx`): heading "Create private room", insert includes `visibility: 'private'`.
- Room waiting UI (`room.$roomId.tsx`): visibility-aware — public rooms show "Finding opponent…" without code emphasis; private rooms keep code + invite link.
- `types.ts`: added `visibility` to rooms types, `find_or_create_public_room` function entry.
- `docs/DECISIONS.md`: added ADR-0013 for public matchmaking via SECURITY DEFINER RPC.
- `docs/SMOKE_TEST.md`: added Phase 4C checklist.
- `docs/IMPLEMENTATION_PLAN.md`: updated Phase 4 status.
- `docs/ENGINEERING_AUDIT.md`: updated with matchmaking notes.

### Next

- Phase 5C: RLS lockdown for room pieces and states.

## 2026-05-04 Phase 5B

### Added
- Supabase Edge Function `forfeit-game` to secure online resignation and abandonment.
- `@tanstack/react-router` `useBlocker` integration in `room.$roomId.tsx` to warn before navigating away from active games.
- `beforeunload` overlay in active rooms to guard against browser tabs closing.
- Explicit "Opponent left the game" and "You won because opponent left" messaging.

### Changed
- "Resign" buttons now securely trigger `forfeit-game` rather than directly issuing `rooms.update()` queries.
- Phase 5B Blocker Bugfix: Fixed `@tanstack/react-router` `useBlocker` skipping early returns by changing participant check to use reliable `user.id` rather than async `profile.id` and adding `allowNavigationRef` break condition.

## Phase 6D Ranked Matchmaking Abuse Prevention

### Added

- Supabase migration `20260505000000_phase_6d_ranked_matchmaking.sql`:
  - Replaces `find_or_create_public_room(p_game_mode, p_host_color)` with mode-aware public matchmaking.
  - Ranked matching prefers hosts within +/-200 rating, then +/-400, then any ranked waiting room; ties use smallest rating difference, then oldest room.
  - Adds `rooms_private_rooms_casual_check` so private rooms cannot be ranked.

### Changed

- Private room creation is casual-only and always inserts `game_mode = 'casual'`, `visibility = 'private'`.
- `/play/find` now lets users choose Casual Match or Ranked Match.
- Public waiting rooms and online games label Casual vs Ranked more clearly.
- Play lobby copy now positions Find Match as casual-or-ranked and Private Room as casual invite play.

### Next

- Apply migration with `npx supabase db push`.
- Run the Phase 6D smoke checklist.

## Phase 6D Ranked Forfeit Rating Bugfix Verification

### Verified

- Migration, generated Supabase types, `forfeit-game` Edge Function deploy, and production build were run successfully.
- Ranked explicit **Resign** now makes the leaver lose rating and the opponent gain rating.
- Ranked **Leave and resign** through sidebar/back now makes the leaver lose rating and the opponent gain rating.
- Exactly one `games` row is created per ranked forfeit with `source_room_id`.
- `rating_events` creates two rows for ranked forfeits.
- Refreshing or reopening the finished room does not apply rating twice.
- Casual resign/leave updates counters while keeping ratings unchanged.
- Leaderboard reflects ranked rating changes.

### Next

- Before Cloudflare deployment, run a pre-deploy gameplay integrity sweep across ranked checkmate, ranked resign/abandon, casual finish, private room joins, public matchmaking, reconnect/reopen, and leaderboard/history/profile consistency.

## Pre-deploy Record Move Finalization Bugfix

### Fixed

- Pre-deploy gameplay integrity sweep found that `record-move` accepted terminal moves and called `finalize_online_room`, but did not capture `finalizeError`.
- `record-move` now mirrors `forfeit-game` finalization error handling:
  - Logs `room_id`, result, end reason, and error details.
  - Returns `500` with `GAME_FINALIZATION_FAILED` if a move was accepted but finalization failed.
  - No longer silently returns success with `game_id = null` for failed terminal-game finalization.

### Next

- Redeploy Edge Function: `npx supabase functions deploy record-move`.
- Re-run the pre-deploy gameplay integrity sweep before Phase 7A.

## 2026-05-03 Phase 7A (Cloudflare deployment readiness)

### Changed

- **README.md** added at repo root for nFactorial submission: product summary, audience, differentiation, features, tech stack, security notes, local run/build, Workers deploy steps, placeholders for live URL and GitHub URL, and future roadmap pointers.
- **`.env.example`:** grouped into browser (Vite/build-time), Worker runtime, Edge Function local alias, and service-role sections with warnings not to expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
- **`wrangler.jsonc`:** enabled `observability` per Cloudflare TanStack Start guidance.
- **`package.json`:** `deploy` script runs `vite build` then `wrangler deploy --config dist/server/wrangler.json`; added **`wrangler`** as an explicit **`devDependency`** for predictable installs.
- **`docs/PROJECT_CONTEXT.md`:** noted absence of `app.config.ts`; config flows through `vite.config.ts`.
- **`docs/IMPLEMENTATION_PLAN.md`:** Phase 7A status, platform choice (Workers + assets), and CI build-time **`VITE_*`** risk documented.
- **`docs/ENGINEERING_AUDIT.md`:** Phase 7A deployment summary.
- **`docs/SMOKE_TEST.md`:** Phase 7A manual checklist post-deploy.

### Verified

- `npm.cmd run build` succeeds (client + SSR outputs under `dist/`).
- `npx wrangler deploy --config dist/server/wrangler.json --dry-run` succeeds after build.

### Next

- Replace README deployment and GitHub placeholders with real URLs.
- Configure Cloudflare Worker environment variables / secrets for production and apply full deploy (requires `wrangler login` + account access).
- Run `docs/SMOKE_TEST.md` Phase 7A checklist on the deployed URL.

## 2026-05-03 nFactorial project completion audit

### Added

- **`docs/ENGINEERING_AUDIT.md`:** full completion matrix (phases 0–8), feature inventory, deferred items, submission blockers, and **Strong**-level nFactorial assessment with evidence pointers.
- **`docs/IMPLEMENTATION_PLAN.md`:** cross-reference to the audit under Phase 8.
- **`docs/SMOKE_TEST.md`:** pre-Typeform submission checklist.

### Notes

- Audit is documentation-only; no application code or schema changes.
- **Go / no-go** and README URL reminder summarized in ENGINEERING_AUDIT.

## 2026-05-03 Phase 8A (Promotion picker)

### Added

- **Pawn promotion UI** on `ChessBoard`: chess.js verbose-move detection, shadcn **Dialog** with Queen / Rook / Bishop / Knight and Cancel; click-to-move and drag-to-square (drag snaps back until promotion is chosen). `onMove(from, to, promotion)` receives the selected piece letter (`q`/`r`/`b`/`n`).
- **`docs/SMOKE_TEST.md`:** Phase 8A manual checklist (AI + online promotion).

### Changed

- **`docs/IMPLEMENTATION_PLAN.md`:** Phase 8A status under Phase 8.

## 2026-05-06 Phase 8B (Draw offers — online)

### Added

- Migration **`20260506000000_phase_8b_draw_offers.sql`:** `finalize_online_room_impl`, refactor `finalize_online_room` → wrapper + impl; **`offer_draw`**, **`respond_draw_offer`** (authenticated); trigger **`trg_rooms_clear_draw_offer_on_fen`** to clear **`draw_offer_by`** on move.
- **`room.$roomId.tsx`:** Offer draw / Accept / Decline via **`supabase.rpc`** only (no direct **`rooms` UPDATE**).
- **`docs/DECISIONS.md`:** ADR-0020; **`docs/SMOKE_TEST.md`:** Phase 8B checklist.

### Changed

- **`src/integrations/supabase/types.ts`:** `offer_draw`, `respond_draw_offer` function entries.

### Deploy

- **`npx supabase db push`** (or apply migration on canonical project). Regenerate types optional: existing types updated manually.

## 2026-05-06 Phase 8C (Mock coins + cosmetic store)

### Added

- Migration **`20260506120000_phase_8c_cosmetic_store.sql`**: cosmetic catalog, wallets (default **500** coins), transactions, inventory, loadouts; RPCs **`ensure_my_wallet`**, **`mock_purchase_coins`**, **`purchase_cosmetic`**, **`equip_cosmetic`**; RLS read-only for users on sensitive tables.
- **`src/routes/store.tsx`**: balance, mock coin packs, board skins + avatar frames; **Mock Buy** / **Buy** / **Equip** via **`supabase.rpc` only**; mock-checkout disclaimer.
- **`src/lib/cosmetics.ts`**, **`src/lib/cosmetic-wallet-context.tsx`**: wallet snapshot parsing, board/avatar styling helpers; provider wraps **`AppShell`**.
- **`AppShell`**: **Store** nav link, optional coin balance link, equipped **avatar frame** on sidebar initials.
- **`ChessBoard`**: optional **`boardSkinSlug`** (equipped skin applies square + board chrome colors).
- **`game.ai`**, **`room.$roomId`**: pass equipped board skin from wallet context.
- **`profile.index`**: equipped frame around profile avatar tile.
- **`pricing`**: logged-in CTA/link to **`/store`** (demo economy).
- **`docs/DECISIONS.md`:** ADR-0021; **`docs/SMOKE_TEST.md`:** Phase 8C checklist.

### Changed

- **`src/integrations/supabase/types.ts`:** tables **`user_wallets`**, **`user_cosmetics`**, **`user_cosmetic_loadouts`**; RPC typings for Phase 8C.

### Deploy / verify

- Apply migration: **`npx supabase db push`** on the target project.
- **`npm.cmd run build`** passes (client + SSR).

## 2026-05-06 Phase 8D (Settings subscription UI cleanup)

### Changed

- **`src/routes/settings.tsx`:** removed subscription/plan UI; **Account** retains email, sign-out, and a **Cosmetic store** link (no **Upgrade to Pro**).
- **`src/routes/pricing.tsx`:** FAQ answer no longer implies subscription cancellation via Settings.

### Notes

- **`/store`**, Arena Coins, and **`/pricing`** (marketing) unchanged in scope; no schema or Stripe changes.
