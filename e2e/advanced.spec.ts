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

  test("a requested code is still waiting after switching to the mail app and back (page reloaded)", async ({
    page,
  }) => {
    const { waitForCode } = await import("./helpers");
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("dev@example.com");
    const since = Date.now();
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByLabel("Code")).toBeVisible();
    const code = await waitForCode("dev@example.com", since);

    // Back from the mail app, the page (or the whole launcher) was reloaded: still the code step.
    await page.reload();
    await expect(page.getByLabel("Code")).toBeVisible();
    await expect(page.getByText("dev@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeVisible();
    await page.getByLabel("Code").fill(code);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    // Signed in, the waiting code is forgotten: the next sign-in starts with the e-mail.
    expect(await page.evaluate(() => localStorage.getItem("ssa:pending-code"))).toBeNull();
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
  // Earlier runs leave passkeys behind and Supabase caps them per user.
  const removeButtons = page.getByRole("button", { name: "Remove passkey" });
  await expect(page.getByRole("button", { name: "Add a passkey for this device" })).toBeVisible();
  while ((await removeButtons.count()) > 0) {
    const before = await removeButtons.count();
    await removeButtons.first().click();
    await expect(removeButtons).toHaveCount(before - 1);
  }
  await page.getByRole("button", { name: "Add a passkey for this device" }).click();
  await expect(page.getByText("Passkey added")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove passkey" }).first()).toBeVisible();

  // Sign out and back in with the passkey only.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await expect(page.getByText(/^Week \d+$/)).toBeVisible();

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
  // Let the swipe's momentum scrolling come to rest, then bring the block back to the middle (away from
  // the edges, where holding it would scroll the timeline), and let that settle too.
  const settle = () =>
    expect
      .poll(async () => {
        const top = await scroller.evaluate((el) => el.scrollTop);
        await page.waitForTimeout(200);
        return top === (await scroller.evaluate((el) => el.scrollTop));
      })
      .toBe(true);
  await settle();
  await block.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle();

  // Press and hold until the block is picked up, then drag down by two hours.
  b = (await block.boundingBox())!;
  const held = page.locator("[data-dragging]", { has: block });
  await touch("touchStart", b.x + 60, b.y + 20);
  await expect(held).toHaveCount(1);
  for (let i = 1; i <= 16; i++) await touch("touchMove", b.x + 60, b.y + 20 + i * 8);
  // Still held: the block shows where it would land; letting go puts it there.
  await expect(block).toContainText("11:00 – 12:00");
  await touch("touchEnd", 0, 0);
  await expect(held).toHaveCount(0);
  await expect(block).toContainText("11:00 – 12:00");

  // The edges too: a swipe that starts on one scrolls and leaves the time alone …
  await settle();
  const edge = (side: "start" | "end") => block.locator(`xpath=..`).locator(`[data-resize="${side}"]`);
  let e = (await edge("end").boundingBox())!;
  const beforeEdgeSwipe = await scroller.evaluate((el) => el.scrollTop);
  await touch("touchStart", e.x + 40, e.y + e.height / 2);
  for (let i = 1; i <= 6; i++) await touch("touchMove", e.x + 40, e.y + e.height / 2 - i * 25);
  await touch("touchEnd", 0, 0);
  await page.waitForTimeout(400);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(beforeEdgeSwipe);
  await expect(block).toContainText("11:00 – 12:00");
  await settle();
  await block.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle();
  // … while press and hold, then drag, changes the end – or the start.
  for (const [side, dy, text] of [
    ["end", 8, "11:00 – 12:30"],
    ["start", -8, "10:30 – 12:30"],
  ] as const) {
    e = (await edge(side).boundingBox())!;
    const y0 = e.y + e.height / 2;
    await touch("touchStart", e.x + 40, y0);
    await expect(held).toHaveCount(1);
    for (let i = 1; i <= 4; i++) await touch("touchMove", e.x + 40, y0 + i * dy);
    await touch("touchEnd", 0, 0);
    await expect(held).toHaveCount(0);
    await expect(block).toContainText(text);
  }

  // Empty space: a quick swipe scrolls; press and hold, then drag, draws a new block.
  await settle();
  // 13:00 at the top of the timeline, so the drawing stays clear of its scrolling edges.
  await scroller.evaluate((el) => (el.scrollTop = 13 * 64));
  await settle();
  const surface = page.getByRole("button", { name: "Add a block" });
  const area = (await surface.boundingBox())!;
  const startY = area.y + 14 * 64 + 3; // 14:00
  await touch("touchStart", area.x + 200, startY);
  await page.waitForTimeout(450);
  await expect(page.locator("[data-drawing]")).toHaveCount(1);
  for (let i = 1; i <= 8; i++) await touch("touchMove", area.x + 200, startY + i * 12);
  await expect(page.locator("[data-drawing]")).toHaveText("14:00 – 15:30");
  await touch("touchEnd", 0, 0);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Start: 14:00" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "End: 15:30" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await context.close();
});
