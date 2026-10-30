import { expect, type Page, test } from "@playwright/test";
import { mockMedia, mockWeather } from "./helpers";

// Example links (answered locally – nothing leaves the test).
const SERIES_A = "https://stream.example/watchseries/bobs-burgers-online-free/season/1/episode/1";
const SERIES_B = "https://stream.example/watchseries/south-park-online-free/season/1/episode/1";
const FILM_A = "https://stream.example/movie/187769-watch-the-substance-2024-online";
const FILM_B = "https://stream.example/movie/53577-watch-american-beauty-1999-online";
const CHANNEL_A = "https://famelack.com/tv/de/first";
const CHANNEL_B = "https://famelack.com/tv/de/second";
const LINK = "https://list.example/";

test.beforeEach(async ({ page, context }) => {
  await mockWeather(page);
  await mockMedia(page);
  // Watching opens the streaming site in a new tab: answered locally too.
  await context.route(/stream\.example|famelack\.com|list\.example/, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Stream</title><p>Playing…</p>" }),
  );
});

const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name });

/** Starts from an empty library: everything in every tab is deleted through the app. */
async function clearMedia(page: Page) {
  await page.goto("/media");
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  for (const name of [/Series/, /Movies/, /Live TV/, /Links/]) {
    await tab(page, name).click();
    for (let i = 0; i < 20; i++) {
      // Series ("Open …"), channels and links ("Edit …"), films (their poster tile).
      const opener = page
        .getByRole("button", { name: /^(Open |Edit )/ })
        .or(page.locator("main .grid > button"))
        .first();
      if ((await opener.count()) === 0) break;
      await opener.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      await dialog.getByRole("button", { name: "Delete for good" }).click();
      await expect(dialog).toHaveCount(0);
    }
  }
}

