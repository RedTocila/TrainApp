import { Video } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { PageTransition } from "@/components/page-transition";

export default async function ClassesPage() {
  const profile = await requireClient();
  const platform = getPlatformCopy(parseCheckoutLocale(profile.preferred_locale));

  return (
    <PageTransition>
      <div className="flex min-h-[min(60vh,24rem)] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Video className="h-8 w-8 text-primary" aria-hidden />
        </div>
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {platform.classes.comingSoon}
        </p>
      </div>
    </PageTransition>
  );
}
