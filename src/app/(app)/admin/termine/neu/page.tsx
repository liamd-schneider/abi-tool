import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/admin/event-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Neuer Termin" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/termine" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück
      </Link>
      <PageHeader title="Neuer Termin" description="Schichten, Bedarf und Sortiment fügst du im nächsten Schritt hinzu." />
      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <EventForm />
        </CardContent>
      </Card>
    </div>
  );
}
