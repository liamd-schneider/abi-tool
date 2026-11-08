// Jemanden zum Plattform-Admin machen (darf Partner pflegen und Jahrgänge sperren).
//
//   npm run make-platform-admin -- vorname.nachname --jahrgang taunusschule-bad-camberg-2027
//   npm run make-platform-admin -- vorname.nachname --jahrgang taunusschule-bad-camberg-2027 --entfernen

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const username = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const cohortSlug = flag("--jahrgang");
const remove = args.includes("--entfernen");

if (!username || !cohortSlug) {
  console.error("Aufruf: npm run make-platform-admin -- vorname.nachname --jahrgang <kennung> [--entfernen]");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: cohort } = await admin.from("cohorts").select("id").eq("slug", cohortSlug).maybeSingle();
if (!cohort) {
  console.error(`Jahrgang „${cohortSlug}“ nicht gefunden.`);
  process.exit(1);
}
const { data: profile } = await admin
  .from("profiles")
  .select("id, full_name")
  .eq("username", username)
  .eq("cohort_id", cohort.id)
  .maybeSingle();
if (!profile) {
  console.error(`„${username}“ gibt es in ${cohortSlug} nicht.`);
  process.exit(1);
}

if (remove) {
  await admin.from("platform_admins").delete().eq("user_id", profile.id);
  console.log(`${profile.full_name} ist kein Plattform-Admin mehr.`);
} else {
  const { error } = await admin.from("platform_admins").upsert({ user_id: profile.id });
  if (error) {
    console.error("Fehler:", error.message);
    process.exit(1);
  }
  console.log(`${profile.full_name} ist jetzt Plattform-Admin.`);
}
