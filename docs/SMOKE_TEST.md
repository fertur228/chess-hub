# Manual smoke tests

Use these checklists after wiring environment variables and applying Supabase migrations.

## Phase 3A: AI training game save, review, history, profile counters

**Prerequisites:** Run `npx supabase db push` so `public.finalize_ai_training_game` exists on the target project. Confirm auth works (sign up / login, onboarding if required). From **Play**, `/play` should show the lobby; **Play vs AI** and `/play/ai` should show the AI setup screen (not an empty play shell).

1. Start an AI game from **Play vs AI** (pick color and difficulty).
2. Make several legal moves; finish by checkmate, draw condition, or **Resign**.
3. Confirm the end modal shows **Saving your game…**, then completes without error.
4. Confirm **View game review** appears only after save succeeds; open it and confirm:
   - Result matches the game.
   - Type shows **AI Training**.
   - Moves count and date look valid.
   - **Rating unchanged** messaging appears (training does not change rating).
   - Coach note / key moments appear (or sensible fallback copy if JSON was empty).
5. Open **History**; confirm the game appears with opponent **Coach Bot**, difficulty if present, type **AI Training**, and **Review** navigates to the same game.
6. Filter history by **AI Training**; confirm the game is listed.
7. Open **Profile**; confirm **Games played** (and win/loss/draw if applicable) increased; **rating** is unchanged from before the training game.
8. Open **Dashboard**; confirm **Recent games** lists the AI game and stats do not crash.
9. In Supabase **Table Editor** (or SQL): confirm exactly **one** new row in `games` for that session (`game_type` = `AI Training`) and no duplicate rows from double-clicking **Retry** after a successful save (retry after failure should create one row on success).

**Known limitations:** Retrying save after an error could theoretically create a duplicate if the first request succeeded but the client never received the response. Prefer verifying in the dashboard before retrying if unsure.

## Phase 3B: Board hints and highlights (AI + online)

**No DB or save-flow changes.** Exercise after Phase 3A migration is applied (for save/review steps if combined).

1. Open `/play/ai`, start a game as **white**; tap/click a pawn or knight on your turn.
2. Confirm **legal empty squares** show a **small dot**; **captures** show a **ring**; **selected** square has a **blue/teal** inset border.
3. Tap an **illegal** empty square: hints should **clear** (or select another of your pieces if applicable).
4. Tap an **opponent** piece: **no** hints for that color.
5. Complete a **legal move** (click or drag): **last move** squares get a **soft amber** tint; your selection clears.
6. Put your king in **check** if possible: **king square** gets a **soft red** tint.
7. During **AI thinking** (`Coach Bot is thinking`): board is **not** interactive and hints **do not** appear for your pieces.
8. After the AI moves, select your piece again: hints return on your turn.
9. **Online:** In an active room on your turn, repeat hint / last-move / check checks; on opponent’s turn, board is disabled and hints are off.
10. Confirm **finish** / **resign** still **saves** and **review** still opens (Phase 3A).

## Phase 4A: Online room basic demo flow

Use **two authenticated accounts** (e.g. main browser + private/incognito with a second user).

1. **User A**: Open `/play/create`, choose **Casual** (or Ranked only if testing rating messaging), pick color pref, click **Create room**.
2. **User A**: On `/room/$roomId`, confirm **waiting** screen shows room **code**, **invite link**, copy buttons (toasts), **mode**, spinner text.
3. **User A**: Copy invite link (`/play/join?code=…`). Confirm URL includes **`?code=`** and matches the displayed code.
4. **User B**: Open the invite link; confirm the **room code field** is prefilled and a **Join room CODE** style hint appears.
5. **User B**: Click **Join game** (no manual typing required if prefilled).
6. **Both**: Confirm the game opens for both (status **playing**), without manual refresh if possible.
7. **User A/B**: Confirm UI shows who is **White/Black** (you play white/black, bottom side).
8. **White** makes a legal move; **Black** sees the board update within a few seconds (Realtime or poll).
9. **Black** moves; **White** sees the update.
10. On each side: **hints** appear only on **your** turn; board **disabled** on opponent turn.
11. One player **Resigns**; **both** see **finished** state and modal messaging.
12. **Casual**: confirm ratings in profile do not change from that game (Ranked may still apply existing client-side rating logic).
13. **User C** (optional third account): Try to join the same **code** while the game is **playing** — should be rejected with a clear message.
14. **User C**: Open `/room/$roomUUID` while not a participant — should see **not in this game** (or use Join with code flow only).

## Phase 4B: Room join RPC and RLS hardening

**Prerequisites:** Run `npx supabase db push` so `public.join_room` and the updated RLS policies exist on the target project. Confirm auth works (two accounts required).

