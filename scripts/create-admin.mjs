// Ersten Admin-Account anlegen (danach geht alles über /admin/mitglieder).
//
//   npm run create-admin -- "Vorname Nachname"
//   npm run create-admin -- "Vorname Nachname" "MeinPasswort123"
//
// Liest NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY und AUTH_USERNAME_EMAIL_DOMAIN aus .env.local.

import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [, , fullNameArg, passwordArg] = process.argv;
if (!fullNameArg || !fullNameArg.trim().includes(" ")) {
  console.error('Bitte Vor- und Nachname angeben, z. B.: npm run create-admin -- "Max Mustermann"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const domain = process.env.AUTH_USERNAME_EMAIL_DOMAIN || "abi.local";
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt (.env.local).");
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

const parts = fullNameArg.trim().replace(/\s+/g, " ").split(" ");
const last = parts.pop();
const first = parts.join(" ");
const fullName = `${first} ${last}`;
const username = `${slug(first)}.${slug(last)}`;

const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = passwordArg || Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing } = await admin.from("profiles").select("id, role").eq("username", username).maybeSingle();
if (existing) {
  await admin.from("profiles").update({ role: "admin" }).eq("id", existing.id);
  console.log(`„${username}“ existiert schon und ist jetzt Admin.`);
  process.exit(0);
}

const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${domain}`,
  password,
  email_confirm: true,
  app_metadata: { username },
  user_metadata: { full_name: fullName },
});
if (error) {
  console.error("Fehler beim Anlegen:", error.message);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, username, full_name: fullName, role: "admin" });
if (profileError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("Fehler beim Profil:", profileError.message);
  process.exit(1);
}

console.log("Admin angelegt:");
console.log(`  Name:         ${fullName}`);
console.log(`  Benutzername: ${username}`);
console.log(`  Passwort:     ${password}`);
