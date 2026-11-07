import type { NextConfig } from "next";

// Jede Seite hängt am Login (Cookies) und ist damit ohnehin dynamisch.
// Darum nutzen wir das klassische dynamische Rendering statt Cache Components.
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  poweredByHeader: false, // kein "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        // Die Content-Security-Policy (mit Nonce pro Anfrage) setzt der Proxy
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), interest-cohort=(), browsing-topics=()",
          },
        ],
      },
      {
        // Service Worker nie cachen, damit Updates sofort ankommen
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
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
