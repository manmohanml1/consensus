import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Consensus — decide together",
    short_name: "Consensus",
    description:
      "A constraint-aware way for groups to choose a plan without creating accounts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070b12",
    theme_color: "#0b1220",
    categories: ["food", "lifestyle", "utilities"],
    icons: [
      {
        src: "/icons/consensus-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/consensus-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
