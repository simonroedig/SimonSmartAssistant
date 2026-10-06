import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("protected pages redirect to the login and keep the target", async ({ page }) => {
    await page.goto("/planner?day=2030-01-07");
    await expect(page).toHaveURL(/\/login\?next=%2Fplanner/);
    await expect(page.getByRole("heading", { name: "Smart Assistant" })).toBeVisible();
  });

  test("unknown e-mails get no code", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("stranger@example.com");
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByText("This e-mail address is not registered")).toBeVisible();
  });

  test("api routes answer 401 instead of data", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(401);
    const keepalive = await request.get("/api/keepalive");
    expect(keepalive.status()).toBe(401);
  });

  test("responses carry strict security headers", async ({ request }) => {
    const res = await request.get("/login");
    const headers = res.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-robots-tag"]).toContain("noindex");
  });
});
