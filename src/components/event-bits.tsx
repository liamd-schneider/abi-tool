import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { dateParts } from "@/lib/dates";
import { cn, mapsUrl } from "@/lib/utils";

export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  const { day, month, weekday } = dateParts(iso);
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft py-1.5 text-primary",
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase">{weekday}</span>
      <span className="text-xl leading-6 font-bold">{day}</span>
      <span className="text-[10px] font-medium uppercase">{month}</span>
    </div>
  );
}

export function LocationLink({
  locationName,
  address,
  customMapsUrl,
  className,
}: {
  locationName: string | null;
  address: string | null;
  customMapsUrl?: string | null;
  className?: string;
}) {
  const url = mapsUrl(locationName, address, customMapsUrl);
  const label = [locationName, address].filter(Boolean).join(", ");
  if (!label && !url) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-start gap-1.5", className)}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 underline-offset-2 hover:underline">
          {label || "Auf Google Maps öffnen"}
          <ExternalLink className="ml-1 inline size-3 align-baseline text-muted-foreground" aria-hidden />
        </a>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}

export function EventLink({ id, title, className }: { id: string; title: string; className?: string }) {
  return (
    <Link href={`/termine/${id}`} className={cn("text-xs font-semibold text-primary hover:underline", className)}>
      {title}
    </Link>
  );
}
