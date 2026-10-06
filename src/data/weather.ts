"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { writeSunTimes } from "@/lib/device";
import { toDayKey } from "@/lib/date";
import {
  fetchAirQuality,
  fetchForecast,
  isoToMinutes,
  searchLocations,
  type WeatherLocation,
} from "@/lib/weather/open-meteo";
import { queryKeys } from "./core";

const QUARTER_HOUR = 15 * 60_000;

export function useForecast(location: WeatherLocation | null) {
  const query = useQuery({
    queryKey: location ? queryKeys.weather(location.latitude, location.longitude) : ["weather", "none"],
    queryFn: ({ signal }) => fetchForecast(location!, signal),
    enabled: !!location,
    staleTime: 10 * 60_000,
    refetchInterval: QUARTER_HOUR,
    refetchIntervalInBackground: true,
    retry: 3,
  });

  // Remember today's sunrise/sunset so the "auto" theme can follow the sun.
  const today = query.data?.daily.find((d) => d.day === toDayKey(new Date()));
  useEffect(() => {
    if (today?.sunrise && today.sunset) {
      writeSunTimes({ sunrise: isoToMinutes(today.sunrise), sunset: isoToMinutes(today.sunset) });
    }
  }, [today?.sunrise, today?.sunset]);

  return query;
}

export function useAirQuality(location: WeatherLocation | null) {
  return useQuery({
    queryKey: location ? queryKeys.air(location.latitude, location.longitude) : ["air", "none"],
    queryFn: ({ signal }) => fetchAirQuality(location!, signal),
    enabled: !!location,
    staleTime: 30 * 60_000,
    refetchInterval: 60 * 60_000,
    retry: 1,
  });
}

export function useLocationSearch(term: string) {
  const query = term.trim();
  return useQuery({
    queryKey: ["geocoding", query.toLowerCase()],
    queryFn: ({ signal }) => searchLocations(query, signal),
    enabled: query.length >= 2,
    staleTime: 24 * 60 * 60_000,
    meta: { persist: false },
  });
}
