/**
 * Negation-aware parsing of free-text coach requests.
 *
 * Splits a message into positive text and negated spans ("without shoulders",
 * "don't train legs", "remove leg day", "I can't do pull-ups", "dairy-free").
 * Downstream parsers read focus / required items ONLY from the positive text and
 * treat every negated span as an explicit constraint.
 */

import type { MuscleGroupId } from "@/lib/ai/exercise-profile";

export type NegationKind =
  | "exclude"
  | "lack"
  | "inability"
  | "dislike"
  | "allergy"
  | "reduce";

export type NegatedSpan = {
  cue: string;
  kind: NegationKind;
  /** Text the negation applies to, e.g. "leg day", "squats or lunges". */
  target: string;
};

export type ParsedConstraintText = {
  normalized: string;
  /** Normalized text with every negated span removed. */
  positive: string;
  negated: NegatedSpan[];
};

/** Lowercase + normalize apostrophes / common chat shorthand. */
export function normalizeUserText(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\bw\/o\b/g, "without")
    .replace(/\bdont\b/g, "don't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bdoesnt\b/g, "doesn't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\bive\b/g, "i've")
    .replace(/\bwanna\b/g, "want to")
    .replace(/\bgonna\b/g, "going to")
    .replace(/\bpls\b|\bplz\b/g, "please")
    .replace(/\s+/g, " ")
    .trim();
}

type CueRule = { re: RegExp; kind: NegationKind };

