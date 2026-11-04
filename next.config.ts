import type { NextConfig } from "next";

// Jede Seite hängt am Login (Cookies) und ist damit ohnehin dynamisch.
// Darum nutzen wir das klassische dynamische Rendering statt Cache Components.
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
