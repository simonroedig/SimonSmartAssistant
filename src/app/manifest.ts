import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Smart Assistant",
    short_name: "Assistant",
    description: "Day planner, weather, shopping list and backlog – synced everywhere.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#060913",
    theme_color: "#060913",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Planner", short_name: "Planner", url: "/planner" },
      { name: "Shopping list", short_name: "Shopping", url: "/shopping" },
      { name: "Backlog", short_name: "Backlog", url: "/todos" },
    ],
  };
}
