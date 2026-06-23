import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/ai/coach-context";
import { generateMealSuggestions } from "@/lib/ai/meal-suggestions";
import type { MacroGap, MealSuggestion } from "@/lib/ai/types";

export async function loadMealSuggestions(
  userId: string,
  dateKey: string
): Promise<{ headline: string; suggestions: MealSuggestion[]; gap: MacroGap }> {
  const ctx = await getCoachContext(userId, dateKey);
  const { headline, suggestions } = await generateMealSuggestions(ctx.macroGap);

  const supabase = await createClient();
  await supabase.from("ai_insights").insert({
    user_id: userId,
    insight_type: "meal_suggestion",
    period_start: dateKey,
    period_end: dateKey,
    title: headline,
    summary: suggestions.map((s) => s.title).join(", "),
    payload: { headline, suggestions, gap: ctx.macroGap },
  });

  return { headline, suggestions, gap: ctx.macroGap };
}
