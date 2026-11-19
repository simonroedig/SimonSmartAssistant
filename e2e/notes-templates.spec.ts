import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

/** Into the Let go collection – made first under "New category" if there's none yet. */
async function openLetGo(page: Page) {
  const tile = page.getByRole("button", { name: /^Let go, \d+ open/ });
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  if (await tile.isVisible()) await tile.click();
  else {
    await page.getByRole("button", { name: "New category" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Let go/ })
      .click();
  }
  await expect(page.getByRole("button", { name: "Delete Let go" })).toBeVisible();
}

test("notes: Let go – + for a situation, check it off, the done ones as a list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  await openLetGo(page);
  const stamp = Date.now() % 100000;

  // + : the questions in a sheet, the first one ready to type into.
  await page.getByRole("button", { name: "New situation" }).click();
  const sheet = page.getByRole("dialog", { name: "New situation" });
  await expect(sheet.getByLabel("What happened?")).toBeFocused();
  const situation = `Awkward handshake ${stamp}`;
  await page.keyboard.type(situation);
  await sheet.getByRole("group", { name: "Is there anything left to do?" }).getByRole("button", { name: "No" }).click();
  await expect(sheet.getByText("only going round in circles")).toBeVisible();
  await sheet.getByLabel("Realistically, the worst that comes of it").fill("Nothing, really.");
  await sheet.getByLabel("What would I tell a friend?").fill("Nobody remembers a handshake.");
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // Let it go: it lands in the list of done ones, with the day; a tap shows it again.
  await sheet.getByRole("button", { name: "Let it go" }).click();
  await expect(sheet).toBeHidden();
  const done = page.getByRole("button", { name: new RegExp(situation) });
  await expect(done).toBeVisible();
  await expect(page.getByRole("heading", { name: /Let go · \d+/ })).toBeVisible();
  await done.click();
  const read = page.getByRole("dialog", { name: "Let go" });
  await expect(read.getByLabel("What would I tell a friend?")).toHaveValue("Nobody remembers a handshake.");
  await expect(read.getByRole("button", { name: "Open again" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(read).toBeHidden();

  // One written and closed: it's open – the circle checks it off right there.
  const next = `Said something odd ${stamp}`;
  await page.getByRole("button", { name: "New situation" }).click();
  await page.keyboard.type(next);
  await page.keyboard.press("Escape");
  const check = page.getByRole("button", { name: `Let it go: ${next}` });
  await expect(check).toBeVisible();
  await check.click();
  await expect(check).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(next) })).toBeVisible();

  // One more, left open.
  const open = `Forgot a name ${stamp}`;
  await page.getByRole("button", { name: "New situation" }).click();
  await page.keyboard.type(open);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: `Let it go: ${open}` })).toBeVisible();

  // Back: the collection's tile in the overview, striped, with what's open.
  await page.getByRole("button", { name: "Back to all notes" }).click();
  const tile = page.getByRole("button", { name: /^Let go, \d+ open/ });
  await expect(tile).toContainText(open);

  // Deleted (to the trash), the next run starts afresh.
  await tile.click();
  await page.getByRole("button", { name: "Delete Let go" }).click();
  await expect(tile).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New category" })).toBeVisible();
});

test("notes: All – pinned notes without a category on top, small; a category keeps its own pinned ones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  const stamp = Date.now() % 100000;
  const name = `Peek ${stamp}`;

  // A pinned note without a category: under Pinned, one line each.
  const loose = `Door code ${stamp}`;
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  let editor = page.getByRole("dialog");
  await editor.getByLabel("Title").fill(loose);
  await editor.getByLabel("Note", { exact: true }).fill("4711\nsecond line");
  await editor.getByRole("button", { name: "Pin note" }).click();
  await editor.getByRole("button", { name: "Done" }).click();
  const pinnedSection = page.locator("section", { has: page.getByRole("heading", { name: /^Pinned/ }) });
  const looseCard = pinnedSection.getByRole("button", { name: `Open note "${loose}"` });
  await expect(looseCard).toBeVisible();
  await expect(looseCard).not.toContainText("second line");

  // A pinned note in a category: pinned in there, not on All.
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  const inside = `Inside ${stamp}`;
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  editor = page.getByRole("dialog");
  await editor.getByLabel("Note", { exact: true }).fill(inside);
  await editor.getByRole("button", { name: "Pin note" }).click();
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(pinnedSection.getByRole("button", { name: `Open note "${inside}"` })).toBeVisible();
  await page.getByRole("button", { name: "Back to all notes" }).click();
  await expect(pinnedSection.getByRole("button", { name: `Open note "${inside}"` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `${name}, 1 note`, exact: true })).toContainText(inside);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // Tidy up: the category goes (its note stays, without one), the pinned note to the trash.
  await page.getByRole("button", { name: `${name}, 1 note`, exact: true }).click();
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await looseCard.click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
  await expect(looseCard).toHaveCount(0);
});

