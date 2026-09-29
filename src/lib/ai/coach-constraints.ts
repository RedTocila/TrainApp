/**
 * Constraint extraction layer: turns a user message (and conversation) into a
 * structured, deterministic constraint object BEFORE any generation happens.
 *
 * Priority (applied by consumers): current explicit instruction > explicit
 * constraints > safety > profile > goals > history > preferences.
 */

import {
  describeMuscleGroups,
  muscleGroupsFromMentions,
  normalizeUserText,
  parseConstraintText,
  parseDayFocusMentions,
  parseMuscleMentions,
  splitTargetList,
  type DayFocusId,
  type NegatedSpan,
} from "@/lib/ai/constraint-language";
import { classifyCoachIntent, EXERCISE_NOUN_RE, type CoachIntent } from "@/lib/ai/coach-intent";
import {
  emptyEquipmentDirectives,
  mergeEquipmentDirectives,
  parseEquipmentDirectives,
  type EquipmentDirectives,
} from "@/lib/ai/equipment-taxonomy";
import type { JointArea, MuscleGroupId } from "@/lib/ai/exercise-profile";
import {
  EXERCISE_FAMILIES,
  parseExcludedFamiliesFromText,
  parseRequiredExercisePhrases,
  type ExerciseFamilyId,
} from "@/lib/ai/exercise-semantic-match";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type CoachGoal = "fat_loss" | "muscle_gain" | "strength" | "endurance" | "toning" | "mobility" | "general";
export type CoachLocation = "home" | "gym" | "outdoor";

