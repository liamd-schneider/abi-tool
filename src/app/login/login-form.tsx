"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { forgetCohort, login, type LoginState } from "@/actions/auth";

export function LoginForm({
  next,
  remembered,
  initialCode,
}: {
  next: string;
  remembered: { slug: string; label: string } | null;
  initialCode: string;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  const [cohort, setCohort] = useState(remembered);
  const [showCode, setShowCode] = useState(Boolean(initialCode));
  const codeVisible = !cohort && (showCode || Boolean(state?.data?.needCode));

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {cohort ? (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Dein Jahrgang</p>
            <p className="font-medium break-words">{cohort.label}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setCohort(null);
              setShowCode(true);
              startTransition(() => forgetCohort());
            }}
          >
            Anderer Jahrgang?
          </button>
          <input type="hidden" name="cohort" value={cohort.slug} />
        </div>
      ) : codeVisible ? (
        <Field label="Jahrgangs-Code" htmlFor="cohort" hint="Steht im Login-Link bzw. bekommst du vom Abikomitee.">
          <Input
            id="cohort"
            name="cohort"
            defaultValue={initialCode}
            placeholder="z. B. K7Q2M9XA"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>
      ) : null}

      <Field label="Benutzername" htmlFor="username">
        <Input
          id="username"
          name="username"
          placeholder="vorname.nachname"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </Field>
      <Field label="Passwort" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />} Anmelden
      </Button>

      {!cohort && !codeVisible ? (
        <button
          type="button"
          onClick={() => setShowCode(true)}
          className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="size-3.5" /> Ich habe einen Jahrgangs-Code
        </button>
      ) : null}
    </form>
  );
}