test("notes: nothing typed is lost – a save that fails is kept and offered again; links open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/notes");
  const text = `Login portal ${Date.now() % 100000} https://example.com/login`;

  // The server turns the save down (a dropped connection is tried again for a while first).
  await page.route("**/rest/v1/notes*", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 400,
          json: { code: "XX000", message: "Something went wrong", details: null, hint: null },
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Note", { exact: true }).fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  const banner = page.getByRole("list", { name: "Not saved" });
  await expect(banner).toContainText("Login portal");

  // Still there after a reload – it's kept on the device.
  await page.unroute("**/rest/v1/notes*");
  await page.reload();
  await expect(banner).toContainText("Login portal");
  await banner.getByRole("button", { name: "Save now" }).click();
  const card = page.getByRole("button", { name: `Open note "${text.slice(0, 39)}…"` });
  await expect(card).toBeVisible();
  await expect(banner).toHaveCount(0);

  // Its link opens right from the card.
  const link = card.locator("..").getByRole("link", { name: "example.com/login" });
  await expect(link).toHaveAttribute("href", "https://example.com/login");
  await expect(link).toHaveAttribute("target", "_blank");

  await card.click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
  await expect(card).toHaveCount(0);
});

/** The part of the page that scrolls on a phone (around the notes). */
const scrollTopOf = (el: import("@playwright/test").Locator) =>
  el.evaluate((node) => {
    for (let p = node.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).overflowY === "auto") return p.scrollTop;
    }
    return window.scrollY;
  });

test("notes on a phone: a category opens at its top; back, the overview is where it was", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 600 },
  });
  const page = await context.newPage();
  await page.goto("/notes");
  const stamp = Date.now() % 100000;
  const name = `Scroll ${stamp}`;
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  const back = page.getByRole("button", { name: "Back to all notes" });
  await expect(back).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await back.click();
  // Enough unsorted notes that the categories sit further down.
  const added: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Add a note", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Note", { exact: true })
      .fill(`Filler ${stamp} ${i}\nline two\nline three`);
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    added.push(`Filler ${stamp} ${i}`);
  }
  const tile = page.getByRole("button", { name: `${name}, 0 notes`, exact: true });
  await tile.scrollIntoViewIfNeeded();
  const before = await scrollTopOf(tile);
  expect(before).toBeGreaterThan(50);
  await tile.click();
  await expect(back).toBeVisible();
  expect(await scrollTopOf(page.getByText(`No notes in ${name} yet.`))).toBe(0);
  await back.click();
  await expect(tile).toBeVisible();
  await expect.poll(() => scrollTopOf(tile)).toBeGreaterThan(before - 5);

  // Tidy up.
  await tile.click();
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const label of added) {
    await page.getByRole("button", { name: `Open note "${label}"` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await context.close();
});

test("notes: search titles, texts and categories – all notes, or only the vault's", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  const stamp = `zq${Date.now() % 100000}`;
  const tabs = page.getByRole("group", { name: "Notes" });

  // A note with the word in its title, one with it in its text inside a category.
  const name = `Search ${stamp}`;
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Note", { exact: true }).fill(`Deep inside: Café ${stamp} code`);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Back to all notes" }).click();
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Title").fill(`Title ${stamp}`);
  await page.getByRole("dialog").getByLabel("Note", { exact: true }).fill("Something else");
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Search (on the right of Vault and All): both, the one in the category with its tag.
  await tabs.getByRole("button", { name: "Search notes" }).click();
  const field = page.getByRole("searchbox", { name: "Search notes" });
  await expect(field).toBeFocused();
  await field.fill(stamp.toUpperCase());
  await expect(page.getByRole("heading", { name: "2 found" })).toBeVisible();
  const inside = page.getByRole("button", { name: /^Open note "Deep inside/ });
  await expect(inside).toContainText(name);
  await expect(page.getByRole("button", { name: `Open note "Title ${stamp}"` })).toBeVisible();
  // Every word, any order, accents or not.
  await field.fill(`code cafe ${stamp}`);
  await expect(page.getByRole("heading", { name: "1 found" })).toBeVisible();
  await field.fill(`${stamp} nothing-like-this`);
  await expect(page.getByText(/Nothing found for/)).toBeVisible();

  // Back closes the search, like the X.
  await page.goBack();
  await expect(tabs.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/notes$/);

  // In the vault, search covers the vault only: the notes on the board aren't found there.
  await tabs.getByRole("button", { name: "Vault" }).click();
  const pin = page.getByRole("dialog");
  if (await pin.getByText("Choose a vault PIN").isVisible()) {
    await pin.getByLabel("New PIN").fill("2468");
    await pin.getByLabel("Repeat the new PIN").fill("2468");
  } else {
    await pin.getByLabel("PIN", { exact: true }).fill("2468");
  }
  await expect(pin).toBeHidden();
  await tabs.getByRole("button", { name: "Search the vault" }).click();
  await page.getByRole("searchbox", { name: "Search the vault" }).fill(stamp);
  await expect(page.getByText(/Nothing found for/)).toBeVisible();
  await page.getByRole("button", { name: "Close search" }).click();
  await tabs.getByRole("button", { name: "All", exact: true }).click();

  // Tidy up.
  await page.getByRole("button", { name: `${name}, 1 note`, exact: true }).click();
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const label of [`Title ${stamp}`]) {
    await page.getByRole("button", { name: `Open note "${label}"` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
  }
  await page.getByRole("button", { name: /^Open note "Deep inside/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete note" }).click();
});
