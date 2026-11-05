import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/auth";
import { EVENT_PERMISSIONS, isEventPermission, type EventPermission } from "@/lib/event-permissions";
import { createClient } from "@/lib/supabase/server";

export interface EventAccess {
  isAdmin: boolean;
  isOrganizer: boolean;
  permissions: EventPermission[];
}

const NO_ACCESS: EventAccess = { isAdmin: false, isOrganizer: false, permissions: [] };

/** Was darf die angemeldete Person bei diesem Termin? Admins dürfen alles. */
export const getEventAccess = cache(async (eventId: string): Promise<EventAccess> => {
  const me = await getCurrentProfile();
  if (!me) return NO_ACCESS;
  if (me.role === "admin") return { isAdmin: true, isOrganizer: false, permissions: [...EVENT_PERMISSIONS] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("event_organizers")
    .select("permissions")
    .eq("event_id", eventId)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!data) return NO_ACCESS;
  return { isAdmin: false, isOrganizer: true, permissions: ((data.permissions ?? []) as unknown[]).filter(isEventPermission) };
});

export function canDo(access: EventAccess, permission: EventPermission) {
  return access.permissions.includes(permission);
}
