import Link from "next/link";
import { cn } from "@/lib/utils";

/** Filter-Chips über searchParams (z. B. ?filter=frei) */
export function FilterTabs({
  basePath,
  current,
  options,
}: {
  basePath: string;
  current: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.value === options[0].value ? basePath : `${basePath}?filter=${o.value}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            current === o.value
              ? "border-primary bg-primary-soft text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
