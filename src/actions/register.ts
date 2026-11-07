"use server";

import { redirect } from "next/navigation";
import { rememberCohort } from "@/actions/auth";
import { usernameToEmail } from "@/lib/auth";
import { emailDomainFor, generateJoinCode, uniqueCohortSlug } from "@/lib/cohorts";
import { bool, int, str } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { makeUsername, parseNameLine } from "@/lib/usernames";

/**
 * Neuen Jahrgang registrieren: legt Schule, Jahrgang und den ersten Admin an
 * und meldet die Person direkt an.
 */
export async function registerCohort(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // Einfacher Bot-Schutz: verstecktes Feld muss leer sein, Formular nicht in < 3 s ausgefüllt
  const startedAt = Number(str(fd, "started_at"));
  if (str(fd, "website") || !startedAt || Date.now() - startedAt < 3000) {
    return { error: "Bitte versuch es nochmal." };
  }

  const schoolName = str(fd, "school_name");
  const city = str(fd, "city") || null;
  const gradYear = int(fd, "grad_year", 0);
  const cohortName = str(fd, "cohort_name") || (gradYear ? `Abi ${gradYear}` : "");
  const fullName = str(fd, "full_name");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const thisYear = new Date().getFullYear();
  if (schoolName.length < 2) return { error: "Bitte den Namen eurer Schule angeben." };
  if (!gradYear || gradYear < thisYear - 1 || gradYear > thisYear + 4) {
    return { error: `Bitte ein Abi-Jahr zwischen ${thisYear - 1} und ${thisYear + 4} angeben.` };
  }
  const parsed = parseNameLine(fullName);
  if (!parsed) return { error: "Bitte deinen Vor- und Nachnamen angeben." };
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  if (password !== confirm) return { error: "Die Passwörter stimmen nicht überein." };
  if (!bool(fd, "accept")) return { error: "Bitte stimme den Nutzungsbedingungen und der Datenschutzerklärung zu." };

  const admin = createAdminClient();
  const username = makeUsername(parsed.first, parsed.last);

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: schoolName.slice(0, 160), city: city?.slice(0, 100) ?? null })
    .select("id")
    .single();
  if (schoolError) return { error: `Fehler: ${schoolError.message}` };

  // Jahrgang anlegen (bei Kollision des Codes erneut versuchen)
  const slug = await uniqueCohortSlug(schoolName, city, gradYear);
  let cohortId: string | null = null;
  for (let attempt = 0; attempt < 5 && !cohortId; attempt++) {
    const { data, error } = await admin
      .from("cohorts")
      .insert({
        school_id: school.id,
        name: cohortName.slice(0, 80),
        grad_year: gradYear,
        slug,
        join_code: generateJoinCode(),
        email_domain: emailDomainFor(slug),
      })
      .select("id")
      .single();
    if (data) cohortId = data.id;
    else if (error && error.code !== "23505") break;
  }
  if (!cohortId) {
    await admin.from("schools").delete().eq("id", school.id);
    return { error: "Der Jahrgang konnte nicht angelegt werden. Bitte versuch es nochmal." };
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username, emailDomainFor(slug)),
    password,
    email_confirm: true,
    app_metadata: { username },
    user_metadata: { full_name: parsed.full },
  });
  if (userError || !created.user) {
    await admin.from("schools").delete().eq("id", school.id);
    return { error: `Account konnte nicht angelegt werden: ${userError?.message ?? "unbekannter Fehler"}` };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username, full_name: parsed.full, role: "admin", cohort_id: cohortId });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("schools").delete().eq("id", school.id);
    return { error: `Fehler: ${profileError.message}` };
  }

  // Direkt anmelden
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: usernameToEmail(username, emailDomainFor(slug)), password });
  await rememberCohort(slug);
  redirect("/admin?willkommen=1");
}
