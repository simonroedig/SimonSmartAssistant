import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test("back from standby: a save waits for the sign-in to be renewed – nothing is turned down or lost", async ({
  page,
}) => {
  await mockWeather(page);
  await page.clock.install();
  const loaded = page.waitForResponse(/\/rest\/v1\/shopping_items/);
  await page.goto("/shopping");
  const input = page.getByLabel("New shopping item");
  await expect(input).toBeVisible();
  await loaded;

  // Hours later the sign-in has run out, and the network isn't back yet: renewing it fails.
  let offline = true;
  await page.route("**/auth/v1/token?grant_type=refresh_token", (route) =>
    offline ? route.abort("internetdisconnected") : route.continue(),
  );
  await page.clock.fastForward("02:00:00");

  const name = `After standby ${Date.now() % 100000}`;
  await input.fill(name);
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(name)).toBeVisible();
  // The sign-in library gives up after 30 s and then waits a minute before trying again –
  // the network is back meanwhile.
  await page.clock.fastForward("00:00:35");
  await page.waitForTimeout(500);
  offline = false;
  for (let i = 0; i < 6; i++) {
    await page.clock.fastForward("00:00:20");
    await page.waitForTimeout(400);
  }

  // Saved after all, without an error on the way – and still there after a reload.
  await expect(page.getByText(/Couldn't/)).toHaveCount(0);
  await expect(page.getByText(name)).toBeVisible();
  await page.reload();
  await expect(page.getByText(name)).toBeVisible();

  // Tidy up.
  await page.locator("li", { hasText: name }).getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Clear" }).click();
});
