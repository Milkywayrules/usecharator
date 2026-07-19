import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#0a0a0a",
    description: "Wizard-driven character image generator",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/icons/icon.svg",
        type: "image/svg+xml",
      },
    ],
    name: "Chara Tor",
    short_name: "Chara Tor",
    start_url: "/",
    theme_color: "#0a0a0a",
  };
}
