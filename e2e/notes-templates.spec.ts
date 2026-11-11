import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test("notes: a Let go note – walk a situation through, check it off, add the next one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  const stamp = Date.now() % 100000;

  // A new note can start from a template (if there's a Let go note already, it opens that one).
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Let go", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Let go" });
  await expect(sheet).toBeVisible();

  // The questions, one situation at a time – the first one ready to type into.
  const situation = `Awkward handshake ${stamp}`;
  await expect(sheet.getByLabel("What happened?").first()).toBeFocused();
  await page.keyboard.type(situation);
  const entry = sheet.getByRole("region", { name: situation });
  await entry.getByRole("group", { name: "Is there anything left to do?" }).getByRole("button", { name: "No" }).click();
  await expect(entry.getByText("only going round in circles")).toBeVisible();
  await entry.getByLabel("Realistically, the worst that comes of it").fill("Nothing, really.");
  await entry.getByLabel("What would I tell a friend?").fill("Nobody remembers a handshake.");
  // Nothing sticks out sideways on a phone.
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // Checked off: it folds away into the done ones, with the day.
  await entry.getByRole("button", { name: "Let it go" }).click();
  await expect(entry).toHaveCount(0);
  const done = sheet.locator("details", { hasText: /Let go · \d+/ });
  await done.locator("summary").click();
  await done.getByRole("button", { name: new RegExp(situation) }).click();
  await expect(done.getByText("Nobody remembers a handshake.")).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();

  // On the board: a card with how many are let go.
  const card = page.getByRole("button", { name: 'Open note "Let go"' });
  await expect(card).toContainText(/\d+ let go/);

  // The next one: open it, a new situation – it shows as open on the card.
  await card.click();
  await sheet.getByRole("button", { name: "New situation" }).click();
  const next = `Said something odd ${stamp}`;
  await page.keyboard.type(next);
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(card).toContainText(/\d+ open/);
  await expect(card).toContainText(next);

  // A new note with the template again opens this one, with a fresh situation to fill in.
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Let go", exact: true }).click();
  await expect(sheet.getByRole("region", { name: next })).toBeVisible();
  await expect(sheet.getByLabel("What happened?").first()).toBeFocused();

  // Deleted, the next run starts afresh.
  await sheet.getByRole("button", { name: "Delete note" }).click();
  await expect(card).toHaveCount(0);
});

test("notes: All gives an overview – pinned, the categories with a peek, then what isn't sorted", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  const stamp = Date.now() % 100000;
  const filters = page.getByRole("group", { name: "Filter notes" });
  const name = `Peek ${stamp}`;
  await filters.getByRole("button", { name: "New category" }).click();
  await page.getByRole("dialog").getByLabel("Category name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // A note in it (the page shows the category now).
  const text = `Inside ${stamp}`;
  await page.getByRole("button", { name: "Add a note", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Note", { exact: true }).fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: `Open note "${text}"` })).toBeVisible();

  await filters.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  const tile = page.getByRole("button", { name: `${name}, 1 note`, exact: true });
  await expect(tile).toContainText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await tile.click();
  await expect(filters.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: `Open note "${text}"` })).toBeVisible();

  // Tidy up: the category goes (its note stays, without one).
  await filters.getByRole("button", { name: "Edit categories" }).click();
  await page.getByRole("dialog", { name: "Categories" }).getByRole("button", { name, exact: true }).click();
  await page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Delete category" }).click();
  await expect(filters.getByRole("button", { name, exact: true })).toHaveCount(0);
});
