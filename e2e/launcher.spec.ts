import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

type Sent = { type: string; [key: string]: unknown };

/** Pretends to be the Android launcher app: answers like its bridge and records what the page asks. */
async function fakeLauncher(page: Page) {
  await page.addInitScript(() => {
    const icon = (color: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" rx="3" fill="${color}"/></svg>`,
      )}`;
    const listeners: ((event: { data: string }) => void)[] = [];
    const sent: unknown[] = [];
    const w = window as unknown as Record<string, unknown>;
    w.__launcherSent = sent;
    w.__launcherEmit = (event: unknown) => listeners.forEach((l) => l({ data: JSON.stringify(event) }));
    w.SmartLauncher = {
      postMessage(raw: string) {
        const message = JSON.parse(raw);
        sent.push(message);
        if (message.type === "clearRecent") w.__cleared = true;
        const answer =
          message.type === "hello"
            ? { version: 3, versionName: "1.3", features: ["recent", "clearRecent"] }
            : message.type === "recent"
              ? w.__usageAllowed
                ? { allowed: true, apps: w.__cleared ? [] : ["com.whatsapp", "de.bank", "com.android.systemui"] }
                : { allowed: false, apps: [] }
              : message.type === "apps"
                ? {
                    apps: [
                      { id: "w|0", label: "WhatsApp", package: "com.whatsapp", icon: icon("#25d366") },
                      { id: "f|0", label: "Firefox", package: "org.mozilla.firefox", icon: icon("#ff7139") },
                      { id: "b|0", label: "Bank", package: "de.bank", icon: icon("#1d4ed8") },
                    ],
                  }
                : { ok: true };
        setTimeout(() => listeners.forEach((l) => l({ data: JSON.stringify({ ...answer, id: message.id }) })), 5);
      },
      addEventListener(_type: string, listener: (event: { data: string }) => void) {
        listeners.push(listener);
      },
    };
  });
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

  // Clear: the list starts afresh.
  await page.evaluate(() => {
    (window as unknown as { __usageAllowed: boolean }).__usageAllowed = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(strip.getByRole("list", { name: "Recent apps" }).getByRole("button")).toHaveText(["WhatsApp", "Bank"]);
  await strip.getByRole("button", { name: "Clear recent apps" }).click();
  await expect(strip.getByText("The apps you open show up here.")).toBeVisible();
  await expect.poll(async () => (await sent(page)).some((m) => m.type === "clearRecent")).toBe(true);

  // Closed again: the tray folds away.
  await page.getByRole("button", { name: "Recent apps" }).click();
  await expect(strip).toBeHidden();
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

test("without the launcher app nothing of it shows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Search the web")).toHaveCount(0);
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/apps");
  await expect(page.getByText(/apps show up here in the Android launcher app/)).toBeVisible();
});
