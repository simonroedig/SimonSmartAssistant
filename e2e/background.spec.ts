import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

/** What the browser does when another app comes to the front (or the screen goes off), and back. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, hidden);
}

test("in the background the live connection rests; back on screen the list catches up in place", async ({
  browser,
}) => {
  const storageState = "e2e/.auth/user.json";
  const phone = await (await browser.newContext({ storageState })).newPage();
  const other = await (await browser.newContext({ storageState })).newPage();
  await mockWeather(phone);
  await mockWeather(other);
  const socketClosed = new Promise<void>((resolve) => phone.on("websocket", (ws) => ws.on("close", () => resolve())));

  await phone.goto("/shopping");
  await expect(phone.getByRole("status", { name: "Synced live" })).toBeAttached({ timeout: 15_000 });
  // Time can be fast-forwarded from here on.
  await phone.clock.install();
  const known = `Already here ${Date.now() % 10000}`;
  await phone.getByLabel("New shopping item").fill(known);
  await phone.getByRole("button", { name: "Add item" }).click();
  await expect(phone.getByText(known)).toBeVisible();

  // A quick look at another app keeps the connection …
  await setHidden(phone, true);
  await phone.clock.fastForward("00:30");
  await setHidden(phone, false);
  await expect(phone.getByRole("status", { name: "Synced live" })).toBeAttached();

  // … a longer one lets it go.
  await setHidden(phone, true);
  await phone.clock.fastForward("01:05");
  await socketClosed;

  // Meanwhile something is added on another device – the hidden phone doesn't hear of it.
  await other.goto("/shopping");
  const name = `While away ${Date.now() % 10000}`;
  await other.getByLabel("New shopping item").fill(name);
  await other.getByRole("button", { name: "Add item" }).click();
  await expect(other.getByText(name)).toBeVisible();
  await phone.waitForTimeout(1500);
  await expect(phone.getByText(name)).toHaveCount(0);

  // Back on screen: the list is there right away (no reload, no loading state) and catches up.
  await setHidden(phone, false);
  await expect(phone.getByText(known)).toBeVisible({ timeout: 500 });
  await expect(phone.locator(".skeleton")).toHaveCount(0);
  await expect(phone.getByText(name)).toBeVisible({ timeout: 10_000 });
  await expect(phone.getByRole("status", { name: "Synced live" })).toBeAttached({ timeout: 15_000 });

  await phone.context().close();
  await other.context().close();
});
