import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.describe("app allowlist", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a valid account that is not on ALLOWED_EMAILS is signed out again", async ({ page }) => {
    // dev2@example.com exists in Supabase but is not in ALLOWED_EMAILS (.env.local).
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("dev2@example.com");
    const since = Date.now();
    await page.getByRole("button", { name: "Send me a code" }).click();
    const { waitForCode } = await import("./helpers");
    await page.getByLabel("Code").fill(await waitForCode("dev2@example.com", since));
    await expect(page).toHaveURL(/\/login\?error=not_allowed/);
    await expect(page.getByText("not allowed")).toBeVisible();
    // The session cookie was removed: protected pages still redirect.
    await page.goto("/shopping");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("passkeys: register on this device, then sign in with it", async ({ page, context }) => {
  await mockWeather(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: "Add a passkey for this device" }).click();
  await expect(page.getByText("Passkey added")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove passkey" }).first()).toBeVisible();

  // Sign out and back in with the passkey only.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await expect(page.getByText("KW ")).toBeVisible();

  // Clean up so the next run starts fresh, and refresh the shared session file.
  await page.goto("/settings");
  const remove = page.getByRole("button", { name: "Remove passkey" });
  while ((await remove.count()) > 0) {
    await remove.first().click();
    await page.waitForTimeout(400);
  }
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});

test("planner on a touch screen: press and hold to move, swipe to scroll", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    hasTouch: true,
    viewport: { width: 1280, height: 900 },
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  await mockWeather(page);
  await page.goto("/planner?day=2030-01-08");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Clear this day" }).click();

  await page.getByRole("button", { name: "Add a block" }).click({ position: { x: 200, y: 9 * 64 + 5 } });
  await page.getByLabel("What").fill("Touch block");
  await page.getByRole("button", { name: "Add to plan" }).click();
  const block = page.locator('[role="button"]', { hasText: "Touch block" }).first();
  await expect(block).toContainText("09:00 – 10:00");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.waitForTimeout(300);

  const cdp = await context.newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });

  // A quick swipe over the block scrolls the timeline and leaves the block alone.
  let b = (await block.boundingBox())!;
  const scroller = page.locator("div.overflow-y-auto", { has: block }).first();
  const before = await scroller.evaluate((el) => el.scrollTop);
  await touch("touchStart", b.x + 60, b.y + 20);
  for (let i = 1; i <= 6; i++) await touch("touchMove", b.x + 60, b.y + 20 - i * 25);
  await touch("touchEnd", 0, 0);
  await page.waitForTimeout(400);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  await expect(block).toContainText("09:00 – 10:00");

  // Press and hold, then drag down by two hours.
  b = (await block.boundingBox())!;
  await touch("touchStart", b.x + 60, b.y + 20);
  await page.waitForTimeout(450);
  for (let i = 1; i <= 16; i++) await touch("touchMove", b.x + 60, b.y + 20 + i * 8);
  await touch("touchEnd", 0, 0);
  await expect(block).toContainText("11:00 – 12:00");
  await context.close();
});
