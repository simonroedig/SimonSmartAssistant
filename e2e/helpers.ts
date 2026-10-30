import type { Page } from "@playwright/test";

const MAILPIT = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Waits for the newest sign-in code mailed to `email` after `since`. */
export async function waitForCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const body = (await res.json()) as { messages: { Created: string; Snippet: string }[] };
    const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= since - 1500);
    const code = fresh?.Snippet.match(/\b(\d{8})\b/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code for ${email}`);
}

export async function signIn(page: Page, email = "dev@example.com") {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  const since = Date.now();
  await page.getByRole("button", { name: "Send me a code" }).click();
  const code = await waitForCode(email, since);
  // Typed digit by digit like on the wall display; it signs in after the last one.
  await page.getByLabel("Code").pressSequentially(code, { delay: 30 });
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** A realistic 8-day Open-Meteo response starting today (Europe/Berlin). */
export function weatherFixture(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return dayKey(d);
  });
  const codes = [2, 61, 3, 0, 80, 1, 95, 2];
  const maxes = [17.8, 14.2, 13.1, 18.6, 15.4, 19.9, 16.2, 15.0];
  const mins = [8.1, 9.4, 6.2, 5.8, 8.9, 9.7, 11.1, 7.4];
  const hourly = {
    time: [] as string[],
    temperature_2m: [] as number[],
    apparent_temperature: [] as number[],
    precipitation_probability: [] as number[],
    precipitation: [] as number[],
    weather_code: [] as number[],
    is_day: [] as number[],
    wind_speed_10m: [] as number[],
    uv_index: [] as number[],
  };
  days.forEach((day, di) => {
    for (let h = 0; h < 24; h++) {
      const t = mins[di] + (maxes[di] - mins[di]) * Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 1.6));
      hourly.time.push(`${day}T${pad(h)}:00`);
      hourly.temperature_2m.push(Math.round(t * 10) / 10);
      hourly.apparent_temperature.push(Math.round((t - 1.5) * 10) / 10);
      hourly.precipitation_probability.push(
        codes[di] >= 51 ? Math.round(30 + 50 * Math.abs(Math.sin(h / 3))) : h % 7 === 0 ? 10 : 0,
      );
      hourly.precipitation.push(codes[di] >= 51 && h % 3 === 0 ? 0.6 : 0);
      hourly.weather_code.push(h >= 7 && h < 19 ? codes[di] : codes[di] === 0 ? 0 : 2);
      hourly.is_day.push(h >= 7 && h < 19 ? 1 : 0);
      hourly.wind_speed_10m.push(9 + (h % 5));
      hourly.uv_index.push(h >= 10 && h <= 16 ? 2.4 : 0);
    }
  });
  return {
    latitude: 48.14,
    longitude: 11.58,
    timezone: "Europe/Berlin",
    utc_offset_seconds: -now.getTimezoneOffset() * 60,
    current: {
      time: `${days[0]}T${pad(now.getHours())}:00`,
      temperature_2m: 16.4,
      relative_humidity_2m: 58,
      apparent_temperature: 15.1,
      is_day: now.getHours() >= 7 && now.getHours() < 19 ? 1 : 0,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 12.3,
      wind_direction_10m: 245,
      wind_gusts_10m: 27.4,
    },
    hourly,
    daily: {
      time: days,
      weather_code: codes,
      temperature_2m_max: maxes,
      temperature_2m_min: mins,
      sunrise: days.map((d) => `${d}T07:21`),
      sunset: days.map((d) => `${d}T18:46`),
      precipitation_sum: codes.map((c) => (c >= 51 ? 4.2 : 0)),
      precipitation_probability_max: codes.map((c) => (c >= 51 ? 80 : 10)),
      wind_speed_10m_max: codes.map(() => 22),
      uv_index_max: codes.map(() => 3.2),
    },
  };
}

export async function mockWeather(page: Page) {
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({ json: weatherFixture() }));
  await page.route("https://air-quality-api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        current: {
          european_aqi: 24,
          birch_pollen: 0,
          grass_pollen: 14.2,
          alder_pollen: 0,
          mugwort_pollen: 3.1,
          ragweed_pollen: 0,
        },
      },
    }),
  );
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 2867714,
            name: "München",
            admin1: "Bayern",
            country: "Deutschland",
            latitude: 48.13743,
            longitude: 11.57549,
            timezone: "Europe/Berlin",
          },
          {
            id: 2867711,
            name: "Münchenbernsdorf",
            admin1: "Thüringen",
            country: "Deutschland",
            latitude: 50.82,
            longitude: 11.93,
            timezone: "Europe/Berlin",
          },
        ],
      },
    }),
  );
}

/** Collects console errors and CSP violations for a page. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  return problems;
}

/** A poster: a coloured SVG with the title (the real ones come from TVmaze/Wikipedia). */
function posterSvg(title: string, hue: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210" height="295" viewBox="0 0 210 295">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${hue + 40} 60% 30%)"/></linearGradient></defs>
<rect width="210" height="295" fill="url(#g)"/><text x="105" y="160" font-family="sans-serif" font-size="22" font-weight="700" fill="white" text-anchor="middle">${title}</text></svg>`;
}

