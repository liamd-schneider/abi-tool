import "server-only";
import { headers } from "next/headers";

/** Eigene Adresse (z. B. https://abi-tool.de) – für Login-Links und Kalender-Abos */
export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
