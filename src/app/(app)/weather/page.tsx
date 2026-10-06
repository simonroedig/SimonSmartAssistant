import type { Metadata } from "next";
import { WeatherView } from "@/components/weather/weather-view";

export const metadata: Metadata = { title: "Weather" };

export default async function WeatherPage({ searchParams }: PageProps<"/weather">) {
  const { day } = await searchParams;
  return <WeatherView initialDay={typeof day === "string" ? day : undefined} />;
}
