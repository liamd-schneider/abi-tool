"use client";

import { useState } from "react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { verifySecondFactor } from "@/actions/security";

export function SecondFactorForm({ next }: { next: string }) {
  const [recovery, setRecovery] = useState(false);
  return (
    <ActionForm action={verifySecondFactor} className="flex flex-col gap-4">
      <Hidden name="next" value={next} />
      <Hidden name="mode" value={recovery ? "recovery" : "totp"} />
      {recovery ? (
        <Field label="Wiederherstellungscode" htmlFor="code" hint="Jeder Code funktioniert nur einmal.">
          <Input id="code" name="code" autoComplete="off" autoCapitalize="none" spellCheck={false} required placeholder="xxxx-xxxx-xxxx-xxxx" />
        </Field>
      ) : (
        <Field label="6-stelliger Code" htmlFor="code">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            className="text-center text-2xl tracking-[0.4em]"
          />
        </Field>
      )}
      <SubmitButton size="lg" className="w-full">
        Bestätigen
      </SubmitButton>
      <button
        type="button"
        onClick={() => setRecovery((r) => !r)}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        {recovery ? "Doch den Code aus der App verwenden" : "Handy weg? Wiederherstellungscode verwenden"}
      </button>
    </ActionForm>
  );
}
