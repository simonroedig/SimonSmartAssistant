import { expect, type Page, test } from "@playwright/test";
import { mockWeather, waitForCode } from "./helpers";

/** The vault PIN of dev@example.com (the integration tests leave it set to this). */
const PIN = "2468";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

const tabs = (page: Page) => page.getByRole("group", { name: "Notes" });
/** A category's tile in the overview (its name says how many notes it has). */
const tile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}, \\d+ notes?$`) });

/** Opens a category to rename, recolour or delete: its tile, then the pencil next to its name. */
async function editCategory(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Back to all notes" }).isVisible()) {
    await page.getByRole("button", { name: "Back to all notes" }).click();
  }
  await tile(page, name).click();
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await expect(page.getByRole("dialog", { name: "Edit category" })).toBeVisible();
}

/** Opens the vault from the notes page – setting the PIN first if there is none yet. */
async function openVault(page: Page) {
  await tabs(page).getByRole("button", { name: "Vault" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/PIN/)).toBeVisible();
  if (await dialog.getByText("Choose a vault PIN").isVisible()) {
    await dialog.getByLabel("New PIN").fill(PIN);
    await dialog.getByLabel("Repeat the new PIN").fill(PIN);
  } else {
    await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  }
  await expect(dialog).toBeHidden();
  await expect(tabs(page).getByRole("button", { name: "Vault (open)" })).toHaveAttribute("aria-pressed", "true");
}

test("notes: categories – a tile each in the overview, a level deeper to open, back to All", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const name = `Work ${Date.now() % 100000}`;
  const back = page.getByRole("button", { name: "Back to all notes" });

  // A new category, in green; the page goes into it.
  await page.getByRole("button", { name: "New category" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Category name").fill(name);
  await sheet.getByRole("radio", { name: "Green" }).click();
  await sheet.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeVisible();
  await expect(page.getByText(`No notes in ${name} yet.`)).toBeVisible();

  // A note written here goes into it.
  const text = `Quarterly report ${Date.now() % 100000}`;
  await page.getByLabel("New note").fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${text}"` });
  await expect(card).toBeVisible();

  // Back in the overview: the category's tile, with a peek at the note (not the note itself).
  await back.click();
  await expect(tabs(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, name)).toHaveAccessibleName(`${name}, 1 note`);
  await expect(tile(page, name)).toContainText(text);
  await expect(card).toHaveCount(0);

  // A note without a category waits under "Not sorted yet".
  const loose = `Loose thought ${Date.now() % 100000}`;
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  const fresh = page.getByRole("dialog");
  await fresh.getByLabel("Note", { exact: true }).fill(loose);
  await fresh.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Not sorted yet" })).toBeVisible();
  const looseCard = page.getByRole("button", { name: `Open note "${loose}"` });
  await expect(looseCard).toBeVisible();

  // The browser's back leaves a category too.
  await tile(page, name).click();
  await expect(card).toBeVisible();
  await page.goBack();
  await expect(tile(page, name)).toBeVisible();
  await expect(page).toHaveURL(/\/notes$/);

  // In the editor the category can be taken off again (tap it once more): the note leaves it.
  await tile(page, name).click();
  await card.click();
  const editor = page.getByRole("dialog");
  const picked = editor.getByRole("group", { name: "Category" }).getByRole("button", { name, exact: true });
  await expect(picked).toHaveAttribute("aria-pressed", "true");
  await picked.click();
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(card).toHaveCount(0);
  await back.click();
  await expect(card).toBeVisible();

  // Rename it, then delete it – from inside, by the pencil; the page goes back to All.
  await editCategory(page, name);
  const form = page.getByRole("dialog", { name: "Edit category" });
  await form.getByLabel("Category name").fill(`${name} new`);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: `Edit ${name} new` })).toBeVisible();
  await page.getByRole("button", { name: `Edit ${name} new` }).click();
  await form.getByRole("button", { name: "Delete category" }).click();
  await expect(tabs(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, `${name} new`)).toHaveCount(0);
  // Its notes stay.
  await expect(card).toBeVisible();
});

