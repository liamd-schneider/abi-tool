"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { usernameToEmail } from "@/lib/auth";
import { rememberCohort } from "@/lib/cohort-cookie";
import { emailDomainFor, generateJoinCode, uniqueCohortSlug } from "@/lib/cohorts";
import { bool, int, str } from "@/lib/forms";
import { checkNewPassword } from "@/lib/security/password";
import { clientIp, hitRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { makeUsername, parseNameLine } from "@/lib/usernames";

/** "open" (Standard): sofort loslegen · "approval": Plattform-Admins schalten neue Jahrgänge frei */
const needsApproval = () => process.env.REGISTRATION_MODE === "approval";

/**
 * Neuen Jahrgang registrieren: legt Schule, Jahrgang und den ersten Admin an
 * und meldet die Person direkt an.
 */
export async function registerCohort(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // Bot-Schutz 1: verstecktes Feld muss leer sein, Formular nicht in < 3 s ausgefüllt
  const startedAt = Number(str(fd, "started_at"));
  if (str(fd, "website") || !startedAt || Date.now() - startedAt < 3000) {
    return { error: "Bitte versuch es nochmal." };
  }

  // Bot-Schutz 2: höchstens 5 Registrierungen pro Stunde und IP
  const ip = await clientIp();
  if (!(await hitRateLimit("register-ip", ip, 5, 60 * 60))) {
    return { error: "Zu viele Registrierungen von diesem Gerät. Bitte versuch es später nochmal." };
  }

  // Bot-Schutz 3: Cloudflare Turnstile (wenn eingerichtet)
  if (!(await verifyTurnstile(str(fd, "cf-turnstile-response") || null, ip))) {
    return { error: "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte lade die Seite neu." };
  }

  const schoolName = str(fd, "school_name").slice(0, 160);
  const city = str(fd, "city").slice(0, 100) || null;
  const gradYear = int(fd, "grad_year", 0);
  const cohortName = (str(fd, "cohort_name") || (gradYear ? `Abi ${gradYear}` : "")).slice(0, 80);
  const fullName = str(fd, "full_name").slice(0, 120);
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const thisYear = new Date().getFullYear();
  if (schoolName.length < 2) return { error: "Bitte den Namen eurer Schule angeben." };
  if (!gradYear || gradYear < thisYear - 1 || gradYear > thisYear + 4) {
    return { error: `Bitte ein Abi-Jahr zwischen ${thisYear - 1} und ${thisYear + 4} angeben.` };
  }
  const parsed = parseNameLine(fullName);
  if (!parsed) return { error: "Bitte deinen Vor- und Nachnamen angeben." };
  if (password !== confirm) return { error: "Die Passwörter stimmen nicht überein." };
  const username = makeUsername(parsed.first, parsed.last).slice(0, 60);
  const weak = await checkNewPassword(password, [parsed.full, username, schoolName, city ?? ""]);
  if (weak) return { error: weak };
  if (!bool(fd, "accept")) return { error: "Bitte stimme den Nutzungsbedingungen und der Datenschutzerklärung zu." };

  const admin = createAdminClient();
  const pending = needsApproval();

  const { data: school, error: schoolError } = await admin.from("schools").insert({ name: schoolName, city }).select("id").single();
  if (schoolError) {
    console.error("Schule anlegen", schoolError);
    return { error: "Die Registrierung hat nicht geklappt. Bitte versuch es nochmal." };
  }

  // Jahrgang anlegen (bei Kollision des Codes erneut versuchen)
  const slug = await uniqueCohortSlug(schoolName, city, gradYear);
  let cohortId: string | null = null;
  for (let attempt = 0; attempt < 5 && !cohortId; attempt++) {
    const { data, error } = await admin
      .from("cohorts")
      .insert({
        school_id: school.id,
        name: cohortName,
        grad_year: gradYear,
        slug,
        join_code: generateJoinCode(),
        email_domain: emailDomainFor(slug),
        pending,
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
    console.error("Admin anlegen", userError);
    await admin.from("schools").delete().eq("id", school.id);
    return { error: "Der Account konnte nicht angelegt werden. Bitte versuch es nochmal." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username, full_name: parsed.full, role: "admin", cohort_id: cohortId });
  if (profileError) {
    console.error("Profil anlegen", profileError);
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("schools").delete().eq("id", school.id);
    return { error: "Die Registrierung hat nicht geklappt. Bitte versuch es nochmal." };
  }

  const label = `${schoolName}${city ? `, ${city}` : ""} · ${cohortName}`;
  await audit("cohort.registered", {
    actor: { id: created.user.id, full_name: parsed.full },
    cohortId,
    target: label,
    details: { pending },
  });

  // Plattform-Admins informieren
  const { data: platformAdmins } = await admin.from("platform_admins").select("user_id");
  if (platformAdmins?.length) {
    await admin.from("notifications").insert(
      platformAdmins.map((p) => ({
        user_id: p.user_id,
        title: pending ? "Neuer Jahrgang wartet auf Freischaltung" : "Neuer Jahrgang registriert",
        body: label,
        link: "/plattform",
      })),
    );
  }

  // Direkt anmelden
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: usernameToEmail(username, emailDomainFor(slug)), password });
  await rememberCohort(slug);
  redirect(pending ? "/start" : "/admin?willkommen=1");
}
