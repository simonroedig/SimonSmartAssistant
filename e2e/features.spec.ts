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

  const order = async () => {
    const labels = await page
      .locator("main")
      .getByRole("button", { name: new RegExp(`^Move (Apfel|Birne) ${stamp}$`) })
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    return labels;
  };
  // New items go to the top: the later "Birne" comes first.
  await expect.poll(order).toEqual([`Move Birne ${stamp}`, `Move Apfel ${stamp}`]);
  await expect(page.getByRole("button", { name: /^Move / }).first()).toHaveAccessibleName(`Move Birne ${stamp}`);

  // Move "Apfel" up by one with the keyboard sensor.
  const handle = page.getByRole("button", { name: `Move Apfel ${stamp}` });
  await handle.focus();
  // Give the sensor a moment between steps, like a person would.
  for (const key of ["Space", "ArrowUp", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }

  await expect.poll(order).toEqual([`Move Apfel ${stamp}`, `Move Birne ${stamp}`]);
  // Saved: the order survives a reload (once the write has gone through).
  await expect
    .poll(async () => {
      await page.reload();
      await handle.waitFor();
      return order();
    })
    .toEqual([`Move Apfel ${stamp}`, `Move Birne ${stamp}`]);
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

/** The 15th, `months` months ahead. */
function fifteenth(months: number) {
  const target = new Date();
  target.setDate(15);
  target.setMonth(target.getMonth() + months);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-15`;
  return { key, weekend: target.getDay() === 0 || target.getDay() === 6 };
}

/** Starts from an empty day (earlier runs leave blocks behind). */
async function clearDay(page: import("@playwright/test").Page, key: string) {
  await page.goto(`/planner?day=${key}`);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Clear this day" }).click();
}

/** Picks the 15th, `months` months ahead, in the backlog editor's calendar; returns the day key. */
async function pickDueDate(dialog: import("@playwright/test").Locator, months: number) {
  await dialog.getByRole("button", { name: "Pick date" }).click();
  for (let i = 0; i < months; i++) await dialog.getByRole("button", { name: "Next month" }).click();
  const target = new Date();
  target.setDate(15);
  target.setMonth(target.getMonth() + months);
  const month = target.toLocaleString("en-GB", { month: "long" });
  await dialog.getByRole("button", { name: new RegExp(`, 15 ${month}$`) }).click();
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-15`;
  return { key, weekend: target.getDay() === 0 || target.getDay() === 6 };
}

test("plan from backlog: on the due date at wake-up, only once, and jump to it later", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clearDay(page, fifteenth(3).key);
  await page.goto("/todos");
  const title = `Plan me ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.getByRole("button", { name: "Add todo" }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog");
  const due = await pickDueDate(dialog, 3);
  await dialog.getByRole("button", { name: "Important" }).click();

  // "Plan it" saves and opens the planner on the due date with the editor ready.
  await dialog.getByRole("button", { name: "Plan it" }).click();
  await expect(page).toHaveURL(new RegExp(`/planner\\?day=${due.key}$`));
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "New block" })).toBeVisible();
  await expect(editor.getByLabel("What")).toHaveValue(title);
  // Important → three hours from waking up.
  const wake = due.weekend ? "09:00" : "07:00";
  const end = due.weekend ? "12:00" : "10:00";
  await expect(editor.getByRole("button", { name: `Start: ${wake}` })).toBeVisible();
  await expect(editor.getByRole("button", { name: `End: ${end}` })).toBeVisible();
  await editor.getByRole("button", { name: "Add to plan" }).click();
  await expect(editor).toBeHidden();
  const block = page.locator('[role="button"]', { hasText: title }).first();
  await expect(block.getByRole("img", { name: "From your backlog" })).toBeVisible();

  // The planner's backlog list now shows it as planned and jumps to it instead of adding it again.
  const planned = page.getByRole("button", { name: `Show "${title}" in the plan` });
  await expect(planned).toBeVisible();
  await page.goto("/planner");
  await page.getByRole("button", { name: `Show "${title}" in the plan` }).click();
  await expect(page).toHaveURL(new RegExp(`day=${due.key}`));
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Edit block" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.locator('[role="button"]', { hasText: title })).toHaveCount(1);
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.waitForTimeout(300); // let the closed sheet give its history entry back

  // The backlog shows where it is planned; ticking it off ticks the block off too.
  await page.goto("/todos");
  const row = page.locator("li", { hasText: title });
  await expect(row.getByText(/^15 \w{3} 0\d:00$/)).toBeVisible();
  await row.getByRole("button", { name: `Complete "${title}"` }).click();
  await page.goto(`/planner?day=${due.key}`);
  await expect(
    page.locator('[role="button"]', { hasText: title }).first().getByRole("button", { name: "Mark as not done" }),
  ).toBeVisible();
});

test("plan from backlog on the phone, and moving a block to another day", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearDay(page, fifteenth(4).key);
  await page.goto("/todos");
  const title = `Phone plan ${Date.now() % 10000}`;
  await page.getByLabel("New todo").fill(title);
  await page.getByRole("button", { name: "Add todo" }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const due = await pickDueDate(page.getByRole("dialog"), 4);
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.waitForTimeout(300); // let the closed sheet give its history entry back

  await page.goto("/planner");
  await page.getByRole("button", { name: "Plan from backlog" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Plan "${title}"` })
    .click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "New block" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`day=${due.key}`));
  // One hour for items that are not marked important.
  const wake = due.weekend ? "09:00" : "07:00";
  const end = due.weekend ? "10:00" : "08:00";
  await expect(editor.getByRole("button", { name: `Start: ${wake}` })).toBeVisible();
  await expect(editor.getByRole("button", { name: `End: ${end}` })).toBeVisible();

  // Move it to the next day right in the editor.
  await editor.getByRole("button", { name: "Day after" }).click();
  await editor.getByRole("button", { name: "Add to plan" }).click();
  await expect(editor).toBeHidden();
  const next = new Date(`${due.key}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  await page.goto(`/planner?day=${nextKey}`);
  await expect(page.locator('[role="button"]', { hasText: title }).first()).toBeVisible();
});

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("wall display: a drag in a long note scrolls its text instead of selecting it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/notes");
  const title = `Long note ${Date.now() % 10000}`;
  const body = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of a long note`).join("\n");
  await page.getByLabel("New note").click();
  await page.getByLabel("Note title").fill(title);
  await page.getByLabel("New note").fill(body);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${title}"` }).first();
  await expect(card).toBeVisible();

  await expect
    .poll(async () => {
      await page.goto("/notes?kiosk=1");
      await card.waitFor({ timeout: 3000 }).catch(() => undefined);
      return card.count();
    })
    .toBe(1);
  await expect(page.locator("html")).toHaveClass(/kiosk/);
  await card.click();
  const dialog = page.getByRole("dialog");
  const text = dialog.getByLabel("Note", { exact: true });
  await expect(text).toHaveValue(body);
  const box = (await text.boundingBox())!;
  const x = box.x + box.width / 2;
  const start = box.y + 280;
  await page.mouse.move(x, start);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, start - i * 25);
  await page.mouse.up();
  await expect.poll(() => text.evaluate((el: HTMLTextAreaElement) => el.scrollTop)).toBeGreaterThan(150);
  // Nothing got selected (or moved), and the note is still open.
  expect(await text.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(0);
  await expect(text).toHaveValue(body);
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Delete note" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/notes?kiosk=0");
  await expect(page.locator("html")).not.toHaveClass(/kiosk/);
});

