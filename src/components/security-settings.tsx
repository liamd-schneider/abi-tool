"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, KeyRound, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  confirmTotpEnrollment,
  disableTotp,
  regenerateRecoveryCodes,
  startTotpEnrollment,
  type TotpEnrollment,
} from "@/actions/security";

function RecoveryCodes({ codes }: { codes: string[] }) {
  const formatted = codes.map((c) => c.match(/.{1,4}/g)?.join("-") ?? c);
  const text = formatted.join("\n");
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3">
      <p className="text-sm font-semibold">Wiederherstellungscodes – nur jetzt sichtbar!</p>
      <p className="text-xs text-muted-foreground">
        Speichere sie an einem sicheren Ort (z. B. Passwort-Manager oder ausgedruckt). Jeder Code funktioniert einmal, falls du
        dein Handy verlierst.
      </p>
      <div className="grid grid-cols-2 gap-1 font-mono text-sm">
        {formatted.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Kopieren" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const blob = new Blob([`Abi-Tool – Wiederherstellungscodes\n\n${text}\n`], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "abi-tool-wiederherstellungscodes.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-4" /> Als Datei
        </Button>
      </div>
    </div>
  );
}

/** Zwei-Faktor-Anmeldung (Authenticator-App) einrichten/verwalten */
export function TwoFactorSettings({ enabled, required }: { enabled: boolean; required: string | null }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  if (enabled && !enrollment) {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
          <ShieldCheck className="size-4" /> Aktiv
        </p>
        {codes ? <RecoveryCodes codes={codes} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await regenerateRecoveryCodes();
                if (res?.error) toast.error(res.error);
                else if (res?.data) setCodes(res.data.recoveryCodes);
              })
            }
          >
            <KeyRound className="size-4" /> Neue Wiederherstellungscodes
          </Button>
        </div>
        {required ? (
          <p className="text-xs text-muted-foreground">{required}</p>
        ) : (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Zwei-Faktor-Anmeldung ausschalten</summary>
            <ActionForm action={disableTotp} className="mt-2 flex flex-wrap items-end gap-2">
              <Field label="Passwort zur Bestätigung" htmlFor="mfa-off-password" className="min-w-48 flex-1">
                <Input id="mfa-off-password" name="password" type="password" autoComplete="current-password" required />
              </Field>
              <SubmitButton variant="destructive-ghost" size="sm">
                <ShieldOff className="size-4" /> Ausschalten
              </SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>
    );
  }

  if (codes) return <RecoveryCodes codes={codes} />;

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-2">
        {required ? <p className="text-sm font-medium text-warning-foreground">{required}</p> : null}
        <Button
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await startTotpEnrollment();
              if (res?.error) toast.error(res.error);
              else if (res?.data) setEnrollment(res.data);
            })
          }
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Zwei-Faktor-Anmeldung einrichten
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Installiere eine Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, 2FAS oder Aegis).</li>
        <li>Scanne den QR-Code – oder tippe den Schlüssel ab.</li>
        <li>Gib den 6-stelligen Code aus der App ein.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-4">
        {/* QR-Code kommt als SVG-Data-URL direkt von Supabase */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qr} alt="QR-Code für die Authenticator-App" className="size-44 rounded-lg border border-border bg-white p-2" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Schlüssel zum Abtippen</p>
          <code className="block font-mono text-sm break-all">{enrollment.secret}</code>
          <CopyButton text={enrollment.secret} label="Kopieren" className="mt-2" />
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const res = await confirmTotpEnrollment(enrollment.factorId, code);
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            toast.success(res?.message ?? "Aktiv");
            setEnrollment(null);
            if (res?.data?.recoveryCodes) setCodes(res.data.recoveryCodes);
          });
        }}
      >
        <Field label="Code aus der App" htmlFor="totp-code" className="w-40">
          <Input
            id="totp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            className="text-center tracking-[0.3em]"
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Aktivieren
        </Button>
        <Button variant="ghost" onClick={() => setEnrollment(null)} disabled={pending}>
          Abbrechen
        </Button>
      </form>
    </div>
  );
}
