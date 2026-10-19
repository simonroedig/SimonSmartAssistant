import { expect, type Page, test } from "@playwright/test";
import { mockWeather, waitForCode } from "./helpers";

/** The vault PIN of dev@example.com (the integration tests leave it set to this). */
const PIN = "2468";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

const filters = (page: Page) => page.getByRole("group", { name: "Filter notes" });

/** Opens a category to rename, recolour or delete: the pencil (all categories), then that one. */
async function editCategory(page: Page, name: string) {
  await filters(page).getByRole("button", { name: "Edit categories" }).click();
  await page.getByRole("dialog", { name: "Categories" }).getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit category" })).toBeVisible();
}

/** Opens the vault from the notes page – setting the PIN first if there is none yet. */
async function openVault(page: Page) {
  await filters(page).getByRole("button", { name: "Vault" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/PIN/)).toBeVisible();
  if (await dialog.getByText("Choose a vault PIN").isVisible()) {
    await dialog.getByLabel("New PIN").fill(PIN);
    await dialog.getByLabel("Repeat the new PIN").fill(PIN);
  } else {
    await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  }
  await expect(dialog).toBeHidden();
  await expect(filters(page).getByRole("button", { name: "Vault (open)" })).toHaveAttribute("aria-pressed", "true");
}

test("notes: categories – add one, filter by it, tag notes, rename and delete it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const name = `Work ${Date.now() % 100000}`;

  // A new category, in green; the page switches to it.
  await filters(page).getByRole("button", { name: "New category" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Category name").fill(name);
  await sheet.getByRole("radio", { name: "Green" }).click();
  await sheet.getByRole("button", { name: "Add category" }).click();
  const chip = filters(page).getByRole("button", { name, exact: true });
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(`No notes in ${name} yet.`)).toBeVisible();

  // A note written here goes into it and carries its tag.
  const text = `Quarterly report ${Date.now() % 100000}`;
  await page.getByLabel("New note").fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${text}"` });
  await expect(card).toBeVisible();
  await expect(card.getByText(name)).toBeVisible();

  // Under All, too.
  await filters(page).getByRole("button", { name: "All", exact: true }).click();
  await expect(card.getByText(name)).toBeVisible();

  // Others: only the notes without a category – a new one written there, not this one.
  await filters(page).getByRole("button", { name: "Others", exact: true }).click();
  await expect(card).toHaveCount(0);
  const loose = `Loose thought ${Date.now() % 100000}`;
  // (The round + opens a new note on wide screens too, besides "Take a note…".)
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  const fresh = page.getByRole("dialog");
  await fresh.getByLabel("Note", { exact: true }).fill(loose);
  await fresh.getByRole("button", { name: "Done" }).click();
  const looseCard = page.getByRole("button", { name: `Open note "${loose}"` });
  await expect(looseCard).toBeVisible();
  await filters(page).getByRole("button", { name: "All", exact: true }).click();
  await expect(looseCard).toBeVisible();
  await expect(card).toBeVisible();

  // In the editor the category can be taken off again (tap it once more).
  await card.click();
  const editor = page.getByRole("dialog");
  const picked = editor.getByRole("group", { name: "Category" }).getByRole("button", { name, exact: true });
  await expect(picked).toHaveAttribute("aria-pressed", "true");
  await picked.click();
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(card.getByText(name)).toHaveCount(0);

  // Rename it (the pencil: all categories, then the one), then delete it.
  await chip.click();
  await editCategory(page, name);
  const form = page.getByRole("dialog", { name: "Edit category" });
  await form.getByLabel("Category name").fill(`${name} new`);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(filters(page).getByRole("button", { name: `${name} new`, exact: true })).toBeVisible();
  await editCategory(page, `${name} new`);
  await form.getByRole("button", { name: "Delete category" }).click();
  await expect(filters(page).getByRole("button", { name: `${name} new`, exact: true })).toHaveCount(0);
  await expect(filters(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Its notes stay.
  await expect(card).toBeVisible();
});

test("notes: categories in an order of your own – drag them in the list behind the pencil", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const stamp = Date.now() % 100000;
  const names = [`First ${stamp}`, `Second ${stamp}`];
  for (const name of names) {
    await filters(page).getByRole("button", { name: "New category" }).click();
    const form = page.getByRole("dialog", { name: "New category" });
    await form.getByLabel("Category name").fill(name);
    await form.getByRole("button", { name: "Add category" }).click();
    await expect(form).toBeHidden();
  }
  const chipOrder = () =>
    filters(page)
      .getByRole("button")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim() || el.getAttribute("aria-label") || ""));
  const order = async () => (await chipOrder()).filter((t) => t.endsWith(String(stamp)));
  await expect.poll(order).toEqual(names);
  // Vault, Others and All always come first.
  expect((await chipOrder()).slice(0, 3)).toEqual(["Vault", "Others", "All"]);

  // The pencil is always there; in its list the second one moves up (here by keyboard).
  await filters(page).getByRole("button", { name: "Edit categories" }).click();
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
  expect((await chipOrder()).slice(0, 3)).toEqual(["Vault", "Others", "All"]);

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
  await expect(filters(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /Open note/ }).first()).toBeVisible();
  await expect(page.getByText(secret)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("ssa:cache") ?? "")).not.toContain(secret);

  // A wrong PIN doesn't open it; the right one does.
  await filters(page).getByRole("button", { name: "Vault" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PIN", { exact: true }).fill("1111");
  await expect(dialog.getByText("Wrong PIN.")).toBeVisible();
  await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();

  // Leaving the notes page locks it, too.
  await page.goto("/");
  await page.goto("/notes");
  await expect(filters(page).getByRole("button", { name: "Vault", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
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

test("notes on a phone: swipe sideways through the vault, All and the categories", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockWeather(page);
  await page.goto("/notes");

  // Categories to swipe to – more than fit across the screen.
  const stamp = Date.now() % 100000;
  const added = [`Ideas ${stamp}`, `Plans ${stamp}`, `Recipes ${stamp}`];
  for (const name of added) {
    await filters(page).getByRole("button", { name: "New category" }).click();
    await page.getByRole("dialog").getByLabel("Category name").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await filters(page).getByRole("button", { name: "All", exact: true }).click();

  // The vault comes first, then Others (notes without a category), All, the categories.
  const chips = await filters(page)
    .getByRole("button")
    .evaluateAll((els) => els.map((el) => el.textContent?.trim() || el.getAttribute("aria-label") || ""));
  expect(chips.slice(0, 3)).toEqual(["Vault", "Others", "All"]);
  const categories = chips.slice(3, -2); // (the last two are + and the pencil)

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
  const pressed = (label: string) =>
    expect(filters(page).getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");

  const row = filters(page);
  const scrolled = () =>
    row.evaluate((el) => ({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 }));

  // To the left: the next category, and on to the last one – the row then shows its very end (+).
  for (const category of categories) {
    await swipe(-160);
    await pressed(category);
    // The picked chip keeps the page's margin from the screen's edges.
    await expect
      .poll(() =>
        row.getByRole("button", { name: category, exact: true }).evaluate((chip) => {
          const box = chip.getBoundingClientRect();
          return box.left >= 15 && box.right <= window.innerWidth - 15;
        }),
      )
      .toBe(true);
  }
  await expect.poll(scrolled).toEqual({ start: false, end: true });
  await expect(row.getByRole("button", { name: "New category" })).toBeInViewport();
  // No further: it doesn't wrap round.
  await swipe(-160);
  await pressed(categories.at(-1)!);

  // To the right: back to All, then on into the vault – with the PIN.
  for (const category of [...categories.slice(0, -1).reverse(), "All"]) {
    await swipe(160);
    await pressed(category);
  }
  // Back at All, the row is back at its start, as when the page opens.
  await expect.poll(scrolled).toEqual({ start: true, end: false });
  // Then Others, then the vault.
  await swipe(160);
  await pressed("Others");
  await swipe(160);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  await expect(dialog).toBeHidden();
  await expect(row.getByRole("button", { name: "Vault (open)" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(scrolled).toEqual({ start: true, end: false });
  // Swiping out of it locks it again.
  await swipe(-160);
  await pressed("Others");
  await expect(row.getByRole("button", { name: "Vault", exact: true })).toHaveAttribute("aria-pressed", "false");

  // Clean up the categories (a moment after the swipe – the tap that ends one is swallowed).
  await page.waitForTimeout(150);
  for (const name of added) {
    await editCategory(page, name);
    await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await context.close();
});
