/**
 * Open-Meteo client (free, no API key, CORS enabled). Docs: https://open-meteo.com/en/docs
 * All times returned by the API are local wall-clock times of the location
 * (timezone=auto), e.g. "2026-10-06T14:00".
 */
import type { DayKey } from "@/lib/date";

export type WeatherLocation = {
  name: string;
  region?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
};

export type CurrentWeather = {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  isDay: boolean;
  precipitation: number;
  code: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
};

export type HourlyPoint = {
  time: string;
  day: DayKey;
  hour: number;
  temperature: number;
  feelsLike: number;
  precipitationProbability: number;
  precipitation: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  uvIndex: number;
};

export type DailyPoint = {
  day: DayKey;
  code: number;
  max: number;
  min: number;
  sunrise: string;
  sunset: string;
  precipitationSum: number;
  precipitationProbability: number;
  windSpeedMax: number;
  uvIndexMax: number;
};

export type Forecast = {
  timezone: string;
  utcOffsetSeconds: number;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  fetchedAt: number;
};

export type AirQuality = {
  europeanAqi: number | null;
  pollen: { name: string; value: number }[];
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "is_day",
  "wind_speed_10m",
  "uv_index",
];
const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "uv_index_max",
];

export function forecastUrl(location: Pick<WeatherLocation, "latitude" | "longitude">, days = 8): string {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    current: CURRENT_FIELDS.join(","),
    hourly: HOURLY_FIELDS.join(","),
    daily: DAILY_FIELDS.join(","),
    timezone: "auto",
    forecast_days: String(days),
  });
  return `${FORECAST_URL}?${params}`;
}

type RawForecast = {
  timezone: string;
  utc_offset_seconds: number;
  current: Record<string, number | string>;
  hourly: Record<string, (number | string | null)[]>;
  daily: Record<string, (number | string | null)[]>;
};

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function parseForecast(raw: RawForecast, fetchedAt = Date.now()): Forecast {
  const c = raw.current;
  const current: CurrentWeather = {
    time: String(c.time),
    temperature: num(c.temperature_2m),
    feelsLike: num(c.apparent_temperature, num(c.temperature_2m)),
    humidity: num(c.relative_humidity_2m),
    isDay: num(c.is_day, 1) === 1,
    precipitation: num(c.precipitation),
    code: num(c.weather_code),
    windSpeed: num(c.wind_speed_10m),
    windDirection: num(c.wind_direction_10m),
    windGusts: num(c.wind_gusts_10m),
  };

  const h = raw.hourly;
  const hourly: HourlyPoint[] = (h.time as string[]).map((time, i) => ({
    time,
    day: time.slice(0, 10),
    hour: Number(time.slice(11, 13)),
    temperature: num(h.temperature_2m?.[i]),
    feelsLike: num(h.apparent_temperature?.[i], num(h.temperature_2m?.[i])),
    precipitationProbability: num(h.precipitation_probability?.[i]),
    precipitation: num(h.precipitation?.[i]),
    code: num(h.weather_code?.[i]),
    isDay: num(h.is_day?.[i], 1) === 1,
    windSpeed: num(h.wind_speed_10m?.[i]),
    uvIndex: num(h.uv_index?.[i]),
  }));

  const d = raw.daily;
  const daily: DailyPoint[] = (d.time as string[]).map((day, i) => ({
    day,
    code: num(d.weather_code?.[i]),
    max: num(d.temperature_2m_max?.[i]),
    min: num(d.temperature_2m_min?.[i]),
    sunrise: String(d.sunrise?.[i] ?? ""),
    sunset: String(d.sunset?.[i] ?? ""),
    precipitationSum: num(d.precipitation_sum?.[i]),
    precipitationProbability: num(d.precipitation_probability_max?.[i]),
    windSpeedMax: num(d.wind_speed_10m_max?.[i]),
    uvIndexMax: num(d.uv_index_max?.[i]),
  }));

  return {
    timezone: raw.timezone,
    utcOffsetSeconds: raw.utc_offset_seconds,
    current,
    hourly,
    daily,
    fetchedAt,
  };
}

export async function fetchForecast(location: WeatherLocation, signal?: AbortSignal): Promise<Forecast> {
  const res = await fetch(forecastUrl(location), { signal });
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  return parseForecast((await res.json()) as RawForecast);
}

/** Current wall-clock time at the forecast location as "YYYY-MM-DDTHH:mm". */
export function locationNowIso(forecast: Pick<Forecast, "utcOffsetSeconds">, now = Date.now()): string {
  return new Date(now + forecast.utcOffsetSeconds * 1000).toISOString().slice(0, 16);
}

/** Minutes after midnight for an Open-Meteo local time string. */
export function isoToMinutes(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

/** The next `count` hours starting with the current hour. */
export function upcomingHours(forecast: Forecast, count = 24, now = Date.now()): HourlyPoint[] {
  const currentHour = `${locationNowIso(forecast, now).slice(0, 13)}:00`;
  const start = forecast.hourly.findIndex((p) => p.time >= currentHour);
  return start === -1 ? [] : forecast.hourly.slice(start, start + count);
}

export function hoursOfDay(forecast: Forecast, day: DayKey): HourlyPoint[] {
  return forecast.hourly.filter((p) => p.day === day);
}

export type GeocodingResult = WeatherLocation & { id: number };

export async function searchLocations(query: string, signal?: AbortSignal): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({ name: query, count: "8", language: "de", format: "json" });
  const res = await fetch(`${GEOCODING_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Location search failed (${res.status})`);
  const body = (await res.json()) as {
    results?: {
      id: number;
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }[];
  };
  return (body.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
  }));
}

const POLLEN_FIELDS: [field: string, name: string][] = [
  ["alder_pollen", "Alder"],
  ["birch_pollen", "Birch"],
  ["grass_pollen", "Grass"],
  ["mugwort_pollen", "Mugwort"],
  ["ragweed_pollen", "Ragweed"],
];

export async function fetchAirQuality(location: WeatherLocation, signal?: AbortSignal): Promise<AirQuality> {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    current: ["european_aqi", ...POLLEN_FIELDS.map(([f]) => f)].join(","),
    timezone: "auto",
  });
  const res = await fetch(`${AIR_QUALITY_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Air quality request failed (${res.status})`);
  const body = (await res.json()) as { current?: Record<string, number | null> };
  const current = body.current ?? {};
  return {
    europeanAqi: typeof current.european_aqi === "number" ? current.european_aqi : null,
    pollen: POLLEN_FIELDS.map(([field, name]) => ({ name, value: num(current[field]) }))
      .filter((p) => p.value >= 1)
      .sort((a, b) => b.value - a.value),
  };
}

/** Pollen concentration (grains/m³) → German-style intensity wording. */
export function pollenLevel(value: number): "low" | "moderate" | "high" {
  if (value < 10) return "low";
  if (value < 50) return "moderate";
  return "high";
}

export function formatLocation(location: WeatherLocation | null | undefined): string {
  if (!location) return "";
  return location.name;
}

export function formatLocationLong(location: WeatherLocation): string {
  return [location.name, location.region, location.country].filter(Boolean).join(", ");
}
