import { expect, type Page, test } from "@playwright/test";
import { mockWeather, setPhoneMore } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

/** Runs `action` and waits until the change it makes has been written. */
async function saved(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() !== "GET",
  );
  await action();
  await response;
}

async function openSettings(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() === "GET",
  );
  await page.goto("/settings");
  await loaded;
}

const labels = (page: Page, nav: "first" | "last") =>
  page.getByRole("navigation", { name: "Main" })[nav]().getByRole("link").allInnerTexts();

test("menu: the order of the phone's tab bar and of the side bar is set in Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setPhoneMore(page, false);
  await openSettings(page);
  const phone = page.getByRole("group", { name: "Phone tab bar" });

  // Default: Shopping, Backlog | Home | Planner, Notes.
  await expect.poll(() => labels(page, "last")).toEqual(["Shopping", "Backlog", "Home", "Planner", "Notes"]);

  // Tap two to swap them.
  await phone.getByRole("button", { name: "Shopping" }).click();
  await expect(phone.getByRole("button", { name: "Shopping" })).toHaveAttribute("aria-pressed", "true");
  await saved(page, () => phone.getByRole("button", { name: "Notes" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Notes", "Backlog", "Home", "Planner", "Shopping"]);

  // The server already renders the new order (no jump while loading).
  const html = await (await page.request.get("/notes")).text();
  const tabbar = html.slice(html.indexOf("data-tabbar"));
  expect(tabbar.indexOf(">Notes<")).toBeLessThan(tabbar.indexOf(">Shopping<"));

  // Home on the left.
  await saved(page, () => page.getByRole("radio", { name: "Home on the left" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Home", "Notes", "Backlog", "Planner", "Shopping"]);
  await saved(page, () => page.getByRole("radio", { name: "Home in the middle" }).click());

  // Back to the default.
  await phone.getByRole("button", { name: "Notes" }).click();
  await saved(page, () => phone.getByRole("button", { name: "Shopping" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Shopping", "Backlog", "Home", "Planner", "Notes"]);

  // Attached to the screen edges, then floating again (as wide as the cards) – the
  // phone's choice leaves the side bar of PC and wall display alone.
  const bar = page.locator("[data-tabbar]");
  const phoneStyle = page.getByRole("radiogroup", { name: "Phone menu bar style" });
  await saved(page, () => phoneStyle.getByRole("radio", { name: "Attached" }).click());
  await expect(bar).toHaveAttribute("data-attached", "");
  expect((await bar.boundingBox())!.width).toBe(390);
  await expect(page.locator("nav:not([data-tabbar])")).not.toHaveAttribute("data-attached");
  await saved(page, () => phoneStyle.getByRole("radio", { name: "Floating" }).click());
  await expect(bar).not.toHaveAttribute("data-attached");
  expect((await bar.boundingBox())!.width).toBe(390 - 2 * 16);

  // The side bar of PC and wall display has its own order; Home stays on top.
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = page.getByRole("group", { name: "Side bar" });
  await expect(rail.getByRole("button", { name: "Home (stays in place)" })).toBeDisabled();
  await rail.getByRole("button", { name: "Planner" }).click();
  await saved(page, () => rail.getByRole("button", { name: "Weather" }).click());
  await expect
    .poll(() => labels(page, "first"))
    .toEqual(["Home", "Weather", "Shopping", "Backlog", "Notes", "Planner", "Media", "Settings"]);
  await rail.getByRole("button", { name: "Weather" }).click();
  await saved(page, () => rail.getByRole("button", { name: "Planner" }).click());
  await expect
    .poll(() => labels(page, "first"))
    .toEqual(["Home", "Planner", "Shopping", "Backlog", "Notes", "Weather", "Media", "Settings"]);
});

test("menu: the phone's tab bar can swipe to Media, Weather and Settings (instead of the icons on Home)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setPhoneMore(page, false);
  const more = page.getByRole("switch", { name: "More in the tab bar" });

  // Off: Media and Settings sit at the top of Home.
  await page.goto("/");
  await expect(page.locator("main").getByRole("link", { name: "Media", exact: true })).toBeVisible();
  const bar = page.locator("[data-tabbar]");
  await expect(bar.locator("[data-tab-pages]")).toHaveCount(0);

  // On: the bar has a second page with them, Home loses its icons.
  await openSettings(page);
  await saved(page, () => more.click());
  await page.goto("/");
  await expect(page.locator("main").getByRole("link", { name: "Media", exact: true })).toHaveCount(0);
  await expect(page.locator("main").getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  const pages = bar.locator("[data-tab-pages]");
  const inView = async (name: string) => {
    const b = (await bar.getByRole("link", { name, exact: true }).boundingBox())!;
    return b.x >= 0 && b.x + b.width <= 390;
  };
  expect(await inView("Home")).toBe(true);
  expect(await inView("Media")).toBe(false);
  // Swiping the bar (it scrolls sideways and snaps) shows the second page.
  await pages.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
  await expect.poll(() => inView("Weather")).toBe(true);
  await bar.getByRole("link", { name: "Media", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  // On one of its pages the bar opens on that second page.
  await expect.poll(() => inView("Weather")).toBe(true);
  await bar.getByRole("link", { name: "Weather", exact: true }).click();
  await expect(page).toHaveURL(/\/weather$/);
  await expect(bar.getByRole("link", { name: "Weather", exact: true })).toHaveAttribute("aria-current", "page");
  // One highlight for both pages, quick: from Weather back to Home it glides back from the
  // second page (not in from the left edge, where a page's own highlight would wait).
  const pill = bar.locator(".ui-pill");
  await expect(pill).toHaveCount(1);
  expect(parseFloat(await pill.evaluate((el) => (el as HTMLElement).style.left))).toBeGreaterThanOrEqual(50);
  expect(await pill.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0.2s");
  await pages.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
  await bar.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => parseFloat(await pill.evaluate((el) => (el as HTMLElement).style.left)))
    .toBeLessThan(50);

  // And off again.
  await openSettings(page);
  await saved(page, () => more.click());
  await expect(more).toHaveAttribute("aria-checked", "false");
});

test("menu: with the second page, a scroll that starts on the tab bar still scrolls the page", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockWeather(page);
  await setPhoneMore(page, true);
  await page.goto("/");
  const bar = page.locator("[data-tabbar]");
  await expect(bar.locator("[data-tab-pages]")).toBeVisible();
  await page.waitForTimeout(500);
  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const box = (await bar.boundingBox())!;
  const y = box.y + box.height / 2;

  // Up from the bar: the home screen scrolls.
  await touch("touchStart", 195, y);
  for (let i = 1; i <= 10; i++) await touch("touchMove", 195, y - i * 40);
  await touch("touchEnd", 0, 0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  // Sideways on the bar: its second page.
  await touch("touchStart", 330, y);
  for (let i = 1; i <= 8; i++) await touch("touchMove", 330 - i * 35, y);
  await touch("touchEnd", 0, 0);
  await expect.poll(() => bar.locator("[data-tab-pages]").evaluate((el) => el.scrollLeft)).toBeGreaterThan(300);

  await setPhoneMore(page, false);
  await context.close();
});
