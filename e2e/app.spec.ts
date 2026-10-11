import { expect, test } from "@playwright/test";
import { mockWeather, watchConsole } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test("every page renders without console errors or CSP violations", async ({ page }) => {
  const problems = watchConsole(page);
  for (const path of ["/", "/planner", "/shopping", "/todos", "/weather", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(400);
  }
  expect(problems).toEqual([]);
});

test("shopping list: add, tick off, clear and undo", async ({ page }) => {
  await page.goto("/shopping");
  const name = `Testkäse ${Date.now() % 10000}`;
  await page.getByLabel("New shopping item").fill(name);
  await page.getByRole("button", { name: "Add item" }).click();
  const listed = page.locator("li", { hasText: name });
  await expect(listed).toHaveCount(1);

  await listed.getByRole("button", { name, exact: true }).click();
  await expect(page.getByText(/In the cart/)).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(listed).toHaveCount(0);
  // Cleared items stay available as one-tap suggestions.
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(listed).toHaveCount(1);

  // Survives a reload (it really is in the database).
  await page.reload();
  await expect(page.locator("li", { hasText: name })).toHaveCount(1);
});

test("backlog: add, star, edit due date and plan it", async ({ page }) => {
  await page.goto("/todos");
  const title = `E2E todo ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByRole("button", { name: "Important" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const row = page.locator("li", { hasText: title });
  await expect(row.getByText("Tomorrow")).toBeVisible();
  await expect(row.getByRole("button", { name: "Remove star" })).toBeVisible();

  // "Plan it" opens the planner on the due date (tomorrow) with the block ready to add.
  await row.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await page.getByRole("button", { name: "Plan it" }).click();
  await expect(page).toHaveURL(/\/planner\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("dialog").getByRole("button", { name: "Pick the day" })).toContainText("Tomorrow");
  await page.getByRole("dialog").getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByRole("button", { name: new RegExp(title) }).first()).toBeVisible();
});

test("backlog: Undo in the backlog's yellow, below the status bar; the whole Completed row opens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/todos");
  // As in the Android app: the page draws under a 40px status bar.
  await page.evaluate(() => document.documentElement.style.setProperty("--safe-top", "40px"));
  const title = `E2E done ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: `Complete "${title}"` }).click();

  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  // (Once it has slid in.)
  await expect
    .poll(async () => (await page.locator("[data-sonner-toast]").first().boundingBox())!.y)
    .toBeGreaterThanOrEqual(40);
  const yellow = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-yellow-400 dark:bg-yellow-300";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(await undo.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(yellow);
  await undo.click();
  await expect(page.getByRole("button", { name: `Complete "${title}"` })).toBeVisible();

  // Done again; the Completed row opens from anywhere on it, not just its words.
  await page.getByRole("button", { name: `Complete "${title}"` }).click();
  const completed = page.getByRole("button", { name: /^Completed/ });
  await expect(completed).toHaveAttribute("aria-expanded", "false");
  await completed.scrollIntoViewIfNeeded();
  const row = (await completed.boundingBox())!;
  await page.mouse.click(row.x + row.width - 12, row.y + row.height / 2);
  await expect(completed).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: `Mark "${title}" as open` })).toBeVisible();
  await page.getByRole("button", { name: `Mark "${title}" as open` }).click();
});

test("shopping and backlog: tick an item off from its sheet – next to Delete, not instead of it", async ({ page }) => {
  // Shopping: press and hold an item, then tick it off there.
  await page.goto("/shopping");
  const name = `Sheet cheese ${Date.now() % 10000}`;
  await page.getByLabel("New shopping item").fill(name);
  await page.getByRole("button", { name: "Add item" }).click();
  const item = page.locator("li", { hasText: name });
  await item.getByRole("button", { name, exact: true }).click({ delay: 700 });
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Delete" })).toBeVisible();
  await sheet.getByRole("button", { name: "In the cart" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(/In the cart · /)).toBeVisible();
  // And back on the list the same way.
  await item.getByRole("button", { name, exact: true }).click({ delay: 700 });
  await sheet.getByRole("button", { name: "Back on the list" }).click();
  await expect(page.locator("li", { hasText: name })).toHaveCount(1);

  // Backlog: tap an item, then complete it from its sheet (an edit made there is kept).
  // (Through the navigation: a closing sheet steps back in the history, which a page.goto would race.)
  await page.getByRole("link", { name: "Backlog" }).first().click();
  await expect(page).toHaveURL(/\/todos$/);
  const title = `Sheet todo ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Delete" })).toBeVisible();
  await sheet.getByLabel("Text").fill(`${title} done`);
  await sheet.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(`Done: ${title}`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Complete "${title} done"` })).toHaveCount(0);
  await page.getByRole("button", { name: /^Completed/ }).click();
  await expect(page.getByRole("button", { name: `Mark "${title} done" as open` })).toBeVisible();
});

