"use client";

import Script from "next/script";

/**
 * Cloudflare-Turnstile-Widget (unsichtbar bzw. ein Klick). Fügt dem umgebenden Formular
 * automatisch das Feld "cf-turnstile-response" hinzu. Ohne Site-Key wird nichts angezeigt.
 */
export function Turnstile({ siteKey, nonce }: { siteKey: string | null; nonce?: string }) {
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={nonce} />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="de" data-theme="auto" />
    </>
  );
}
