import { Clock3 } from "lucide-react";
import type { SubscriptionOffer } from "@/lib/subscription-offers";
import { getOfferEndsLabel } from "@/lib/subscription-offers";
import { cn } from "@/lib/utils";

export function OfferBanner({
  offer,
  locale = "en",
  className,
}: {
  offer: SubscriptionOffer;
  locale?: string;
  className?: string;
}) {
  const endsLabel = getOfferEndsLabel(offer, locale);
  const title = `${offer.badge_text ?? `${offer.percent_off}% OFF`} · ${offer.name}`;

  if (offer.image_url) {
    return (
      <div className={cn("relative isolate overflow-hidden bg-black/30", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={offer.image_url}
          alt=""
          className="block h-auto w-full object-contain object-center"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-10">
          <p className="text-[10px] font-black uppercase tracking-wide text-primary">
            Limited offer
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{title}</p>
          {endsLabel ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/80">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Ends {endsLabel}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b border-primary/25 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent px-3 py-4",
        className
      )}
    >
      <p className="text-xs font-black uppercase tracking-wide text-primary">Limited offer</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{title}</p>
      {endsLabel ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ends {endsLabel}
        </p>
      ) : null}
    </div>
  );
}
