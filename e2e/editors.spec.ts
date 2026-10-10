import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("block editor: details under What, a suggestion can be taken back, your own length stays a chip, swipe moves the day", async ({
  page,
}) => {
  await page.goto("/planner?day=2031-03-04");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Clear this day" }).click();
  const gym = `Gym ${Date.now() % 10000}`;
  await page.getByRole("button", { name: "Add a block" }).click({ position: { x: 200, y: 9 * 64 + 5 } });
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What").fill(gym);
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Add block" }).click();
  await expect(dialog.getByRole("heading", { name: "New block" })).toBeVisible();

  // The details sit right under What, before the times.
  const details = dialog.getByLabel("Details");
  expect((await details.boundingBox())!.y).toBeLessThan(
    (await dialog.getByText("Start", { exact: true }).boundingBox())!.y,
  );

  // A suggestion fills in What – and Undo takes it back.
  const what = dialog.getByLabel("What");
  await dialog.getByRole("button", { name: gym }).click();
  await expect(what).toHaveValue(gym);
  await dialog.getByRole("button", { name: "Undo" }).click();
  await expect(what).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Undo" })).toHaveCount(0);

  // An own length (not a quick pick) gets a chip: try 2h, then go back to it.
  await dialog.getByRole("button", { name: "End later" }).click();
  const own = dialog.getByRole("button", { name: /^Your own length/ });
  await expect(own).toBeVisible();
  const end = await dialog.getByRole("button", { name: /^End: / }).getAttribute("aria-label");
  await dialog.getByRole("button", { name: "2h", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^End: / })).not.toHaveAttribute("aria-label", end!);
  await own.click();
  await expect(dialog.getByRole("button", { name: /^End: / })).toHaveAttribute("aria-label", end!);

  // A sideways swipe (finger) moves the block to the next day.
  const day = dialog.getByRole("button", { name: "Pick the day" });
  const before = await day.innerText();
  await dialog.locator("form").evaluate((form) => {
    const box = form.getBoundingClientRect();
    const at = (type: string, x: number) =>
      form.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 7,
          pointerType: "touch",
          clientX: x,
          clientY: box.top + 300,
        }),
      );
    at("pointerdown", box.left + 300);
    at("pointerup", box.left + 120);
  });
  await expect(day).not.toHaveText(before);
  await expect(day).toContainText("5 March");
});

test("note editor: Done once there is text; the whole note can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  await page.getByRole("button", { name: "Take a note…" }).click();
  const dialog = page.getByRole("dialog");
  const done = dialog.getByRole("button", { name: "Done" });
  await expect(done).toBeDisabled();
  await dialog.getByLabel("Title").fill("Only a title");
  await expect(done).toBeDisabled();
  await dialog.getByLabel("Note", { exact: true }).fill("Door code 1234");
  await expect(done).toBeEnabled();

  await dialog.getByRole("button", { name: "Copy note" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("Only a title\n\nDoor code 1234");

  await done.click();
  await expect(dialog).toBeHidden();
  // Clean up.
  await page.getByRole("button", { name: 'Open note "Only a title"' }).first().click();
  await dialog.getByRole("button", { name: "Delete note" }).click();
});
