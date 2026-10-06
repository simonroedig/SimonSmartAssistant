<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes (Smart Assistant)

Private dashboard for one user: wall touch display (Raspberry Pi kiosk), phone PWA, laptop.

- **UI language is English, dates/times are German** (`de-DE`, e.g. "Dienstag, 6. Oktober 2026", 24h).
  Use the helpers in `src/lib/date.ts` / `src/lib/time.ts`, never ad-hoc formatting.
- **Data access** happens in the browser via `src/data/*` hooks (TanStack Query + Supabase client) with
  optimistic updates through `useOptimisticMutation`. Realtime invalidation lives in
  `src/components/providers/realtime-provider.tsx`; every synced table must be listed there and be in the
  `supabase_realtime` publication.
- **Security model:** every table has `user_id uuid default auth.uid()`, RLS policies
  `(select auth.uid()) = user_id`, explicit `grant … to authenticated`, nothing for `anon`.
  New tables must follow this pattern (see `supabase/migrations/20261006120000_init.sql`) and get a
  case in `tests/integration/security.test.ts`. Never use the service-role/secret key in the app.
- **Schema changes:** add a new timestamped file in `supabase/migrations/` (never edit applied ones),
  run `npx supabase db reset`, then `npm run db:types`. Bulk inserts: pass full rows or
  `{ defaultToNull: false }`.
- **CSP:** scripts need the nonce from `proxy.ts`; new external hosts must be added to
  `src/lib/security/csp.ts`.
- **Kiosk features** (`src/components/kiosk/*`) are enabled per device via `?kiosk=1` / Settings and
  must not render DOM-dependent values during SSR.
- **Checks before pushing:** `npm run lint && npm run typecheck && npm test && npm run build`;
  with local Supabase also `npm run test:integration` and `npx playwright test`.
