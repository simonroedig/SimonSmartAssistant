import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

type Sent = { type: string; [key: string]: unknown };

/** Pretends to be the Android launcher app: answers like its bridge and records what the page asks. */
async function fakeLauncher(page: Page, extraApps: { id: string; label: string; package: string }[] = []) {
  await page.addInitScript((extra) => {
    const icon = (color: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" rx="3" fill="${color}"/></svg>`,
      )}`;
    const listeners: ((event: { data: string }) => void)[] = [];
    const sent: unknown[] = [];
    const w = window as unknown as Record<string, unknown>;
    w.__launcherSent = sent;
    w.__launcherEmit = (event: unknown) => listeners.forEach((l) => l({ data: JSON.stringify(event) }));
    // Blocked apps live natively; across a navigation in the test, keep them in localStorage.
    w.__blocked = JSON.parse(localStorage.getItem("__blocked") ?? "[]");
    w.SmartLauncher = {
      postMessage(raw: string) {
        const message = JSON.parse(raw);
        sent.push(message);
        if (message.type === "setBlockedApps") {
          w.__blocked = message.packages;
          localStorage.setItem("__blocked", JSON.stringify(message.packages));
        }
        const answer =
          message.type === "hello"
            ? { version: 3, versionName: "1.3", features: ["recent", "appfilter"] }
            : message.type === "appFilter"
              ? { enabled: w.__filterOn === true, blocked: (w.__blocked as string[]) ?? [] }
              : message.type === "recent"
                ? w.__usageAllowed
                  ? { allowed: true, apps: ["com.whatsapp", "de.bank", "com.android.systemui"] }
                  : { allowed: false, apps: [] }
                : message.type === "apps"
                  ? {
                      apps: [
                        { id: "w|0", label: "WhatsApp", package: "com.whatsapp", icon: icon("#25d366") },
                        { id: "f|0", label: "Firefox", package: "org.mozilla.firefox", icon: icon("#ff7139") },
                        { id: "b|0", label: "Bank", package: "de.bank", icon: icon("#1d4ed8") },
                        ...extra.map((app) => ({ ...app, icon: icon("#7d4698") })),
                      ],
                    }
                  : { ok: true };
        setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ ...answer, id: message.id }) })), 5);
      },
      addEventListener(_type: string, listener: (event: { data: string }) => void) {
        listeners.push(listener);
      },
    };
  }, extraApps);
}

const sent = (page: Page) => page.evaluate(() => (window as unknown as { __launcherSent: Sent[] }).__launcherSent);

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("launcher: Home switches to the apps; open, search and come back with the home button", async ({ page }) => {
  await fakeLauncher(page);
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Main" }).last();

  // The status bar gets the dashboard's colours.
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "theme")?.color).toBeTruthy();

  // Home → apps (A–Z), and the tab now says "Apps".
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await expect(tabs.getByRole("link", { name: "Apps" })).toHaveAttribute("aria-current", "page");
  const apps = page.getByRole("list", { name: "Apps" });
  await expect(apps.getByRole("button")).toHaveText(["Bank", "Firefox", "WhatsApp"]);

  // Search results start at the bottom right, next to the thumb.
  await page.getByLabel("Search apps or the web").fill("a");
  await expect(apps.getByRole("button")).toHaveText(["Bank", "WhatsApp"]);
  const bank = (await apps.getByRole("button", { name: "Bank" }).boundingBox())!;
  const whatsapp = (await apps.getByRole("button", { name: "WhatsApp" }).boundingBox())!;
  expect(bank.x).toBeGreaterThan(whatsapp.x);

  // Filter and open an app: the tap doesn't take the focus from the search (on a phone
  // that would close the keyboard first and swallow the tap).
  await page.getByLabel("Search apps or the web").fill("wha");
  await page.evaluate(() =>
    document.addEventListener("mousedown", (e) => {
      (window as unknown as { __kept: boolean }).__kept = e.defaultPrevented;
    }),
  );
  await expect(apps.getByRole("button")).toHaveText(["WhatsApp"]);
  await apps.getByRole("button", { name: "WhatsApp" }).click();
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "launch")?.app).toBe("w|0");
  await expect(page.getByLabel("Search apps or the web")).toHaveValue("");
  expect(await page.evaluate(() => (window as unknown as { __kept: boolean }).__kept)).toBe(true);
  // Afterwards the keyboard goes away.
  await expect(page.getByLabel("Search apps or the web")).not.toBeFocused();

  // Enter searches the web in Firefox.
  await page.getByLabel("Search apps or the web").fill("Wetter München");
  await page.getByLabel("Search apps or the web").press("Enter");
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "search")?.query).toBe("Wetter München");

  // Home stays switched to the apps: away to another section and back lands in the apps again.
  await tabs.getByRole("link", { name: "Shopping" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(tabs.getByRole("link", { name: "Apps" })).toBeVisible();
  await tabs.getByRole("link", { name: "Apps" }).click();
  await expect(page).toHaveURL(/\/apps$/);

  // The apps are a second home: back from a section leads there first, then home.
  await tabs.getByRole("link", { name: "Notes" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await tabs.getByRole("link", { name: "Backlog" }).click();
  await expect(page).toHaveURL(/\/todos$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/apps$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/apps$/);

  // The phone's home button opens the chosen view, too.
  await tabs.getByRole("link", { name: "Planner" }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await page.evaluate(() =>
    (window as unknown as { __launcherEmit: (e: unknown) => void }).__launcherEmit({ type: "home" }),
  );
  await expect(page).toHaveURL(/\/apps$/);

  // Tapping it on the apps flips back to the home screen – and that sticks the same way.
  await tabs.getByRole("link", { name: "Apps" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Notes" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Web search right from the home screen.
  await page.getByLabel("Search the web").fill("Feiertage Bayern");
  await page.getByRole("button", { name: "Search in Firefox" }).click();
  await expect
    .poll(async () => (await sent(page)).filter((m) => m.type === "search").map((m) => m.query))
    .toContain("Feiertage Bayern");
});

test("launcher: the apps used last, in a strip above the search", async ({ page }) => {
  await fakeLauncher(page);
  await page.goto("/apps");
  await expect(page.getByRole("button", { name: "Search the web" })).toBeVisible();
  // Off until switched on in Settings.
  await expect(page.getByRole("button", { name: "Recent apps" })).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Recently used apps" }).click();
  await expect(page.getByRole("switch", { name: "Recently used apps" })).toBeChecked();
  await page.goto("/apps");
  const strip = page.getByRole("region", { name: "Recent apps" });
  const toggle = page.getByRole("button", { name: "Recent apps" });
  await expect(strip).toBeHidden();

  // First the system's permission is needed.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await strip.getByRole("button", { name: "Allow" }).click();
  await expect.poll(async () => (await sent(page)).some((m) => m.type === "usageAccess")).toBe(true);

  // Allowed and back in the launcher: newest on the right, what isn't an app left out.
  await page.evaluate(() => {
    (window as unknown as { __usageAllowed: boolean }).__usageAllowed = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const recent = strip.getByRole("list", { name: "Recent apps" }).getByRole("button");
  await expect(recent).toHaveText(["WhatsApp", "Bank"]);
  const whatsapp = (await recent.nth(0).boundingBox())!;
  const bank = (await recent.nth(1).boundingBox())!;
  expect(whatsapp.x).toBeGreaterThan(bank.x);
  // Just above the search, at the bottom.
  const search = (await page.getByRole("search").boundingBox())!;
  const box = (await strip.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(search.y);
  expect(search.y - (box.y + box.height)).toBeLessThan(16);

  await recent.nth(1).click();
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "launch")?.app).toBe("b|0");

  // Out of the way while searching; stays open on this phone.
  await page.getByLabel("Search apps or the web").fill("fi");
  await expect(strip).toBeHidden();
  await page.getByLabel("Search apps or the web").fill("");
  await page.reload();
  await expect(page.getByRole("button", { name: "Recent apps" })).toHaveAttribute("aria-pressed", "true");
  await expect(strip).toBeVisible();

  // Closed again: the tray folds away.
  await page.getByRole("button", { name: "Recent apps" }).click();
  await expect(strip).toBeHidden();
});

test("launcher: block an app for good – confirm, no unblock, greyed out and not opened", async ({ page }) => {
  const tor = { id: "t|0", label: "Tor Browser", package: "org.torproject.torbrowser" };
  await fakeLauncher(page, [tor]);
  const loaded = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/blocked_apps") && r.request().method() === "GET",
  );
  await page.goto("/settings");
  const section = page.locator("section").filter({ hasText: "Blocked apps" }).first();
  const list = section.getByRole("list", { name: "Blocked apps" });
  // (The app can't delete rows, so a local database may still have it from an earlier run.)
  const already = ((await (await loaded).json()) as { package: string }[]).some((b) => b.package === tor.package);
  await expect(section.getByLabel("Add an app to block")).toBeVisible();

  if (!already) {
    // Cancelling the confirmation blocks nothing.
    await section.getByLabel("Add an app to block").fill("tor");
    await section
      .getByRole("list", { name: "Apps to block" })
      .getByRole("button", { name: /Tor Browser/ })
      .click();
    await expect(section.getByText("Block Tor Browser for good?")).toBeVisible();
    await section.getByRole("button", { name: "Cancel" }).click();
    await expect(list.getByText(tor.label)).toHaveCount(0);

    await section.getByLabel("Add an app to block").fill("tor");
    await section
      .getByRole("list", { name: "Apps to block" })
      .getByRole("button", { name: /Tor Browser/ })
      .click();
    await section.getByRole("button", { name: "Block", exact: true }).click();
  }
  // Listed for good – nothing here unblocks it – and handed to the phone.
  await expect(list.getByText(tor.label)).toBeVisible();
  await expect(section.getByRole("button", { name: /unblock/i })).toHaveCount(0);
  await expect(section.getByText(/delete its row in Supabase/)).toBeVisible();
  await expect
    .poll(async () => (await sent(page)).filter((m) => m.type === "setBlockedApps").at(-1)?.packages)
    .toContain(tor.package);

  // Without the service on, a note offers to turn it on (opens accessibility).
  await section.getByRole("button", { name: "Turn on" }).click();
  await expect.poll(async () => (await sent(page)).some((m) => m.type === "filterSettings")).toBe(true);

  // In the apps list it's greyed out and a tap only says it's blocked.
  await page.goto("/apps");
  await page.getByRole("list", { name: "Apps" }).getByRole("button", { name: "Tor Browser (blocked)" }).click();
  await expect(page.getByText("Tor Browser is blocked")).toBeVisible();
  expect((await sent(page)).some((m) => m.type === "launch" && m.app === tor.id)).toBe(false);
});

test("launcher: a newer app version is offered on the home screen", async ({ page }) => {
  await fakeLauncher(page);
  await page.route("**/launcher/version.json", (route) =>
    route.fulfill({ json: { versionCode: 7, versionName: "1.7" } }),
  );
  await page.goto("/");
  await expect(page.getByText("Launcher update 1.7")).toBeVisible();
  await page.getByRole("button", { name: "Install" }).click();
  await expect.poll(async () => (await sent(page)).some((m) => m.type === "update")).toBe(true);
});

test("launcher: searching apps scrolls down to the best matches by the thumb", async ({ page }) => {
  // A launcher with many apps, so the search results are taller than the screen.
  await page.addInitScript(() => {
    const listeners: ((e: { data: string }) => void)[] = [];
    const names = "ABCDEFGHIJKLMNOPQRSTUVWX".split("").map((c) => `Tool ${c}`);
    const apps = names.map((label, i) => ({
      id: `${i}|0`,
      label,
      package: `p.${i}`,
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
    }));
    (window as unknown as Record<string, unknown>).SmartLauncher = {
      postMessage(raw: string) {
        const m = JSON.parse(raw);
        const a =
          m.type === "hello"
            ? { version: 9, features: [] }
            : m.type === "apps"
              ? { apps }
              : m.type === "appFilter"
                ? { enabled: false, blocked: [] }
                : { ok: true };
        setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ ...a, id: m.id }) })), 5);
      },
      addEventListener(_t: string, l: (e: { data: string }) => void) {
        listeners.push(l);
      },
    };
  });
  await page.goto("/apps");
  const scroller = page
    .locator("[aria-label='Apps']")
    .locator("xpath=ancestor::div[contains(@class,'overflow-y-auto')]");
  await page.getByLabel("Search apps or the web").fill("tool"); // matches all 24
  // The results fill past one screen and the view scrolls to the bottom (newest by the thumb).
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(4);
});

test("without the launcher app nothing of it shows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Search the web")).toHaveCount(0);
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/apps");
  await expect(page.getByText(/apps show up here in the Android launcher app/)).toBeVisible();
});