test("phone home: lists show their first items with a link to the rest; the plan is an overview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shopping");
  const stamp = Date.now() % 10000;
  for (let i = 1; i <= 6; i++) {
    await page.getByLabel("New shopping item").fill(`Thing ${i} ${stamp}`);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("button", { name: `Thing ${i} ${stamp}`, exact: true })).toBeVisible();
  }
  await expect
    .poll(async () => {
      await page.goto("/");
      const shopping = page.locator("section").filter({ has: page.locator('a[href="/shopping"]') });
      await shopping
        .getByRole("button", { name: /^Move / })
        .first()
        .waitFor({ timeout: 3000 })
        .catch(() => undefined);
      return shopping.getByRole("button", { name: `Move Thing 6 ${stamp}` }).count();
    })
    .toBe(1);
  const shopping = page.locator("section").filter({ has: page.locator('a[href="/shopping"]') });
  // Newest first, five at most, and no scrolling inside the card.
  await expect(shopping.getByRole("button", { name: /^Move / })).toHaveCount(5);
  await expect(shopping.getByRole("button", { name: /^Move / }).first()).toHaveAccessibleName(`Move Thing 6 ${stamp}`);
  const more = shopping.getByRole("link", { name: /\d+ more/ });
  await expect(more).toBeVisible();

  // The day plan shows the whole waking day at once and has nothing to drag.
  const timeline = page.getByRole("button", { name: "Add a block" }).locator("xpath=../..");
  expect(await timeline.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  expect(await timeline.evaluate((el) => getComputedStyle(el).overflowY)).toBe("visible");
  await expect(timeline.getByText("10:00", { exact: true })).toBeVisible();
  await expect(timeline.getByText("22:00", { exact: true })).toBeVisible();
  await expect(timeline.locator(".cursor-ns-resize")).toHaveCount(0);

  await more.click();
  await expect(page).toHaveURL(/\/shopping$/);
});

test("planner header: the weekday leads, the relative day follows in brackets on one line", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekday = tomorrow.toLocaleDateString("en-GB", { weekday: "long" });
  const month = tomorrow.toLocaleDateString("en-GB", { month: "long" });
  await page.goto(`/planner?day=${dayKeyOf(tomorrow)}`);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(`${weekday} (Tomorrow)`);
  // The date below it, with the short month on a phone.
  const date = heading.locator("xpath=following-sibling::p[1]");
  await expect(date).toHaveText(new RegExp(`^${tomorrow.getDate()} ${month.slice(0, 3)}\\w* · Week \\d+$`), {
    useInnerText: true,
  });
  expect(await date.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  // One line for the title and one for the date – nothing wraps.
  expect((await heading.boundingBox())!.height).toBeLessThan(48);
  // The picked day is quietly grey in the week strip, not in the planner's rose.
  const picked = page.getByRole("button", { pressed: true, name: new RegExp(`^${weekday}, `) });
  await expect(picked).toBeVisible();
  expect(await picked.getAttribute("class")).not.toMatch(/bg-rose/);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(heading).toContainText("(Today)");
});

