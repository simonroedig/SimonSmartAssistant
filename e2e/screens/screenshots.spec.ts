import { expect, test } from "@playwright/test";
import { mockWeather, watchConsole } from "../helpers";

// Visual snapshots for manual review: SCREENSHOTS=1 npx playwright test e2e/screens
const OUT = process.env.SCREENSHOT_DIR ?? "test-results/screens";
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture screenshots");

const pages = ["/", "/planner", "/shopping", "/todos", "/weather", "/settings"];

for (const theme of ["dark", "light"] as const) {
  test(`wall display 1920x1080 ${theme}`, async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockWeather(page);
    await page.addInitScript((t) => {
      localStorage.setItem("ssa:device", JSON.stringify({ theme: t, kiosk: false, scale: 1.1 }));
    }, theme);
    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/kiosk-${theme}${path.replace(/\//g, "_") || "_home"}.png` });
    }
    expect(problems).toEqual([]);
  });
}

test("phone 390x844 dark", async ({ page }) => {
  const problems = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWeather(page);
  await page.addInitScript(() => localStorage.setItem("ssa:device", JSON.stringify({ theme: "dark" })));
  for (const path of pages) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/phone${path.replace(/\//g, "_") || "_home"}.png`, fullPage: path === "/" });
  }
  expect(problems).toEqual([]);
});

test("details: login, editor, keyboard, night mode", async ({ page, browser }) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "ssa:device",
      JSON.stringify({
        theme: "dark",
        kiosk: true,
        keyboard: true,
        scale: 1.1,
        screensaver: "always",
        screensaverDelay: 0,
      }),
    ),
  );

  // Block editor on the wall display.
  await page.goto("/planner");
  await page.getByRole("button", { name: "Add a block" }).click({ position: { x: 300, y: 16 * 64 + 5 } });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/detail-editor-kiosk.png` });
  await page.getByLabel("What").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/detail-editor-keyboard.png` });
  await page.keyboard.press("Escape");

  // Night mode kicks in after the (test) delay.
  await page.goto("/");
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/detail-nightmode.png` });

  // Login screens (signed out).
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] }, colorScheme: "dark" });
  const login = await anon.newPage();
  await login.setViewportSize({ width: 390, height: 844 });
  await login.goto("/login");
  await login.waitForTimeout(500);
  await login.screenshot({ path: `${OUT}/detail-login-phone.png` });
  await anon.close();

  // Phone: block editor as a bottom sheet.
  const phoneCtx = await browser.newContext({
    storageState: "e2e/.auth/user.json",
    viewport: { width: 390, height: 844 },
  });
  const phone = await phoneCtx.newPage();
  await mockWeather(phone);
  await phone.addInitScript(() => localStorage.setItem("ssa:device", JSON.stringify({ theme: "light" })));
  await phone.goto("/planner");
  await phone.getByRole("button", { name: "Add block" }).click();
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: `${OUT}/detail-editor-phone.png` });
  await phoneCtx.close();
});
