/**
 * Per-device preferences (stored in localStorage, never synced): the wall
 * display wants kiosk behaviour and a bigger UI, the phone does not.
 */
export type ThemeMode = "auto" | "system" | "dark" | "light";
export type ScreensaverMode = "off" | "night" | "always";

export type DevicePrefs = {
  /** auto = dark between sunset and sunrise */
  theme: ThemeMode;
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
};

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  theme: "auto",
  kiosk: false,
  keyboard: false,
  scale: 1,
  screensaver: "night",
  screensaverDelay: 2,
};

export const DEVICE_STORAGE_KEY = "ssa:device";
export const SUN_STORAGE_KEY = "ssa:sun";
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

    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("kiosk", prefs.kiosk === true);
    root.dataset.phase = phase;
    const scale = typeof prefs.scale === "number" && prefs.scale >= 0.75 && prefs.scale <= 1.6 ? prefs.scale : 1;
    root.style.fontSize = scale === 1 ? "" : `${16 * scale}px`;

    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", dark ? "#060913" : "#eceff7");
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
