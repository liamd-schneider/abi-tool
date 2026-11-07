/**
 * Nur interne Pfade als Weiterleitungsziel zulassen (verhindert Open-Redirects wie
 * "//evil.com", "/\evil.com" oder Steuerzeichen).
 */
export function safeNextPath(value: string | null | undefined, fallback = "/start") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (value.length > 500) return fallback;
  return value;
}
