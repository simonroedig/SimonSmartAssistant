import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("mind: a reminder as a card – marked words, the one for today, change and delete it", async ({ page }) => {
  await page.goto("/mind");
  const stamp = Date.now() % 100000;
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabs.getByRole("link", { name: "Mind" })).toBeAttached();

  // +: the text first (ready to type), a title and where it's from; a preview below.
  await page.getByRole("button", { name: "New reminder" }).click();
  const sheet = page.getByRole("dialog", { name: "New reminder" });
  await expect(sheet.getByLabel("The reminder")).toBeFocused();
  await page.keyboard.type(`Small steps ==still count ${stamp}==. Keep going.`);
  await sheet.getByLabel("Title (if any)").fill(`Small steps ${stamp}`);
  await sheet.getByLabel("From (if you like)").fill("A good book");
  await expect(sheet.locator("mark")).toHaveText(`still count ${stamp}`);
  expect(await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // In the list, marked like a highlighter, with who said it.
  const card = page.getByRole("button", { name: new RegExp(`^Small steps ${stamp}`) }).last();
  await expect(card).toBeVisible();
  await expect(card.locator("mark")).toHaveText(`still count ${stamp}`);
  await expect(card).toContainText("— A good book");
  await expect(page.getByText(/^(For today|Another one)$/)).toBeVisible();

  // A tap opens it to change; closing saves.
  await card.click();
  const edit = page.getByRole("dialog", { name: "Reminder" });
  await edit.getByLabel("Title (if any)").fill(`Tiny steps ${stamp}`);
  await page.keyboard.press("Escape");
  const changed = page.getByRole("button", { name: new RegExp(`^Tiny steps ${stamp}`) }).last();
  await expect(changed).toBeVisible();

  // Deleted – with a way back.
  await changed.click();
  await page.getByRole("dialog", { name: "Reminder" }).getByRole("button", { name: "Delete this reminder" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Tiny steps ${stamp}`) })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^Tiny steps ${stamp}`) }).last()).toBeVisible();
});

test("mind: several pasted at once – cards and a video; videos open where they play", async ({ page }) => {
  await page.goto("/mind");
  const stamp = Date.now() % 100000;
  await page.getByRole("button", { name: "Add several at once" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Add several at once" });
  await sheet
    .getByLabel("Reminders and videos to add")
    .fill(
      [
        `# Two ways ${stamp}`,
        "Plans change… 😔",
        "Plans change!!! 😄",
        "— A friend",
        "---",
        `Rest is part of the work ${stamp}.`,
        "---",
        `# A calm view ${stamp}`,
        "https://youtu.be/abcDEF12345",
      ].join("\n"),
    );
  await sheet.getByRole("button", { name: "Add 2 reminders and 1 video" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: new RegExp(`^Two ways ${stamp}`) }).last()).toContainText(
    "— A friend",
  );

  // Videos: a sideways swipe away (or the chip); YouTube shows its still, a tap plays it.
  await page.getByRole("tab", { name: /Videos/ }).click();
  const video = page.getByRole("link", { name: new RegExp(`A calm view ${stamp}`) });
  await expect(video).toHaveAttribute("href", "https://youtu.be/abcDEF12345");
  await expect(video).toHaveAttribute("target", "_blank");
  await expect(video.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg");

  // A shared text with a link in it is enough; something without one isn't kept – and says so.
  await page.getByRole("button", { name: "Pin a video" }).click();
  const pin = page.getByRole("dialog", { name: "Pin a video" });
  await pin.getByLabel("Link").fill(`Look at this! https://vm.tiktok.com/ZSexample1/ ${stamp}`);
  await expect(pin.getByText("TikTok · opens in its app or the browser")).toBeVisible();
  await pin.getByLabel("Title").fill(`A calm talk ${stamp}`);
  await pin.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`A calm talk ${stamp}`) })).toHaveAttribute(
    "href",
    "https://vm.tiktok.com/ZSexample1/",
  );
  await page.getByRole("button", { name: "Pin a video" }).click();
  await pin.getByLabel("Link").fill("not a link");
  await expect(pin.getByText("No link in it yet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Not saved – there's no link in it")).toBeVisible();

  // Tidy up the video (its edit button).
  await page.getByRole("button", { name: `Edit A calm view ${stamp}` }).click();
  await page.getByRole("dialog", { name: "Video" }).getByRole("button", { name: "Delete this video" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`A calm view ${stamp}`) })).toHaveCount(0);
});

test("mind: Let go – + for a situation, check it off, the done ones as a list (not in Notes any more)", async ({
  page,
}) => {
  await page.goto("/mind?tab=letgo");
  const stamp = Date.now() % 100000;
  await expect(page.getByRole("tab", { name: /Let go/ })).toHaveAttribute("aria-selected", "true");

  // + : the questions in a sheet, the first one ready to type into.
  await page.getByRole("button", { name: "New situation" }).click();
  const sheet = page.getByRole("dialog", { name: "New situation" });
  await expect(sheet.getByLabel("What happened?")).toBeFocused();
  const situation = `Awkward handshake ${stamp}`;
  await page.keyboard.type(situation);
  await sheet.getByRole("group", { name: "Is there anything left to do?" }).getByRole("button", { name: "No" }).click();
  await expect(sheet.getByText("only going round in circles")).toBeVisible();
  await sheet.getByLabel("What would I tell a friend?").fill("Nobody remembers a handshake.");

  // Let it go: it lands in the list of done ones; a tap shows it again.
  await sheet.getByRole("button", { name: "Let it go" }).click();
  await expect(sheet).toBeHidden();
  const done = page.getByRole("button", { name: new RegExp(situation) });
  await expect(done).toBeVisible();
  await expect(page.getByRole("heading", { name: /Let go · \d+/ })).toBeVisible();
  await done.click();
  const read = page.getByRole("dialog", { name: "Let go" });
  await expect(read.getByLabel("What would I tell a friend?")).toHaveValue("Nobody remembers a handshake.");
  await page.keyboard.press("Escape");

  // One written and closed: it's open – the circle checks it off right there.
  const next = `Said something odd ${stamp}`;
  await page.getByRole("button", { name: "New situation" }).click();
  await page.keyboard.type(next);
  await page.keyboard.press("Escape");
  const check = page.getByRole("button", { name: `Let it go: ${next}` });
  await expect(check).toBeVisible();
  await check.click();
  await expect(check).toHaveCount(0);

  // Notes has no trace of it: no tile, nothing "special" to make there.
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Let go/ })).toHaveCount(0);
  await page.getByRole("button", { name: "New category" }).click();
  await expect(page.getByText("Or something special")).toHaveCount(0);
});
