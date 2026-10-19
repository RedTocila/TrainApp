import type { CheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import type { ReminderSlot } from "@/lib/reminder-clock";
import { reminderDeepLinkPath, type ReminderType } from "@/lib/reminder-settings";

export type ReminderPushMessage = {
  title: string;
  body: string;
  path: string;
};

type Line = { title: string; body: string };
type Band = "none" | "partial" | "almost" | "shame";

/** Alex, first person. `{open}` is the list still unfinished. */
const LINES: Record<"en" | "al", Record<Band, readonly Line[]>> = {
  en: {
    none: [
      {
        title: "Still at zero?",
        body: "I checked. {open} — untouched. The day isn't over. Your excuses are getting loud.",
      },
      {
        title: "Couch is winning",
        body: "Nothing logged. {open} are waiting. I didn't write this plan so you could ignore it.",
      },
      {
        title: "You awake?",
        body: "{open} still open. Motivation isn't coming to get you. Start with one.",
      },
      {
        title: "Clock's ticking",
        body: "Zero so far. {open} haven't moved. I'll pretend I didn't notice — after you start.",
      },
    ],
    partial: [
      {
        title: "Don't coast",
        body: "You started. Respect. {open} still open. Finish what you opened.",
      },
      {
        title: "Halfway isn't done",
        body: "Progress, then a pause. Classic. {open} left. Close them.",
      },
      {
        title: "I see the effort",
        body: "Some of it is done. {open} is the part you're avoiding. Do that.",
      },
      {
        title: "Keep going",
        body: "You didn't quit. Yet. {open} still on the board. Knock it out.",
      },
    ],
    almost: [
      {
        title: "One left",
        body: "Almost a clean day. {open} is the last piece. Don't ghost the finish.",
      },
      {
        title: "So close",
        body: "{open} and you're done. I'll even be nice. Briefly.",
      },
      {
        title: "Finish it",
        body: "You did the hard part. {open} is still sitting there. End the day properly.",
      },
      {
        title: "Last one",
        body: "Don't leave {open} for tomorrow's version of you. They already have enough.",
      },
    ],
    shame: [
      {
        title: "Shame to skip the day",
        body: "23:00 and {open} never moved. Whole day, nothing done. I'm disappointed, not surprised.",
      },
      {
        title: "Blank day",
        body: "Shame to leave {open} untouched. That's a choice. Own the skip, or fix one thing before sleep.",
      },
      {
        title: "Nothing. All day.",
        body: "I looked. {open} sat there the entire day. The plan didn't fail. You skipped it.",
      },
      {
        title: "Still zero at 23:00",
        body: "Shame not to complete a single thing. {open} — still blank. Tomorrow can be different. This one wasn't.",
      },
    ],
  },
  al: {
    none: [
      {
        title: "Ende në zero?",
        body: "Kontrollova. {open} — pa i prekur. Dita s'ka mbaruar. Justifikimet po bëhen të zhurmshme.",
      },
      {
        title: "Divani po fiton",
        body: "Asgjë e regjistruar. {open} presin. S'e shkrova planin që ta injorosh.",
      },
      {
        title: "Je zgjuar?",
        body: "{open} ende hapur. Motivimi s'vjen vetë. Fillo me një.",
      },
      {
        title: "Ora po ecën",
        body: "Zero deri tani. {open} s'kanë lëvizur. Do bëj sikur s'e pashë — pasi të fillosh.",
      },
    ],
    partial: [
      {
        title: "Mos u ndal",
        body: "Fille. Respekt. {open} ende hapur. Mbaro ç'ke hapur.",
      },
      {
        title: "Gjysma s'është fundi",
        body: "Progres, pastaj pauzë. Klasike. {open} kanë mbetur. Mbylli.",
      },
      {
        title: "E shoh mundin",
        body: "Diçka u bë. {open} është ajo që po e shmang. Bëje.",
      },
      {
        title: "Vazhdo",
        body: "S'hoqe dorë. Ende. {open} janë në tabelë. Mbaroji.",
      },
    ],
    almost: [
      {
        title: "Ka mbetur një",
        body: "Pothuajse ditë e pastër. {open} është e fundit. Mos e lër në fund.",
      },
      {
        title: "Kahet",
        body: "{open} dhe je gati. Do jem i sjellshëm. Shkurt.",
      },
      {
        title: "Mbaroje",
        body: "E bëre pjesën e vështirë. {open} ende pret. Mbylle ditën si duhet.",
      },
      {
        title: "E fundit",
        body: "Mos ia lër {open} të nesërmes. Ai version i yt ka mjaft punë.",
      },
    ],
    shame: [
      {
        title: "Turp ta lësh ditën",
        body: "23:00 dhe {open} s'kanë lëvizur. Gjithë dita, asgjë. I zhgënjyer, jo i befasuar.",
      },
      {
        title: "Ditë bosh",
        body: "Turp t'i lësh {open} pa i prekur. Kjo është zgjedhje. Pranoje, ose bëj një gjë para gjumit.",
      },
      {
        title: "Asgjë. Gjithë ditën.",
        body: "Pashë. {open} qëndruan aty gjithë ditën. Plani s'dështoi. Ti e anashkabove.",
      },
      {
        title: "Ende zero në 23:00",
        body: "Turp të mos përfundosh asnjë gjë. {open} — ende bosh. Nesër mund të jetë ndryshe. Kjo s'qe.",
      },
    ],
  },
};

function joinLabels(labels: string[], andWord: string): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} ${andWord} ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} ${andWord} ${labels[labels.length - 1]}`;
}

function pickLine(lines: readonly Line[], seed: string): Line {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return lines[(hash >>> 0) % lines.length]!;
}

export function reminderMessageBand(input: {
  openCount: number;
  doneCount: number;
  slot: ReminderSlot;
}): Band | null {
  if (input.openCount === 0) return null;
  if (input.slot === 4) return input.doneCount === 0 ? "shame" : null;
  if (input.doneCount === 0) return "none";
  if (input.openCount === 1) return "almost";
  return "partial";
}

/**
 * Alex-style nudge. Daytime lines follow progress.
 * 23:00 only speaks when nothing on today's list is done.
 */
export function reminderPushMessage(input: {
  open: ReminderType[];
  done: ReminderType[];
  locale: CheckoutLocale;
  slot: ReminderSlot;
  seed: string;
}): ReminderPushMessage | null {
  const band = reminderMessageBand({
    openCount: input.open.length,
    doneCount: input.done.length,
    slot: input.slot,
  });
  if (!band) return null;

  const locale = input.locale === "en" ? "en" : "al";
  const copy = getPlatformCopy(locale).reminders;
  const labels = input.open.map((type) => copy.shortTypes[type]);
  const openList = joinLabels(labels, copy.digestAnd);
  const line = pickLine(LINES[locale][band], input.seed);

  return {
    title: line.title,
    body: line.body.split("{open}").join(openList),
    path:
      input.open.length === 1
        ? reminderDeepLinkPath(input.open[0]!)
        : "/dashboard",
  };
}
