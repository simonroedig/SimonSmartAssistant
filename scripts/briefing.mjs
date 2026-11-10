#!/usr/bin/env node
/**
 * The daily briefing's way into the dashboard – run by a scheduled Claude task
 * (claude.ai → Scheduled), see docs/BRIEFING.md.
 *
 *   node scripts/briefing.mjs prompt          today's instructions: the prompt from Settings
 *   node scripts/briefing.mjs publish <file>  hands in the finished briefing (Markdown)
 *   node scripts/briefing.mjs fail "<why>"    notes that today's briefing couldn't be made
 *
 * Needs BRIEFING_SUPABASE_URL and BRIEFING_SUPABASE_KEY (the project's publishable key –
 * public anyway). The briefing key itself is added to every request by the task's cloud
 * environment (a network secret, header x-briefing-key), so it never sits in the task;
 * BRIEFING_KEY works too, e.g. for trying it out locally. No packages needed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT = join(tmpdir(), "briefing.md");
const USED_PROMPT = join(tmpdir(), "briefing-prompt.txt");
const TIME_ZONE = "Europe/Berlin";

function stop(message) {
  console.error(`briefing: ${message}`);
  process.exit(1);
}

/** Calls one of the briefing functions in Supabase (with curl: it goes through any proxy). */
function call(fn, body) {
  const url = process.env.BRIEFING_SUPABASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.BRIEFING_SUPABASE_KEY;
  if (!url || !apiKey) {
    stop("BRIEFING_SUPABASE_URL and BRIEFING_SUPABASE_KEY must be set (see Settings → Daily briefing).");
  }
  const args = [
    "-sS",
    "-X",
    "POST",
    `${url}/rest/v1/rpc/${fn}`,
    "-H",
    `apikey: ${apiKey}`,
    "-H",
    "Content-Type: application/json",
    "-H",
    "Accept: application/json",
    "--data-binary",
    "@-",
    "-w",
    "\n%{http_code}",
  ];
  if (process.env.BRIEFING_KEY) args.push("-H", `x-briefing-key: ${process.env.BRIEFING_KEY}`);
  let out;
  try {
    out = execFileSync("curl", args, { input: JSON.stringify(body), encoding: "utf8", maxBuffer: 10_000_000 });
  } catch (error) {
    stop(`couldn't reach Supabase: ${error.message}`);
  }
  const split = out.lastIndexOf("\n");
  const status = Number(out.slice(split + 1));
  const text = out.slice(0, split);
  if (status === 401 || status === 403 || /invalid briefing key/.test(text)) {
    stop("the briefing key is missing or wrong – make one in Settings → Daily briefing and add it to the environment.");
  }
  if (!(status >= 200 && status < 300)) stop(`${fn} failed (${status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** The prompt with today's date and time filled in (German, as the prompt is). */
export function fillPrompt(prompt, now = new Date()) {
  const part = (options) => new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options }).format(now);
  const values = {
    WOCHENTAG: part({ weekday: "long" }),
    DATUM: part({ day: "numeric", month: "long", year: "numeric" }),
    UHRZEIT: part({ hour: "2-digit", minute: "2-digit", hour12: false }),
  };
  values.WEEKDAY = values.WOCHENTAG;
  values.DATE = values.DATUM;
  values.TIME = values.UHRZEIT;
  return prompt.replace(/\{\{\s*([A-Z]+)\s*\}\}/g, (whole, name) => values[name] ?? whole);
}

const HAND_IN = `

---
How to hand it in (for the dashboard):
- Research with web search only, about 10–15 searches. Don't open whole pages unless you really need to.
- Plan the searches from the prompt first: at least one targeted search for every section and every interest it
  names – a general news search doesn't cover them. If a search only finds old pages, search again more narrowly.
- Before handing in, check the briefing against the prompt's format: every section it asks for is there. Leave one
  out only if a targeted search for it really found nothing; a section that needs no news (a fact, a background)
  is never left out.
- Write only the finished briefing (no preamble) as Markdown to ${OUTPUT}
- Then run: node scripts/briefing.mjs publish ${OUTPUT}
- If something goes wrong, run: node scripts/briefing.mjs fail "<short reason>"
- Don't change, commit or push anything in the repository.`;

function main([command, arg]) {
  if (command === "prompt") {
    const prompt = call("briefing_prompt", {});
    if (typeof prompt !== "string" || !prompt.trim()) stop("no prompt saved – set one in Settings → Daily briefing.");
    const filled = fillPrompt(prompt);
    writeFileSync(USED_PROMPT, filled);
    console.log(filled + HAND_IN);
  } else if (command === "publish") {
    const file = arg ?? OUTPUT;
    if (!existsSync(file)) stop(`no briefing at ${file}`);
    const content = readFileSync(file, "utf8").trim();
    if (!content) stop(`${file} is empty`);
    const prompt = existsSync(USED_PROMPT) ? readFileSync(USED_PROMPT, "utf8") : null;
    call("briefing_post", { content, prompt });
    console.log("Briefing handed in – it's on the dashboard now.");
  } else if (command === "fail") {
    const reason = (arg ?? "").trim() || "The run couldn't finish.";
    const prompt = existsSync(USED_PROMPT) ? readFileSync(USED_PROMPT, "utf8") : null;
    call("briefing_post", { content: "", prompt, failed: reason });
    console.log("Noted on the dashboard that today's briefing couldn't be made.");
  } else {
    stop('use "prompt", "publish <file>" or "fail <reason>"');
  }
}

// Run as a command (not when a test imports fillPrompt).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
