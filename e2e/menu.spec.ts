import { expect, type Page, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

/** Runs `action` and waits until the change it makes has been written. */
async function saved(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() !== "GET",
  );
  await action();
  await response;
}

async function openSettings(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() === "GET",
  );
  await page.goto("/settings");
  await loaded;
}

const labels = (page: Page, nav: "first" | "last") =>
  page.getByRole("navigation", { name: "Main" })[nav]().getByRole("link").allInnerTexts();

test("menu: the order of the phone's tab bar and of the side bar is set in Settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSettings(page);
  const phone = page.getByRole("group", { name: "Phone tab bar" });

  // Default: Shopping, Backlog | Home | Planner, Notes.
  await expect.poll(() => labels(page, "last")).toEqual(["Shopping", "Backlog", "Home", "Planner", "Notes"]);

  // Tap two to swap them.
  await phone.getByRole("button", { name: "Shopping" }).click();
  await expect(phone.getByRole("button", { name: "Shopping" })).toHaveAttribute("aria-pressed", "true");
  await saved(page, () => phone.getByRole("button", { name: "Notes" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Notes", "Backlog", "Home", "Planner", "Shopping"]);

  // The server already renders the new order (no jump while loading).
  const html = await (await page.request.get("/notes")).text();
  const tabbar = html.slice(html.indexOf("data-tabbar"));
  expect(tabbar.indexOf(">Notes<")).toBeLessThan(tabbar.indexOf(">Shopping<"));

  // Home on the left.
  await saved(page, () => page.getByRole("radio", { name: "Home on the left" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Home", "Notes", "Backlog", "Planner", "Shopping"]);
  await saved(page, () => page.getByRole("radio", { name: "Home in the middle" }).click());

  // Back to the default.
  await phone.getByRole("button", { name: "Notes" }).click();
  await saved(page, () => phone.getByRole("button", { name: "Shopping" }).click());
  await expect.poll(() => labels(page, "last")).toEqual(["Shopping", "Backlog", "Home", "Planner", "Notes"]);

  // Attached to the screen edges, then floating again (as wide as the cards).
  const bar = page.locator("[data-tabbar]");
  await saved(page, () => page.getByRole("radio", { name: "Attached" }).click());
  await expect(bar).toHaveAttribute("data-attached", "");
  expect((await bar.boundingBox())!.width).toBe(390);
  await saved(page, () => page.getByRole("radio", { name: "Floating" }).click());
  await expect(bar).not.toHaveAttribute("data-attached");
  expect((await bar.boundingBox())!.width).toBe(390 - 2 * 16);

  // The side bar of PC and wall display has its own order; Home stays on top.
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = page.getByRole("group", { name: "Side bar" });
  await expect(rail.getByRole("button", { name: "Home (stays in place)" })).toBeDisabled();
  await rail.getByRole("button", { name: "Planner" }).click();
  await saved(page, () => rail.getByRole("button", { name: "Weather" }).click());
  await expect
    .poll(() => labels(page, "first"))
    .toEqual(["Home", "Weather", "Shopping", "Backlog", "Notes", "Planner", "Settings"]);
  await rail.getByRole("button", { name: "Weather" }).click();
  await saved(page, () => rail.getByRole("button", { name: "Planner" }).click());
  await expect
    .poll(() => labels(page, "first"))
    .toEqual(["Home", "Planner", "Shopping", "Backlog", "Notes", "Weather", "Settings"]);
});
