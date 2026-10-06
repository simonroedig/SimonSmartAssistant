/**
 * WMO weather interpretation codes (as used by Open-Meteo) mapped to a label
 * and an animated Meteocons icon in /public/weather.
 */
type CodeInfo = { label: string; day: string; night: string };

const CODES: Record<number, CodeInfo> = {
  0: { label: "Clear sky", day: "clear-day", night: "clear-night" },
  1: { label: "Mostly clear", day: "partly-cloudy-day", night: "partly-cloudy-night" },
  2: { label: "Partly cloudy", day: "partly-cloudy-day", night: "partly-cloudy-night" },
  3: { label: "Overcast", day: "overcast-day", night: "overcast-night" },
  45: { label: "Fog", day: "fog-day", night: "fog-night" },
  48: { label: "Icy fog", day: "fog-day", night: "fog-night" },
  51: { label: "Light drizzle", day: "partly-cloudy-day-drizzle", night: "partly-cloudy-night-drizzle" },
  53: { label: "Drizzle", day: "drizzle", night: "drizzle" },
  55: { label: "Heavy drizzle", day: "drizzle", night: "drizzle" },
  56: { label: "Freezing drizzle", day: "sleet", night: "sleet" },
  57: { label: "Freezing drizzle", day: "sleet", night: "sleet" },
  61: { label: "Light rain", day: "partly-cloudy-day-rain", night: "partly-cloudy-night-rain" },
  63: { label: "Rain", day: "rain", night: "rain" },
  65: { label: "Heavy rain", day: "rain", night: "rain" },
  66: { label: "Freezing rain", day: "sleet", night: "sleet" },
  67: { label: "Freezing rain", day: "sleet", night: "sleet" },
  71: { label: "Light snow", day: "partly-cloudy-day-snow", night: "partly-cloudy-night-snow" },
  73: { label: "Snow", day: "snow", night: "snow" },
  75: { label: "Heavy snow", day: "snow", night: "snow" },
  77: { label: "Snow grains", day: "snow", night: "snow" },
  80: { label: "Rain showers", day: "partly-cloudy-day-rain", night: "partly-cloudy-night-rain" },
  81: { label: "Rain showers", day: "rain", night: "rain" },
  82: { label: "Heavy showers", day: "rain", night: "rain" },
  85: { label: "Snow showers", day: "partly-cloudy-day-snow", night: "partly-cloudy-night-snow" },
  86: { label: "Snow showers", day: "snow", night: "snow" },
  95: { label: "Thunderstorm", day: "thunderstorms-day", night: "thunderstorms-night" },
  96: { label: "Thunderstorm, hail", day: "thunderstorms-day-rain", night: "thunderstorms-night-rain" },
  99: { label: "Thunderstorm, hail", day: "thunderstorms-day-rain", night: "thunderstorms-night-rain" },
};

const UNKNOWN: CodeInfo = { label: "Unknown", day: "not-available", night: "not-available" };

export function weatherInfo(code: number, isDay = true): { label: string; icon: string } {
  const info = CODES[code] ?? UNKNOWN;
  return { label: info.label, icon: isDay ? info.day : info.night };
}

export function isPrecipitation(code: number): boolean {
  return code >= 51;
}

/** Every icon the app can reference (used to copy assets and in tests). */
export const ALL_WEATHER_ICONS = Array.from(
  new Set(
    [...Object.values(CODES), UNKNOWN]
      .flatMap((c) => [c.day, c.night])
      .concat(["sunrise", "sunset", "raindrop", "umbrella", "wind", "humidity", "thermometer", "uv-index"]),
  ),
).sort();

export function windDirectionLabel(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function uvLabel(uv: number): string {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very poor";
  return "Extremely poor";
}
