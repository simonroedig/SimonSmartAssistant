import { expect, test } from "@playwright/test";
import { mockWeather } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test("mind: a reminder as a card – highlighted and italic words, today's on a stack to flip through, change and delete it", async ({ page }) => {
  await page.goto("/mind");
  const stamp = Date.now() % 100000;
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabs.getByRole("link", { name: "Mind" })).toBeAttached();

  // +: the text first (ready to type), a title and where it's from; a preview below.
  await page.getByRole("button", { name: "New reminder" }).click();
  const sheet = page.getByRole("dialog", { name: "New reminder" });
  await expect(sheet.getByLabel("The reminder")).toBeFocused();
  await page.keyboard.type(`Small steps ==still count ${stamp}==. *Keep going.*`);
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
  await expect(card.locator("em")).toHaveText("Keep going.");
  await expect(card).toContainText("— A good book");

  // A second one, so there is a stack to flip through.
  await page.getByRole("button", { name: "New reminder" }).click();
  await page.keyboard.type(`Breathe out ${stamp}.`);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: new RegExp(`^Breathe out ${stamp}`) }).last()).toBeVisible();

  // On top: today's, on a stack – swiped aside (or the arrows), the next one comes up.
  // Each card has its number (the newest the highest): today's says which one it is.
  const deckTitle = page.getByText(/^For today · No\. \d+ · \w{3} \d+ \w{3}$/);
  await expect(deckTitle).toBeVisible();
  const top = page.locator("[data-swipe] .z-10").first();
  const box = (await top.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  for (const dx of [20, 60, 120, 180, 240]) await page.mouse.move(box.x + box.width / 2 - dx, box.y + 40);
  await page.mouse.up();
  await expect(page.getByText(/^2 of \d+$/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Previous reminder" }).click();
  await expect(deckTitle).toBeVisible();
  await page.getByRole("button", { name: "Next reminder" }).click();
  await expect(page.getByText(/^2 of \d+$/)).toBeVisible();
  await page.getByRole("button", { name: "Today's" }).click();
  await expect(deckTitle).toBeVisible();

  // Scrolled down, the next tab still starts at its top.
  const scroller = page.locator(".max-md\\:overflow-y-auto").first();
  await scroller.evaluate((el) => (el.scrollTop = 400));
  await page.getByRole("tab", { name: /Videos/ }).click();
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("tab", { name: /Reminders/ }).click();

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

test("mind: pinned videos – YouTube with its still, a shared TikTok text; they open where they play", async ({
  page,
}) => {
  await page.goto("/mind");
  const stamp = Date.now() % 100000;
  // Videos: a sideways swipe away (or the chip); YouTube shows its still, a tap plays it.
  await page.getByRole("tab", { name: /Videos/ }).click();
  await page.getByRole("button", { name: "Pin a video" }).click();
  const add = page.getByRole("dialog", { name: "Pin a video" });
  await add.getByLabel("Link").fill("https://youtu.be/abcDEF12345");
  await add.getByLabel("Title").fill(`A calm view ${stamp}`);
  await page.keyboard.press("Escape");
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
  await page.goto("/mind?tab=videos");
  const stamp = Date.now() % 100000;
  await expect(page.getByRole("button", { name: "Pin a video" })).toBeVisible();
  const plus = (await page.getByRole("button", { name: "Pin a video" }).boundingBox())!;
  // Its + sits where the others' does – right away, not sliding in with the content.
  await page.getByRole("tab", { name: /Let go/ }).click();
  const fab = (await page.getByRole("button", { name: "New situation" }).boundingBox())!;
  expect(Math.abs(fab.y - plus.y)).toBeLessThan(2);
  expect(Math.abs(fab.x - plus.x)).toBeLessThan(2);

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

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("mind: swipe after swipe flips the cards – every one counts, also with long texts", async ({ page }) => {
    await page.goto("/mind");
    const stamp = Date.now() % 100000;
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "New reminder" }).click();
      // Long enough that the card's text box scrolls.
      await page.keyboard.type(`Swipe ${i} ${stamp} ` + "quiet words ".repeat(60));
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: new RegExp(`^Swipe ${i} ${stamp}`) }).last()).toBeVisible();
    }
    const total = Number(/\d+/.exec((await page.getByRole("heading", { name: /^All reminders/ }).textContent())!)![0]);
    const cdp = await page.context().newCDPSession(page);
    for (let n = 2; n <= 4; n++) {
      const box = (await page.locator("[data-swipe] .z-10:not(.pointer-events-none)").boundingBox())!;
      const [x, y] = [box.x + box.width * 0.75, box.y + box.height / 2];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let k = 1; k <= 8; k++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - k * 30, y: y + k }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(page.getByText(new RegExp(`^${n} of ${total}$`))).toBeVisible();
    }
    await expect(page.getByRole("tab", { name: /Reminders/ })).toHaveAttribute("aria-selected", "true");
  });
});
