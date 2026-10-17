/**
 * Aurora Sky: the background is the sky over the user's city right now. The time
 * of day (relative to sunrise and sunset) sets its colours and where the sun or
 * moon stands, the weather its mood, light/dark only how bright it is.
 *
 * Pure: computes CSS custom properties; src/components/providers/sky-controller.tsx
 * puts them on <html> and src/app/designs.css draws the sky from them.
 */

export type SkyWeather = "clear" | "partly" | "overcast" | "fog" | "rain" | "snow" | "storm";

/** WMO weather code (Open-Meteo) → what the sky shows. */
export function skyWeather(code: number | null | undefined): SkyWeather {
  if (code == null) return "clear";
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "clear";
}

/**
 * Where the sky is drawn, in % of the screen. On the home screen the clock is the
 * window: the horizon lies just below the date, the sun and moon travel where no
 * text is. Other pages ("calm") only carry the mood in a band at the top.
 */
export type SkyLayout = {
  scene: "full" | "calm";
  /** Horizon (full) or the depth of the band (calm), from the top. */
  horizon: number;
  /** Highest point of the sun's path, from the top. */
  top: number;
  /** The sun's and moon's path, from the left. */
  x0: number;
  x1: number;
  /** Width of the clock's window from the left (below 100: its column on a wide screen). */
  width: number;
};

export const CALM_LAYOUT: SkyLayout = { scene: "calm", horizon: 22, top: 4, x0: 55, x1: 93, width: 100 };

export type SkyInput = {
  /** Minutes after midnight. */
  minutes: number;
  sunrise: number;
  sunset: number;
  weather: SkyWeather;
  /** °C, if known. */
  temperature?: number | null;
  dark: boolean;
  layout: SkyLayout;
};

type RGB = [number, number, number];
type Frame = [offset: number, top: string, mid: string, horizon: string, glow: string, accent: string];

