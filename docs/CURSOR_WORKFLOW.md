# Cursor Workflow

These rules guide future Cursor-assisted work on ChessCoach Arena.

## Documentation Rules

- Always update `docs/CHANGELOG.md` after meaningful changes.
- Update `docs/IMPLEMENTATION_PLAN.md` when phase status changes.
- Add important technical decisions to `docs/DECISIONS.md`.
- Keep audits, plans, migration notes, and implementation notes in Markdown inside `docs/`.

## Phase Discipline

- Do not add new features outside the current phase.
- If priorities change, update `IMPLEMENTATION_PLAN.md` before implementation.
- Prefer small, reviewable changes.
- Avoid broad refactors unless they are explicitly part of the active phase.

## Package Manager

- Use npm for all package operations.
- Keep `package-lock.json` committed.
- Do not use Bun, pnpm, or Yarn unless a new architecture decision replaces this rule.
- Do not add `bun.lockb`, `bunfig.toml`, `pnpm-lock.yaml`, or `yarn.lock`.

## Before Code Changes

- Summarize the intended files to modify.
- Explain the goal of the change.
- Identify any risky areas.
- Confirm whether database, auth, or deployment behavior is affected.

## After Code Changes

- Summarize changed files.
- Explain how to test the change.
- Record meaningful changes in `CHANGELOG.md`.
- Record important technical decisions in `DECISIONS.md`.
- If a phase was completed or changed, update `IMPLEMENTATION_PLAN.md`.

## Secrets and Environment Variables

- Never commit secrets.
- Do not put `.env` into git.
- Use `.env.example` for required variables.
- Treat Supabase service-role keys as server-only secrets.
- Publishable Supabase keys may be used by the frontend, but still keep local environment files out of git.

## Supabase Work

- Keep RLS enabled on exposed tables.
- Do not rely on client-side logic for trusted rating or game-result mutations.
- Prefer server-controlled RPCs or Edge Functions for sensitive operations.
- Verify Supabase behavior against current documentation before implementing schema, auth, RLS, storage, or Edge Function changes.

## Cloudflare Work

- Test production builds before deployment.
- Document required Cloudflare variables and secrets.
- Avoid browser-only assumptions in code that can run during SSR or in worker runtime.

## Review Expectations

- Prioritize correctness, security, and beginner-friendly product behavior.
- Prefer conservative changes that match the existing codebase.
- Do not refactor unrelated files while implementing a narrow task.
