import { audit } from "@/lib/audit";
import { getAal, getCurrentProfile } from "@/lib/auth";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** DSGVO Art. 15/20: Alle eigenen Daten als JSON herunterladen */
export async function GET() {
  const me = await getCurrentProfile();
  if (!me) return new Response("Nicht angemeldet", { status: 401 });
  const aal = await getAal();
  if (aal.next === "aal2" && aal.current !== "aal2") return new Response("2FA erforderlich", { status: 403 });
  if (!(await hitRateLimit("data-export", me.id, 5, 60 * 60))) return new Response("Bitte später nochmal versuchen", { status: 429 });

  const supabase = await createClient();
  const [signups, pledges, votes, comments, notifications, pushSubs, shopping, organizer] = await Promise.all([
    supabase.from("shift_signups").select("created_at, attended, shifts(title, starts_at, ends_at, events(title))").eq("user_id", me.id),
    supabase.from("need_pledges").select("quantity, note, delivered, created_at, event_needs(title, unit, events(title))").eq("user_id", me.id),
    supabase.from("poll_votes").select("created_at, poll_options(label), polls(question)").eq("user_id", me.id),
    supabase.from("event_comments").select("body, created_at, events(title)").eq("user_id", me.id),
    supabase.from("notifications").select("title, body, link, read_at, created_at").eq("user_id", me.id),
    supabase.from("push_subscriptions").select("user_agent, created_at, last_success_at").eq("user_id", me.id),
    supabase.from("shopping_items").select("title, quantity, note, cost, bought_at, created_at, events(title)").or(`created_by.eq.${me.id},assigned_to.eq.${me.id},bought_by.eq.${me.id}`),
    supabase.from("event_organizers").select("permissions, created_at, events(title)").eq("user_id", me.id),
  ]);

  const exportData = {
    exportiert_am: new Date().toISOString(),
    hinweis: "Alle personenbezogenen Daten, die das Abi-Tool zu deinem Account speichert.",
    profil: { benutzername: me.username, name: me.full_name, rolle: me.role },
    schicht_eintragungen: signups.data ?? [],
    spenden: pledges.data ?? [],
    abstimmungen: votes.data ?? [],
    anmerkungen: comments.data ?? [],
    benachrichtigungen: notifications.data ?? [],
    push_geraete: pushSubs.data ?? [],
    einkaufsliste: shopping.data ?? [],
    orga_team: organizer.data ?? [],
  };

  await audit("account.data_export");
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="abi-tool-meine-daten-${me.username}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
