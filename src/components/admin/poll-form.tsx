"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { createPoll } from "@/actions/admin";

type Option = { key: number; value: string };

export function PollForm() {
  const nextKey = useRef(3);
  const [options, setOptions] = useState<Option[]>([
    { key: 1, value: "" },
    { key: 2, value: "" },
  ]);

  const update = (key: number, value: string) => setOptions((opts) => opts.map((o) => (o.key === key ? { ...o, value } : o)));
  const remove = (key: number) => setOptions((opts) => (opts.length > 2 ? opts.filter((o) => o.key !== key) : opts));
  const add = () => setOptions((opts) => [...opts, { key: nextKey.current++, value: "" }]);

  return (
    <ActionForm
      action={createPoll}
      resetOnSuccess
      onDone={(state) => {
        if (state?.ok) setOptions([{ key: nextKey.current++, value: "" }, { key: nextKey.current++, value: "" }]);
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Frage *" htmlFor="question">
        <Input id="question" name="question" required maxLength={300} placeholder="z. B. Welches Motto nehmen wir?" />
      </Field>
      <Field label="Beschreibung" htmlFor="poll-description">
        <Textarea id="poll-description" name="description" rows={2} placeholder="Optional" />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Antwortmöglichkeiten *</span>
        {options.map((o, i) => (
          <div key={o.key} className="flex gap-2">
            <Input
              name="option"
              value={o.value}
              onChange={(e) => update(o.key, e.target.value)}
              placeholder={`Option ${i + 1}`}
              maxLength={200}
              required={i < 2}
            />
            <Button variant="ghost" size="icon" onClick={() => remove(o.key)} disabled={options.length <= 2} aria-label="Option entfernen">
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={add} className="self-start" disabled={options.length >= 20}>
          <Plus className="size-4" /> Option hinzufügen
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Checkbox name="allow_multiple" label="Mehrere Antworten erlauben" />
          <Checkbox name="anonymous" label="Anonym (niemand sieht, wer was gewählt hat)" />
        </div>
        <Field label="Endet am (optional)" htmlFor="closes_at">
          <Input id="closes_at" name="closes_at" type="datetime-local" />
        </Field>
      </div>

      <div>
        <SubmitButton>Abstimmung starten</SubmitButton>
      </div>
    </ActionForm>
  );
}