export type CoachConstraints = {
  intent: CoachIntent;
  must_include: string[];
  must_exclude: string[];
  excluded_families: ExerciseFamilyId[];
  equipment: EquipmentDirectives;
  muscles_focus: MuscleGroupId[];
  muscles_avoid: MuscleGroupId[];
  muscles_reduce: MuscleGroupId[];
  days_exclude: DayFocusId[];
  experience_level: ExperienceLevel | null;
  /** "I can do pistols" — allow a required move above the experience cap. */
  experience_override: boolean;
  injuries_limitations: JointArea[];
  low_impact: boolean;
  location: CoachLocation | null;
  duration_minutes: number | null;
  frequency_days: number | null;
  exercise_count: number | null;
  goal: CoachGoal | null;
  /** Negated targets that were not exercise/muscle/equipment (foods etc.). */
  other_negations: NegatedSpan[];
  replacement_requested: boolean;
  other_requirements: string[];
  positive_text: string;
  raw_text: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Muscle words inside exercise names must not count as focus/avoid. */
const EXERCISE_NAME_WITH_MUSCLE_RE =
  /\b(?:leg|legs|chest|shoulder|back|calf|hip|glute|arm|tricep|triceps|bicep|biceps|hamstring|lat|ab)\s+(?:press(?:es)?|curls?|extensions?|raises?|fl(?:y|ies|yes)|dips?|thrusts?|bridges?|kickbacks?|rows?|squats?|stretch(?:es)?|circles?|pulldowns?|swings?|abductions?|adductions?|walks?)\b/g;
const IDIOM_BACK_RE = /\b(?:get|come|go|coming|going|getting|be|bring|set|put|add|adding|putting|bringing) (?:it |them |that |those |squats |legs |\w+ )?back\b|\bback (?:then|again|home|in|on track)\b|\bback[\s-]?to[\s-]?back\b/g;

function stripExerciseNames(text: string): string {
  return text.replace(EXERCISE_NAME_WITH_MUSCLE_RE, " ").replace(IDIOM_BACK_RE, " ");
}

function isExercisePhrase(part: string): boolean {
  return EXERCISE_NOUN_RE.test(part) || EXERCISE_FAMILIES.some((f) => f.mentionPatterns.some((p) => p.test(part)));
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

function toNumber(s: string | undefined): number | null {
  if (!s) return null;
  const n = /^\d+$/.test(s) ? parseInt(s, 10) : WORD_NUMBERS[s] ?? NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseDurationMinutesFromText(text: string): number | null {
  const t = normalizeUserText(text);
  const hour = t.match(/\b(?:an|1|one) hour\b|\b60 ?min/);
  const m = t.match(/\b(\d{1,3})\s*(?:-|to)?\s*(?:\d{1,3}\s*)?(?:min(?:ute)?s?|mins?)\b/);
  if (m) {
    const n = parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 5 && n <= 180) return n;
  }
  if (/\bhalf (?:an )?hour\b/.test(t)) return 30;
  if (hour) return 60;
  const h = t.match(/\b(\d(?:\.\d)?)\s*(?:hours?|hrs?)\b/);
  if (h) {
    const n = Math.round(parseFloat(h[1]!) * 60);
    if (n >= 5 && n <= 180) return n;
  }
  return null;
}

export function parseFrequencyDays(text: string): number | null {
  const t = normalizeUserText(text);
  const num = "(\\d|one|two|three|four|five|six|seven)";
  const patterns = [
    new RegExp(`\\b${num}\\s*(?:-|to)?\\s*days?\\s*(?:a|per|each|every|\\/)\\s*week\\b`),
    new RegExp(`\\b${num}[\\s-]?days?[\\s-](?:split|program|programme|plan|routine|schedule|week|workout plan|training plan)\\b`),
    new RegExp(`\\b${num}\\s*(?:x|times)\\s*(?:a|per|\\/)?\\s*week\\b`),
    new RegExp(`\\btrain(?:ing)?\\s+${num}\\s+days?\\b`),
    new RegExp(`\\b${num}\\s+(?:training|workout|gym)\\s+days\\b`),
    new RegExp(`\\b${num}\\s+dite\\b`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const n = toNumber(m?.[1]);
    if (n && n >= 1 && n <= 7) return n;
  }
  return null;
}

export function parseExerciseCountFromText(text: string): number | null {
  const t = normalizeUserText(text);
  const m = t.match(/\b(?:exactly\s+|only\s+|just\s+)?(\d{1,2}|one|two|three|four|five|six|seven)\s+(?:different\s+)?exercises?\b/);
  const n = toNumber(m?.[1]);
  if (!n || n < 1 || n > 20) return null;
  return n;
}

function parseExperience(positive: string): ExperienceLevel | null {
  if (/\b(?:beginner|newbie|novice|new to (?:training|working out|the gym|lifting|exercise|exercising|fitness|this)|just (?:started|starting)|never (?:trained|worked out|lifted|exercised)|first time|haven't (?:trained|worked out|exercised) in (?:a long time|years|ages)|out of shape|complete beginner|fillestar)\b/.test(positive)) {
    return "beginner";
  }
  if (/\b(?:advanced|very experienced|experienced lifter|athlete|been (?:lifting|training) for (?:\d{1,2}|several|many|five|six|seven|eight|ten) years|competitive|expert|i'm strong)\b/.test(positive)) {
    return "advanced";
  }
  if (/\b(?:intermediate|some experience|been (?:lifting|training) for (?:a|1|one|2|two) years?|mesatar)\b/.test(positive)) {
    return "intermediate";
  }
  return null;
}

const PAIN_RE =
  /\b(?:hurts?|hurting|pain(?:ful)?|injur(?:y|ies|ed)|sore|problems?|issues?|surgery|torn|tear|recovering|rehab|ache|aches|achy|sensitive|tendin\w*|arthritis|sprain(?:ed)?|strain(?:ed)?|niggle|dodgy|clicky|herniat\w*|bulging|sciatica|impingement|dislocat\w*|replacement|operated|dhemb\w*|lendim\w*)\b|\b(?:bad|weak|injured|busted|messed up) (?:knee|back|shoulder|hip|ankle|wrist|elbow)s?\b/;

const JOINT_TERMS: { joint: JointArea; re: RegExp }[] = [
  { joint: "knees", re: /\bknees?\b|\bacl\b|\bmcl\b|\bmeniscus\b|\bpatell\w*\b|\bgju\w*\b/ },
  { joint: "back", re: /\blower back\b|\bback\b|\bspine\b|\bdiscs?\b|\bsciatica\b|\blumbar\b|\bshpin\w*\b/ },
  { joint: "shoulders", re: /\bshoulders?\b|\brotator cuff\b|\bimpingement\b|\bshpatull\w*\b/ },
  { joint: "hips", re: /\bhips?\b|\bhip flexors?\b|\bpiriformis\b/ },
  { joint: "ankles", re: /\bankles?\b|\bachilles\b|\bfeet\b|\bfoot\b|\bplantar\b/ },
  { joint: "wrists", re: /\bwrists?\b|\belbows?\b|\btennis elbow\b|\bgolfer'?s elbow\b|\bcarpal\b/ },
];

function parseInjuries(normalized: string): JointArea[] {
  const out = new Set<JointArea>();
  const clauses = normalized.split(/[.;!?,]|\bbut\b|\bso\b|\band\b(?=\s+(?:i|my|also))/);
  for (const clause of clauses) {
    const friendly = /\b(?:easy on|gentle on|friendly for|protect|careful with|go easy on)\b/.test(clause) || /(?:knee|joint|back|shoulder|wrist)[\s-]?friendly/.test(clause);
    if (!PAIN_RE.test(clause) && !friendly) continue;
    for (const { joint, re } of JOINT_TERMS) {
      if (re.test(clause)) out.add(joint);
    }
  }
  return [...out];
}

function parseLowImpact(normalized: string, negated: NegatedSpan[]): boolean {
  if (/\blow[\s-]?impact\b|\bquiet\b|\bapartment\b|\bneighbou?rs?\b|\bjoint[\s-]?friendly\b|\bknee[\s-]?friendly\b|\bno[\s-]?impact\b/.test(normalized)) {
    return true;
  }
  return negated.some((n) => n.kind !== "reduce" && /\b(?:jump(?:ing|s)?|plyo\w*|high[\s-]?impact|impact)\b/.test(n.target));
}

function parseLocation(positive: string): CoachLocation | null {
  if (/\bat home\b|\bhome\b|\bin my (?:room|apartment|living room|bedroom|house|flat)\b|\bshtepi\b/.test(positive)) return "home";
  if (/\bgym\b|\bpalester\w*\b/.test(positive)) return "gym";
  if (/\boutdoors?\b|\boutside\b|\bpark\b|\bplayground\b/.test(positive)) return "outdoor";
  return null;
}

function parseGoal(positive: string): CoachGoal | null {
  if (/\blose (?:weight|fat)\b|\bfat loss\b|\bweight loss\b|\bcut(?:ting)?\b|\bshred\w*\b|\blean(?:er)? out\b|\bburn fat\b/.test(positive)) return "fat_loss";
  if (/\bbuild muscle\b|\bbulk\w*\b|\bhypertrophy\b|\bgain (?:muscle|mass|size|weight)\b|\bget bigger\b|\bgrow\b|\bmass\b/.test(positive)) return "muscle_gain";
  if (/\bstrength\b|\bstronger\b|\bpowerlifting\b|\b1rm\b|\bmax(?:imal)? strength\b/.test(positive)) return "strength";
  if (/\bendurance\b|\bstamina\b|\bconditioning\b|\bmarathon\b|\brunning\b/.test(positive)) return "endurance";
  if (/\btone\b|\btoned\b|\btoning\b|\bdefinition\b|\bsculpt\w*\b/.test(positive)) return "toning";
  if (/\bmobility\b|\bflexib\w*\b|\bstretch(?:ing)?\b/.test(positive)) return "mobility";
  return null;
}

const FOCUS_BOOST_RE = /\b(?:more|extra|emphasi[sz]e|emphasis on|prioriti[sz]e|focus(?:ing)? on|focused on|target(?:ing)?|bigger|grow(?:ing)?|build(?:ing)?|bring up|lagging|weak point)\b/;

// ─── Extraction ────────────────────────────────────────────────────────────

/** Extract structured constraints from ONE message. */
export function extractCoachConstraints(
  text: string | null | undefined,
  context?: { hasExistingPlan?: boolean }
): CoachConstraints {
  const raw = text ?? "";
  const parsed = parseConstraintText(raw);
  const normalized = parsed.normalized;
  const positive = parsed.positive;
  const intent = classifyCoachIntent(raw, context);

  const mustExclude = new Set<string>();
  const families = new Set<ExerciseFamilyId>(parseExcludedFamiliesFromText(normalized));
  const avoid = new Set<MuscleGroupId>();
  const reduce = new Set<MuscleGroupId>();
  const daysExclude = new Set<DayFocusId>();
  const otherNegations: NegatedSpan[] = [];

  for (const span of parsed.negated) {
    const target = span.target;
    const dayFocus = parseDayFocusMentions(target);
    if (dayFocus.length > 0 && span.kind !== "reduce") {
      for (const d of dayFocus) daysExclude.add(d);
      // "no leg day" also means no leg-focused work in a NEW program.
      if (dayFocus.includes("legs")) {
        for (const g of muscleGroupsFromMentions(parseMuscleMentions("legs"))) avoid.add(g);
      }
      continue;
    }
    let consumed = false;
    for (const part of splitTargetList(target)) {
      if (isExercisePhrase(part)) {
        consumed = true;
        if (span.kind === "reduce") continue;
        let familyHit = false;
        for (const f of EXERCISE_FAMILIES) {
          if (f.mentionPatterns.some((p) => p.test(part))) {
            families.add(f.id);
            familyHit = true;
          }
        }
        // Specific names ("bulgarian split squat") are also kept verbatim.
        const cleaned = part.replace(/^(?:any|the|a|an|doing|to do)\s+/, "").trim();
        if (!familyHit || cleaned.split(/\s+/).length > 1) {
          if (!/^(?:exercises?|moves?|movements?)$/.test(cleaned)) mustExclude.add(cleaned);
        }
        continue;
      }
      const muscles = muscleGroupsFromMentions(parseMuscleMentions(stripExerciseNames(part)));
      if (muscles.length > 0) {
        consumed = true;
        for (const g of muscles) (span.kind === "reduce" ? reduce : avoid).add(g);
      }
    }
    if (!consumed) otherNegations.push(span);
  }

  // Focus: positive muscle mentions (exercise names stripped first).
  const focusText = stripExerciseNames(positive);
  const focus = new Set<MuscleGroupId>();
  if (!/\bfull[\s-]?body\b/.test(focusText) || FOCUS_BOOST_RE.test(focusText)) {
    for (const g of muscleGroupsFromMentions(parseMuscleMentions(focusText))) {
      if (!avoid.has(g)) focus.add(g);
    }
  }
  if (/\bpush\b(?![\s-]?ups?)/.test(focusText)) for (const g of ["chest", "front_delts", "side_delts", "triceps"] as MuscleGroupId[]) if (!avoid.has(g)) focus.add(g);
  if (/\bpull\b(?![\s-]?ups?)/.test(focusText)) for (const g of ["lats", "upper_back", "rear_delts", "biceps"] as MuscleGroupId[]) if (!avoid.has(g)) focus.add(g);

  const mustInclude = parseRequiredExercisePhrases(positive).filter((p) => isExercisePhrase(p));

  const experience = parseExperience(positive);
  const override =
    /\bi can (?:do|already do|handle|manage) (?:it|them|those|that|these|\w+)\b|\bi(?:'m| am) (?:able to|strong enough|experienced with)\b|\bi know how to\b|\bi(?:'ve| have) done (?:it|them|these|those|that) before\b|\btrust me\b|\bi insist\b|\bkeep (?:it|them) anyway\b/.test(
      normalized
    );

  const other: string[] = [];
  if (/\bsuperset/.test(normalized)) other.push("use supersets");
  if (/\bcircuit\b/.test(normalized)) other.push("circuit format");
  if (/\bno rest\b|\bminimal rest\b|\bshort rest\b/.test(normalized)) other.push("short rest periods");
  if (/\bwarm[\s-]?up\b/.test(positive)) other.push("include a warm-up");
  if (/\bstretch(?:ing)?\b|\bcool[\s-]?down\b/.test(positive)) other.push("include stretching / cool-down");

  return {
    intent,
    must_include: mustInclude,
    must_exclude: [...mustExclude],
    excluded_families: [...families],
    equipment: parseEquipmentDirectives(raw),
    muscles_focus: [...focus],
    muscles_avoid: [...avoid],
    muscles_reduce: [...reduce].filter((g) => !avoid.has(g)),
    days_exclude: [...daysExclude],
    experience_level: experience,
    experience_override: override,
    injuries_limitations: parseInjuries(normalized),
    low_impact: parseLowImpact(normalized, parsed.negated),
    location: parseLocation(positive),
    duration_minutes: parseDurationMinutesFromText(normalized),
    frequency_days: parseFrequencyDays(normalized),
    exercise_count: parseExerciseCountFromText(normalized),
    goal: parseGoal(positive),
    other_negations: otherNegations,
    replacement_requested: intent.replacementRequested,
    other_requirements: other,
    positive_text: positive,
    raw_text: raw,
  };
}

export function emptyCoachConstraints(): CoachConstraints {
  return extractCoachConstraints("");
}

/**
 * Merge constraints from a chronological list of messages. Entries flagged
 * `current` (the latest user turn + the tool's own preferences) contribute
 * request-scoped fields; earlier turns only contribute persistent constraints
 * (exclusions, avoided muscles, equipment, injuries, experience, foods).
 * A later positive request lifts an earlier exclusion of the same thing.
 */
export function mergeCoachConstraints(
  entries: { c: CoachConstraints; current: boolean }[]
): CoachConstraints {
  const out = emptyCoachConstraints();
  const families = new Set<ExerciseFamilyId>();
  const mustExclude = new Set<string>();
  const avoid = new Set<MuscleGroupId>();
  const reduce = new Set<MuscleGroupId>();
  const injuries = new Set<JointArea>();
  const focus = new Set<MuscleGroupId>();
  const include = new Set<string>();
  const daysExclude = new Set<DayFocusId>();
  const equipment: EquipmentDirectives[] = [];
  const otherReq = new Set<string>();

  for (const { c, current } of entries) {
    // Lift earlier exclusions when this turn explicitly asks for them again.
    for (const phrase of c.must_include) {
      for (const f of EXERCISE_FAMILIES) {
        if (f.mentionPatterns.some((p) => p.test(phrase))) families.delete(f.id);
      }
      mustExclude.delete(phrase);
    }
    for (const g of c.muscles_focus) {
      avoid.delete(g);
      reduce.delete(g);
    }

    for (const f of c.excluded_families) families.add(f);
    for (const p of c.must_exclude) mustExclude.add(p);
    for (const g of c.muscles_avoid) avoid.add(g);
    for (const g of c.muscles_reduce) reduce.add(g);
    for (const j of c.injuries_limitations) injuries.add(j);
    equipment.push(c.equipment);
    if (c.experience_level) out.experience_level = c.experience_level;
    if (c.low_impact) out.low_impact = true;
    out.other_negations.push(...c.other_negations);
    if (c.duration_minutes != null) out.duration_minutes = c.duration_minutes;
    if (c.goal) out.goal = c.goal;

    if (current) {
      for (const g of c.muscles_focus) focus.add(g);
      for (const p of c.must_include) include.add(p);
      for (const d of c.days_exclude) daysExclude.add(d);
      for (const r of c.other_requirements) otherReq.add(r);
      if (c.frequency_days != null) out.frequency_days = c.frequency_days;
      if (c.exercise_count != null) out.exercise_count = c.exercise_count;
      if (c.location) out.location = c.location;
      if (c.experience_override) out.experience_override = true;
      if (c.replacement_requested) out.replacement_requested = true;
      out.intent = c.intent;
      out.positive_text = [out.positive_text, c.positive_text].filter(Boolean).join(" ");
      out.raw_text = [out.raw_text, c.raw_text].filter(Boolean).join("\n");
    }
  }

  for (const g of avoid) focus.delete(g);
  out.excluded_families = [...families];
  out.must_exclude = [...mustExclude];
  out.muscles_avoid = [...avoid];
  out.muscles_reduce = [...reduce].filter((g) => !avoid.has(g));
  out.muscles_focus = [...focus];
  out.must_include = [...include];
  out.days_exclude = [...daysExclude];
  out.injuries_limitations = [...injuries];
  out.equipment = equipment.length ? mergeEquipmentDirectives(equipment) : emptyEquipmentDirectives();
  out.other_requirements = [...otherReq];
  return out;
}

/**
 * Standard ordering: earlier user turns → tool preferences → latest user turn.
 * The user's own latest words always win over the model's paraphrase.
 */
export function constraintsFromConversation(
  userTurns: readonly string[],
  preferences?: string | null,
  context?: { hasExistingPlan?: boolean }
): CoachConstraints {
  const turns = userTurns.filter((t) => t && t.trim());
  const entries: { c: CoachConstraints; current: boolean }[] = [];
  const earlier = turns.slice(0, -1);
  const latest = turns.length ? turns[turns.length - 1]! : null;
  for (const t of earlier) entries.push({ c: extractCoachConstraints(t, context), current: false });
  if (preferences?.trim()) entries.push({ c: extractCoachConstraints(preferences, context), current: true });
  if (latest) entries.push({ c: extractCoachConstraints(latest, context), current: true });
  return mergeCoachConstraints(entries);
}

/** Compact, human-readable block injected into the chat turn for the LLM. */
export function formatConstraintsForChat(c: CoachConstraints): string {
  const lines: string[] = [];
  const eq = c.equipment;
  if (eq.base) lines.push(`equipment: ${eq.base.description}`);
  if (eq.forbidTags.size) lines.push(`equipment forbidden: ${[...eq.forbidTags].filter((t) => t !== "resistance band").join(", ")}`);
  if (eq.addProps.size) lines.push(`also available: ${[...eq.addProps].join(", ").replace(/_/g, " ")}`);
  if (eq.forbidGym) lines.push("no gym access");
  if (c.muscles_focus.length) lines.push(`focus: ${describeMuscleGroups(c.muscles_focus)}`);
  if (c.muscles_avoid.length) lines.push(`do NOT train: ${describeMuscleGroups(c.muscles_avoid)}`);
  if (c.muscles_reduce.length) lines.push(`less volume for: ${describeMuscleGroups(c.muscles_reduce)}`);
  if (c.excluded_families.length) {
    lines.push(
      `excluded movements: ${c.excluded_families.map((f) => EXERCISE_FAMILIES.find((x) => x.id === f)?.label ?? f).join(", ")}`
    );
  }
  if (c.must_exclude.length) lines.push(`excluded exercises: ${c.must_exclude.join(", ")}`);
  if (c.must_include.length) lines.push(`must include: ${c.must_include.join(", ")}`);
  if (c.days_exclude.length) lines.push(`remove/skip day type: ${c.days_exclude.join(", ").replace(/_/g, " ")}`);
  if (c.experience_level) lines.push(`experience: ${c.experience_level}`);
  if (c.injuries_limitations.length) lines.push(`injury/limitation: ${c.injuries_limitations.join(", ")}`);
  if (c.low_impact) lines.push("low impact (no jumping)");
  if (c.duration_minutes) lines.push(`duration: ${c.duration_minutes} min`);
  if (c.frequency_days) lines.push(`frequency: ${c.frequency_days} days/week`);
  if (c.exercise_count) lines.push(`exercise count: ${c.exercise_count}`);
  if (c.location) lines.push(`location: ${c.location}`);
  if (c.goal) lines.push(`goal: ${c.goal.replace(/_/g, " ")}`);
  if (c.other_requirements.length) lines.push(`other: ${c.other_requirements.join(", ")}`);
  const foods = c.other_negations.filter((n) => n.kind !== "reduce" && n.kind !== "inability").map((n) => n.target);
  if (foods.length) lines.push(`other exclusions (foods etc.): ${foods.join(", ")}`);
  lines.push(`intent: ${c.intent.primary.replace(/_/g, " ")}${c.intent.removeOnly ? " (remove only — no replacement)" : ""}`);
  return lines.map((l) => `- ${l}`).join("\n");
}
