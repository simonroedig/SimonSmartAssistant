import type { Metadata } from "next";
import { MindView } from "@/components/mind/mind-view";

export const metadata: Metadata = { title: "Mind" };

export default async function MindPage({ searchParams }: PageProps<"/mind">) {
  const { tab } = await searchParams;
  return <MindView initialTab={typeof tab === "string" ? tab : undefined} />;
}
