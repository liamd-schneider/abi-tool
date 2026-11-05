// Rechte, die Admins dem Orga-Team eines Termins einzeln geben können.
// (Client-tauglich – keine Server-Imports.)

export const EVENT_PERMISSIONS = ["einkauf", "schichten", "bedarf", "sortiment", "details"] as const;
export type EventPermission = (typeof EVENT_PERMISSIONS)[number];

export const PERMISSION_INFO: Record<EventPermission, { label: string; hint: string }> = {
  einkauf: { label: "Einkaufsliste", hint: "Einträge anlegen, abhaken, Beträge eintragen" },
  schichten: { label: "Schichten", hint: "Schichten anlegen & ändern, Leute ein-/austragen, Anwesenheit" },
  bedarf: { label: "Spenden & Material", hint: "Bedarf anlegen & ändern, „abgegeben“ abhaken" },
  sortiment: { label: "Sortiment", hint: "Produkte und Preise" },
  details: { label: "Termindaten", hint: "Beschreibung, Hinweise, Zeit & Ort, Anmerkungen moderieren" },
};

export function isEventPermission(value: unknown): value is EventPermission {
  return typeof value === "string" && (EVENT_PERMISSIONS as readonly string[]).includes(value);
}
