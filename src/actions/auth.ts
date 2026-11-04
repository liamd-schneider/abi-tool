"use server";

import { redirect } from "next/navigation";
import { requireUser, usernameToEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsernameInput } from "@/lib/usernames";
import { str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const username = normalizeUsernameInput(str(fd, "username"));
  const password = String(fd.get("password") ?? "");
  if (!username || !password) return { error: "Bitte Benutzername und Passwort eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) {
    return {
      error: error.status === 429 ? "Zu viele Versuche – bitte kurz warten." : "Benutzername oder Passwort ist falsch.",
    };
  }

  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  if (password !== confirm) return { error: "Die Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Das ist schon dein aktuelles Passwort." };
    if (error.code === "weak_password") return { error: "Das Passwort ist zu schwach." };
    return { error: `Fehler: ${error.message}` };
  }
  return { ok: true, message: "Passwort geändert." };
}
