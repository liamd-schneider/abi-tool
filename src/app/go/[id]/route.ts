import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { clientIp, hitRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Partner-Klick zählen (für die Abrechnung mit Partnern) und weiterleiten */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fallback = new URL("/", request.url);
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(fallback);

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("id, url, active").eq("id", id).maybeSingle();
  if (!partner?.active) return NextResponse.redirect(fallback);

  const source = (new URL(request.url).searchParams.get("src") ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || null;
  const profile = await getCurrentProfile();
  // Pro Gerät und Partner höchstens ein gezählter Klick in 30 Minuten (gegen künstlich hochgetriebene Zahlen)
  const ip = await clientIp();
  if (await hitRateLimit("partner-click", `${ip}:${partner.id}`, 1, 30 * 60)) {
    await admin.from("partner_clicks").insert({
      partner_id: partner.id,
      cohort_id: profile?.cohort_id ?? null,
      user_id: profile?.id ?? null,
      source,
    });
  }

  const target = new URL(partner.url);
  if (!target.searchParams.has("utm_source")) {
    target.searchParams.set("utm_source", "abi-tool");
    target.searchParams.set("utm_medium", "partnerhub");
    if (source) target.searchParams.set("utm_campaign", source);
  }
  return NextResponse.redirect(target, 302);
}
