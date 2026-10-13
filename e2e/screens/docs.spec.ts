import { test } from "@playwright/test";
import { mockWeather } from "../helpers";

// Screenshots for the README, with the demo content:
//   node scripts/seed-demo.mjs && DOCS_SCREENSHOTS=1 npx playwright test e2e/screens/docs.spec.ts
test.skip(!process.env.DOCS_SCREENSHOTS, "set DOCS_SCREENSHOTS=1 to refresh docs/screenshots");

const shots: { name: string; path: string; width: number; height: number; theme: string; scale?: number }[] = [
  { name: "wall-dark", path: "/", width: 1920, height: 1080, theme: "dark", scale: 1.1 },
  { name: "wall-light", path: "/", width: 1920, height: 1080, theme: "light", scale: 1.1 },
  { name: "planner", path: "/planner", width: 1600, height: 1000, theme: "dark" },
  { name: "notes", path: "/notes", width: 1600, height: 1000, theme: "light" },
  { name: "weather", path: "/weather", width: 1600, height: 1000, theme: "light" },
  { name: "phone-home", path: "/", width: 390, height: 844, theme: "dark" },
  { name: "phone-planner", path: "/planner", width: 390, height: 844, theme: "light" },
  { name: "phone-shopping", path: "/shopping", width: 390, height: 844, theme: "dark" },
  { name: "phone-notes", path: "/notes", width: 390, height: 844, theme: "light" },
];

for (const shot of shots) {
  test(shot.name, async ({ page }) => {
    // Mid-morning, so the plan shows what's done, what's now and what's next.
    const now = new Date();
    now.setHours(10, 24, 0, 0);
    await page.clock.setFixedTime(now);
    await mockWeather(page);
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.addInitScript(
      ({ theme, scale }) => localStorage.setItem("ssa:device", JSON.stringify({ theme, scale: scale ?? 1 })),
      { theme: shot.theme, scale: shot.scale },
    );
    await page.goto(shot.path);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `docs/screenshots/${shot.name}.png` });
  });
}
