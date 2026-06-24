import type { Profile } from "@/lib/types";

export interface HabitSuggestion {
  id: string;
  title: string;
  reason: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  weekdays?: number[];
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function baseSuggestions(profile: Profile): HabitSuggestion[] {
  const suggestions: HabitSuggestion[] = [];
  const routine = `${profile.daily_routine ?? ""}`.toLowerCase();
  const work = `${profile.work_schedule ?? ""}`.toLowerCase();
  const vices = `${profile.vices ?? ""}`.toLowerCase();
  const combined = `${routine} ${work} ${vices}`;

  suggestions.push({
    id: "log-meals",
    title: "Log meals daily",
    reason: "Keeps nutrition on track toward your macro targets",
  });

  suggestions.push({
    id: "water-morning",
    title: "Drink water after waking",
    reason: "Supports hydration and energy through the day",
    timeStart: "07:00",
    timeEnd: "09:00",
  });

  switch (profile.goal) {
    case "lose_weight":
      suggestions.push(
        {
          id: "walk-after-meals",
          title: "10-minute walk after dinner",
          reason: "Helps with weight loss and recovery",
          timeStart: "19:00",
          timeEnd: "21:00",
        },
        {
          id: "protein-each-meal",
          title: "Include protein at every meal",
          reason: "Supports fat loss while preserving muscle",
        }
      );
      break;
    case "build_muscle":
      suggestions.push(
        {
          id: "protein-target",
          title: "Hit daily protein target",
          reason: "Muscle growth needs consistent protein intake",
        },
        {
          id: "sleep-7h",
          title: "Sleep 7+ hours",
          reason: "Recovery is essential for building muscle",
          timeStart: "22:00",
          timeEnd: "23:30",
        },
        {
          id: "post-workout-stretch",
          title: "Stretch after workouts",
          reason: "Improves mobility and recovery",
        }
      );
      break;
    case "improve_endurance":
      suggestions.push(
        {
          id: "hydrate-training",
          title: "Hydrate before training",
          reason: "Supports endurance performance",
        },
        {
          id: "easy-cardio",
          title: "Easy cardio session",
          reason: "Builds aerobic base for endurance goals",
          weekdays: [1, 3, 5],
        }
      );
      break;
    case "general_health":
      suggestions.push({
        id: "daily-steps",
        title: "Get 8,000+ steps",
        reason: "Supports general health and daily movement",
      });
      break;
    default:
      suggestions.push({
        id: "move-daily",
        title: "Move for 30 minutes",
        reason: "Matches your stay-fit goal",
      });
  }

  if (includesAny(combined, [/smok/, /cigarette/, /vape/])) {
    suggestions.push({
      id: "reduce-smoking",
      title: "Reduce smoking today",
      reason: "Based on your health profile",
    });
  }

  if (includesAny(combined, [/alcohol/, /drink/, /beer/, /wine/])) {
    suggestions.push({
      id: "limit-alcohol",
      title: "Limit alcohol today",
      reason: "Supports your health and fitness goals",
    });
  }

  if (includesAny(work, [/desk/, /office/, /sedentary/, /remote/, /wfh/])) {
    suggestions.push({
      id: "stand-hourly",
      title: "Stand up every hour",
      reason: "Offsets long desk or office hours",
      weekdays: [1, 2, 3, 4, 5],
    });
  }

  if (includesAny(combined, [/sleep/, /bed/, /wake/, /insomnia/])) {
    suggestions.push({
      id: "consistent-sleep",
      title: "Keep a consistent sleep schedule",
      reason: "Your routine mentions sleep patterns",
      timeStart: "22:00",
      timeEnd: "23:00",
    });
  }

  if (profile.injuries?.trim()) {
    suggestions.push({
      id: "mobility-rehab",
      title: "Mobility / rehab exercises",
      reason: "Supports recovery from reported injuries",
    });
  }

  if (profile.medical_conditions?.trim()) {
    suggestions.push({
      id: "medication-routine",
      title: "Follow medication routine",
      reason: "Based on your medical conditions",
      timeStart: "08:00",
      timeEnd: "09:00",
    });
  }

  return suggestions;
}

export function getHabitSuggestionsForProfile(
  profile: Profile,
  existingHabitTitles: string[],
  dismissedIds: string[] = []
): HabitSuggestion[] {
  const existing = new Set(
    existingHabitTitles.map((title) => title.trim().toLowerCase())
  );
  const dismissed = new Set(dismissedIds);

  const seen = new Set<string>();
  return baseSuggestions(profile).filter((suggestion) => {
    if (dismissed.has(suggestion.id)) return false;
    if (existing.has(suggestion.title.trim().toLowerCase())) return false;
    if (seen.has(suggestion.id)) return false;
    seen.add(suggestion.id);
    return true;
  });
}

export function findHabitSuggestionById(
  profile: Profile,
  suggestionId: string
): HabitSuggestion | undefined {
  return baseSuggestions(profile).find((suggestion) => suggestion.id === suggestionId);
}
