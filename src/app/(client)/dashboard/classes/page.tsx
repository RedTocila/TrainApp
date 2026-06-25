import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getPublishedClasses } from "@/lib/actions/classes";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { ClassesCatalog } from "@/components/classes-catalog";
import { PageTransition } from "@/components/page-transition";
import { hasAiAccess } from "@/lib/subscription";

export default async function ClassesPage() {
  await requireClient();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const platform = getPlatformCopy(parseCheckoutLocale(profile?.preferred_locale));

  if (!profile || !hasAiAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl">
          <AiUpgradeGate
            title={`${PLATFORM_AI_NAME} required for live coaching`}
            description={platform.classes.upgradeDescription}
          />
        </div>
      </PageTransition>
    );
  }

  const classes = await getPublishedClasses();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl">
        <ClassesCatalog classes={classes} />
      </div>
    </PageTransition>
  );
}