/** Ordered: longer / more specific cues first. Each regex must be global. */
const CUE_RULES: CueRule[] = [
  { re: /\b(?:i'm |i am )?allergic to\b|\ballergy to\b|\ballergies to\b/g, kind: "allergy" },
  { re: /\b(?:i'm |i am )?intolerant (?:to|of)\b|\bintolerance to\b/g, kind: "allergy" },
  {
    re: /\bi (?:don't|do not|never|can't|cannot) (?:eat|drink)\b|\bi (?:can't|cannot) have\b|\bno longer eat\b/g,
    kind: "exclude",
  },
  {
    re: /\bi (?:don't|do not) have(?: any| a| an)?\b|\bi have no\b|\bi haven't got\b|\bi don't own\b|\bno access to\b|\bwithout access to\b/g,
    kind: "lack",
  },
  {
    re: /\bi (?:can't|cannot|can not) (?:do|perform|manage)\b|\bi'm (?:not able|unable) to do\b|\bcan't do\b|\bunable to do\b|\bi can't\b/g,
    kind: "inability",
  },
  {
    re: /\bi (?:don't|do not) (?:like|want|enjoy|need)\b|\bi hate\b|\bnot a fan of\b|\bi dislike\b|\bi'd rather not(?: do| have)?\b/g,
    kind: "dislike",
  },
  {
    re: /\b(?:less|fewer|reduce|go easy on|cut back on|not so much|not too much)\b/g,
    kind: "reduce",
  },
  {
    re: /\b(?:don't|do not|never|shouldn't|should not)\s+(?:put|add|include|use|give(?: me)?|train|do|want|work|hit|program|schedule|make(?: it)?|want any|have)\b/g,
    kind: "exclude",
  },
  {
    re: /\b(?:no more|not including|get rid of|take out|leave out|cut out|lose the|nothing with)\b/g,
    kind: "exclude",
  },
  {
    re: /\b(?:no|without|avoid|avoiding|skip|skipping|exclude|excluding|except|remove|removing|drop|minus|zero|ban|not)\b/g,
    kind: "exclude",
  },
  // Albanian basics: pa (without), mos (don't), hiq (remove), jo (no).
  { re: /\b(?:pa|mos|hiq|hiqe|jo)\b/g, kind: "exclude" },
];

/**
 * Where a negated target ends. Commas / "and" continue a list unless a new
 * positive clause starts ("…no squats, and focus on glutes").
 */
const TARGET_END_RE =
  /[.;!?\n]|\b(?:but|then|instead|while|so that|because|since|though|however|although|plus)\b|,\s*(?=(?:but|and|then|also|with|focus|include|add|make|give|i\b|i'm|use|using|keep|target|more|please|for|at|on|in|it|should|can|do|train|put)\b)|\band\s+(?=(?:with|focus|include|add|make|give|i\b|i'm|use|using|keep|target|more|please|do|train|also|then|put|have|replace|swap|substitute|sub|switch|instead|give|it|make))|\b(?:replace|swap|substitute|switch)\b|\bwith\s+(?=(?:more|extra|a focus|focus)\b)/;

const MAX_TARGET_CHARS = 80;

function extractTarget(rest: string): string {
  const m = rest.match(TARGET_END_RE);
  let out = (m ? rest.slice(0, m.index) : rest)
    .slice(0, MAX_TARGET_CHARS)
    .replace(/^[\s,:-]+/, "")
    .replace(/^(?:any|some|the|a|an|more|of|my|those|these|with)\s+/g, "")
    .replace(/[\s,:-]+$/, "")
    .trim();
  const filler = /\s*\b(?:please|thanks|thank you|today|this week|for me|at all|anymore|any more|ok|okay|in it|from it|from the plan|from my plan)$/;
  while (filler.test(out)) out = out.replace(filler, "").trim();
  return out;
}

/**
 * Parse negations. Overlapping cues resolve to the earliest/longest match so
 * "don't include" wins over its inner "include".
 */
export function parseConstraintText(text: string | null | undefined): ParsedConstraintText {
  const normalized = normalizeUserText(text);
  if (!normalized) return { normalized, positive: "", negated: [] };

  type Hit = { start: number; end: number; cue: string; kind: NegationKind };
  const hits: Hit[] = [];
  for (const rule of CUE_RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(normalized)) != null) {
      hits.push({ start: m.index, end: m.index + m[0].length, cue: m[0], kind: rule.kind });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const negated: NegatedSpan[] = [];
  const removeRanges: [number, number][] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    const rest = normalized.slice(hit.end);
    const target = extractTarget(rest);
    // "No, I want…" / "no problem" etc. — nothing meaningful negated.
    if (!target || /^(?:problem|worries|thanks|thank you|way|idea)\b/.test(target)) {
      cursor = hit.end;
      continue;
    }
    const targetEnd = hit.end + rest.indexOf(target) + target.length;
    negated.push({ cue: hit.cue.trim(), kind: hit.kind, target });
    removeRanges.push([hit.start, targetEnd]);
    cursor = targetEnd;
  }

  // "dairy-free", "equipment free", "gluten-free"
  const freeRe = /\b([a-z]+(?: [a-z]+)?)[\s-]free\b/g;
  let fm: RegExpExecArray | null;
  while ((fm = freeRe.exec(normalized)) != null) {
    const target = fm[1]!.replace(/^(?:a|an|the|make it|keep it|it|be)\s+/, "").trim();
    if (!target || removeRanges.some(([s, e]) => fm!.index >= s && fm!.index < e)) continue;
    negated.push({ cue: "-free", kind: "exclude", target });
    removeRanges.push([fm.index, fm.index + fm[0].length]);
  }

  // "squats are off limits / banned / forbidden"
  const offRe = /\b([a-z][a-z\s-]{2,40}?)\s+(?:are|is)\s+(?:off[\s-]?limits|forbidden|banned|a no[\s-]?go)\b/g;
  let om: RegExpExecArray | null;
  while ((om = offRe.exec(normalized)) != null) {
    negated.push({ cue: "off limits", kind: "exclude", target: om[1]!.trim() });
    removeRanges.push([om.index, om.index + om[0].length]);
  }

  removeRanges.sort((a, b) => a[0] - b[0]);
  let positive = "";
  let last = 0;
  for (const [s, e] of removeRanges) {
    if (s < last) continue;
    positive += normalized.slice(last, s) + " ";
    last = e;
  }
  positive += normalized.slice(last);

  return {
    normalized,
    positive: positive.replace(/\s+/g, " ").trim(),
    negated,
  };
}

/** Split a negated target list: "squats, lunges or jumps" → parts. */
export function splitTargetList(target: string): string[] {
  return target
    .split(/\s*(?:,|&|\/|\+|\band\b|\bor\b|\bnor\b)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

// ─── Muscle-group vocabulary ───────────────────────────────────────────────

const LEG_GROUPS: MuscleGroupId[] = [
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
];
const SHOULDER_GROUPS: MuscleGroupId[] = ["front_delts", "side_delts", "rear_delts"];
const ARM_GROUPS: MuscleGroupId[] = ["biceps", "triceps", "forearms"];
const BACK_GROUPS: MuscleGroupId[] = ["lats", "upper_back", "traps"];
const CHEST_GROUPS: MuscleGroupId[] = ["chest", "upper_chest"];
const CORE_GROUPS: MuscleGroupId[] = ["core", "obliques"];

export const MUSCLE_GROUP_SETS = {
  legs: LEG_GROUPS,
  shoulders: SHOULDER_GROUPS,
  arms: ARM_GROUPS,
  back: BACK_GROUPS,
  chest: CHEST_GROUPS,
  core: CORE_GROUPS,
  upper_body: [...CHEST_GROUPS, ...BACK_GROUPS, ...SHOULDER_GROUPS, ...ARM_GROUPS],
  lower_body: LEG_GROUPS,
  push: [...CHEST_GROUPS, "front_delts", "side_delts", "triceps"] as MuscleGroupId[],
  pull: [...BACK_GROUPS, "rear_delts", "biceps", "forearms"] as MuscleGroupId[],
} as const;

type MuscleTerm = { re: RegExp; groups: MuscleGroupId[]; label: string };

/** More specific terms first — callers stop matching overlapping text. */
const MUSCLE_TERMS: MuscleTerm[] = [
  { re: /\bupper (?:chest|pecs?)\b|\bclavicular\b/, groups: ["upper_chest"], label: "upper chest" },
  { re: /\blower back\b|\berectors?\b/, groups: ["lower_back"], label: "lower back" },
  { re: /\bupper back\b|\brhomboids?\b/, groups: ["upper_back"], label: "upper back" },
  { re: /\brear delts?\b|\brear deltoids?\b|\brear shoulders?\b/, groups: ["rear_delts"], label: "rear delts" },
  { re: /\bside delts?\b|\blateral delts?\b|\bmedial delts?\b/, groups: ["side_delts"], label: "side delts" },
  { re: /\bfront delts?\b|\banterior delts?\b/, groups: ["front_delts"], label: "front delts" },
  { re: /\binner thighs?\b|\badductors?\b/, groups: ["adductors"], label: "adductors" },
  { re: /\bouter thighs?\b|\babductors?\b|\bglute med(?:ius)?\b/, groups: ["abductors"], label: "abductors" },
  { re: /\blower[\s-]?body\b|\blegs?\b|\bleg day\b|\bkembe\b|\bkembet\b/, groups: LEG_GROUPS, label: "legs" },
  { re: /\bupper[\s-]?body\b/, groups: [...MUSCLE_GROUP_SETS.upper_body], label: "upper body" },
  { re: /\bchest\b|\bpecs?\b|\bpectorals?\b|\bgjoks\w*\b/, groups: CHEST_GROUPS, label: "chest" },
  { re: /\blats?\b|\blatissimus\b/, groups: ["lats"], label: "lats" },
  { re: /\btraps?\b|\btrapezius\b/, groups: ["traps"], label: "traps" },
  { re: /\bback\b(?! to\b)|\bshpin\w*\b/, groups: BACK_GROUPS, label: "back" },
  { re: /\bshoulders?\b|\bdelts?\b|\bdeltoids?\b|\bshpatull\w*\b/, groups: SHOULDER_GROUPS, label: "shoulders" },
  { re: /\bbiceps?\b|\bbis\b|\bbicep curls?\b/, groups: ["biceps"], label: "biceps" },
  { re: /\btriceps?\b|\btris\b/, groups: ["triceps"], label: "triceps" },
  { re: /\bforearms?\b|\bgrip\b/, groups: ["forearms"], label: "forearms" },
  { re: /\barms?\b|\bkrah\w*\b/, groups: ARM_GROUPS, label: "arms" },
  { re: /\bobliques?\b|\blove handles\b/, groups: ["obliques"], label: "obliques" },
  { re: /\bcore\b|\babs\b|\babdominals?\b|\bsix[\s-]?pack\b|\bstomach\b|\bbark\w*\b/, groups: CORE_GROUPS, label: "core" },
  { re: /\bglutes?\b|\bbooty\b|\bbutt\b|\bbum\b|\bvithe\w*\b/, groups: ["glutes"], label: "glutes" },
  { re: /\bhamstrings?\b|\bhammies\b|\bhams\b/, groups: ["hamstrings"], label: "hamstrings" },
  { re: /\bquads?\b|\bquadriceps\b/, groups: ["quads"], label: "quads" },
  { re: /\bthighs?\b/, groups: ["quads", "hamstrings"], label: "thighs" },
  { re: /\bcalf\b|\bcalves\b/, groups: ["calves"], label: "calves" },
  { re: /\bneck\b/, groups: ["neck"], label: "neck" },
];

export type MuscleMention = { label: string; groups: MuscleGroupId[] };

/** Muscle groups mentioned in a text fragment (specific terms consume text first). */
export function parseMuscleMentions(text: string): MuscleMention[] {
  let remaining = ` ${normalizeUserText(text)} `;
  const out: MuscleMention[] = [];
  for (const term of MUSCLE_TERMS) {
    const re = new RegExp(term.re.source, "g");
    if (!re.test(remaining)) continue;
    out.push({ label: term.label, groups: [...term.groups] });
    remaining = remaining.replace(new RegExp(term.re.source, "g"), " ");
  }
  return out;
}

export function muscleGroupsFromMentions(mentions: MuscleMention[]): MuscleGroupId[] {
  const set = new Set<MuscleGroupId>();
  for (const m of mentions) for (const g of m.groups) set.add(g);
  return [...set];
}

/** Human label for a set of muscle groups (for prompts / tool results). */
export function describeMuscleGroups(groups: readonly MuscleGroupId[]): string {
  const set = new Set(groups);
  const parts: string[] = [];
  const take = (label: string, members: readonly MuscleGroupId[]) => {
    if (members.every((g) => set.has(g))) {
      parts.push(label);
      for (const g of members) set.delete(g);
    }
  };
  take("legs", LEG_GROUPS);
  take("shoulders", SHOULDER_GROUPS);
  take("arms", ARM_GROUPS);
  take("back", BACK_GROUPS);
  take("chest", CHEST_GROUPS);
  take("core", CORE_GROUPS);
  for (const g of set) parts.push(g.replace(/_/g, " "));
  return parts.join(", ");
}

// ─── Day-focus vocabulary (for "remove leg day") ───────────────────────────

export type DayFocusId =
  | "legs"
  | "push"
  | "pull"
  | "upper"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body"
  | "cardio";

const DAY_FOCUS_TERMS: { re: RegExp; id: DayFocusId }[] = [
  { re: /\b(?:legs?|lower(?:[\s-]?body)?|glutes?|quads?|hamstrings?|kembe\w*)\b/, id: "legs" },
  { re: /\bpush\b/, id: "push" },
  { re: /\bpull\b/, id: "pull" },
  { re: /\bupper(?:[\s-]?body)?\b/, id: "upper" },
  { re: /\bchest\b/, id: "chest" },
  { re: /\bback\b/, id: "back" },
  { re: /\bshoulders?\b/, id: "shoulders" },
  { re: /\barms?\b/, id: "arms" },
  { re: /\b(?:core|abs)\b/, id: "core" },
  { re: /\bfull[\s-]?body\b/, id: "full_body" },
  { re: /\b(?:cardio|conditioning|hiit)\b/, id: "cardio" },
];

/** "leg day" / "the legs workout" / "lower body session" → day focus ids. */
export function parseDayFocusMentions(target: string): DayFocusId[] {
  if (!/\b(?:day|days|session|sessions|workout|workouts|dite|dita)\b/.test(target)) return [];
  const out: DayFocusId[] = [];
  for (const t of DAY_FOCUS_TERMS) {
    if (t.re.test(target) && !out.includes(t.id)) out.push(t.id);
  }
  return out;
}

/** Muscle groups a day focus trains (empty = not muscle-specific). */
export const DAY_FOCUS_MUSCLES: Record<DayFocusId, readonly MuscleGroupId[]> = {
  legs: MUSCLE_GROUP_SETS.legs,
  push: MUSCLE_GROUP_SETS.push,
  pull: MUSCLE_GROUP_SETS.pull,
  upper: MUSCLE_GROUP_SETS.upper_body,
  chest: MUSCLE_GROUP_SETS.chest,
  back: MUSCLE_GROUP_SETS.back,
  shoulders: MUSCLE_GROUP_SETS.shoulders,
  arms: MUSCLE_GROUP_SETS.arms,
  core: MUSCLE_GROUP_SETS.core,
  full_body: [],
  cardio: [],
};

/** Regex matching a workout-day title for a focus id. */
export const DAY_TITLE_PATTERNS: Record<DayFocusId, RegExp> = {
  legs: /\bleg|\blower|\bquad|\bhamstring|\bglute|\bsquat|\bcalf|\bcalves|\bposterior chain/i,
  push: /\bpush\b/i,
  pull: /\bpull\b/i,
  upper: /\bupper\b/i,
  chest: /\bchest\b/i,
  back: /\bback\b/i,
  shoulders: /\bshoulder|\bdelt/i,
  arms: /\barms?\b|\bbiceps?\b|\btriceps?\b/i,
  core: /\bcore\b|\babs\b/i,
  full_body: /\bfull[\s-]?body\b/i,
  cardio: /\bcardio|\bconditioning|\bhiit\b/i,
};