const SHOWS = [
  {
    id: 107,
    name: "Bob's Burgers",
    premiered: "2011-01-09",
    hue: 20,
    summary: "<p>Bob runs Bob's Burgers with his wife and three kids.</p>",
  },
  {
    id: 112,
    name: "South Park",
    premiered: "1997-08-13",
    hue: 200,
    summary: "<p>Four boys in a quiet mountain town.</p>",
  },
];

/** TVmaze and Wikipedia, answered locally: two shows with three seasons each, two films. */
export async function mockMedia(page: Page) {
  await page.route("https://static.tvmaze.com/**", (route) => {
    const show = SHOWS.find((s) => route.request().url().includes(`/${s.id}.`)) ?? SHOWS[0];
    return route.fulfill({ contentType: "image/svg+xml", body: posterSvg(show.name, show.hue) });
  });
  await page.route("https://upload.wikimedia.org/**", (route) => {
    const film = route.request().url().includes("Substance") ? "The Substance" : "American Beauty";
    return route.fulfill({ contentType: "image/svg+xml", body: posterSvg(film, film === "The Substance" ? 330 : 0) });
  });
  await page.route("https://api.tvmaze.com/**", (route) => {
    const url = new URL(route.request().url());
    const episodes = url.pathname.match(/^\/shows\/(\d+)\/episodes$/);
    if (episodes) {
      const id = Number(episodes[1]);
      const list = [];
      for (let season = 1; season <= 3; season++) {
        for (let number = 1; number <= (season === 3 ? 4 : 13); number++) {
          list.push({
            id: id * 1000 + season * 100 + number,
            season,
            number,
            name: `${id === 107 ? "Burger" : "Town"} story ${season}.${number}`,
            airdate: `${2010 + season}-0${Math.min(9, Math.ceil(number / 2))}-1${number % 10}`,
            runtime: 22,
            summary: `<p>Season ${season}, episode ${number}: something &amp; more happens.</p>`,
          });
        }
      }
      // One special without a number (left out), and one episode still to come.
      list.push({
        id: id * 1000 + 999,
        season: 1,
        number: null,
        name: "Special",
        airdate: "2012-12-24",
        runtime: 22,
        summary: null,
      });
      list.push({
        id: id * 1000 + 399,
        season: 3,
        number: 5,
        name: "Not out yet",
        airdate: "2099-01-01",
        runtime: 22,
        summary: null,
      });
      return route.fulfill({ json: list });
    }
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const hits = SHOWS.filter((s) =>
      s.name.toLowerCase().replace(/'/g, "").includes(q.replace(/'/g, "").split(" ")[0]),
    );
    return route.fulfill({
      json: hits.map((s) => ({
        score: 1,
        show: {
          id: s.id,
          name: s.name,
          premiered: s.premiered,
          summary: s.summary,
          image: { medium: `https://static.tvmaze.com/uploads/images/medium_portrait/${s.id}.jpg` },
        },
      })),
    });
  });
  await page.route("https://en.wikipedia.org/**", (route) => {
    const url = new URL(route.request().url());
    const films: Record<string, { description: string; extract: string; image: string }> = {
      "The Substance": {
        description: "2024 film by Coralie Fargeat",
        extract: "The Substance is a 2024 body horror film.",
        image: "https://upload.wikimedia.org/wikipedia/en/Substance.png",
      },
      "American Beauty (1999 film)": {
        description: "1999 film by Sam Mendes",
        extract: "American Beauty is a 1999 American black comedy-drama film.",
        image: "https://upload.wikimedia.org/wikipedia/en/Beauty.png",
      },
    };
    if (url.pathname === "/w/api.php") {
      const q = (url.searchParams.get("srsearch") ?? "").toLowerCase();
      const titles = Object.keys(films).filter((t) => q.includes(t.toLowerCase().split(" (")[0]));
      return route.fulfill({ json: { query: { search: titles.map((title) => ({ title })) } } });
    }
    const title = decodeURIComponent(url.pathname.split("/").pop() ?? "").replace(/_/g, " ");
    const film = films[title];
    if (!film) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({
      json: {
        type: "standard",
        title,
        description: film.description,
        extract: film.extract,
        thumbnail: { source: film.image },
      },
    });
  });
}

/** Sets the phone's "More in the tab bar" (a synced setting – tests must not rely on what an earlier one left). */
export async function setPhoneMore(page: Page, on: boolean) {
  const loaded = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() === "GET",
  );
  await page.goto("/settings");
  await loaded;
  const toggle = page.getByRole("switch", { name: "More in the tab bar" });
  if ((await toggle.getAttribute("aria-checked")) === String(on)) return;
  const saved = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_settings") && r.request().method() !== "GET",
  );
  await toggle.click();
  await saved;
}
