/**
 * Semantic exercise profile derived from catalog metadata (name, tags, muscles,
 * instructions). Pure — no catalog import — so equipment-taxonomy can use it
 * without an import cycle.
 *
 * The ExerciseDB tags many moves as "body weight" even when they need a bar,
 * bench, chair, rings, or a band. `propRequirements` / `impliedEquipmentTags`
 * capture that hidden equipment so "no equipment" really means bodyweight only.
 */

import type { CatalogExercise } from "@/lib/exercise-catalog";

/** Non-catalog equipment / environment an exercise may need. */
export type ExerciseProp =
  | "pull_up_bar"
  | "dip_station"
  | "rings_suspension"
  | "low_bar"
  | "bench"
  | "chair"
  | "box_step"
  | "towel"
  | "partner"
  | "balance_board"
  | "gym_station"
  | "wall";

export const ALL_EXERCISE_PROPS: readonly ExerciseProp[] = [
  "pull_up_bar",
  "dip_station",
  "rings_suspension",
  "low_bar",
  "bench",
  "chair",
  "box_step",
  "towel",
  "partner",
  "balance_board",
  "gym_station",
  "wall",
];

export const PROP_LABELS: Record<ExerciseProp, string> = {
  pull_up_bar: "pull-up bar",
  dip_station: "dip station / parallel bars",
  rings_suspension: "rings / suspension trainer",
  low_bar: "low bar (for rows)",
  bench: "bench",
  chair: "chair",
  box_step: "box / step / stairs",
  towel: "towel",
  partner: "training partner",
  balance_board: "balance board",
  gym_station: "gym station (hyperextension / GHD / captain's chair)",
  wall: "wall",
};

export type MovementPattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "hip_extension"
  | "hip_abduction"
  | "knee_flexion"
  | "carry"
  | "rotation"
  | "anti_rotation"
  | "anti_extension"
  | "anti_flexion"
  | "anti_lateral_flexion"
  | "core_flexion"
  | "calf"
  | "isolation"
  | "locomotion"
  | "plyometric"
  | "mobility"
  | "cardio";

/** Main-lift patterns programmed before accessories. */
export const COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "hip_extension",
]);

/** 1 beginner · 2 intermediate · 3 advanced · 4 elite skill. */
export type DifficultyTier = 1 | 2 | 3 | 4;

export type JointArea = "knees" | "back" | "shoulders" | "hips" | "ankles" | "wrists";

export const ALL_JOINT_AREAS: readonly JointArea[] = [
  "knees",
  "back",
  "shoulders",
  "hips",
  "ankles",
  "wrists",
];

/** Fine-grained muscle groups used for focus / avoid logic. */
export type MuscleGroupId =
  | "chest"
  | "upper_chest"
  | "lats"
  | "upper_back"
  | "traps"
  | "lower_back"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "obliques"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "adductors"
  | "abductors"
  | "neck"
  | "cardio";

export type ExerciseProfile = {
  id: string;
  name: string;
  /** Catalog tags + tags implied by instructions for "body weight" moves. */
  effectiveEquipmentTags: string[];
  impliedEquipmentTags: string[];
  /** AND of OR-groups: each inner array is satisfied by any one prop. */
  propRequirements: ExerciseProp[][];
  pattern: MovementPattern;
  difficulty: DifficultyTier;
  highStressJoints: JointArea[];
  moderateStressJoints: JointArea[];
  impact: "low" | "high";
  primaryGroups: MuscleGroupId[];
  secondaryGroups: MuscleGroupId[];
  isMobility: boolean;
  isCompound: boolean;
};

const BODY_WEIGHT_TAG = "body weight";

