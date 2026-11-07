import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Abi-Tool",
    short_name: "Abi-Tool",
    description: "Termine, Schichten, Dienste und Abstimmungen für unseren Abi-Jahrgang",
    start_url: "/start",
    display: "standalone",
    background_color: "#f9f9fc",
    theme_color: "#4f46e5",
    lang: "de",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
