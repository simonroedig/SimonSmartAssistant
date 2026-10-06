import { describe, expect, it } from "vitest";
import { ALL_WEATHER_ICONS, weatherInfo, windDirectionLabel } from "./codes";
import { forecastUrl, isoToMinutes, locationNowIso, parseForecast, upcomingHours } from "./open-meteo";

function rawForecast() {
  const hours = Array.from({ length: 48 }, (_, i) => {
    const day = i < 24 ? "2026-10-06" : "2026-10-07";
    return `${day}T${String(i % 24).padStart(2, "0")}:00`;
  });
  return {
    timezone: "Europe/Berlin",
    utc_offset_seconds: 7200,
    current: {
      time: "2026-10-06T13:00",
      temperature_2m: 17.4,
      relative_humidity_2m: 61,
      apparent_temperature: 16.1,
      is_day: 1,
      precipitation: 0,
      weather_code: 2,
      wind_speed_10m: 11.2,
      wind_direction_10m: 250,
      wind_gusts_10m: 24,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 10 + (i % 24) / 2),
      apparent_temperature: hours.map(() => 9),
      precipitation_probability: hours.map((_, i) => (i % 5) * 10),
      precipitation: hours.map(() => 0),
      weather_code: hours.map(() => 3),
      is_day: hours.map((_, i) => (i % 24 >= 7 && i % 24 < 19 ? 1 : 0)),
      wind_speed_10m: hours.map(() => 8),
      uv_index: hours.map(() => 1.5),
    },
    daily: {
      time: ["2026-10-06", "2026-10-07"],
      weather_code: [2, 61],
      temperature_2m_max: [19.2, 15.1],
      temperature_2m_min: [8.4, 9.0],
      sunrise: ["2026-10-06T07:21", "2026-10-07T07:23"],
      sunset: ["2026-10-06T18:47", "2026-10-07T18:45"],
      precipitation_sum: [0, 4.2],
      precipitation_probability_max: [10, 80],
      wind_speed_10m_max: [18, 25],
      uv_index_max: [3.1, 1.2],
    },
  };
}

describe("Open-Meteo parsing", () => {
  it("builds a request with all fields", () => {
    const url = new URL(forecastUrl({ latitude: 48.1374, longitude: 11.5755 }));
    expect(url.hostname).toBe("api.open-meteo.com");
    expect(url.searchParams.get("timezone")).toBe("auto");
    expect(url.searchParams.get("daily")).toContain("sunrise");
  });

  it("normalizes the response", () => {
    const forecast = parseForecast(rawForecast(), 0);
    expect(forecast.current).toMatchObject({ temperature: 17.4, isDay: true, code: 2 });
    expect(forecast.hourly).toHaveLength(48);
    expect(forecast.hourly[25]).toMatchObject({ day: "2026-10-07", hour: 1 });
    expect(forecast.daily[1]).toMatchObject({ day: "2026-10-07", precipitationProbability: 80 });
  });

  it("starts the hourly strip at the current local hour", () => {
    const forecast = parseForecast(rawForecast(), 0);
    // 11:30 UTC = 13:30 in Berlin (UTC+2).
    const now = Date.UTC(2026, 9, 6, 11, 30);
    expect(locationNowIso(forecast, now)).toBe("2026-10-06T13:30");
    const next = upcomingHours(forecast, 12, now);
    expect(next[0].time).toBe("2026-10-06T13:00");
    expect(next).toHaveLength(12);
  });

  it("converts local times to minutes", () => {
    expect(isoToMinutes("2026-10-06T07:21")).toBe(441);
  });
});

describe("weather codes", () => {
  it("maps codes to labels and day/night icons", () => {
    expect(weatherInfo(0, true)).toEqual({ label: "Clear sky", icon: "clear-day" });
    expect(weatherInfo(0, false).icon).toBe("clear-night");
    expect(weatherInfo(1234).label).toBe("Unknown");
  });

  it("lists every referenced icon", () => {
    expect(ALL_WEATHER_ICONS).toContain("thunderstorms-night-rain");
    expect(ALL_WEATHER_ICONS).toContain("not-available");
  });

  it("names wind directions", () => {
    expect(windDirectionLabel(0)).toBe("N");
    expect(windDirectionLabel(250)).toBe("W");
    expect(windDirectionLabel(359)).toBe("N");
  });
});

describe("weather icon assets", () => {
  it("ships an SVG for every referenced icon", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const missing = ALL_WEATHER_ICONS.filter(
      (icon) => !existsSync(join(process.cwd(), "public/weather", `${icon}.svg`)),
    );
    expect(missing).toEqual([]);
  });
});
