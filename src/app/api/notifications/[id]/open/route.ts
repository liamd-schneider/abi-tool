import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Benachrichtigung als gelesen markieren und zum Ziel weiterleiten */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("link")
    .maybeSingle();

  const link = data?.link;
  const target = link && link.startsWith("/") && !link.startsWith("//") ? link : "/benachrichtigungen";
  return NextResponse.redirect(new URL(target, request.url), 303);
}
