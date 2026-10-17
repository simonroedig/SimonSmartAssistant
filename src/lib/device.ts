/**
 * Per-device preferences (stored in localStorage, never synced): the wall
 * display wants kiosk behaviour and a bigger UI, the phone does not.
 */
export type ThemeMode = "auto" | "system" | "dark" | "light";
export type ScreensaverMode = "off" | "night" | "always";
/** The design system (see src/lib/designs.ts and src/app/designs.css). */
export type DesignId = "aurora" | "sky" | "studio" | "tactile" | "block" | "doodle";

export type DevicePrefs = {
  /** auto = dark between sunset and sunrise */
  theme: ThemeMode;
  design: DesignId;
  /** Wall display mode: hidden cursor, screensaver, on-screen keyboard, auto-update. */
  kiosk: boolean;
  /** Built-in on-screen keyboard for touch screens without a system keyboard. */
  keyboard: boolean;
  /** UI scale (root font size multiplier). */
  scale: number;
  /** When the wall display dims to a calm clock. */
  screensaver: ScreensaverMode;
  /** Minutes without interaction before the screensaver starts. */
  screensaverDelay: number;
  /** Android launcher: a button next to the apps search for the apps used last. */
  recentApps: boolean;
};

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  theme: "auto",
  design: "aurora",
  kiosk: false,
  keyboard: false,
  scale: 1,
  screensaver: "night",
  screensaverDelay: 2,
  recentApps: false,
};

export const DEVICE_STORAGE_KEY = "ssa:device";
export const SUN_STORAGE_KEY = "ssa:sun";
/** Aurora Sky: the sky last drawn (src/lib/sky.ts), painted again before the first frame. */
export const SKY_STORAGE_KEY = "ssa:sky";
export const DEVICE_CHANGE_EVENT = "ssa:device-change";

export type SunTimes = { sunrise: number; sunset: number };

/**
 * Applies theme, kiosk and scale classes to <html>. Self-contained on purpose:
 * it is serialized into an inline <script> that runs before the first paint,
 * and the client calls the very same function whenever something changes.
 */
export function applyDeviceState(deviceKey: string, sunKey: string): void {
  try {
    let prefs: Record<string, unknown> = {};
    try {
      prefs = JSON.parse(localStorage.getItem(deviceKey) || "{}") || {};
    } catch {
      prefs = {};
    }

    const params = new URLSearchParams(window.location.search);
    const kioskParam = params.get("kiosk");
    if (kioskParam === "1" || kioskParam === "0") {
      const on = kioskParam === "1";
      prefs.kiosk = on;
      prefs.keyboard = on;
      if (on && typeof prefs.scale !== "number") prefs.scale = 1.1;
      localStorage.setItem(deviceKey, JSON.stringify(prefs));
    }

    let sun: { sunrise?: unknown; sunset?: unknown } | null = null;
    try {
      sun = JSON.parse(localStorage.getItem(sunKey) || "null");
    } catch {
      sun = null;
    }
    const sunrise = sun && typeof sun.sunrise === "number" ? sun.sunrise : 420;
    const sunset = sun && typeof sun.sunset === "number" ? sun.sunset : 1140;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const mode = typeof prefs.theme === "string" ? prefs.theme : "auto";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark =
      mode === "dark" ||
      (mode === "system" && systemDark) ||
      (mode === "auto" && (minutes < sunrise || minutes >= sunset));

    let phase = "day";
    if (minutes < sunrise - 45 || minutes >= sunset + 45) phase = "night";
    else if (minutes < sunrise + 75) phase = "dawn";
    else if (minutes >= sunset - 75) phase = "dusk";

    // Background of each design, light and dark (also the browser's/status bar's colour).
    const backgrounds: Record<string, [string, string]> = {
      aurora: ["#eceff7", "#060913"],
      sky: ["#e2ebf9", "#080d1f"],
      studio: ["#f5f6f8", "#08090c"],
      tactile: ["#e9e6e1", "#2a2c31"],
      block: ["#fff4e0", "#2b2933"],
      doodle: ["#fffaf0", "#1f2622"],
    };
    const design = typeof prefs.design === "string" && prefs.design in backgrounds ? prefs.design : "aurora";

    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.design = design;
    root.classList.toggle("kiosk", prefs.kiosk === true);
    root.dataset.phase = phase;
    // Aurora Sky: the sky as it was last drawn, until the page computes it anew.
    if (design === "sky") {
      try {
        const sky = JSON.parse(localStorage.getItem("ssa:sky") || "null");
        if (sky && typeof sky === "object") {
          for (const name of Object.keys(sky)) {
            if (name.startsWith("--") && typeof sky[name] === "string") root.style.setProperty(name, sky[name]);
          }
          if (typeof sky.weather === "string") root.dataset.sky = sky.weather;
        }
      } catch {
        // drawn by the page in a moment
      }
    }
    const scale = typeof prefs.scale === "number" && prefs.scale >= 0.75 && prefs.scale <= 1.6 ? prefs.scale : 1;
    root.style.fontSize = scale === 1 ? "" : `${16 * scale}px`;

    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", backgrounds[design][dark ? 1 : 0]);
  } catch {
    // Never block rendering because of storage problems.
  }
}

export const deviceInitScript = `(${applyDeviceState.toString()})(${JSON.stringify(
  DEVICE_STORAGE_KEY,
)}, ${JSON.stringify(SUN_STORAGE_KEY)})`;

export function readDevicePrefs(): DevicePrefs {
  if (typeof window === "undefined") return DEFAULT_DEVICE_PREFS;
  try {
    const stored = JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY) || "{}") as Partial<DevicePrefs>;
    return { ...DEFAULT_DEVICE_PREFS, ...stored };
  } catch {
    return DEFAULT_DEVICE_PREFS;
  }
}

export function writeDevicePrefs(patch: Partial<DevicePrefs>): DevicePrefs {
  const next = { ...readDevicePrefs(), ...patch };
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode); the change still applies for this session.
  }
  applyDeviceState(DEVICE_STORAGE_KEY, SUN_STORAGE_KEY);
  window.dispatchEvent(new Event(DEVICE_CHANGE_EVENT));
  return next;
}

export function readSunTimes(): SunTimes | null {
  try {
    const sun = JSON.parse(localStorage.getItem(SUN_STORAGE_KEY) || "null");
    return sun && typeof sun.sunrise === "number" && typeof sun.sunset === "number" ? sun : null;
  } catch {
    return null;
  }
}

export function writeSunTimes(sun: SunTimes): void {
  try {
    const previous = localStorage.getItem(SUN_STORAGE_KEY);
    const value = JSON.stringify(sun);
    if (previous === value) return;
    localStorage.setItem(SUN_STORAGE_KEY, value);
    applyDeviceState(DEVICE_STORAGE_KEY, SUN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