test("notes: categories in an order of your own – drag them in the list behind the pencil", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const stamp = Date.now() % 100000;
  const names = [`First ${stamp}`, `Second ${stamp}`];
  for (const name of names) {
    await page.getByRole("button", { name: "New category" }).click();
    const form = page.getByRole("dialog", { name: "New category" });
    await form.getByLabel("Category name").fill(name);
    await form.getByRole("button", { name: "Add category" }).click();
    await expect(form).toBeHidden();
    await page.getByRole("button", { name: "Back to all notes" }).click();
  }
  // The tiles, in order.
  const order = async () =>
    (
      await page
        .getByRole("button", { name: /, \d+ notes?$/ })
        .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")?.replace(/, \d+ notes?$/, "") ?? ""))
    ).filter((t) => t.endsWith(String(stamp)));
  await expect.poll(order).toEqual(names);

  // The pencil next to "Categories": in its list the second one moves up (here by keyboard).
  await page.getByRole("button", { name: "Edit categories" }).click();
  const list = page.getByRole("dialog", { name: "Categories" });
  const handle = list.getByRole("button", { name: `Move ${names[1]}` });
  await handle.focus();
  // Give the sensor a moment between steps, like a person would.
  for (const key of ["Space", "ArrowUp", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  const listOrder = () =>
    list
      .getByRole("button", { name: /^Move / })
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")?.replace("Move ", "") ?? ""));
  await expect
    .poll(async () => (await listOrder()).filter((n) => n.endsWith(String(stamp))))
    .toEqual([names[1], names[0]]);
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect.poll(order).toEqual([names[1], names[0]]);

  // It stays that way.
  await page.reload();
  await expect.poll(order).toEqual([names[1], names[0]]);

  for (const name of names) {
    await editCategory(page, name);
    await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("notes: the vault – only with the PIN, locked again on leaving, never kept on the device", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  await openVault(page);
  await expect(page.getByText("The vault is open")).toBeVisible();

  // A note written in the vault stays in it.
  const secret = `Safe code ${Date.now() % 100000}`;
  await page.getByLabel("New note").fill(secret);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${secret}"` });
  await expect(card).toBeVisible();

  // Switching to another window or app keeps it open.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(card).toBeVisible();

  // Lock: back to all notes, and the vault's notes are gone from sight and from the device.
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(tabs(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open note/ }).first()).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("ssa:cache") ?? "")).not.toContain(secret);

  // A wrong PIN doesn't open it; the right one does.
  await tabs(page).getByRole("button", { name: "Vault" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PIN", { exact: true }).fill("1111");
  await expect(dialog.getByText("Wrong PIN.")).toBeVisible();
  await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();

  // Leaving the notes page locks it, too.
  await page.goto("/");
  await page.goto("/notes");
  await expect(tabs(page).getByRole("button", { name: "Vault", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(secret)).toHaveCount(0);
});

test("notes: a note moves into the vault from its editor, even while the vault is locked", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const text = `Wi-Fi code ${Date.now() % 100000}`;
  await page.getByLabel("New note").fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${text}"` });
  await card.click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("group", { name: "Category" }).getByRole("button", { name: "Vault" }).click();
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Moved to the vault")).toBeVisible();
  await expect(card).toHaveCount(0);
  // Not a failed save: it's there once the vault is open.
  await expect(page.getByText(/Couldn't update/)).toHaveCount(0);
  await openVault(page);
  await expect(card).toBeVisible();
});

test("settings: change the vault PIN, or reset it with a code from the e-mail", async ({ page }) => {
  await page.goto("/notes");
  await openVault(page); // (sets a PIN if there is none)
  await page.goto("/settings");
  const section = page.locator("section").filter({ hasText: "Notes vault" }).first();
  const dialog = page.getByRole("dialog");

  // Change: the current PIN first (a wrong one is refused), then the new one twice.
  await section.getByRole("button", { name: "Change PIN" }).click();
  await dialog.getByLabel("Current PIN").fill("9999");
  await dialog.getByLabel("New PIN").fill(PIN);
  await dialog.getByLabel("Repeat the new PIN").fill(PIN);
  await expect(dialog.getByText("Wrong PIN.")).toBeVisible();
  await dialog.getByLabel("Current PIN").fill(PIN);
  await dialog.getByLabel("New PIN").fill(PIN);
  await dialog.getByLabel("Repeat the new PIN").fill(PIN);
  await expect(page.getByText("Vault PIN changed")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Forgotten: confirm with a code from the e-mail, then a new PIN.
  await section.getByRole("button", { name: "Reset PIN" }).click();
  const since = Date.now();
  await dialog.getByRole("button", { name: "Send code" }).click();
  const code = await waitForCode("dev@example.com", since);
  await dialog.getByLabel("Code from the e-mail").fill(code);
  await dialog.getByLabel("New PIN").fill(PIN);
  await dialog.getByLabel("Repeat the new PIN").fill(PIN);
  await expect(page.getByText("Vault PIN changed")).toBeVisible();
});

test("notes on a phone: swipe right to go back from a category, and on into the vault", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockWeather(page);
  await page.goto("/notes");
  const name = `Ideas ${Date.now() % 100000}`;
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Nothing sticks out sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const cdp = await context.newCDPSession(page);
  const swipe = async (dx: number) => {
    const [x, y] = [195, 520];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / 8, y, id: 1 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const all = tabs(page).getByRole("button", { name: "All", exact: true });

  // To the right: out of the category, back to All.
  await swipe(160);
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, name)).toBeVisible();

  // Again: into the vault – with the PIN.
  await swipe(160);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  await expect(dialog).toBeHidden();
  await expect(tabs(page).getByRole("button", { name: "Vault (open)" })).toHaveAttribute("aria-pressed", "true");
  // To the left: back to All, and the vault locks.
  await swipe(-160);
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(tabs(page).getByRole("button", { name: "Vault", exact: true })).toHaveAttribute("aria-pressed", "false");

  // Clean up (a moment after the swipe – the tap that ends one is swallowed).
  await page.waitForTimeout(150);
  await editCategory(page, name);
  await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});
