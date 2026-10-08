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
        const answer =
          message.type === "hello"
            ? { version: 3, versionName: "1.3" }
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

  // Filter and open an app.
  await page.getByLabel("Search apps or the web").fill("wha");
  await expect(apps.getByRole("button")).toHaveText(["WhatsApp"]);
  await apps.getByRole("button", { name: "WhatsApp" }).click();
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "launch")?.app).toBe("w|0");
  await expect(page.getByLabel("Search apps or the web")).toHaveValue("");

  // Enter searches the web in Firefox.
  await page.getByLabel("Search apps or the web").fill("Wetter München");
  await page.getByLabel("Search apps or the web").press("Enter");
  await expect.poll(async () => (await sent(page)).find((m) => m.type === "search")?.query).toBe("Wetter München");

  // The phone's home button brings the home screen back.
  await page.evaluate(() =>
    (window as unknown as { __launcherEmit: (e: unknown) => void }).__launcherEmit({ type: "home" }),
  );
  await expect(page).toHaveURL(/\/$/);
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

  // Apps → Home with the tab, too.
  await tabs.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/apps$/);
  await tabs.getByRole("link", { name: "Apps" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Web search right from the home screen.
  await page.getByLabel("Search the web").fill("Feiertage Bayern");
  await page.getByRole("button", { name: "Search in Firefox" }).click();
  await expect
    .poll(async () => (await sent(page)).filter((m) => m.type === "search").map((m) => m.query))
    .toContain("Feiertage Bayern");
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
