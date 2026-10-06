import { expect, test as setup } from "@playwright/test";
import { signIn } from "./helpers";

setup("sign in with an e-mail code", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await signIn(page);
  await expect(page.getByText("KW ")).toBeVisible();
  // Start every test without the persisted data cache (only the session).
  await page.evaluate(() => localStorage.removeItem("ssa:cache"));
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
