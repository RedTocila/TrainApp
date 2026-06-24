import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getPublishedClasses } from "@/lib/actions/classes";
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

  if (!profile || !hasAiAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl">
          <AiUpgradeGate
            title="LevelUp AI required for live coaching"
            description="Upgrade to the €19/month AI plan to join live coaching sessions and watch replays anytime."
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
