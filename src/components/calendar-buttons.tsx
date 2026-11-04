import { CalendarPlus, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { googleCalendarUrl, type CalendarItem } from "@/lib/calendar";

/** "Zu Google Kalender" + ".ics"-Download (Apple, Outlook, Android …) */
export function CalendarButtons({
  item,
  icsHref,
  compact = false,
}: {
  item: CalendarItem;
  icsHref: string;
  compact?: boolean;
}) {
  const size = compact ? "xs" : "sm";
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl(item)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size })}
        title="In Google Kalender eintragen"
      >
        <CalendarPlus className="size-4" />
        Google Kalender
      </a>
      <a href={icsHref} className={buttonVariants({ variant: "outline", size })} title="Kalenderdatei für Apple, Outlook & Co.">
        <Download className="size-4" />
        {compact ? ".ics" : "Apple / Outlook (.ics)"}
      </a>
    </div>
  );
}
