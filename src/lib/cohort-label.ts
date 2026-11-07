/** "Gymnasium am Markt, Musterstadt · Abi 2027" */
export function cohortLabel(c: { name: string; schools: { name: string; city: string | null } | null }) {
  const school = c.schools ? [c.schools.name, c.schools.city].filter(Boolean).join(", ") : "";
  return school ? `${school} · ${c.name}` : c.name;
}