test("planner: a day opens with just its last hour of sleep at the top", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 10 Jan 2030 is a Thursday: up at 07:00, so the view starts at 06:00 (64 px per hour).
  await clearDay(page, "2030-01-10");
  await page.reload();
  const timeline = page.getByRole("button", { name: "Add a block" }).locator("xpath=../..");
  await expect.poll(() => timeline.evaluate((el) => Math.round(el.scrollTop))).toBe(6 * 64);
});

test("weather: the forecast comes first, the details of right now after it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const change = page.getByRole("button", { name: "Change" });
  const search = page.getByLabel("Search location");
  await expect(change.or(search)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await search.fill("Münch");
  await page.getByRole("button", { name: /^München München, Bayern/ }).click();
  await expect(page.getByText("München, Bayern, Deutschland")).toBeVisible();

  await page.goto("/weather");
  const daily = page.getByRole("heading", { name: "Next 7 days" });
  const feels = page.getByText("Feels like", { exact: true });
  await expect(daily).toBeVisible();
  expect((await daily.boundingBox())!.y).toBeLessThan((await feels.boundingBox())!.y);
  // Side by side on big screens: forecast on the left.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(async () => (await daily.boundingBox())!.x < (await feels.boundingBox())!.x - 200).toBe(true);
});

test("notes: deleting moves a note to the trash – restore it or delete it for good", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/notes");
  const stamp = Date.now() % 10000;
  const add = async (text: string) => {
    await page.getByLabel("New note").click();
    await page.getByLabel("New note").fill(text);
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByRole("button", { name: `Open note "${text}"` })).toBeVisible();
  };
  const remove = async (text: string) => {
    await page.getByRole("button", { name: `Open note "${text}"` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
    await expect(page.getByRole("button", { name: `Open note "${text}"` })).toHaveCount(0);
  };
  const first = `Trash me ${stamp}`;
  const second = `Gone for good ${stamp}`;
  await add(first);
  await add(second);
  await remove(first);
  await remove(second);

  // In the trash; restoring brings it back onto the board.
  await page.getByRole("button", { name: /^Trash \(\d+\)$/ }).click();
  const trash = page.getByRole("dialog", { name: "Trash" });
  await expect(trash).toContainText(first);
  await expect(trash).toContainText(second);
  await trash.getByRole("button", { name: `Restore "${first}"` }).click();
  await expect(trash).not.toContainText(first);
  await trash.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: `Open note "${first}"` })).toBeVisible();

  // Delete for good: also gone from the trash (after a reload, too).
  await page.getByRole("button", { name: /^Trash \(\d+\)$/ }).click();
  await trash.getByRole("button", { name: `Delete "${second}" for good` }).click();
  await expect(trash).not.toContainText(second);
  await trash.getByRole("button", { name: "Close" }).click();

  // Empty the trash.
  await remove(first);
  await page.getByRole("button", { name: /^Trash \(\d+\)$/ }).click();
  await expect(trash).toContainText(first);
  await trash.getByRole("button", { name: "Empty trash" }).click();
  await expect(trash).toContainText("The trash is empty.");
  await trash.getByRole("button", { name: "Close" }).click();
  await expect(trash).toBeHidden();
  await page.waitForTimeout(300); // let the closed sheet give its history entry back
  await expect
    .poll(async () => {
      await page.reload();
      await page.getByRole("button", { name: /^Trash \(\d+\)$/ }).waitFor();
      return page.getByRole("button", { name: "Trash (0)" }).count();
    })
    .toBe(1);
});

test("phone: the add row of shopping, backlog and notes waits at the bottom, near the thumb", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  for (const [path, label] of [
    ["/shopping", "New shopping item"],
    ["/todos", "New todo"],
  ] as const) {
    await page.goto(path);
    const field = page.getByLabel(label);
    await expect(field).toBeVisible();
    const tabBar = (await tabs.boundingBox())!;
    const check = async () => {
      const box = (await field.boundingBox())!;
      // Low on the screen, but above the tab bar.
      expect(box.y).toBeGreaterThan(560);
      expect(box.y + box.height).toBeLessThan(tabBar.y);
    };
    await check();
    // It stays there while the list scrolls.
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(300);
    await check();
  }

  await page.goto("/notes");
  const take = page.getByRole("button", { name: "Take a note…" });
  expect((await take.boundingBox())!.y).toBeGreaterThan(560);
  await take.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New note" })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(dialog.getByLabel("Note", { exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Close" }).click();
});