test("planner: tap to create, drag to move, resize and complete", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/planner?day=2030-01-07"); // a quiet Monday far in the future
  await expect(page.getByRole("heading", { name: "Monday" })).toBeVisible();

  // Clear anything left from earlier runs.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Clear this day" }).click();

  // Tap the empty timeline at 10:00 (64px per hour).
  const surface = page.getByRole("button", { name: "Add a block" });
  await surface.click({ position: { x: 200, y: 10 * 64 + 5 } });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Start: 10:00" })).toBeVisible();
  await dialog.getByLabel("What").fill("E2E focus block");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();

  const block = page.locator('[role="button"]', { hasText: "E2E focus block" }).first();
  await expect(block).toContainText("10:00 – 11:00");

  // Drag it one hour down with the mouse.
  const b = (await block.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + 15);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width / 2, b.y + 15 + i * 8);
  await page.mouse.up();
  await expect(block).toContainText("11:00 – 12:00");

  // Resize: drag the bottom handle down by 30 minutes.
  const after = (await block.boundingBox())!;
  await page.mouse.move(after.x + after.width / 2, after.y + after.height + 2);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(after.x + after.width / 2, after.y + after.height + 2 + i * 8);
  await page.mouse.up();
  await expect(block).toContainText("11:00 – 12:30");

  await block.getByRole("button", { name: "Mark as done" }).click();
  await expect(block.getByRole("button", { name: "Mark as not done" })).toBeVisible();

  await page.reload();
  const reloaded = page.locator('[role="button"]', { hasText: "E2E focus block" }).first();
  await expect(reloaded).toContainText("11:00 – 12:30");
  await expect(reloaded.getByRole("button", { name: "Mark as not done" })).toBeVisible();
});

test("changes sync live to another device", async ({ browser }) => {
  const storageState = "e2e/.auth/user.json";
  const wall = await (await browser.newContext({ storageState })).newPage();
  const phone = await (await browser.newContext({ storageState, viewport: { width: 390, height: 844 } })).newPage();
  await mockWeather(wall);
  await mockWeather(phone);

  await wall.goto("/shopping");
  await expect(wall.getByRole("status", { name: "Synced live" })).toBeAttached({ timeout: 15_000 });
  await phone.goto("/shopping");

  const name = `Live-Sync ${Date.now() % 10000}`;
  await phone.getByLabel("New shopping item").fill(name);
  await phone.getByRole("button", { name: "Add item" }).click();

  // No reload on the wall display – realtime pushes the change.
  await expect(wall.getByText(name)).toBeVisible({ timeout: 10_000 });
  await wall.context().close();
  await phone.context().close();
});

test("wall display: built-in keyboard types into fields", async ({ page }) => {
  await page.goto("/shopping?kiosk=1");
  await expect(page.locator("html")).toHaveClass(/kiosk/);
  await page.getByLabel("New shopping item").click();

  const keyboard = page.locator("[data-osk]");
  await expect(keyboard).toBeVisible();
  // The first letter of an empty field is capitalised automatically.
  for (const key of ["M", "i", "l", "c", "h"]) {
    await keyboard.getByRole("button", { name: key, exact: true }).click();
  }
  await expect(page.getByLabel("New shopping item")).toHaveValue("Milch");
  await keyboard.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("button", { name: /^Milch/ }).first()).toBeVisible();

  await keyboard.getByRole("button", { name: "Hide keyboard" }).click();
  await expect(keyboard).toBeHidden();

  // Leave kiosk mode again for the other tests.
  await page.goto("/shopping?kiosk=0");
  await expect(page.locator("html")).not.toHaveClass(/kiosk/);
});

test("weather: pick a city, then a day to see its hours", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const change = page.getByRole("button", { name: "Change", exact: true });
  const search = page.getByLabel("Search location");
  await expect(change.or(search)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await search.fill("Münch");
  await page.getByRole("button", { name: /^München München, Bayern/ }).click();
  await expect(page.getByText("München, Bayern, Deutschland")).toBeVisible();

  await page.goto("/weather");
  await expect(page.getByText("Partly cloudy").first()).toBeVisible();
  // Tomorrow, whatever weekday that is (the list starts with "Today").
  const tomorrow = new Date(Date.now() + 86_400_000);
  const weekday = (style: "short" | "long") => tomorrow.toLocaleDateString("en-GB", { weekday: style });
  await page.getByRole("button", { name: new RegExp(`^${weekday("short")}`) }).click();
  await expect(page).toHaveURL(/\/weather\?day=/);
  await expect(page.getByRole("heading", { name: new RegExp(weekday("long")) })).toBeVisible();
});

test("settings: navigating away works after changing preferences", async ({ page }) => {
  // Regression: a render loop on the settings page blocked every navigation.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("radio", { name: "15 min" }).click();
  await page.locator('nav a[href="/planner"]').first().click();
  await expect(page).toHaveURL(/\/planner$/);
  await page.locator('nav a[href="/settings"]').first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.locator('nav a[href="/"]:visible').last().click();
  await expect(page).toHaveURL(/\/$/);
});

test("dashboard: browse the plan of the next days with arrows and swipes", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await mockWeather(page);
  // Midday: in the evening the card starts with tomorrow on purpose.
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  await page.clock.setFixedTime(noon);
  await page.goto("/");
  const card = page.locator("section", { has: page.getByRole("button", { name: "Next day" }) });
  await expect(card.getByText("Today", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Next day" }).click();
  await expect(card.getByText("Tomorrow", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: /Tomorrow/ })).toHaveAttribute(
    "href",
    /\/planner\?day=\d{4}-\d{2}-\d{2}/,
  );
  await card.getByRole("button", { name: "Previous day" }).click();
  await expect(card.getByText("Today", { exact: true })).toBeVisible();

  // A sideways finger swipe over the timeline switches the day without opening the editor.
  // Inside the card, above the bottom tab bar.
  const box = (await card.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = Math.min(box.y + 200, 640);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", box.x + box.width - 30);
  for (let i = 1; i <= 3; i++) await touch("touchMove", box.x + box.width - 30 - i * 60);
  await touch("touchEnd", 0);
  await expect(card.getByText("Tomorrow", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await context.close();
});
