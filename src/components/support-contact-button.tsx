"use client";

import { useEffect, useRef, useState } from "react";
import { LifeBuoy, MessageSquare, Phone } from "lucide-react";
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from "@/lib/landing-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function phoneHref(phone: string) {
  return phone.replace(/[\s()-]/g, "");
}

function whatsappHref(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function SupportContactButton({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!SUPPORT_PHONE) return null;

  const tel = phoneHref(SUPPORT_PHONE);
  const display = SUPPORT_PHONE_DISPLAY || SUPPORT_PHONE;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0", buttonClassName)}
        onClick={() => setOpen((value) => !value)}
        aria-label="Contact support"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <LifeBuoy className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">Need help?</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              For any issue, call or message on WhatsApp.
            </p>
          </div>
          <div className="p-1.5">
            <a
              role="menuitem"
              href={`tel:${tel}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">Call</span>
                <span className="block truncate text-xs text-muted-foreground">{display}</span>
              </span>
            </a>
            <a
              role="menuitem"
              href={whatsappHref(SUPPORT_PHONE)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">WhatsApp</span>
                <span className="block truncate text-xs text-muted-foreground">{display}</span>
              </span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
