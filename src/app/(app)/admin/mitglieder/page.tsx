import type { Metadata } from "next";
import { Settings2, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { CreateMembersForm } from "@/components/admin/create-members-form";
import { ResetPasswordForm } from "@/components/admin/reset-password-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, PageHeader, SectionTitle } from "@/components/ui/misc";
import { deleteMember, renameMember, setRole } from "@/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { formatHours, formatStamp } from "@/lib/dates";
import { loadLastSignIns } from "@/lib/login-status";
import { loadMemberStats } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";
import { FilterTabs } from "../../filter-tabs";

export const metadata: Metadata = { title: "Mitglieder" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const me = await requireAdmin();
  const { filter = "alle" } = await searchParams;
  const supabase = await createClient();
  const [allMembers, lastSignIns] = await Promise.all([loadMemberStats(supabase), loadLastSignIns()]);
  const admins = allMembers.filter((m) => m.role === "admin").length;
  const neverCount = allMembers.filter((m) => !lastSignIns.get(m.id)).length;

  const members =
    filter === "nie"
      ? allMembers.filter((m) => !lastSignIns.get(m.id))
      : filter === "eingeloggt"
        ? allMembers.filter((m) => lastSignIns.get(m.id))
        : allMembers;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mitglieder"
        description={`${allMembers.length} Accounts · davon ${admins} Admins · ${allMembers.length - neverCount} schon eingeloggt`}
        className="mb-0"
      />

      <Card>
        <CardHeader>
          <CardTitle>Accounts anlegen</CardTitle>
          <CardDescription>
            Namensliste einfügen – Benutzernamen (vorname.nachname) und Startpasswörter werden automatisch erzeugt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMembersForm />
        </CardContent>
      </Card>

      <section>
        <SectionTitle>Alle Mitglieder</SectionTitle>
        <FilterTabs
          basePath="/admin/mitglieder"
          current={filter}
          options={[
            { value: "alle", label: `Alle (${allMembers.length})` },
            { value: "nie", label: `Noch nie eingeloggt (${neverCount})` },
            { value: "eingeloggt", label: `Schon eingeloggt (${allMembers.length - neverCount})` },
          ]}
        />
        {filter === "nie" && neverCount > 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Tipp: Auf eine Person tippen → <b>Passwort zurücksetzen</b> und die neuen Zugangsdaten nochmal persönlich schicken.
          </p>
        ) : null}
        <Card>
          {members.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {filter === "nie" ? "Alle haben sich schon mindestens einmal eingeloggt." : "Keine Einträge."}
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <details>
                  <summary className="flex cursor-pointer items-center gap-3">
                    <Avatar name={m.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {m.full_name} {m.id === me.id ? <span className="text-xs text-muted-foreground">(du)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{m.username} · {m.shiftsTotal} Schichten · {formatHours(m.hoursDone + m.hoursPlanned)} · {m.pledges} Spenden
                      </p>
                      {lastSignIns.get(m.id) ? (
                        <p className="text-xs text-muted-foreground">Letzter Login: {formatStamp(lastSignIns.get(m.id)!)}</p>
                      ) : (
                        <p className="text-xs font-medium text-warning-foreground">Noch nie eingeloggt</p>
                      )}
                    </div>
                    {m.role === "admin" ? <Badge>Admin</Badge> : null}
                    <Settings2 className="size-4 shrink-0 text-muted-foreground" />
                  </summary>

                  <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:pl-10">
                    <ActionForm action={renameMember} className="flex gap-2">
                      <Hidden name="user_id" value={m.id} />
                      <Input name="full_name" defaultValue={m.full_name} className="h-8 max-w-xs" aria-label="Name" />
                      <SubmitButton variant="outline" size="sm">
                        Name speichern
                      </SubmitButton>
                    </ActionForm>
                    <div className="flex flex-wrap items-start gap-2">
                      <ResetPasswordForm userId={m.id} name={m.full_name} />
                      {m.id !== me.id ? (
                        <>
                          <ActionForm action={setRole}>
                            <Hidden name="user_id" value={m.id} />
                            <Hidden name="role" value={m.role === "admin" ? "member" : "admin"} />
                            <SubmitButton variant="outline" size="sm">
                              {m.role === "admin" ? "Admin-Rechte entziehen" : "Zum Admin machen"}
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm
                            action={deleteMember}
                            confirm={`Account von ${m.full_name} endgültig löschen? Alle Eintragungen dieser Person gehen verloren.`}
                          >
                            <Hidden name="user_id" value={m.id} />
                            <SubmitButton variant="destructive-ghost" size="sm">
                              <Trash className="size-4" /> Löschen
                            </SubmitButton>
                          </ActionForm>
                        </>
                      ) : null}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
