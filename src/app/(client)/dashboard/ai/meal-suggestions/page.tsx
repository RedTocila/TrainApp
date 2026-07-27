import { createClient } from "@/lib/supabase/server";
import { hasAiAccess } from "@/lib/subscription";
import { loadMealSuggestions } from "@/lib/ai/load-meal-suggestions";
import { buildPricingHref } from "@/lib/pricing-nav";
import { redirect } from "next/navigation";
import { MealSuggestionsClient } from "@/components/meal-suggestions-client";
import { formatDateKey } from "@/lib/utils";

export default async function MealSuggestionsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
    if (!user) return { data: null };
    return supabase.from("profiles").select("*").eq("id", user.id).single();
  });

  if (!profile || !hasAiAccess(profile)) {
    redirect(buildPricingHref("/dashboard/ai/meal-suggestions"));
  }

  const today = formatDateKey(new Date());
  const initial = await loadMealSuggestions(profile.id, today);

  return (
    <MealSuggestionsClient
      dateKey={today}
      initialHeadline={initial.headline}
      initialSuggestions={initial.suggestions}
      initialGap={initial.gap}
    />
  );
}