1. **User A**: Create a room from `/play/create` (Casual, any color pref).
2. **User A**: Copy the invite link or room code.
3. **User B**: Open `/play/join?code=CODE` → code is prefilled.
4. **User B**: Click **Join game** → toast "Joined — starting game", navigates to `/room/$roomId`.
5. **Both**: Confirm the game opens (status **playing**) and correct White/Black assignment.
6. **Both**: Make a few moves; moves sync via Realtime/poll.
7. **User A**: Create a **new** waiting room → cancel it → succeeds.
8. **User C** (or User B in new tab): Try to join a **playing** room by code → error "This room is no longer available."
9. **User A** (host): Re-open join page with own room code → toast "Returning to your room…", navigates without modifying room.
10. **User B** (guest): Re-open join page with same code → toast "Returning to your game…", navigates without modifying room.
11. **User B**: Resign from an active game → both see **finished** state (verifies guest WITH CHECK allows status change to finished).
12. Casual game → profile ratings unchanged.

## Phase 4C: Private rooms and public matchmaking (✅ Verified)

**Prerequisites:** Target project has `rooms.visibility` and `find_or_create_public_room`. Confirm auth works (two accounts required).

1. **User A**: Create a private room from `/play/create` → room shows **code + invite link**, heading says **Create private room**.
2. **User B**: Join private room by code/link → game starts normally.
3. **User A**: Click **Find Match** on `/play` with no other public rooms → public waiting room created → waiting UI shows **"Finding opponent…"** without code emphasis, **"Public matchmaking room"** badge.
4. **User B**: Click **Find Match** → matched with User A's public room → toast "Matched! Starting game" → both enter game.
5. Both make a few moves → moves sync.
6. **User A**: Create a public room via Find Match → cancel matchmaking → succeeds.
7. **User A**: Click Find Match twice quickly → second call returns existing room (`action:'existing'`), no duplicate room created.
8. Third user cannot join a playing room (existing Phase 4B check).
9. **Play lobby** shows 4 cards: Play vs AI, Find Match, Create Private Room, Join by Code.
10. Casual game → profile ratings unchanged.
11. AI game still works from Play vs AI card.

## Phase 5A: Server-Side Move Validation

**Prerequisites:** Edge function must be running locally via `npx supabase functions serve record-move --env-file .env` or deployed via `npx supabase functions deploy record-move`.

1. **User A**: Start an online game with User B (private or matched).
2. **User A**: Make a valid move (e.g., e2 to e4) → board updates immediately, move is recorded, opponent sees it.
3. **User B**: Attempt to move out of turn → local UI prevents it.
4. **User A**: Attempt to simulate calling the Edge Function out of turn or with an illegal move → server rejects with 400 Bad Request, local board reverts on failure.
5. **Both**: Play to checkmate → server automatically detects checkmate and sets `status = 'finished'`, `end_reason = 'checkmate'`, and assigns the `result`.
6. **User A**: Resign the game → still works (falls back to legacy client update until Phase 5B).


## Phase 5C: RLS Lockdown

1. **User A**: Create private room -> Ensure displays code gracefully.
2. **User A**: Cancel private room -> Ensure cancels safely.
3. **User A**: Find Match -> Creates public waiting room.
4. **User A**: Cancel matchmaking -> Restores to lobby cleanly.
5. **User B**: Join by code works.
6. **User A & B**: Play pieces interact natively via `record-move` Edge Function.
7. **User A**: Third user blocked from joining a playing room.
All verified manually on 2026-05-04.


## Phase 6B (Draft): Ratings Execution

1. Play ranked game -> Validate exactly 1 unique game entry inserts matching `source_room_id`.
2. Win/Lose ranked -> Metrics update globally matching the Elo math.
3. Win/Lose casual -> Elo math ignores change, but counters (`games_played`, `wins`, etc.) augment properly.
4. Call Edge function twice forcefully -> Idempotency drops second execution and profile values remain identical seamlessly.
All Phase 6B mechanisms verified manually successfully on 2026-05-04.

## Phase 6D: Ranked matchmaking only through Find Match

**Prerequisites:** Run `npx supabase db push` so the Phase 6D migration is applied. Use two authenticated accounts.

1. Open `/play/create`.
2. Confirm Ranked option is gone.
3. Create private room.
4. Confirm `rooms.game_mode = casual` and `rooms.visibility = private`.
5. Confirm private room copy says rating unchanged.
6. Open `/play/find`.
7. Choose **Casual Match**.
8. Confirm casual public matchmaking works and rating unchanged after game finalization.
9. Open `/play/find`.
10. Choose **Ranked Match** with User A.
11. Choose **Ranked Match** with User B.
12. Confirm they match.
13. Finish ranked game.
14. Confirm rating updates server-side.
15. Confirm leaderboard updates.
16. Confirm user cannot create ranked private room from UI.

