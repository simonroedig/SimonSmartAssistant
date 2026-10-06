"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_DEVICE_PREFS,
  DEVICE_CHANGE_EVENT,
  DEVICE_STORAGE_KEY,
  type DevicePrefs,
  readDevicePrefs,
  writeDevicePrefs,
} from "@/lib/device";

let cachedRaw: string | null | undefined;
let cachedPrefs: DevicePrefs = DEFAULT_DEVICE_PREFS;

function getSnapshot(): DevicePrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = readDevicePrefs();
  }
  return cachedPrefs;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === DEVICE_STORAGE_KEY) onChange();
  };
  window.addEventListener(DEVICE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DEVICE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Device-local preferences with live updates across tabs. */
export function useDevicePrefs(): [DevicePrefs, (patch: Partial<DevicePrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_DEVICE_PREFS);
  const update = useCallback((patch: Partial<DevicePrefs>) => {
    writeDevicePrefs(patch);
  }, []);
  return [prefs, update];
}
