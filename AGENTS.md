<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes (Smart Assistant)

Private dashboard for one user: wall touch display (Raspberry Pi kiosk), phone PWA, laptop.

- **UI language is English, including dates, in German order** (e.g. "Tuesday, 6 October 2026", 24h, 06.10.2026).
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

# How the user likes it (read before building)

Learned over many rounds – following these saves going back and forth.

- **Talk German, compact.** The user writes German, often by voice (expect transcription slips). Answer what was
  asked first, short. The app's UI stays English (see above). "Nur einschätzen" / "erstmal nicht umsetzen" means:
  assess, don't build.
- **One interaction per job, everywhere.** Switching views = a row of chips; a sideways swipe moves to the
  neighbouring chip (`useSwipe`; the chip row itself is `data-swipe`), the picked chip scrolls into view
  (`useScrollToPressed`) and the content slides in from that side. Press and hold edits (chips, tiles). Sheets
  close by swiping down, back or tapping outside – and save on close. Going a level deeper (a tile → its
  content) gets its own history entry and a back arrow; back, the back gesture or a swipe to the right return.
  A new screen reuses these, never invents its own.
- **Three devices, all first-class:** phone (it's the launcher – touch, ~390 px wide), the wall display (Pi, touch,
  kiosk) and the PC (mouse: drag to scroll, hover). Check every change at 390×844, in a low window and wide;
  nothing may stick out sideways, nothing may need a precise tap.
- **At a glance.** Overviews before details (e.g. Notes → All: pinned notes without a category (one line each),
  what isn't sorted, then the categories as tiles with a peek). Dense but calm.
- **Ready to use.** When the user gives real examples, fill them in for them – but never commit personal content
  (the repository is public): offer an import or another way in instead.
- **Colours:** each section has its tone (`src/lib/tones.ts`); app-wide things use the accent, not sky blue (that
  clashes with the weather). Unsure or failed states are amber and say why – never silent, never a wrong yes.
- **Spare resources:** check or fetch only while something is on screen, cache it, keep stored history short
  (briefings: 14 days).
- **Pragmatic:** the simplest thing that works well; no new packages without need; make it extensible only where
  the user hints at more to come (like note templates).
- **Flow:** one commit per feature; run the checks above before pushing; push to the working branch and to
  `main` (migrations deploy from `main`); CI must end green.
- **Usage is limited:** keep sessions lean – no long CI polling, small screenshots and log excerpts.

# Local setup in a cloud container (learnings)

- Docker isn't running after a restart: `rm -f /var/run/docker.pid; dockerd &`, then `npx supabase start`.
- `.env.local` missing: copy `.env.example`.
- After `npx supabase db reset` the dev user is gone: `npm run test:integration` creates it again (vault PIN 2468).
  Then `docker restart supabase_auth_simon-smart-assistant` (the e-mail code limit) and
  `npx playwright test --project=setup`.
- Stop old servers with `pgrep -f "[n]ext-server" | xargs -r kill` (`pkill -f "next start"` kills its own shell).
- CI runs Playwright on `ubuntu-24.04` (newer images aren't supported by it yet).
