import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

/** The vault PIN of dev@example.com (the integration tests leave it set to this). */
const PIN = "2468";

/** Opens Settings once its values are there (a choice made before would not be saved). */
async function openSettings(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() === "GET",
  );
  await page.goto("/settings");
  await loaded;
}

/** Picks a count and waits until it is written. */
async function pickCount(page: Page, group: string, option: string) {
  const saved = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() !== "GET",
  );
  await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: option }).click();
  await saved;
}

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).first();

test("backup: everything in one file, the vault included – and when it was made", async ({ page }) => {
  await mockWeather(page);
  const marker = `Backup marker ${Date.now() % 100000}`;
  await page.goto("/shopping");
  await page.getByLabel("New shopping item").fill(marker);
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(marker).first()).toBeVisible();

  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  // The vault's notes only come along with the PIN.
  const dialog = page.getByRole("dialog");
  if (
    await dialog
      .getByLabel("PIN", { exact: true })
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await dialog.getByLabel("PIN", { exact: true }).fill(PIN);
  }
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^smart-assistant-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(backup.app).toBe("smart-assistant");
  expect(backup.vault_included).toBe(true);
  expect(Object.keys(backup.tables)).toEqual(
    expect.arrayContaining(["notes", "todos", "plan_blocks", "shopping_items"]),
  );
  expect(backup.tables.shopping_items.some((i: { name: string }) => i.name === marker)).toBe(true);

  // It says when, and the menu's Settings icon has no "due" dot any more.
  await expect(page.getByText(/^Last backup: \w+day, \d+ \w+ \d{4}$/)).toBeVisible();
  await expect(page.getByText(/^Downloaded: /)).toBeVisible();
  await expect(menu(page).locator('[data-hint="due"]')).toHaveCount(0);
});

test("menu icons: a quiet count – always or from the chosen number on – and a star for starred backlog items", async ({
  page,
}) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // Shopping: from 3 items on.
  await openSettings(page);
  await pickCount(page, "Shopping count", "3+");
  await page.goto("/shopping");
  for (let i = 0; i < 3; i++) {
    const name = `Count ${i} ${Date.now() % 100000}`;
    await page.getByLabel("New shopping item").fill(name);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  const shopping = menu(page).getByRole("link", { name: "Shopping" });
  await expect(shopping.locator('[data-hint="count"]')).toHaveAttribute("data-count", /^\d+\+?$/);
  // Off: no number.
  await openSettings(page);
  await pickCount(page, "Shopping count", "Off");
  await expect(menu(page).getByRole("link", { name: "Shopping" }).locator('[data-hint="count"]')).toHaveCount(0);

  // Backlog: a starred item shows as a small star on the icon.
  await page.goto("/todos");
  const title = `Important ${Date.now() % 100000}`;
  await page.getByLabel("New todo").fill(title);
  await page.keyboard.press("Enter");
  const item = page.getByRole("listitem").filter({ hasText: title });
  await item.getByRole("button", { name: "Star" }).click();
  await expect(item.getByRole("button", { name: "Remove star" })).toBeVisible();
  await expect(menu(page).getByRole("link", { name: "Backlog" }).locator('[data-hint="star"]')).toBeVisible();
  await item.getByRole("button", { name: "Remove star" }).click();

  // Always: the number is there whatever it is – 0 too.
  await openSettings(page);
  await pickCount(page, "Shopping count", "Always");
  await expect(menu(page).getByRole("link", { name: "Shopping" }).locator('[data-hint="count"]')).toHaveAttribute(
    "data-count",
    /^\d\+?$/,
  );
  // Back to the default: from 1 on.
  await pickCount(page, "Shopping count", "1+");
  await expect(menu(page).getByRole("link", { name: "Shopping" }).locator('[data-hint="count"]')).toHaveAttribute(
    "data-count",
    /^[1-9]\+?$/,
  );
});
