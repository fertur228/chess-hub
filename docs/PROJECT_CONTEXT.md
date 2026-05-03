# Project Context

## Product Name

ChessCoach Arena

## Product Summary

ChessCoach Arena is a beginner-friendly chess platform focused on helping new and casual players play more games, understand results, and improve over time.

The product should support:

- Sign up and log in.
- View a personal dashboard.
- Play chess against AI.
- Create and join online chess rooms.
- Play online chess.
- Track rating.
- View game history.
- Open game reviews after matches.
- View profile and leaderboard.
- Manage basic settings.

## Target Users

- Beginner chess players who know little or nothing about chess.
- Casual players who want a simple place to practice.
- Players who want lightweight rating and progress tracking.
- Friends who want to create a room and play together.

## Core Product Flow

1. A user lands on the marketing home page.
2. The user signs up or logs in with Supabase Auth.
3. The user completes onboarding with skill level and goal.
4. The user opens the dashboard.
5. The user starts with an AI game.
6. Completed games are saved and become available in history.
7. The user opens a game review and gets beginner-friendly feedback.
8. Later, the user can create or join online rooms.
9. Ranked online games update rating and leaderboard position.

## Current Technical Stack Detected

- Framework: TanStack Start on Vite.
- Language: TypeScript.
- UI: React 19, Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react.
- Routing: TanStack Router file-based routes.
- Chess: chess.js and react-chessboard.
- Auth/data: Supabase client and generated database types are already present.
- Database schema: Supabase migrations exist for `profiles`, `games`, and `rooms`.
- Realtime: Supabase Realtime is configured for `rooms`.
- Deployment config: Cloudflare Workers config exists through `wrangler.jsonc`. TanStack Start is wired via `vite.config.ts` (`@lovable.dev/vite-tanstack-config`); there is no separate `app.config.ts` in this repo.
- Package manager: npm with `package-lock.json`.

## Deployment Target

Cloudflare.

The app should eventually deploy to Cloudflare Workers or the Cloudflare platform path selected for TanStack Start.

## Backend and Data Target

Supabase.

Canonical Supabase project ref: `vyzglfxxonubnyydhzgf`.

Deprecated project ref: `tdzdwfpzbgxputgotcjj`. Do not use this project ref going forward.

Supabase is the target for:

- Authentication.
- User profiles.
- Game records.
- Online rooms.
- Realtime room updates.
- Rating and leaderboard data.
- Future storage if avatars or media are added.

## Lovable Status

Lovable is no longer part of the development plan.

The codebase may still contain Lovable-generated comments, package names, or config wrappers. Future work should treat those as legacy implementation details and gradually remove or replace them when doing so is part of the active phase.
