# Daily briefing

Each morning a scheduled Claude task (claude.ai → Scheduled) researches the news and
hands a briefing in; Home shows it (a dot and a note while it's new). It runs in the
Claude subscription – no API key, no extra costs.

## How it fits together

- **Prompt:** Settings → Daily briefing. `{{WOCHENTAG}}`, `{{DATUM}}` and `{{UHRZEIT}}`
  are filled in with the run's day, date and time (Europe/Berlin).
- **Key:** made in Settings, shown once. It can only read the prompt and hand in briefings
  (`briefing_prompt`, `briefing_post` in `supabase/migrations/20261110120000_briefings.sql`) –
  nothing else in the database. A new key retires the old one.
- **Script:** `scripts/briefing.mjs` – `prompt` prints today's instructions, `publish <file>`
  hands the Markdown in, `fail "<reason>"` notes a run that couldn't finish. No packages needed.
- **No briefing by 10:00** (e.g. Claude's usage limit, so the run never started): Home marks
  it in amber and shows the last one.

## Setting it up in Claude

Settings → Daily briefing → "Set up in Claude" shows every value with a copy button.

1. **Environment** (claude.ai/code → environment menu → Add environment), named "Briefing":
   - Network access: Limited (Custom in older apps) with the package managers kept, plus the
     Supabase project's host under allowed domains.
   - Environment variables: `BRIEFING_SUPABASE_URL` and `BRIEFING_SUPABASE_KEY` (the
     publishable key – public anyway).
   - Repository and setup script: none.
   - Network secrets → Add secret: allowed websites = the Supabase host, path prefix
     `/rest/v1/rpc/`, and under custom headers the prefilled `Authorization` renamed to
     `x-briefing-key` with the prefix emptied (no "Bearer") and the key as value. No
     `Authorization` header may be left: Supabase would read the key as a login token and
     turn every call down. The environment adds the header to each request, so the key never
     sits in the task itself.
2. **Scheduled task** (claude.ai → Scheduled → New): daily at e.g. 7:43, repository
   SimonSmartAssistant, the Briefing environment, model Sonnet, and these instructions:

   > Daily briefing for my dashboard. In the SimonSmartAssistant repository, run
   > `node scripts/briefing.mjs prompt` and do exactly what it prints. If anything fails, run
   > `node scripts/briefing.mjs fail "<short reason>"`. Don't change, commit or push anything
   > in the repository.

3. **Try it:** "Run now" – a few minutes later the briefing is on Home.

Trying the script locally: `BRIEFING_SUPABASE_URL=… BRIEFING_SUPABASE_KEY=… BRIEFING_KEY=brf_…
node scripts/briefing.mjs prompt`.
