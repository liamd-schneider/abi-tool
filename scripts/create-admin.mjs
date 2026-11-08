// Admin-Account in einem Jahrgang anlegen (danach geht alles über /admin/mitglieder).
//
//   npm run create-admin -- "Vorname Nachname"                       (wenn es nur einen Jahrgang gibt)
//   npm run create-admin -- "Vorname Nachname" --jahrgang taunusschule-bad-camberg-2027
//   npm run create-admin -- "Vorname Nachname" --jahrgang taunusschule-bad-camberg-2027 --passwort "MeinPasswort123"
//
// Neue Jahrgänge legt man normalerweise über /registrieren an.
// Liest NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY aus der Env-Datei.

import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fullNameArg = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const cohortSlug = flag("--jahrgang");
const passwordArg = flag("--passwort");

if (!fullNameArg || !fullNameArg.trim().includes(" ")) {
  console.error('Bitte Vor- und Nachname angeben, z. B.: npm run create-admin -- "Max Mustermann" --jahrgang taunusschule-bad-camberg-2027');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt.");
  process.exit(1);
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Jahrgang bestimmen
const { data: cohorts } = await admin.from("cohorts").select("id, slug, name, email_domain").order("created_at");
const cohort = cohortSlug ? cohorts?.find((c) => c.slug === cohortSlug) : cohorts?.length === 1 ? cohorts[0] : undefined;
if (!cohort) {
  console.error(cohortSlug ? `Jahrgang „${cohortSlug}“ nicht gefunden.` : "Bitte mit --jahrgang <kennung> angeben, welcher Jahrgang.");
  console.error("Vorhandene Jahrgänge:", (cohorts ?? []).map((c) => `${c.slug} (${c.name})`).join(", ") || "keine");
  process.exit(1);
}

const parts = fullNameArg.trim().replace(/\s+/g, " ").split(" ");
const last = parts.pop();
const first = parts.join(" ");
const fullName = `${first} ${last}`;
const username = `${slug(first)}.${slug(last)}`;

const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = passwordArg || Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");

const { data: existing } = await admin
  .from("profiles")
  .select("id")
  .eq("username", username)
  .eq("cohort_id", cohort.id)
  .maybeSingle();
if (existing) {
  await admin.from("profiles").update({ role: "admin" }).eq("id", existing.id);
  console.log(`„${username}“ existiert in ${cohort.slug} schon und ist jetzt Admin.`);
  process.exit(0);
}

const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${cohort.email_domain}`,
  password,
  email_confirm: true,
  app_metadata: { username },
  user_metadata: { full_name: fullName },
});
if (error) {
  console.error("Fehler beim Anlegen:", error.message);
  process.exit(1);
}

const { error: profileError } = await admin
  .from("profiles")
  .insert({ id: data.user.id, username, full_name: fullName, role: "admin", cohort_id: cohort.id });
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("Fehler beim Profil:", profileError.message);
  process.exit(1);
}

console.log("Admin angelegt:");
console.log(`  Jahrgang:     ${cohort.name} (${cohort.slug})`);
console.log(`  Name:         ${fullName}`);
console.log(`  Benutzername: ${username}`);
console.log(`  Passwort:     ${password}`);
