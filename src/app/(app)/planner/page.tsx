import type { Metadata } from "next";
import { PlannerClient } from "@/components/planner/planner-client";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const { day } = await searchParams;
  return <PlannerClient requestedDay={typeof day === "string" ? day : undefined} />;
}
