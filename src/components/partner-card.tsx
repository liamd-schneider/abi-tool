import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Partner } from "@/lib/types";

/** Partnerangebot – immer als Anzeige gekennzeichnet, Klicks laufen über /go/<id> (Zählung) */
export function PartnerCard({ partner, source }: { partner: Partner; source: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        {partner.logo_url ? (
          // Externe Partner-Logos: bewusst einfaches <img>, kein Next-Image-Proxy nötig
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.logo_url} alt="" className="size-11 shrink-0 rounded-xl border border-border object-contain" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-bold text-primary">
            {partner.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{partner.category}</p>
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Anzeige</span>
          </div>
          <p className="font-semibold break-words">{partner.name}</p>
        </div>
      </div>
      {partner.highlight ? <Badge className="self-start">{partner.highlight}</Badge> : null}
      {partner.description ? <p className="text-sm text-muted-foreground">{partner.description}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <a
          href={`/go/${partner.id}?src=${encodeURIComponent(source)}`}
          target="_blank"
          rel="sponsored noopener"
          className={buttonVariants({ size: "sm" })}
        >
          Zum Angebot <ExternalLink className="size-3.5" />
        </a>
        {partner.discount_code ? (
          <CopyButton text={partner.discount_code} label={`Code: ${partner.discount_code}`} />
        ) : null}
      </div>
    </div>
  );
}