test("media: a pasted list becomes series, films, live TV and links – each found and filed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearMedia(page);

  await page.getByRole("button", { name: "Add to Media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/Link/)
    .fill(
      [SERIES_A, SERIES_B, FILM_A, FILM_B, `Das Erste ${CHANNEL_A}`, `ZDF ${CHANNEL_B}`, `yarrlist ${LINK}`].join("\n"),
    );
  // Each line is recognised before anything is added.
  for (const [name, kind] of [
    ["Bobs Burgers", "Series"],
    ["The Substance", "Film"],
    ["ZDF", "Live TV"],
    ["yarrlist", "Link"],
  ]) {
    await expect(dialog.getByRole("listitem").filter({ hasText: name })).toContainText(kind);
  }
  await dialog.getByRole("button", { name: "Add 7" }).click();
  await expect(dialog).toHaveCount(0);

  // Series: the real names (from TVmaze), their posters and the first episode to watch.
  await tab(page, /Series/).click();
  const bob = page.locator("article", { hasText: "Bob's Burgers" });
  await expect(bob).toContainText("0 of 30 seen");
  await expect(bob.getByRole("link", { name: "S1 E1" })).toHaveAttribute(
    "href",
    "https://stream.example/watchseries/bobs-burgers-online-free/season/1/episode/1",
  );
  await expect(page.locator("article", { hasText: "South Park" })).toBeVisible();

  // Films (from Wikipedia), live TV and links in their own tabs.
  await tab(page, /Movies/).click();
  await expect(page.getByRole("button", { name: "The Substance" })).toContainText("2024");
  await expect(page.getByRole("button", { name: "American Beauty" })).toContainText("1999");
  await tab(page, /Live TV/).click();
  await expect(page.getByRole("link", { name: /Das Erste/ })).toHaveAttribute("href", CHANNEL_A);
  await expect(page.getByRole("link", { name: /ZDF/ })).toBeVisible();
  await tab(page, /Links/).click();
  await expect(page.getByRole("link", { name: /yarrlist/ })).toHaveAttribute("href", LINK);

  // Pasting one again adds nothing twice.
  await page.getByRole("button", { name: "Add to Media" }).click();
  await dialog.getByLabel(/Link/).fill(`ZDF ${CHANNEL_B}`);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Already there – the link is kept with it")).toBeVisible();
  await tab(page, /Live TV/).click();
  await expect(page.getByRole("link", { name: /ZDF/ })).toHaveCount(1);
});

test("media: watch the next episode, tick it off, catch up on earlier ones – with summaries", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clearMedia(page);
  await page.getByRole("button", { name: "Add to Media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Link/).fill(SERIES_A);
  // The show is looked up and picked by itself.
  await expect(dialog.getByRole("button", { name: /Bob's Burgers/, pressed: true })).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue("Bob's Burgers");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // Watching opens the episode in a new tab; back here, the page asks whether it was seen.
  const card = page.locator("article", { hasText: "Bob's Burgers" });
  const popup = page.waitForEvent("popup");
  await card.getByRole("link", { name: "S1 E1" }).click();
  await (await popup).close();
  await page.getByRole("button", { name: "Seen it" }).click();
  await expect(card).toContainText("1 of 30 seen");
  await expect(card.getByRole("link", { name: "S1 E2" })).toHaveAttribute("href", /season\/1\/episode\/2$/);

  // ✓ on the card marks the next one.
  await card.getByRole("button", { name: "Mark S1 E2 as seen" }).click();
  await expect(card).toContainText("2 of 30 seen");

  // The episode list: summaries open on a tap; ticking a later one offers the ones before.
  await page.getByRole("button", { name: "Open Bob's Burgers" }).click();
  await expect(dialog.getByText("Bob runs Bob's Burgers with his wife and three kids.")).toBeVisible();
  await dialog.getByRole("button", { name: /^E4/ }).click();
  await expect(dialog.getByText("Season 1, episode 4: something & more happens.")).toBeVisible();
  await dialog.getByRole("button", { name: "S1 E5: mark seen" }).click();
  await dialog.getByRole("button", { name: "Mark them too" }).click();
  await expect(dialog.getByRole("button", { name: "S1 E4: mark unseen" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Watch S1 E6" })).toHaveAttribute("href", /season\/1\/episode\/6$/);

  // A whole season at once, and the next one follows.
  await dialog.getByRole("button", { name: "Mark season seen" }).click();
  await expect(dialog.getByRole("link", { name: "Watch S2 E1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(card).toContainText("13 of 30 seen");

  // Another site as a spare: it moves to the front with one tap.
  await page.getByRole("button", { name: "Open Bob's Burgers" }).click();
  await dialog.getByLabel("Add a link").fill("https://other.example/show/bobs-burgers-s01e01");
  await dialog.getByRole("button", { name: "Add the link" }).click();
  await dialog.getByRole("button", { name: "Use other.example first" }).click();
  await expect(dialog.getByRole("link", { name: "Watch S2 E1" })).toHaveAttribute(
    "href",
    "https://other.example/show/bobs-burgers-s02e01",
  );
});

test("media: films are ticked off, and the TV remote moves between them with the arrow keys", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await clearMedia(page);
  await page.getByRole("button", { name: "Add to Media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Link/).fill(FILM_B);
  await expect(dialog.getByLabel("Name")).toHaveValue("American Beauty");
  await dialog.getByRole("switch", { name: "Already seen" }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Add to Media" }).click();
  await dialog.getByLabel(/Link/).fill(FILM_A);
  await expect(dialog.getByLabel("Name")).toHaveValue("The Substance");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "American Beauty (seen)" })).toContainText("Seen");
  // Still to watch comes first.
  const tiles = page.locator("main .grid > button");
  await expect(tiles.first()).toHaveAccessibleName("The Substance");

  // The TV: ?tv=1 turns on the remote; the arrows move the focus from tile to tile.
  await page.goto("/media?tab=movie&tv=1");
  await expect(page.locator("html")).toHaveClass(/\btv\b/);
  await page.getByRole("tab", { name: /Movies/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tiles.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("link", { name: "Watch" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/media?tv=0");
  await expect(page.locator("html")).not.toHaveClass(/\btv\b/);
});

test("media: in the rail under Weather, and on the phone's home screen beside Settings", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const rail = page.getByRole("navigation", { name: "Main" }).first();
  const labels = await rail.getByRole("link").allInnerTexts();
  expect(
    labels
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-3),
  ).toEqual(["Weather", "Media", "Settings"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const media = page.locator("main").getByRole("link", { name: "Media", exact: true });
  const settings = page.locator("main").getByRole("link", { name: "Settings", exact: true });
  const [m, s] = [(await media.boundingBox())!, (await settings.boundingBox())!];
  expect(Math.abs(m.y - s.y)).toBeLessThan(4);
  expect(m.x).toBeLessThan(s.x);
  await media.click();
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
});
