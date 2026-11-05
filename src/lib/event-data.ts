import "server-only";
import { EVENT_FIELDS, NEED_SELECT, SHIFT_SELECT } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, MemberRef, NeedWithPledges, OrganizerRow, ProductRow, ShiftWithSignups, ShoppingItem } from "@/lib/types";

/** Alles, was die Verwaltungsseite eines Termins braucht (Admin- und Orga-Ansicht) */
export async function loadEventManagement(eventId: string) {
  const supabase = await createClient();
  const [eventRes, shiftsRes, needsRes, productsRes, shoppingRes, organizersRes, membersRes] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).eq("id", eventId).maybeSingle(),
    supabase.from("shifts").select(SHIFT_SELECT).eq("event_id", eventId).order("starts_at").order("title"),
    supabase.from("event_needs").select(NEED_SELECT).eq("event_id", eventId).order("created_at"),
    supabase.from("event_products").select("*").eq("event_id", eventId).order("sort_order").order("name"),
    supabase
      .from("shopping_items")
      .select("id, event_id, title, quantity, note, assigned_to, cost, bought_at, bought_by, created_at")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("event_organizers").select("user_id, permissions, profiles(full_name)").eq("event_id", eventId).order("created_at"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  return {
    event: eventRes.data as EventRow | null,
    shifts: (shiftsRes.data ?? []) as unknown as ShiftWithSignups[],
    needs: (needsRes.data ?? []) as unknown as NeedWithPledges[],
    products: (productsRes.data ?? []) as ProductRow[],
    shopping: (shoppingRes.data ?? []) as ShoppingItem[],
    organizers: (organizersRes.data ?? []) as unknown as OrganizerRow[],
    members: (membersRes.data ?? []) as MemberRef[],
  };
}
