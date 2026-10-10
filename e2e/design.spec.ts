import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test("designs: pick one in Settings – it restyles the whole app and stays on this device", async ({ page }) => {
  await mockWeather(page);
  await page.goto("/settings");
  const designs = page.getByRole("radiogroup", { name: "Design" });
  // Wait for the picker to render before reading the labels (evaluateAll doesn't retry).
  await expect(designs.getByRole("radio")).toHaveCount(4);
  expect(await designs.getByRole("radio").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))).toEqual(
    ["Aurora", "Tactile", "Block", "Doodle"],
  );
  await expect(designs.getByRole("radio", { name: "Aurora" })).toHaveAttribute("aria-checked", "true");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-design", "aurora");

  // Block: ink outlines on the cards.
  await designs.getByRole("radio", { name: "Block" }).click();
  await expect(html).toHaveAttribute("data-design", "block");
  const card = page.locator("section.glass").first();
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");

  // The samples keep their own look whatever the page uses.
  const sample = designs.locator('[data-design="tactile"] .glass');
  expect(await sample.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("2px");

  // Applied before the first paint after a reload, and in another section too.
  await page.goto("/shopping");
  await expect(html).toHaveAttribute("data-design", "block");
  expect(
    await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content")),
  ).toMatch(/^#(fff4e0|2b2933)$/);

  // Back to Aurora.
  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Design" }).getByRole("radio", { name: "Aurora" }).click();
  await expect(html).toHaveAttribute("data-design", "aurora");
});
