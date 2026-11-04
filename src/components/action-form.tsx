"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionState } from "@/lib/types";

type Action<T> = (prev: ActionState<T>, formData: FormData) => Promise<ActionState<T>>;

const PendingContext = createContext(false);

/**
 * Formular für Server Actions:
 *  - zeigt Fehler/Erfolg als Toast
 *  - behält Eingaben bei Fehlern (kein automatisches Zurücksetzen)
 *  - optional Sicherheitsabfrage (confirm)
 */
export function ActionForm<T = undefined>({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  onDone,
}: {
  action: Action<T>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  onDone?: (state: ActionState<T>) => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState<T>, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
    if (state.ok && resetOnSuccess) formRef.current?.reset();
    onDoneRef.current?.(state);
  }, [state, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className}>
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function Hidden({ name, value }: { name: string; value: string | number | boolean | null | undefined }) {
  return <input type="hidden" name={name} value={value === null || value === undefined ? "" : String(value)} />;
}
