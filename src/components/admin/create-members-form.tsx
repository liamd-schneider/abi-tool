"use client";

import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, LoaderCircle, UserPlus } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";
import { createMembers, type CreatedAccount } from "@/actions/admin";

function downloadCsv(rows: CreatedAccount[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = ["Name;Benutzername;Startpasswort", ...rows.map((r) => [r.full_name, r.username, r.password].map(escape).join(";"))].join(
    "\r\n",
  );
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "abi-tool-zugangsdaten.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CreateMembersForm() {
  const [state, action, pending] = useActionState(createMembers, null);

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  const created = state?.data?.created ?? [];
  const errors = state?.data?.errors ?? [];
  const copyText = created
    .map((c) => `${c.full_name}\nBenutzername: ${c.username}\nPasswort: ${c.password}`)
    .join("\n\n");

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
        <Field
          label="Namen (eine Person pro Zeile)"
          htmlFor="names"
          hint="„Max Mustermann“ oder „Mustermann, Max“. Bei Namenszusätzen mit Semikolon trennen: „Lisa; von Berg“."
          className="sm:row-span-2"
        >
          <Textarea id="names" name="names" rows={8} placeholder={"Max Mustermann\nErika Musterfrau\n…"} required />
        </Field>
        <Field label="Rolle" htmlFor="role">
          <Select id="role" name="role" defaultValue="member">
            <option value="member">Mitglied</option>
            <option value="admin">Admin (Komitee)</option>
          </Select>
        </Field>
        <div className="self-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Accounts anlegen
          </Button>
        </div>
      </form>

      {errors.length > 0 ? (
        <Notice tone="warning">
          <p className="font-semibold">Nicht angelegt:</p>
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {created.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Zugangsdaten – nur jetzt sichtbar!</p>
            <div className="flex gap-2">
              <CopyButton text={copyText} label="Alles kopieren" />
              <Button variant="outline" size="sm" onClick={() => downloadCsv(created)}>
                <Download className="size-4" /> CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Name</th>
                  <th className="py-1 pr-3 font-medium">Benutzername</th>
                  <th className="py-1 font-medium">Startpasswort</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {created.map((c) => (
                  <tr key={c.username} className="border-t border-border">
                    <td className="py-1.5 pr-3 font-sans">{c.full_name}</td>
                    <td className="py-1.5 pr-3">{c.username}</td>
                    <td className="py-1.5">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Gib jeder Person ihre Daten persönlich (z. B. per Privatnachricht). Nach dem ersten Login kann das Passwort unter
            „Profil“ geändert werden.
          </p>
        </div>
      ) : null}
    </div>
  );
}
