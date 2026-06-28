import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  Bot,
  Brain,
  Calendar,
  Camera,
  ChefHat,
  Crown,
  Dumbbell,
  Flame,
  Headphones,
  History,
  LineChart,
  MessageCircle,
  Mic,
  Ruler,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Users,
  Utensils,
  Video,
  Wand2,
  Zap,
} from "lucide-react";

const FEATURE_ICON_RULES: { pattern: RegExp; icon: LucideIcon }[] = [
  { pattern: /workout plan|workout generator|workout logging|workout history|workout adjustment|exclusive workout/i, icon: Dumbbell },
  { pattern: /nutrition plan|nutrition coach|meal log|meal suggestion|calorie|macro/i, icon: Utensils },
  { pattern: /weight tracking|body measurement/i, icon: Scale },
  { pattern: /progress photo/i, icon: Camera },
  { pattern: /progress stat|progress report|leaderboard/i, icon: BarChart3 },
  { pattern: /streak/i, icon: Flame },
  { pattern: /achievement/i, icon: Award },
  { pattern: /exercise library/i, icon: Target },
  { pattern: /ai fitness coach|ai coach|fitness chat|daily motivation/i, icon: Bot },
  { pattern: /recommendation|recovery|performance insight|prediction/i, icon: Brain },
  { pattern: /live training|live class|coaching call|group coaching/i, icon: Video },
  { pattern: /challenge|competition|prize|transformation/i, icon: Trophy },
  { pattern: /community|elite community/i, icon: Users },
  { pattern: /exclusive educational|early access|priority support/i, icon: Crown },
  { pattern: /chat/i, icon: MessageCircle },
  { pattern: /report/i, icon: LineChart },
  { pattern: /history/i, icon: History },
  { pattern: /coach/i, icon: Mic },
  { pattern: /personalized/i, icon: Wand2 },
  { pattern: /automatic/i, icon: Zap },
  { pattern: /manual meal|recipe|chef/i, icon: ChefHat },
  { pattern: /measurement|ruler/i, icon: Ruler },
  { pattern: /calendar|weekly/i, icon: Calendar },
  { pattern: /support/i, icon: Headphones },
];

export function getPricingFeatureIcon(feature: string): LucideIcon {
  for (const rule of FEATURE_ICON_RULES) {
    if (rule.pattern.test(feature)) return rule.icon;
  }
  return Sparkles;
}