## Phase 6D: Ranked forfeit and abandonment integrity

**Status:** Verified after applying migrations, regenerating Supabase types, deploying `forfeit-game`, and running `npm.cmd run build`.

**Prerequisites:** Apply the latest Phase 6D migrations and deploy `forfeit-game`. Use two authenticated accounts with known starting ratings.

1. **Ranked explicit resign:** User A and User B match through `/play/find` -> **Ranked Match**.
2. Confirm the room is `game_mode = ranked` and `status = playing`.
3. User A clicks **Resign**.
4. Confirm room becomes `status = finished`, `end_reason = resignation`, and `result` is the opponent color (`white` or `black`).
5. Confirm exactly one `games` row exists for the room via `source_room_id`.
6. Confirm User A lost rating and User B gained rating.
7. Confirm leaderboard reflects the new ratings.
8. Refresh/reopen the same room and confirm ratings do not change again.
9. **Ranked Leave and resign:** Start a second ranked match.
10. User A navigates with sidebar/browser-back and confirms **Leave and resign**.
11. Confirm room becomes `status = finished`, `end_reason = abandon`, and User A loses rating while User B gains rating.
12. Refresh/reopen the same room and confirm the game is not saved twice and ratings do not change again.
13. **Casual leave:** Start a casual public match.
14. User A resigns or confirms leave.
15. Confirm counters update and exactly one game is saved, but both ratings remain unchanged.

**Verified results:**

- Ranked explicit Resign makes the leaver lose rating and the opponent gain rating.
- Ranked Leave and resign through sidebar/back makes the leaver lose rating and the opponent gain rating.
- One `games` row is created with `source_room_id`.
- `rating_events` has two rows for ranked games.
- Refresh/reopen does not apply rating twice.
- Casual resign/leave updates counters but rating remains unchanged.
- Leaderboard reflects ranked rating changes.

## Pre-deploy gameplay integrity sweep

Recommended before Cloudflare deployment:

1. Ranked checkmate/stalemate/draw finalizes once and writes expected `games`/`rating_events`.
2. Ranked explicit Resign finalizes once and updates ratings/leaderboard.
3. Ranked Leave and resign finalizes once and updates ratings/leaderboard.
4. Casual resign/leave/checkmate updates counters but leaves ratings unchanged.
5. Private rooms remain casual-only and cannot create ranked games.
6. Public Find Match still supports both Casual Match and Ranked Match.
7. Refresh/reopen finished rooms does not duplicate game saves or rating events.
8. Profile, History, Dashboard, Review, and Leaderboard reflect the finalized game consistently.

**Record-move finalization bugfix note:** The sweep found and fixed a `record-move` gap where terminal moves could set a room to `finished` but silently ignore `finalize_online_room` errors. Deploy `record-move`, then include these checks:

1. Ranked checkmate returns a non-null `game_id`.
2. Ranked checkmate creates exactly one `games` row and two `rating_events` rows.
3. Ranked stalemate/draw creates exactly one game and does not duplicate on refresh/reopen.
4. If finalization fails, `record-move` returns `GAME_FINALIZATION_FAILED` instead of success with `game_id = null`.

## Phase 7A: Deployed Workers smoke (after Cloudflare publish)

Run against the production or preview Worker URL (`*.workers.dev` or custom hostname). Prerequisites: migrations and Edge Functions deployed to the linked Supabase project; Worker env vars **`SUPABASE_URL`** and **`SUPABASE_PUBLISHABLE_KEY`** set; **`VITE_*`** values were correct at **`npm run build`** time used for this deploy.

1. Open `/` → marketing/home loads without console errors referencing missing **`VITE_`** placeholders.
2. Open `/signup` and `/login` → forms render; signup/log in hits the expected Supabase project (network tab URL matches your dashboard).
3. Log in → reach `/dashboard` or `/onboarding` as applicable; refresh once; no SSR 500 referencing missing **`SUPABASE_`** vars.
4. Open `/play` → lobby cards navigable; **`/game/ai`** / **`/room/…`** sanity if time permits (Realtime + **`record-move`** / **`forfeit-game`** rely on deployed functions).
5. Confirm Supabase **`Auth → URL Configuration`** allows your Workers origin (Site URL / redirect URLs) if OAuth or email redirects misbehave post-deploy.

**Rollback reminder:** Workers versions can be rolled back from the Cloudflare dashboard; pinning a Git tag alongside each release is helpful for auditors.
