import { expect, type Page, test } from "@playwright/test";
import { mockWeather, waitForCode } from "./helpers";

/** The vault PIN of dev@example.com (the integration tests leave it set to this). */
const PIN = "2468";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

const filters = (page: Page) => page.getByRole("group", { name: "Filter notes" });

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

  // A note written here goes into it; no tag needed while the page shows only this category.
  const text = `Quarterly report ${Date.now() % 100000}`;
  await page.getByLabel("New note").fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  const card = page.getByRole("button", { name: `Open note "${text}"` });
  await expect(card).toBeVisible();
  await expect(card.getByText(name)).toHaveCount(0);

  // Under All it carries the category as a tag.
  await filters(page).getByRole("button", { name: "All", exact: true }).click();
  await expect(card.getByText(name)).toBeVisible();

  // In the editor the category can be taken off again (tap it once more).
  await card.click();
  const editor = page.getByRole("dialog");
  const picked = editor.getByRole("group", { name: "Category" }).getByRole("button", { name, exact: true });
  await expect(picked).toHaveAttribute("aria-pressed", "true");
  await picked.click();
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(card.getByText(name)).toHaveCount(0);

  // Rename it (the pencil next to a picked category), then delete it.
  await chip.click();
  await filters(page)
    .getByRole("button", { name: `Edit ${name}` })
    .click();
  await sheet.getByLabel("Category name").fill(`${name} new`);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(filters(page).getByRole("button", { name: `${name} new`, exact: true })).toBeVisible();
  await filters(page)
    .getByRole("button", { name: `Edit ${name} new` })
    .click();
  await sheet.getByRole("button", { name: "Delete category" }).click();
  await expect(filters(page).getByRole("button", { name: `${name} new`, exact: true })).toHaveCount(0);
  await expect(filters(page).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Its notes stay.
  await expect(card).toBeVisible();
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
