# ChessCoach Arena Documentation

This folder is the source of truth for engineering context, plans, audits, and decisions for ChessCoach Arena.

Lovable is no longer part of the development plan. This is now a Cursor-led engineering project targeting Supabase for backend/data and Cloudflare for deployment.

## Files

- `PROJECT_CONTEXT.md` - Product context, target users, core flows, stack, and platform direction.
- `ENGINEERING_AUDIT.md` - Current technical audit of the cloned codebase.
- `IMPLEMENTATION_PLAN.md` - Phased development plan and definitions of done.
- `CHANGELOG.md` - Human-readable history of meaningful project changes.
- `DECISIONS.md` - Architecture Decision Record style log for important technical and product decisions.
- `CURSOR_WORKFLOW.md` - Rules for future Cursor-assisted engineering work.
- `SMOKE_TEST.md` - Manual verification checklists by phase (including Phase 3A AI save flow).

## Documentation Rules

- Update `CHANGELOG.md` after meaningful changes.
- Update `IMPLEMENTATION_PLAN.md` when phase status changes.
- Record important technical decisions in `DECISIONS.md`.
- Keep implementation notes in Markdown inside `docs/`.
- Do not commit secrets or `.env` files.