// Keyframes along the sun's day, relative to sunrise (r) and sunset (s).
const LIGHT: ((r: number, n: number, s: number) => Frame)[] = [
  (r) => [r - 120, "#dfe3f2", "#e7e6f3", "#eee9f1", "#c9d2ff", "#5b5bd6"], // night
  (r) => [r - 30, "#e6e1f5", "#f3dfe6", "#ffe1cc", "#ffb489", "#e2603f"], // dawn
  (r) => [r + 60, "#dbe8fa", "#eaeff9", "#fbefe2", "#ffe2b0", "#e0702f"], // early morning
  (r) => [r + 180, "#d3e5fb", "#e4eefb", "#f2f5fb", "#fff6d8", "#2f72e6"], // morning
  (_, n) => [n, "#cbe2fc", "#e0edfc", "#eef4fc", "#ffffff", "#1f6be3"], // noon
  (_, __, s) => [s - 120, "#d2e3fa", "#e6edf8", "#f8f0e4", "#fff1cc", "#2a6fdc"], // afternoon
  (_, __, s) => [s - 40, "#e3e2f4", "#f8e6d6", "#ffd9ad", "#ffc06a", "#d26a12"], // golden hour
  (_, __, s) => [s + 15, "#dcd8f1", "#f0d7e8", "#ffd3c4", "#ff9e8e", "#c2418f"], // sunset
  (_, __, s) => [s + 70, "#d9dcf0", "#e3e1f1", "#ece6f0", "#c5c9f5", "#6157d6"], // dusk
];
const DARK: ((r: number, n: number, s: number) => Frame)[] = [
  (r) => [r - 120, "#04060f", "#080d1f", "#0f1730", "#c7d0ff", "#a5b4fc"],
  (r) => [r - 30, "#0e1230", "#2e2148", "#6e3a4a", "#ff9468", "#ff8a66"],
  (r) => [r + 60, "#0c1a3a", "#1b3156", "#5a4a4a", "#ffc58a", "#ffad6b"],
  (r) => [r + 180, "#0a1d3d", "#123360", "#24507f", "#ffe9b0", "#72aaff"],
  (_, n) => [n, "#0a2148", "#143b6c", "#2a5c8e", "#fff4d6", "#6ea8ff"],
  (_, __, s) => [s - 120, "#0b1d40", "#173764", "#3d5577", "#ffe0a0", "#78a9ff"],
  (_, __, s) => [s - 40, "#131636", "#3c2646", "#9a4f2e", "#ffb050", "#ffb35c"],
  (_, __, s) => [s + 15, "#0d0f2e", "#2b1846", "#6a2650", "#ff7a8a", "#f472b6"],
  (_, __, s) => [s + 70, "#070a1c", "#0f1430", "#1c1d3d", "#c3c8ff", "#a5b4fc"],
];

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const rgb = (c: RGB, a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${+a.toFixed(3)})`;
const grey = (c: RGB): RGB => {
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return [l, l, l];
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v: number) => `${+v.toFixed(2)}%`;
const NONE = "linear-gradient(transparent, transparent)";

const WASH: Record<SkyWeather, number> = {
  clear: 0,
  partly: 0.12,
  overcast: 0.55,
  fog: 0.7,
  rain: 0.55,
  snow: 0.6,
  storm: 0.6,
};
const SUN: Record<SkyWeather, number> = {
  clear: 1,
  partly: 0.85,
  overcast: 0.3,
  fog: 0.35,
  rain: 0.2,
  snow: 0.3,
  storm: 0.12,
};

/** The sky's colours at this minute, before the weather: [top, mid, horizon, glow, accent]. */
function palette(minutes: number, sunrise: number, sunset: number, dark: boolean): RGB[] {
  const noon = (sunrise + sunset) / 2;
  const frames = (dark ? DARK : LIGHT).map((f) => f(sunrise, noon, sunset));
  const first = frames[0][0];
  const m = minutes < first ? minutes + 1440 : minutes;
  for (let i = 0; i < frames.length; i++) {
    const start = frames[i][0];
    const end = i + 1 < frames.length ? frames[i + 1][0] : first + 1440;
    if (m >= start && m < end) {
      const next = frames[(i + 1) % frames.length];
      const t = (m - start) / (end - start);
      const ease = t * t * (3 - 2 * t);
      return [1, 2, 3, 4, 5].map((k) => mix(hex(frames[i][k] as string), hex(next[k] as string), ease));
    }
  }
  return [1, 2, 3, 4, 5].map((k) => hex(frames[0][k] as string));
}

export type Sky = { vars: Record<string, string>; weather: SkyWeather; isDay: boolean };

export function computeSky({ minutes, sunrise, sunset, weather: w, temperature, dark, layout }: SkyInput): Sky {
  const up = sunrise;
  const down = sunset > sunrise ? sunset : sunrise + 600;
  const colours = palette(minutes, up, down, dark);
  let [top, mid, hor] = colours;
  const glow = colours[3];
  let accent = colours[4];

  // Weather: clouds wash the colour out, rain cools it, snow brightens, storms darken.
  const cool: RGB = dark ? [20, 30, 45] : [200, 212, 226];
  const tint = (c: RGB) => mix(c, mix(grey(c), cool, 0.4), WASH[w]);
  [top, mid, hor] = [top, mid, hor].map(tint);
  if (w === "snow" && !dark) [top, mid, hor] = [top, mid, hor].map((c) => mix(c, [246, 249, 252], 0.35));
  if (w === "storm") [top, mid, hor] = [top, mid, hor].map((c) => mix(c, dark ? [18, 12, 34] : [150, 145, 175], 0.35));
  // Temperature, very slightly: hot days a touch warmer, frost a touch bluer.
  if (temperature != null && temperature >= 25) [mid, hor] = [mid, hor].map((c) => mix(c, [255, 190, 130], 0.08));
  if (temperature != null && temperature <= 2) [top, mid] = [top, mid].map((c) => mix(c, [160, 200, 255], 0.08));
  if (w === "rain" || w === "storm") accent = mix(accent, dark ? [120, 170, 220] : [40, 110, 170], 0.55);
  if (w === "snow") accent = mix(accent, dark ? [150, 200, 240] : [40, 120, 190], 0.6);
  if (w === "fog") accent = mix(accent, grey(accent), 0.4);

  const { scene, horizon: H, top: T, x0, x1, width } = layout;
  const calm = scene === "calm";
  const land = width < 100;

  // The sun on an arc over the horizon (below it shortly before sunrise and after sunset),
  // the moon on its own arc at night.
  const isDay = minutes >= up - 25 && minutes <= down + 25;
  let gx: number;
  let gy: number;
  if (isDay) {
    const p = (minutes - up) / (down - up);
    const q = clamp(p, 0, 1);
    gx = x0 + (x1 - x0) * q;
    gy = H - Math.sin(Math.PI * q) * (H - T) + (p < 0 ? -p * 60 : p > 1 ? (p - 1) * 60 : 0);
  } else {
    const night = 1440 - (down - up) - 50;
    const p = clamp((((minutes - down - 25 + 1440) % 1440) / night) % 1, 0, 1);
    gx = x0 + (x1 - x0) * p;
    gy = H - Math.sin(Math.PI * p) * (H - T) * 0.8;
  }
  const strength = SUN[w];
  const ground = dark ? mix(mix(top, mid, 0.5), [6, 8, 16], 0.35) : mix(mix(mid, hor, 0.5), [255, 255, 255], 0.45);

  const vars: Record<string, string> = {};
  if (calm) {
    vars["--hz-sky"] = [
      `radial-gradient(ellipse 60vmax 30vmax at ${pct(isDay ? gx : 80)} 0%, ${rgb(glow, (dark ? 0.3 : 0.45) * strength)}, transparent 70%)`,
      `linear-gradient(180deg, ${rgb(top)} 0%, ${rgb(mid)} ${pct(H * 0.5)}, ${rgb(hor)} ${pct(H)}, ${rgb(ground)} ${pct(H + 30)})`,
    ].join(",");
    vars["--hz-ground"] = NONE;
    vars["--hz-sun"] = NONE;
  } else {
    const body: string[] = [];
    if (isDay) {
      // A soft disc in its glow – bigger and warmer low over the horizon.
      const low = 1 - clamp((H - gy) / (H - T), 0, 1);
      const disc = land ? 2.2 + low * 0.8 : 3 + low * 1.2;
      const core = mix([255, 252, 240], glow, 0.35 + low * 0.5);
      const g = (dark ? 0.75 : 1) * strength;
      body.push(
        `radial-gradient(circle at ${pct(gx)} ${pct(gy)}, ${rgb(core, g)} 0 ${disc}vmax, ${rgb(glow, 0.55 * g)} ${disc + 0.3}vmax, ${rgb(glow, 0.18 * g)} ${disc * 4}vmax, transparent ${disc * 10}vmax)`,
      );
    } else {
      const clear = w === "clear" || w === "partly";
      const disc = land ? 1.5 : 2.2;
      body.push(
        `radial-gradient(circle at ${pct(gx)} ${pct(gy)}, ${rgb([240, 243, 255], clear ? 0.95 : 0.3)} 0 ${disc}vmax, ${rgb(glow, clear ? 0.22 : 0.08)} ${disc + 0.15}vmax, transparent ${disc * 7}vmax)`,
      );
    }
    // The sun or moon in its own layer: cut off at the horizon (the top of the first
    // card below the clock), so it sets behind that card and never shines through cards.
    vars["--hz-sun"] = body.join(",");
    vars["--hz-sky"] = `linear-gradient(180deg, ${rgb(top)} 0%, ${rgb(mid)} ${pct(H * 0.6)}, ${rgb(hor)} ${pct(H)})`;
    // Below the horizon the sky flows softly into a calm ground the cards sit on
    // (no edge, no lines); the setting sun sinks into it.
    vars["--hz-ground"] =
      `linear-gradient(180deg, transparent ${pct(H - 9)}, ${rgb(mix(hor, ground, 0.5), 0.85)} ${pct(H + 3)}, ${rgb(ground)} ${pct(H + 20)}, ${rgb(ground)} 100%)`;
  }

  const haze: RGB = dark ? [70, 76, 92] : [255, 255, 255];
  vars["--hz-haze"] =
    w === "fog"
      ? `linear-gradient(180deg, ${rgb(haze, dark ? 0.15 : 0.3)} 0%, ${rgb(haze, dark ? 0.5 : 0.9)} ${pct(H)}, ${rgb(haze, dark ? 0.25 : 0.5)} ${pct(H + 14)}, ${rgb(haze, 0)} ${pct(H + 34)})`
      : NONE;

  // Clouds: soft, wide shapes in the sky.
  const cloudC: RGB = dark ? [78, 88, 112] : [255, 255, 255];
  const cloudA = {
    clear: 0,
    partly: dark ? 0.35 : 0.85,
    overcast: dark ? 0.45 : 0.75,
    fog: 0,
    rain: dark ? 0.4 : 0.6,
    snow: 0.55,
    storm: dark ? 0.45 : 0.5,
  }[w];
  const cx = (f: number) => 4 + 92 * f;
  const cy = (f: number) => (calm ? 2 + (H - 4) * f * 0.7 : T + (H - T) * f);
  const cloud = (fx: number, fy: number, wv: number, hv: number, a: number) =>
    `radial-gradient(ellipse ${wv}vmax ${hv}vmax at ${pct(cx(fx))} ${pct(cy(fy))}, ${rgb(cloudC, cloudA * a)}, transparent 70%)`;
  vars["--hz-clouds"] = cloudA
    ? [
        cloud(0.2, 0.35, land ? 14 : 22, 3, 1),
        cloud(0.32, 0.45, land ? 10 : 16, 2.2, 0.75),
        cloud(0.78, 0.2, land ? 16 : 24, 3.4, 1),
        cloud(0.66, 0.55, land ? 12 : 18, 2.4, 0.7),
        cloud(0.5, 0.8, land ? 18 : 30, 2.4, 0.6),
      ].join(",")
    : NONE;

  // Stars at night, rain and snow – only in the sky.
  const stars = !isDay && (w === "clear" || w === "partly") ? (dark ? 0.9 : 0.55) : 0;
  vars["--hz-stars"] = String(calm ? +(stars * 0.45).toFixed(3) : stars);
  vars["--hz-rain"] = w === "rain" || w === "storm" ? (dark ? "0.6" : "0.75") : "0";
  vars["--hz-snow"] = w === "snow" ? (dark ? "0.6" : "1") : "0";
  vars["--hz-h"] = pct(H);

  // The accent follows the sky: coral at dawn, blue by day, amber in the evening, lavender at night.
  vars["--accent"] = rgb(accent);
  vars["--accent-soft"] = rgb(accent, dark ? 0.18 : 0.13);
  vars["--nav-bg"] = dark ? rgb(mix(top, [0, 0, 0], 0.15)) : rgb(mix(top, [255, 255, 255], 0.8));
  vars["--surface-strong"] = dark ? rgb(mix(top, [12, 14, 24], 0.25), 0.97) : "rgb(255 255 255 / 0.95)";
  vars["--hz-shadow"] = dark ? "rgb(0 0 0 / 0.55)" : rgb(mix(mid, [40, 50, 90], 0.6), 0.22);

  return { vars, weather: w, isDay };
}

/** The variables computeSky sets (to clear them again when another design is chosen). */
export const SKY_VARS = [
  "--hz-sky",
  "--hz-ground",
  "--hz-haze",
  "--hz-clouds",
  "--hz-stars",
  "--hz-rain",
  "--hz-snow",
  "--hz-h",
  "--hz-sun",
  "--accent",
  "--accent-soft",
  "--nav-bg",
  "--surface-strong",
  "--hz-shadow",
];
