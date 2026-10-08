import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

function dayKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const dayChips = (page: Page) => page.getByRole("list", { name: "Holidays and birthdays", exact: true });

/** Opens a planner day until the expected chip shows (changes are saved in the background). */
async function expectChip(page: Page, day: string, text: string) {
  await expect
    .poll(async () => {
      await openFresh(page, `/planner?day=${day}`);
      return (await dayChips(page).count()) ? dayChips(page).innerText() : "";
    })
    .toContain(text);
}

/** Opens a page once settings and birthdays are fresh from the server (this device's cache may be older). */
async function openFresh(page: Page, path: string, tables = ["user_settings", "birthdays"]) {
  const loaded = tables.map((table) =>
    page.waitForResponse((r) => r.url().includes(`/rest/v1/${table}`) && r.request().method() === "GET"),
  );
  await page.goto(path).catch(() => undefined);
  await Promise.all(loaded);
  await page.waitForTimeout(150);
}

/** Settings, once they are loaded (changes before that would be lost). */
async function openSettings(page: Page) {
  await openFresh(page, "/settings");
}

/** Runs `action` and waits until the change it makes has been written. */
async function saved(page: Page, table: string, action: () => Promise<unknown>) {
  const response = page.waitForResponse((r) => r.url().includes(`/rest/v1/${table}`) && r.request().method() !== "GET");
  await action();
  await response;
}

test("holidays: shown in the planner with what they mean for the shops, per state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSettings(page);
  // Start from Bavaria with holidays on (an earlier run may have left something else).
  const state = page.getByLabel("State for public holidays");
  const show = page.getByRole("switch", { name: "Show holidays" });
  if ((await show.getAttribute("aria-checked")) !== "true") await saved(page, "user_settings", () => show.click());
  await saved(page, "user_settings", () => state.selectOption("BE"));
  await saved(page, "user_settings", () => state.selectOption("BY"));

  await expectChip(page, "2030-10-03", "German Unity Day");
  await expect(dayChips(page)).toContainText("Shops closed");
  // The month calendar lists the month's holidays and colours the day.
  await expect(page.getByRole("list", { name: "Holidays and birthdays this month" })).toContainText("German Unity Day");
  await expect(page.getByRole("button", { name: /^Thursday, 3 October · German Unity Day/ }).first()).toBeVisible();

  // Repentance Day: no public holiday in Bavaria – no school, but the shops are open.
  await expectChip(page, "2030-11-20", "Repentance Day");
  await expect(dayChips(page)).toContainText("No school · shops open");
  await page.goto("/planner?day=2030-10-31");
  await expect(dayChips(page)).toHaveCount(0);

  // Hamburg has Reformation Day.
  await openSettings(page);
  await saved(page, "user_settings", () => state.selectOption("HH"));
  await expectChip(page, "2030-10-31", "Reformation Day");

  // Back to Bavaria; switched off, nothing shows.
  await openSettings(page);
  await saved(page, "user_settings", () => state.selectOption("BY"));
  await saved(page, "user_settings", () => page.getByRole("switch", { name: "Show holidays" }).click());
  await expect
    .poll(async () => {
      await openFresh(page, "/planner?day=2030-10-03");
      return dayChips(page).count();
    })
    .toBe(0);
  await openSettings(page);
  await saved(page, "user_settings", () => page.getByRole("switch", { name: "Show holidays" }).click());
  await expectChip(page, "2030-10-03", "German Unity Day");
});

test("birthdays: a simple list in Settings, shown in the planner with the age", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const name = `Anna ${Date.now() % 10000}`;

  await openSettings(page);
  await page.getByRole("button", { name: "Add birthday" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Day").selectOption(String(tomorrow.getDate()));
  await dialog.getByLabel("Month").selectOption(String(tomorrow.getMonth() + 1));
  await dialog.getByLabel("Year (optional)").fill(String(tomorrow.getFullYear() - 30));
  await expect(dialog).toContainText("turns 30");
  await saved(page, "birthdays", () => dialog.getByRole("button", { name: "Save" }).click());
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(300); // let the closed sheet give its history entry back
  const row = page.getByRole("button", { name: `Edit ${name}` });
  await expect(row).toContainText("Tomorrow");
  await expect(row).toContainText("turns 30");

  // The planner shows it on the day, the week strip marks the day.
  await expectChip(page, dayKeyOf(tomorrow), `${name} turns 30`);
  await expect(page.getByRole("button", { name: new RegExp(`${name} turns 30`) }).first()).toBeVisible();

  // Without the year it's just the birthday.
  await openSettings(page);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await dialog.getByLabel("Year (optional)").fill("");
  await saved(page, "birthdays", () => dialog.getByRole("button", { name: "Save" }).click());
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(300); // let the closed sheet give its history entry back
  await expectChip(page, dayKeyOf(tomorrow), `${name}'s birthday`);

  // Delete it again.
  await openSettings(page);
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await saved(page, "birthdays", () => dialog.getByRole("button", { name: "Delete birthday" }).click());
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toHaveCount(0);
});
