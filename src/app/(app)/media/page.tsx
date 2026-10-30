import type { Metadata } from "next";
import { MediaView } from "@/components/media/media-view";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { tab } = await searchParams;
  return <MediaView initialTab={typeof tab === "string" ? tab : undefined} />;
}
