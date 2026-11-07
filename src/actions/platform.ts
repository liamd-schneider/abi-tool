"use server";

// Aktionen für die Plattform-Betreiber (Jahrgänge verwalten, Partner-Hub pflegen)

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { bool, dbError, int, optStr, str } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");

export async function setCohortActive(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePlatformAdmin();
  const cohortId = str(fd, "id");
  const active = bool(fd, "active");
  if (!active && cohortId === me.cohort_id) return { error: "Deinen eigenen Jahrgang kannst du nicht sperren." };
  const admin = createAdminClient();
  const { error } = await admin.from("cohorts").update({ active }).eq("id", cohortId);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: active ? "Jahrgang freigeschaltet." : "Jahrgang gesperrt." };
}

export async function savePartner(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  const category = str(fd, "category");
  const url = safeUrl(str(fd, "url"));
  const logoRaw = optStr(fd, "logo_url");
  const logo = logoRaw ? safeUrl(logoRaw) : null;

  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!category) return { error: "Bitte eine Kategorie angeben." };
  if (!url || !url.startsWith("https://")) return { error: "Der Link muss mit https:// beginnen." };
  if (logoRaw && (!logo || !logo.startsWith("https://"))) return { error: "Das Logo muss eine https://-Adresse sein." };

  const payload = {
    name: name.slice(0, 120),
    category: category.slice(0, 60),
    description: optStr(fd, "description")?.slice(0, 600) ?? null,
    url,
    logo_url: logo,
    discount_code: optStr(fd, "discount_code")?.slice(0, 60) ?? null,
    highlight: optStr(fd, "highlight")?.slice(0, 80) ?? null,
    sort_order: int(fd, "sort_order", 0),
    active: bool(fd, "active"),
  };

  // Partner-Tabelle: RLS erlaubt Schreiben nur Plattform-Admins
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("partners").update(payload).eq("id", id)
    : await supabase.from("partners").insert(payload);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: id ? "Partner gespeichert." : "Partner angelegt." };
}

export async function deletePartner(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Partner gelöscht." };
}
