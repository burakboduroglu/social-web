# social-web

Invite-only social app: React 19 + TanStack Router in `src/`, Bun API in `server/`, Supabase Auth/Postgres/Storage, Drizzle with RLS.

## Commands

- Dev: `bun run dev` (web `127.0.0.1:5173`, API `127.0.0.1:3001`)
- Typecheck: `bun run typecheck`
- Tests: `bun test`
- Live DB/RLS check: `bun run db:check`
- Create invite: `bun run db:invite [days] [uses]`
- Build: `bun run build`
- Deploy: `bun run worker:deploy` (Cloudflare Worker, see `docs/deployment.md`)

## Rules

- `supabase/migrations/` is the source of truth for schema, policies and triggers; never replace them with `drizzle-kit push`.
- `.env` holds only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` and `TURNSTILE_SITE_KEY`. Restart the API after editing it.
- Turnstile is enforced by Supabase Auth. The secret key goes in the Supabase dashboard, never in this repo; only the public site key reaches `/api/config`.
- Local development uses Cloudflare's always-pass Turnstile test pair (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`). Restore the real pair before deployment.
- Keep code comments and commit messages in English; user-facing UI copy is Turkish.
- Run `bun run typecheck` and `bun test` before finishing a change.

## Read when relevant

- Architecture, auth flow and migration notes: `docs/supabase-migration.md`
- Cloudflare Workers deployment: `docs/deployment.md`
- Pixel illustrations, brand and asset sources: `docs/brand.md`
- Illustration attribution: `src/assets/illustrations/README.md`
- UI/feature specs and plans: `docs/specs/`, `docs/plans/`, `docs/design/`
