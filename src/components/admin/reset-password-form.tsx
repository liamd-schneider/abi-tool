"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/actions/admin";

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Neues Passwort für ${name} erzeugen? Das alte funktioniert dann nicht mehr.`)) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="user_id" value={userId} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Passwort zurücksetzen
        </Button>
      </form>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.data ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-success/10 p-2 text-sm">
          <span>
            Neues Passwort für <b>{state.data.username}</b>: <code className="font-mono font-semibold">{state.data.password}</code>
          </span>
          <CopyButton text={`Benutzername: ${state.data.username}\nPasswort: ${state.data.password}`} label="Kopieren" />
        </div>
      ) : null}
    </div>
  );
}
