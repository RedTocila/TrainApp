import type {
  MacroGap,
  MealSuggestion,
  ProgressPrediction,
  WeeklyCoachReport,
} from "@/lib/ai/types";
import type { BodyWeightLog } from "@/lib/types";

export type CoachChatRichBlock =
  | {
      type: "section_header";
      title: string;
      subtitle?: string;
    }
  | {
      type: "macro_rings";
      gap: MacroGap;
    }
  | {
      type: "stat_tiles";
      tiles: { label: string; value: string }[];
    }
  | {
      type: "insight_banner";
      text: string;
      tone?: "default" | "warning" | "success";
    }
  | {
      type: "score_gauges";
      gauges: { score: number | null; label: string; colorClass: string }[];
    }
  | {
      type: "stat_bars";
      bars: {
        label: string;
        value: number;
        max: number;
        unit?: string;
        accentClass: string;
      }[];
    }
  | {
      type: "tip_cards";
      tips: {
        title: string;
        body: string;
        tone: "default" | "success" | "warning" | "primary";
        icon: string;
      }[];
    }
  | {
      type: "weight_trend";
      prediction: ProgressPrediction;
      weightHistory: BodyWeightLog[];
      startWeightKg?: number | null;
      startDate?: string | null;
    }
  | {
      type: "meal_suggestions";
      headline: string;
      gap: MacroGap;
      suggestions: MealSuggestion[];
    }
  | {
      type: "weekly_report";
      report: WeeklyCoachReport;
    };
