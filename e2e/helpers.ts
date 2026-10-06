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
