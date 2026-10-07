import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test("notes: write, pin, edit and delete with undo – also on the home screen", async ({ page }) => {
  await page.goto("/notes");
  const stamp = Date.now() % 10000;
  const title = `Codes ${stamp}`;
  const text = `Door code ${stamp}`;
  await page.getByLabel("New note").click();
  await page.getByLabel("Note title").fill(title);
  await page.getByLabel("New note").fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${title}"` }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();

  // Pin it, then it is listed under "Pinned".
  await card.locator("..").getByRole("button", { name: "Pin note" }).click();
  await expect(page.getByRole("heading", { name: "Pinned" })).toBeVisible();

  // Edit in the sheet; closing saves.
  await card.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Note", { exact: true }).fill(`${text}\nRing twice ${stamp}`);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Ring twice ${stamp}`)).toBeVisible();

  // The home screen shows it too.
  await page.goto("/");
  await expect(page.getByRole("button", { name: `Open note "${title}"` }).first()).toBeVisible();

  // Delete and undo.
  await page
    .getByRole("button", { name: `Open note "${title}"` })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByRole("button", { name: `Open note "${title}"` })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: `Open note "${title}"` }).first()).toBeVisible();
});

test("backlog: one free text with several lines, newest first", async ({ page }) => {
  await page.goto("/todos");
  const headline = `Hallway lamp ${Date.now() % 10000}`;
  const box = page.getByLabel("New todo");
  await box.fill(`${headline}\nBuy a warm white bulb`);
  await page.getByRole("button", { name: "Add todo" }).click();
  const row = page.getByRole("button", { name: headline, exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText("Buy a warm white bulb").first()).toBeVisible();
  // New items go to the top of the list.
  await expect(page.locator("main li").first()).toContainText(headline);

  await row.click();
  const text = page.getByRole("dialog").getByLabel("Text");
  await expect(text).toHaveValue(`${headline}\nBuy a warm white bulb`);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
});

test("shopping: drag an item to a new place (keyboard) and it stays there", async ({ page }) => {
  await page.goto("/shopping");
  const stamp = Date.now() % 10000;
  for (const name of [`Apfel ${stamp}`, `Birne ${stamp}`]) {
    await page.getByLabel("New shopping item").fill(name);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("button", { name: name, exact: true })).toBeVisible();
  }
  const names = async () =>
    (
      await page
        .locator("main")
        .getByRole("button", { name: new RegExp(`^Move (Apfel|Birne) ${stamp}$`) })
        .all()
    ).length;
  expect(await names()).toBe(2);
  // Start from the saved state (not the optimistic one that is still being confirmed).
  await page.reload();
  await expect.poll(names).toBe(2);

  // Move "Birne" up by one with the keyboard sensor.
  const handle = page.getByRole("button", { name: `Move Birne ${stamp}` });
  await handle.focus();
  // Give the sensor a moment between steps, like a person would.
  for (const key of ["Space", "ArrowUp", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }

  const order = async () => {
    const labels = await page
      .locator("main")
      .getByRole("button", { name: new RegExp(`^Move (Apfel|Birne) ${stamp}$`) })
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    return labels;
  };
  await expect.poll(order).toEqual([`Move Birne ${stamp}`, `Move Apfel ${stamp}`]);
  // Saved: the order survives a reload (once the write has gone through).
  await expect
    .poll(async () => {
      await page.reload();
      await handle.waitFor();
      return order();
    })
    .toEqual([`Move Birne ${stamp}`, `Move Apfel ${stamp}`]);
});

test("planner: back gesture closes the editor; swipe and month calendar change the day", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await mockWeather(page);
  await page.goto("/planner?day=2030-01-07");
  await expect(page.getByRole("heading", { name: "Monday" })).toBeVisible();

  // The phone's back button closes the editor instead of leaving the page.
  await page.getByRole("button", { name: "Add block" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/planner\?day=2030-01-07$/);

  // Swipe left on the timeline: next day.
  const card = (await page.getByRole("button", { name: "Add a block" }).locator("..").boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const y = 520;
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", card.x + card.width - 30);
  for (let i = 1; i <= 3; i++) await touch("touchMove", card.x + card.width - 30 - i * 60);
  await touch("touchEnd", 0);
  await expect(page.getByRole("heading", { name: "Tuesday" })).toBeVisible();
  await expect(page).toHaveURL(/day=2030-01-08/);
  await expect(page.getByRole("dialog")).toBeHidden();

  // Month calendar: jump to another month and pick a day.
  await page.getByRole("button", { name: "Pick a day" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("January 2030")).toBeVisible();
  await dialog.getByRole("button", { name: "Next month" }).click();
  await expect(dialog.getByText("February 2030")).toBeVisible();
  await dialog.getByRole("button", { name: "Friday, 15 February" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Friday" })).toBeVisible();
  await expect(page).toHaveURL(/day=2030-02-15/);
  await context.close();
});

test("navigation behaves like an app: back from any section leads home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/^Week \d+$/)).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await tabs.getByRole("link", { name: "Shopping" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await tabs.getByRole("link", { name: "Backlog" }).click();
  await expect(page).toHaveURL(/\/todos$/);
  await tabs.getByRole("link", { name: "Notes" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/^Week \d+$/)).toBeVisible();
  // The tab bar follows, and no loading bar is left behind.
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Notes" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("progressbar", { name: "Loading" })).toHaveCount(0);

  // Straight from home to a section and back again.
  await tabs.getByRole("link", { name: "Planner" }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Planner" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("progressbar", { name: "Loading" })).toHaveCount(0);
});

test("wall display: dragging with the touch screen (as a mouse) scrolls instead of tapping", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/planner?day=2030-01-07&kiosk=1");
  await expect(page.locator("html")).toHaveClass(/kiosk/);
  const surface = page.getByRole("button", { name: "Add a block" });
  const scroller = surface.locator("xpath=../..");
  const before = await scroller.evaluate((el) => el.scrollTop);
  const box = (await surface.boundingBox())!;
  const x = box.x + 300;
  const start = 600;
  await page.mouse.move(x, start);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, start - i * 25);
  await page.mouse.up();
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 150);
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/planner?kiosk=0");
  await expect(page.locator("html")).not.toHaveClass(/kiosk/);
});

test("wall display: the on-screen keyboard types into a sheet without closing it", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() =>
    localStorage.setItem("ssa:device", JSON.stringify({ kiosk: true, keyboard: true, theme: "dark" })),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const keyboard = page.locator("[data-osk]");
  await expect(keyboard).toBeVisible();
  // The new note's text field keeps the focus.
  await page.waitForTimeout(600);
  await expect(dialog.getByLabel("Note", { exact: true })).toBeFocused();

  for (const key of ["H", "a", "l", "l", "o"]) {
    await keyboard.getByRole("button", { name: key, exact: true }).click();
  }
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Note", { exact: true })).toHaveValue("Hallo");

  // Switch to the title and keep typing.
  await dialog.getByLabel("Title").click();
  for (const key of ["W", "o"]) await keyboard.getByRole("button", { name: key, exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title")).toHaveValue("Wo");

  await dialog.getByRole("button", { name: "Delete note" }).count(); // new note: no delete button
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: 'Open note "Wo"' }).first()).toBeVisible();
});