function lower(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Muscle groups ─────────────────────────────────────────────────────────

const SECONDARY_MUSCLE_MAP: Record<string, MuscleGroupId> = {
  "hip flexors": "core",
  "lower back": "lower_back",
  obliques: "obliques",
  forearms: "forearms",
  hamstrings: "hamstrings",
  glutes: "glutes",
  biceps: "biceps",
  rhomboids: "upper_back",
  core: "core",
  shoulders: "front_delts",
  triceps: "triceps",
  back: "upper_back",
  quadriceps: "quads",
  quads: "quads",
  calves: "calves",
  soleus: "calves",
  chest: "chest",
  "upper chest": "upper_chest",
  deltoids: "front_delts",
  "rear deltoids": "rear_delts",
  traps: "traps",
  trapezius: "traps",
  "upper back": "upper_back",
  brachialis: "biceps",
  groin: "adductors",
  "inner thighs": "adductors",
  "latissimus dorsi": "lats",
  lats: "lats",
  abdominals: "core",
  "lower abs": "core",
  "wrist flexors": "forearms",
  "wrist extensors": "forearms",
  "grip muscles": "forearms",
  "rotator cuff": "rear_delts",
  sternocleidomastoid: "neck",
};

function deltGroup(name: string): MuscleGroupId {
  if (/\brear\b|reverse fly|face pull|rear delt|reverse pec|bent[\s-]?over (lateral|raise)/.test(name)) {
    return "rear_delts";
  }
  if (/lateral raise|side raise|\blateral\b|upright row|y[\s-]?raise/.test(name)) {
    return "side_delts";
  }
  return "front_delts";
}

function primaryGroupsFor(ex: CatalogExercise, name: string): MuscleGroupId[] {
  const out = new Set<MuscleGroupId>();
  for (const m of ex.primary_muscles) {
    switch (m) {
      case "abs":
        out.add(/oblique|side|twist|russian|woodchop|bicycle/.test(name) ? "obliques" : "core");
        break;
      case "pectorals":
        out.add("chest");
        if (/\bincline\b|low[\s-]?to[\s-]?high|upper chest|reverse grip bench/.test(name)) {
          out.add("upper_chest");
        }
        break;
      case "serratus anterior":
        out.add("chest");
        break;
      case "delts":
        out.add(deltGroup(name));
        break;
      case "lats":
        out.add("lats");
        break;
      case "upper back":
        out.add("upper_back");
        break;
      case "traps":
        out.add("traps");
        break;
      case "spine":
        out.add("lower_back");
        break;
      case "biceps":
        out.add("biceps");
        break;
      case "triceps":
        out.add("triceps");
        break;
      case "forearms":
        out.add("forearms");
        break;
      case "glutes":
        out.add("glutes");
        break;
      case "quads":
        out.add("quads");
        break;
      case "hamstrings":
        out.add("hamstrings");
        break;
      case "calves":
        out.add("calves");
        break;
      case "adductors":
        out.add("adductors");
        break;
      case "abductors":
        out.add("abductors");
        break;
      case "levator scapulae":
        out.add("neck");
        break;
      case "cardiovascular system":
        out.add("cardio");
        break;
      default:
        break;
    }
  }
  return [...out];
}

function secondaryGroupsFor(ex: CatalogExercise): MuscleGroupId[] {
  const out = new Set<MuscleGroupId>();
  for (const m of ex.secondary_muscles) {
    const g = SECONDARY_MUSCLE_MAP[m.toLowerCase()];
    if (g) out.add(g);
  }
  return [...out];
}

// ─── Movement pattern ──────────────────────────────────────────────────────

function classifyPattern(ex: CatalogExercise, name: string): MovementPattern {
  const primary = ex.primary_muscles[0] ?? "";
  if (/\bstretch\b|stretching|\bpose\b|yoga|mobility|circles?\b|foam|roller|release|\brolling\b|cat[\s-]?cow|child'?s pose|cobra\b(?!.*push)/.test(name)) {
    return "mobility";
  }
  if (/jump|\bhop\b|hops\b|bound|plyo|clap|skater|depth|tuck jump|burpee|\bjacks?\b(?![\s-]?knife)|astride/.test(name)) {
    return "plyometric";
  }
  if (/\bdips?\b/.test(name)) return "horizontal_push";
  if (/hanging|leg raise|knee raise/.test(name)) return "core_flexion";
  if (/pull[\s-]?ups?|chin[\s-]?ups?|\bchin\b|pulldown|pull[\s-]?down|muscle[\s-]?up|lat pull/.test(name)) {
    return "vertical_pull";
  }
  if (/\brow\b|rows\b|face pull|reverse fly|rear delt|pull[\s-]?apart|inverted/.test(name)) {
    return "horizontal_pull";
  }
  if (/overhead press|shoulder press|military|push press|handstand|pike|arnold|\bjerk\b|landmine press|z press|seated press/.test(name)) {
    return "vertical_push";
  }
  if (/bench press|chest press|push[\s-]?ups?|pushups?|floor press|\bdips?\b|body-up/.test(name)) {
    return "horizontal_push";
  }
  if (/carry|farmer|suitcase walk|waiter walk/.test(name)) return "carry";
  if (/deadlift|\brdl\b|good morning|swing|hip hinge|hyperextension|back extension|pull[\s-]?through|\bclean\b|snatch|superman|jefferson/.test(name)) {
    return "hinge";
  }
  if (/abduction|abductor|clamshell|clam shell|fire hydrant|monster walk|lateral band walk|side[\s-]?lying leg raise|lateral leg raise/.test(name)) {
    return "hip_abduction";
  }
  if (/hip thrust|glute bridge|\bbridge\b|kickback|donkey kick|frog pump|hip extension|reverse hyper|hip lift|butt-ups/.test(name) && primary !== "triceps") {
    return "hip_extension";
  }
  if (/leg curl|hamstring curl|nordic|glute[\s-]?ham|inverse leg curl/.test(name)) {
    return "knee_flexion";
  }
  if (/lunge|split squat|bulgarian|step[\s-]?ups?|curtsey|cossack|lateral squat/.test(name)) {
    return "lunge";
  }
  if (/squat|leg press|hack|wall sit|sissy|thruster|knee bends?|\bquads\b/.test(name)) {
    return "squat";
  }
  if (/calf raise|calves|heel raise/.test(name) || primary === "calves") return "calf";
  if (/pallof|bird[\s-]?dog|renegade|shoulder tap|anti[\s-]?rotation/.test(name)) {
    return "anti_rotation";
  }
  if (/side plank|side bridge|suitcase/.test(name)) return "anti_lateral_flexion";
  if (/plank|rollout|roll[\s-]?out|ab wheel|dead bug|body saw|hollow|fallout/.test(name)) {
    return "anti_extension";
  }
  if (/russian twist|woodchop|wood chop|rotation|twist|windmill|wiper/.test(name)) {
    return "rotation";
  }
  if (/crunch|sit[\s-]?up|leg raise|knee raise|v[\s-]?up|toe touch|jackknife|bicycle|heel touch|flutter|scissor|tuck/.test(name)) {
    return "core_flexion";
  }
  if (/crawl|walk\b|walking|sprint|\brun\b|running|high knee|march|skip|climber/.test(name)) {
    return "locomotion";
  }
  if (primary === "cardiovascular system") return "cardio";
  if (primary === "abs") return "core_flexion";
  if (primary === "spine") return "anti_flexion";
  if (primary === "glutes" || primary === "hamstrings") return "hip_extension";
  if (primary === "quads") return "squat";
  if (primary === "lats") return "vertical_pull";
  if (primary === "upper back") return "horizontal_pull";
  return "isolation";
}

// ─── Difficulty ────────────────────────────────────────────────────────────

const ELITE_RE =
  /planche|front lever|back lever|muscle[\s-]?up|human flag|\bflag\b|maltese|iron cross|one arm (pull|chin)|one arm push|single arm push|one arm dip|impossible dip|handstand push|dragon flag|skin the cat|l-pull|gorilla chin|side-to-side chin/;
const ADVANCED_RE =
  /pistol|one leg squat|single leg squat|archer|clap|plyo push|explosive|depth jump|nordic|glute[\s-]?ham|l-sit|handstand|typewriter|snatch|\bclean\b|\bjerk\b|kipping|sissy squat|shrimp squat|pseudo planche|hanging straight|toes[\s-]?to[\s-]?bar|windmill|turkish get|overhead squat|zercher|jefferson|deficit|korean dip|ring dip|reverse nordic|behind (the )?neck|wide grip rear pull|hanging pike|straddle|jackknife pull|elevator|rear pull-up|l-sit|v-sit/;
const INTERMEDIATE_RE =
  /pull[\s-]?ups?|chin[\s-]?ups?|\bdips?\b|pike push|decline push|diamond push|burpee|box jump|jump squat|jump lunge|lunge with jump|bulgarian|kettlebell swing|jackknife|v[\s-]?up|hanging|hollow|single leg|one leg|renegade|front squat|good morning|bear crawl|spider|superman push|pike-to-cobra|inchworm|split jump|star jump|tuck jump/;

function classifyDifficulty(ex: CatalogExercise, name: string, pattern: MovementPattern): DifficultyTier {
  if (pattern === "mobility" && /\bstretch\b/.test(name)) return 1;
  if (ELITE_RE.test(name)) return 4;
  if (ADVANCED_RE.test(name)) return 3;
  // Low-level plyos (jumping jacks & friends) are standard beginner conditioning.
  if (/jack\b|jacks\b|astride|star jump|jack jump/.test(name)) return 1;
  const tags = ex.equipment.map(lower);
  const isBarbell = tags.some((t) => /barbell|trap bar/.test(t));
  const barbellCompound =
    isBarbell &&
    /squat|deadlift|bench press|overhead press|military|bent over row|lunge|good morning|hip thrust|push press|pendlay|rack pull/.test(name);
  if (barbellCompound) return 2;
  if (INTERMEDIATE_RE.test(name)) return 2;
  if (pattern === "plyometric") return 2;
  return 1;
}

// ─── Joint stress / impact ─────────────────────────────────────────────────

function classifyJointStress(
  name: string,
  pattern: MovementPattern
): { high: JointArea[]; moderate: JointArea[] } {
  const high = new Set<JointArea>();
  const moderate = new Set<JointArea>();
  const jumping = pattern === "plyometric" || /jump|hop|bound|sprint|burpee|skip|skater|tuck/.test(name);

  // Knees
  if (
    jumping ||
    /pistol|one leg squat|single leg squat|sissy|shrimp|lunge|split squat|bulgarian|curtsey|cossack|full squat|front squat|hack squat|overhead squat|deep squat|jump/.test(name)
  ) {
    high.add("knees");
  } else if (/squat|leg extension|step[\s-]?up|leg press|wall sit|knee bend/.test(name)) {
    moderate.add("knees");
  }

  // Lower back
  if (
    /deadlift|good morning|bent over row|back squat|full squat|barbell squat|hyperextension|back extension|jefferson|sit[\s-]?up|russian twist|kettlebell swing|\bswing\b|\bclean\b|snatch|t-bar row|pendlay|rack pull|reverse hyper|v[\s-]?up|jackknife|straight leg raise|good-morning|toe touch/.test(name)
  ) {
    high.add("back");
  } else if (/overhead press|military|superman|crunch|leg raise|row\b|squat|lunge/.test(name)) {
    moderate.add("back");
  }

  // Shoulders
  if (
    /overhead|shoulder press|military|push press|arnold|handstand|pike push|upright row|behind (the )?neck|\bdips?\b|snatch|\bjerk\b|kipping|muscle[\s-]?up|planche|lever|skin the cat|pullover|bench dip/.test(name)
  ) {
    high.add("shoulders");
  } else if (/bench press|pull[\s-]?up|chin[\s-]?up|hanging|lateral raise|front raise|push[\s-]?up|fly|flye|pulldown/.test(name)) {
    moderate.add("shoulders");
  }

  // Hips
  if (/pistol|cossack|lateral lunge|curtsey|sumo|jump|frog|deep squat|split/.test(name)) {
    high.add("hips");
  } else if (/lunge|squat|hip thrust|bridge|abduction|adduction/.test(name)) {
    moderate.add("hips");
  }

  // Ankles
  if (jumping || /\brun\b|running|high knee|pistol|jack\b|jacks\b|sprint|skip/.test(name)) {
    high.add("ankles");
  } else if (/calf raise|lunge|step[\s-]?up/.test(name)) {
    moderate.add("ankles");
  }

  // Wrists
  if (/handstand|planche|front squat|\bclean\b|snatch|pseudo planche|wrist curl|l-sit|knuckle/.test(name)) {
    high.add("wrists");
  } else if (/push[\s-]?up|plank|mountain climber|burpee|bear crawl|dip|crawl/.test(name)) {
    moderate.add("wrists");
  }

  for (const j of high) moderate.delete(j);
  return { high: [...high], moderate: [...moderate] };
}

// ─── Hidden equipment (props + implied tags) ───────────────────────────────

type PropRule = { re: RegExp; props: ExerciseProp[] };

/** Name-based prop rules. First match per category wins; order matters. */
const NAME_PROP_RULES: PropRule[] = [
  { re: /scapula dips/, props: [] },
  { re: /bench dip|triceps dips? floor|elbow dips|dip on floor|three bench dip/, props: ["bench", "chair"] },
  { re: /ring dips?|\brings?\b|suspend|suspension|\btrx\b|with straps/, props: ["rings_suspension"] },
  { re: /parallel bars|dip-pull-up cage|straight bar|\bdips?\b/, props: ["dip_station", "rings_suspension"] },
  {
    re: /pull[\s-]?ups?|chin[\s-]?ups?|\bchin\b|muscle[\s-]?up|hanging|\bhang\b|front lever|back lever|skin the cat|toes[\s-]?to[\s-]?bar|arm slingers|straddle maltese/,
    props: ["pull_up_bar"],
  },
  { re: /inverted row|standing (close-grip |one arm )?row|squatting row|body[\s-]?weight .*row/, props: ["low_bar", "rings_suspension"] },
  { re: /\btowel\b/, props: ["towel"] },
  { re: /captains? chair|hyperextension|back extension|glute[\s-]?ham|roman chair|45° hyper/, props: ["gym_station"] },
  { re: /reverse hyper on flat bench/, props: ["bench"] },
  { re: /box jump|depth jump|jump (on|onto) box/, props: ["box_step"] },
  { re: /incline push|incline (close-grip|reverse grip|scapula) push|push up depth jump|push-up \(on box\)/, props: ["bench", "chair", "box_step"] },
  { re: /decline push/, props: ["bench", "chair", "box_step"] },
  { re: /decline (crunch|sit-up|bridge)|incline (sit-up|twisting sit-up|leg hip raise)|flat bench|on bench|with bench|bench (hip|pull)|two legs on bench|\(bench support\)|between benches|bench leg/, props: ["bench"] },
  { re: /step[\s-]?ups?|platform|stair|staircase|\bbox\b/, props: ["box_step", "bench"] },
  { re: /chair/, props: ["chair", "bench"] },
  { re: /partner|assisted by/, props: ["partner"] },
  { re: /balance board/, props: ["balance_board"] },
  { re: /\bwall\b/, props: ["wall"] },
];

const SIMILE_OR_OPTIONAL_RE =
  /as if|as though|like (you are|you're) sitting|imagin|if needed|if necessary|optional|for balance|for support if/;
const FLOOR_ALTERNATIVE_RE =
  /(floor|ground|mat)\s+or\s+(a\s+|an\s+)?(flat\s+)?(bench|chair|box|step)|(bench|chair|step|box)\s+or\s+(the\s+|a\s+)?(floor|ground|mat)/;

const INSTRUCTION_PROP_RULES: PropRule[] = [
  { re: /pull[\s-]?up bar|chin[\s-]?up bar|overhead bar|hang (from|onto|on) (a|the)|high bar/, props: ["pull_up_bar"] },
  { re: /parallel bars|dip (station|bars)/, props: ["dip_station"] },
  { re: /suspension trainer|\btrx\b|gymnastic rings|\brings\b/, props: ["rings_suspension"] },
  { re: /(lie|lying|lay)[^.]{0,40}\b(on|onto)\s+(a|the)\s+(flat |decline |incline )?bench|decline bench|incline bench|preacher|adjustable bench/, props: ["bench"] },
  { re: /(edge of|on|onto)\s+(a|the)\s+(flat |sturdy |stable )?(bench|chair)|(bench|chair) or (a |the )?(chair|bench)/, props: ["bench", "chair"] },
  { re: /elevated surface|raised surface|(on|onto) (a|an|the) (step|box|platform|block|stair|staircase|curb)|feet elevated|toes on (an|a) (elevated|raised)/, props: ["box_step", "bench", "chair"] },
  { re: /\btowel\b/, props: ["towel"] },
  { re: /\bpartner\b/, props: ["partner"] },
  { re: /balance board/, props: ["balance_board"] },
  { re: /(holding onto|hold onto|grasp|grab)\s+(a|the)\s+(sturdy|stable|secure)\s+(object|anchor|bar)|grasp a bar|grasp the bar/, props: ["low_bar", "rings_suspension"] },
  { re: /glute[\s-]?ham raise machine|hyperextension bench|roman chair/, props: ["gym_station"] },
];

/** Gear named in the exercise title — applies regardless of catalog tags. */
const NAME_IMPLIED_TAG_RULES: { re: RegExp; tag: string }[] = [
  { re: /exercise ball|stability ball|swiss ball/, tag: "stability ball" },
  { re: /bosu/, tag: "bosu ball" },
  { re: /\bbands?\b|resistance band/, tag: "band" },
  { re: /medicine ball|\bmed ball\b/, tag: "medicine ball" },
];

const IMPLIED_TAG_RULES: { re: RegExp; tag: string }[] = [
  { re: /resistance band|\bband\b|mini[\s-]?band|loop band/, tag: "band" },
  { re: /\bdumbbells?\b/, tag: "dumbbell" },
  { re: /\bkettlebells?\b/, tag: "kettlebell" },
  { re: /\bbarbell\b/, tag: "barbell" },
  { re: /medicine ball/, tag: "medicine ball" },
  { re: /stability ball|swiss ball|exercise ball/, tag: "stability ball" },
  { re: /\bmachine\b/, tag: "leverage machine" },
];

function isBodyweightTagged(ex: CatalogExercise): boolean {
  return ex.equipment.length === 0 || ex.equipment.every((t) => lower(t) === BODY_WEIGHT_TAG);
}

function sentences(instructions: string[]): string[] {
  return instructions
    .join(" ")
    .toLowerCase()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function detectPropsAndImpliedTags(
  ex: CatalogExercise,
  name: string
): { props: ExerciseProp[][]; impliedTags: string[] } {
  const groups: ExerciseProp[][] = [];
  const pushGroup = (g: ExerciseProp[]) => {
    if (g.length === 0) return;
    const key = [...g].sort().join("|");
    if (!groups.some((x) => [...x].sort().join("|") === key)) groups.push(g);
  };

  let nameMatched = false;
  for (const rule of NAME_PROP_RULES) {
    if (rule.re.test(name)) {
      nameMatched = true;
      pushGroup(rule.props);
      // Most names encode one prop; stop after the first non-wall hit.
      if (!rule.props.includes("wall")) break;
    }
  }

  const impliedTags = new Set<string>();
  const catalogTags = new Set(ex.equipment.map(lower));
  for (const rule of NAME_IMPLIED_TAG_RULES) {
    if (rule.re.test(name) && !catalogTags.has(rule.tag)) impliedTags.add(rule.tag);
  }
  const bodyweightTagged = isBodyweightTagged(ex);
  const sents = sentences(ex.instructions);

  for (const s of sents) {
    if (bodyweightTagged && !SIMILE_OR_OPTIONAL_RE.test(s)) {
      for (const rule of IMPLIED_TAG_RULES) {
        if (rule.re.test(s)) impliedTags.add(rule.tag);
      }
    }
    if (nameMatched) continue;
    if (SIMILE_OR_OPTIONAL_RE.test(s) || FLOOR_ALTERNATIVE_RE.test(s)) continue;
    // "wall or sturdy object" → a wall is enough.
    if (/\bwall\b/.test(s)) continue;
    for (const rule of INSTRUCTION_PROP_RULES) {
      if (rule.re.test(s)) pushGroup(rule.props);
    }
  }

  return { props: groups.filter((g) => !(g.length === 1 && g[0] === "wall")), impliedTags: [...impliedTags] };
}

// ─── Public API ────────────────────────────────────────────────────────────

const profileCache = new Map<string, ExerciseProfile>();

export function getExerciseProfile(ex: CatalogExercise): ExerciseProfile {
  const cacheKey = ex.id || ex.name;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const name = lower(ex.name);
  const pattern = classifyPattern(ex, name);
  const { props, impliedTags } = detectPropsAndImpliedTags(ex, name);
  const catalogTags = ex.equipment.length
    ? ex.equipment.map(lower)
    : [BODY_WEIGHT_TAG];
  const effective = new Set(catalogTags);
  for (const t of impliedTags) {
    effective.add(t);
  }
  if (impliedTags.length > 0) effective.delete(BODY_WEIGHT_TAG);
  const { high, moderate } = classifyJointStress(name, pattern);
  const primaryGroups = primaryGroupsFor(ex, name);
  const secondaryGroups = secondaryGroupsFor(ex).filter((g) => !primaryGroups.includes(g));

  const profile: ExerciseProfile = {
    id: ex.id,
    name: ex.name,
    effectiveEquipmentTags: [...effective],
    impliedEquipmentTags: impliedTags,
    propRequirements: props,
    pattern,
    difficulty: classifyDifficulty(ex, name, pattern),
    highStressJoints: high,
    moderateStressJoints: moderate,
    impact:
      pattern === "plyometric" || /jump|hop|bound|sprint|burpee|skip|skater|\bjacks?\b/.test(name)
        ? "high"
        : "low",
    primaryGroups,
    secondaryGroups,
    isMobility: pattern === "mobility",
    isCompound: COMPOUND_PATTERNS.has(pattern),
  };
  profileCache.set(cacheKey, profile);
  return profile;
}

/** True when every prop group is satisfied by `available` (wall is always available). */
export function propRequirementsSatisfied(
  profile: ExerciseProfile,
  available: ReadonlySet<ExerciseProp>
): boolean {
  return profile.propRequirements.every((group) =>
    group.some((p) => p === "wall" || available.has(p))
  );
}

export function describePropRequirements(profile: ExerciseProfile): string {
  return profile.propRequirements
    .map((g) => g.map((p) => PROP_LABELS[p]).join(" or "))
    .join(" + ");
}
