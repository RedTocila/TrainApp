import { LifeBuoy, MessageSquare, Phone } from "lucide-react";
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from "@/lib/landing-content";
import type { PlatformCopy } from "@/lib/platform-copy";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function phoneHref(phone: string) {
  return phone.replace(/[\s()-]/g, "");
}

function whatsappHref(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function ProfileSupportCard({
  copy,
}: {
  copy: PlatformCopy["support"];
}) {
  if (!SUPPORT_PHONE) return null;

  const tel = phoneHref(SUPPORT_PHONE);
  const display = SUPPORT_PHONE_DISPLAY || SUPPORT_PHONE;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <LifeBuoy className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black">{copy.needHelp}</p>
            <p className="text-xs text-muted-foreground">{copy.helpBlurb}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={`tel:${tel}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "justify-between rounded-xl"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{copy.call}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{display}</span>
          </a>
          <a
            href={whatsappHref(SUPPORT_PHONE)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "justify-between rounded-xl"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{copy.whatsapp}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{display}</span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
