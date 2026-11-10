import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

/** What the scheduled task does: call the briefing functions with its key (no sign-in). */
async function asTask(fn: "briefing_prompt" | "briefing_post", key: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json", "x-briefing-key": key },
    body: JSON.stringify(body),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  return res.json();
}

/** Settings → Daily briefing: a fresh key (set up the first time, replaced after that). */
async function newKey(page: Page): Promise<string> {
  await page.goto("/settings#briefing");
  const section = page.locator("#briefing");
  const setUp = section.getByRole("button", { name: "Set up" });
  const again = section.getByRole("button", { name: "New key", exact: true });
  await expect(setUp.or(again)).toBeVisible();
  if (await setUp.isVisible()) await setUp.click();
  else {
    await again.click();
    await section.getByRole("button", { name: "New key – the old one stops" }).click();
  }
  const key = section.locator("code").filter({ hasText: /^brf_/ });
  await expect(key).toBeVisible();
  return (await key.innerText()).trim();
}

test("daily briefing: set up in Settings, handed in by the task, new on Home until it's read", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const key = await newKey(page);
  const section = page.locator("#briefing");

  // What to put into Claude is right there to copy.
  await expect(section.getByText("node scripts/briefing.mjs prompt", { exact: false })).toBeVisible();
  await expect(section.getByText("x-briefing-key", { exact: true })).toBeVisible();
  // On the phone nothing sticks out sideways – long keys and addresses wrap.
  // (Open by itself right after a new key.)
  await expect(section.locator("details")).toHaveAttribute("open", "");
  await expect(section.getByText("/rest/v1/rpc/", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // The prompt is edited here – the task reads it with its key.
  const prompt = section.getByLabel("Prompt");
  const text = `Briefing ${Date.now() % 100000} für {{WOCHENTAG}}, {{DATUM}}.`;
  await prompt.fill(text);
  await prompt.blur();
  await expect(page.getByText("Prompt saved – used from the next run")).toBeVisible();
  await expect.poll(() => asTask("briefing_prompt", key)).toBe(text);

  // The morning's run hands one in.
  await asTask("briefing_post", key, {
    content: [
      "## 🔥 Heute wichtig",
      "- **KI-Gipfel** in Paris: neue Regeln für Modelle. [Quelle](https://example.com/ki)",
      "",
      "## 📅 Demnächst",
      "- 3.12. – Ein Termin",
    ].join("\n"),
    prompt: "Briefing für Dienstag, 10. November 2026.",
  });

  // Home: the button says it's new, a note under it too; a tap opens it.
  await page.goto("/");
  const button = page.getByRole("button", { name: "Daily briefing (new)" });
  await expect(button).toBeVisible();
  const note = page.getByRole("button", { name: /Your briefing is here/ });
  await note.click();
  const sheet = page.getByRole("dialog", { name: "Daily briefing" });
  await expect(sheet.getByRole("heading", { name: "🔥 Heute wichtig" })).toBeVisible();
  await expect(sheet.locator("strong", { hasText: "KI-Gipfel" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Quelle" })).toHaveAttribute("href", "https://example.com/ki");
  // The prompt it was made with, a tap away.
  await sheet.getByText("Prompt used").click();
  await expect(sheet.getByText("Briefing für Dienstag, 10. November 2026.")).toBeVisible();

  // Read now – on every screen (it is saved).
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(note).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole("button", { name: "Daily briefing", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Your briefing is here/ })).toHaveCount(0);

  // A run that couldn't finish (e.g. Claude's usage limit) says so – the last briefing is a tap away.
  await asTask("briefing_post", key, { failed: "Claude's usage limit was reached" });
  await page.reload();
  await expect(page.locator("[data-briefing-dot=trouble]")).toBeVisible();
  await page.getByRole("button", { name: "Daily briefing", exact: true }).click();
  await expect(sheet.getByText("This briefing couldn't be made.")).toBeVisible();
  await expect(sheet.getByText("Claude's usage limit was reached", { exact: false })).toBeVisible();
  // The days sit up top: picking one leaves them where they are (two on one day show their time).
  const days = sheet.getByRole("group", { name: "Briefings" });
  await expect(days.getByRole("button").first()).toHaveText(/\d{2}:\d{2}$/);
  await days.getByRole("button").nth(1).click();
  await expect(sheet.getByRole("heading", { name: "🔥 Heute wichtig" })).toBeVisible();
  await expect(days).toBeInViewport();
  await days.getByRole("button").first().click();
  await expect(days).toBeInViewport();
  await expect(sheet.getByText("This briefing couldn't be made.")).toBeVisible();
});

test("daily briefing: the task's key can't do anything else", async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/briefing_prompt`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json", "x-briefing-key": "brf_wrong" },
    body: "{}",
  });
  expect(res.ok).toBe(false);
});
