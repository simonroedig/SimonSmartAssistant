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