test("planner: tapping a block opens it – with a mouse and on the wall display", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/planner?day=2030-01-09");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Clear this day" }).click();
  await page.getByRole("button", { name: "Add a block" }).click({ position: { x: 200, y: 9 * 64 + 5 } });
  await page.getByRole("dialog").getByLabel("What").fill("Tap me");
  await page.getByRole("dialog").getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const block = page.locator('[role="button"]', { hasText: "Tap me" }).first();
  await block.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Wall display: the touch screen arrives as a mouse and is treated like a finger.
  await page.goto("/planner?day=2030-01-09&kiosk=1");
  await expect(page.locator("html")).toHaveClass(/kiosk/);
  await page.locator('[role="button"]', { hasText: "Tap me" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.goto("/planner?kiosk=0");
});

test("planner: a bedtime after midnight is shown at the end of the same day", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 4 Jan 2030 is a Friday; the default schedule goes to bed at 00:30 on Fridays.
  await page.goto("/planner?day=2030-01-04");
  await expect(page.getByRole("heading", { name: "Friday" })).toBeVisible();
  await expect(page.getByText("Midnight", { exact: true })).toBeAttached();
  await expect(page.getByText("Bedtime 00:30")).toBeAttached();
  // A normal weekday ends at midnight with its bedtime before it.
  await page.goto("/planner?day=2030-01-08");
  await expect(page.getByText("Bedtime 23:30")).toBeAttached();
  await expect(page.getByText("Midnight", { exact: true })).toHaveCount(0);
});

test("backlog: due dates from the quick picks and the built-in calendar", async ({ page }) => {
  await page.goto("/todos");
  const title = `Due test ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.getByRole("button", { name: "Add todo" }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog");

  // "Next week" keeps saying so (or "Tomorrow" when today is Sunday).
  await dialog.getByRole("button", { name: "Next week" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  const row = page.locator("li", { hasText: title });
  await expect(row.getByText(/^(Next week|Tomorrow)$/)).toBeVisible();

  // Pick the 15th of next month in our own calendar (no native date picker needed).
  await page.getByRole("button", { name: title, exact: true }).click();
  await dialog.getByRole("button", { name: "Pick date" }).click();
  await dialog.getByRole("button", { name: "Next month" }).click();
  const next = new Date();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const month = next.toLocaleString("en-GB", { month: "long" });
  await dialog.getByRole("button", { name: new RegExp(`, 15 ${month}$`) }).click();
  await expect(dialog.getByRole("button", { name: /^15 / })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText(new RegExp(`^15 ${month.slice(0, 3)}$`))).toBeVisible();
});
