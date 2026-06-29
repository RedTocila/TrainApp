import {
  ArrowRight,
  Calendar,
  ClipboardList,
  Clock,
  Crown,
  FileText,
  Gavel,
  Layers,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformCopy } from "@/lib/platform-copy";
import {
  computeTournamentFunnelCounts,
  getChallengeDurationMonths,
} from "@/lib/challenge-utils";
import type { Challenge, ChallengePhase } from "@/lib/types";
import { cn } from "@/lib/utils";

function interpolate(text: string, groupSize: number, durationMonths: number) {
  return text
    .replace(/\{groupSize\}/g, String(groupSize))
    .replace(/\{count\}/g, String(durationMonths));
}

function PeopleStack({ count, className }: { count: number; className?: string }) {
  const shown = Math.min(count, 5);
  return (
    <div className={cn("flex -space-x-1", className)}>
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground"
        >
          <Users className="h-3 w-3" />
        </span>
      ))}
      {count > 5 && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 px-1 text-[10px] font-bold text-primary">
          +{count - 5}
        </span>
      )}
    </div>
  );
}

export function TournamentFlowDiagram({
  copy,
  groupSize,
  durationMonths,
}: {
  copy: PlatformCopy["challenges"];
  groupSize: number;
  durationMonths: number;
}) {
  const gs = String(groupSize);
  const phases = [
    {
      round: "1",
      title: copy.phase1Title,
      body: interpolate(copy.phase1Body, groupSize, durationMonths),
      from: groupSize,
      to: Math.floor(groupSize / 2),
      color: "border-violet-500/40 bg-violet-500/10 text-violet-200",
      icon: Video,
    },
    {
      round: "2",
      title: copy.phase2Title,
      body: interpolate(copy.phase2Body, groupSize, durationMonths),
      from: groupSize,
      to: 1,
      color: "border-sky-500/40 bg-sky-500/10 text-sky-200",
      icon: Users,
    },
    {
      round: "★",
      title: copy.phase3Title,
      body: interpolate(copy.phase3Body, groupSize, durationMonths),
      from: null,
      to: 1,
      color: "border-amber-500/40 bg-amber-500/10 text-amber-200",
      icon: Crown,
    },
  ];

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b border-border/60 bg-primary/5 pb-4">
        <CardTitle className="text-base">
          {copy.diagramFlowTitle.replace("{count}", String(durationMonths))}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {interpolate(copy.tournamentIntro, groupSize, durationMonths)}
        </p>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <div key={phase.round}>
              <div className="flex gap-4 p-4 sm:p-5">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-black",
                    phase.color
                  )}
                >
                  {phase.round === "★" ? <Crown className="h-5 w-5" /> : phase.round}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="font-semibold">{phase.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{phase.body}</p>
                  {phase.from != null && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <PeopleStack count={phase.from} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                        {phase.to === 1
                          ? copy.diagramOneWinner
                          : copy.diagramAdvanceCount.replace("{count}", String(phase.to))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {copy.diagramPerGroup.replace("{groupSize}", gs)}
                      </span>
                    </div>
                  )}
                  {phase.from == null && (
                    <div className="flex items-center gap-2 pt-1">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-200/90">
                        {copy.diagramChampionWins}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {index < phases.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="h-6 w-px bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function EliminationFunnel({
  copy,
  groupSize,
  participantCount,
}: {
  copy: PlatformCopy["challenges"];
  groupSize: number;
  participantCount?: number;
}) {
  const half = Math.floor(groupSize / 2);
  const counts =
    participantCount != null && participantCount > 0
      ? computeTournamentFunnelCounts(participantCount, groupSize)
      : { start: 100, afterR1: 50, afterR2: 5, champion: 1 };

  const subtitle =
    participantCount != null && participantCount > 0
      ? copy.diagramFunnelSubtitleDynamic.replace("{count}", String(participantCount))
      : copy.diagramFunnelSubtitle;

  const steps = [
    {
      label: copy.diagramFunnelStart.replace("{count}", String(counts.start)),
      width: "w-full",
      tone: "bg-violet-500/20",
    },
    {
      label: copy.diagramFunnelR1.replace("{count}", String(counts.afterR1)),
      width: counts.afterR1 <= 5 ? "w-[55%]" : counts.afterR1 <= 20 ? "w-[65%]" : "w-[72%]",
      tone: "bg-violet-500/30",
    },
    {
      label: copy.diagramFunnelR2.replace("{count}", String(counts.afterR2)),
      width: counts.afterR2 <= 3 ? "w-[35%]" : "w-[40%]",
      tone: "bg-sky-500/30",
    },
    {
      label: copy.diagramFunnelChampion,
      width: "w-[22%]",
      tone: "bg-amber-500/35",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{copy.diagramFunnelTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 pb-6">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "flex items-center justify-center rounded-lg border border-border/60 py-3 text-center text-xs font-bold sm:text-sm",
              step.width,
              step.tone
            )}
          >
            {step.label}
          </div>
        ))}
        <p className="mt-2 max-w-sm text-center text-xs text-muted-foreground">
          {copy.diagramFunnelNote.replace("{groupSize}", String(groupSize)).replace("{half}", String(half))}
        </p>
      </CardContent>
    </Card>
  );
}

export function JudgingSplitDiagram({ copy }: { copy: PlatformCopy["challenges"] }) {
  const cards = [
    {
      icon: FileText,
      title: copy.selectionPlatformTitle,
      weight: copy.selectionPlatformWeight,
      weightLabel: copy.diagramPrepOnly,
      body: copy.selectionPlatformBody,
      bullets: copy.diagramPlatformBullets,
      className: "border-emerald-500/25 bg-emerald-500/5",
      iconClassName: "bg-emerald-500/15 text-emerald-300",
      bulletClassName: "text-emerald-400",
      weightClassName: "bg-emerald-500/15 text-emerald-300",
    },
    {
      icon: Video,
      title: copy.selectionZoomTitle,
      weight: copy.selectionZoomWeight,
      weightLabel: copy.diagramDecisive,
      body: copy.selectionZoomBody,
      bullets: copy.diagramZoomBullets,
      className: "border-violet-500/25 bg-violet-500/5",
      iconClassName: "bg-violet-500/15 text-violet-300",
      bulletClassName: "text-violet-400",
      weightClassName: "bg-violet-500/15 text-violet-300",
    },
    {
      icon: Gavel,
      title: copy.selectionAdminTitle,
      weight: copy.selectionAdminWeight,
      weightLabel: copy.diagramAdminWeight,
      body: copy.selectionAdminBody,
      bullets: copy.diagramAdminBullets,
      className: "border-amber-500/25 bg-amber-500/5",
      iconClassName: "bg-amber-500/15 text-amber-300",
      bulletClassName: "text-amber-400",
      weightClassName: "bg-amber-500/15 text-amber-300",
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">{copy.judgingFormulaTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.judgingFormulaIntro}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {cards.map(
          ({
            icon: Icon,
            title,
            weight,
            weightLabel,
            body,
            bullets,
            className,
            iconClassName,
            bulletClassName,
            weightClassName,
          }) => (
            <Card key={title} className={className}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        iconClassName
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold leading-snug">{title}</p>
                      <p className="text-xs text-muted-foreground">{weightLabel}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-sm font-black",
                      weightClassName
                    )}
                  >
                    {weight}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{body}</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className={bulletClassName}>•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </section>
  );
}

export function InstructionTimeline({
  items,
  groupSize,
  durationMonths,
}: {
  items: readonly string[];
  groupSize: number;
  durationMonths: number;
}) {
  return (
    <ol className="relative space-y-0 border-l-2 border-primary/30 pl-6">
      {items.map((item, index) => (
        <li key={item} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary/40 bg-card text-xs font-black text-primary">
            {index + 1}
          </span>
          <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
            {interpolate(item, groupSize, durationMonths)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function RulesCategoryCards({
  copy,
  groupSize,
  durationMonths,
}: {
  copy: PlatformCopy["challenges"];
  groupSize: number;
  durationMonths: number;
}) {
  const cards = [
    {
      icon: Crown,
      title: copy.diagramRulesEliteTitle,
      body: copy.diagramRulesEliteBody,
      className: "border-violet-500/30 bg-violet-500/5",
    },
    {
      icon: Trophy,
      title: copy.diagramRulesPrizeTitle,
      body: copy.diagramRulesPrizeBody,
      className: "border-amber-500/30 bg-amber-500/5",
    },
    {
      icon: Video,
      title: copy.diagramRulesZoomTitle,
      body: interpolate(copy.diagramRulesZoomBody, groupSize, durationMonths),
      className: "border-sky-500/30 bg-sky-500/5",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(({ icon: Icon, title, body, className }) => (
        <Card key={title} className={className}>
          <CardContent className="space-y-2 p-4">
            <Icon className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChallengeOverviewStats({
  copy,
  challenge,
  participantCount,
}: {
  copy: PlatformCopy["challenges"];
  challenge: Pick<Challenge, "scheduled_at" | "group_size" | "duration_months" | "is_transformation" | "max_participants">;
  participantCount: number;
}) {
  const durationMonths = getChallengeDurationMonths(challenge);
  const isTransformation = challenge.is_transformation === true;

  const stats = [
    {
      icon: Calendar,
      label: copy.detailStatStart,
      value: format(new Date(challenge.scheduled_at), "MMM d, yyyy"),
    },
    {
      icon: Clock,
      label: copy.detailStatDuration,
      value: copy.tournamentDuration.replace("{count}", String(durationMonths)),
    },
    ...(isTransformation
      ? [
          {
            icon: Layers,
            label: copy.detailStatScoring,
            value: copy.detailStatScoringValue,
          },
        ]
      : [
          {
            icon: Layers,
            label: copy.detailStatGroupSize,
            value: String(challenge.group_size),
          },
        ]),
    {
      icon: Users,
      label: copy.detailStatRegistered,
      value: String(participantCount),
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3"
          >
            <Icon className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ChallengePhaseTimeline({
  copy,
  challenge,
  currentPhase,
}: {
  copy: PlatformCopy["challenges"];
  challenge: Pick<
    Challenge,
    "scheduled_at" | "round_1_zoom_at" | "round_2_zoom_at" | "round_3_zoom_at"
  >;
  currentPhase: ChallengePhase;
}) {
  const phases: {
    phase: ChallengePhase;
    icon: typeof Video;
    label: string;
    date: string | null;
  }[] = [
    {
      phase: 0,
      icon: ClipboardList,
      label: copy.detailPhaseRegistration,
      date: challenge.scheduled_at,
    },
    {
      phase: 1,
      icon: Video,
      label: copy.detailPhaseRound1,
      date: challenge.round_1_zoom_at,
    },
    {
      phase: 2,
      icon: Users,
      label: copy.detailPhaseRound2,
      date: challenge.round_2_zoom_at,
    },
    {
      phase: 3,
      icon: Crown,
      label: copy.detailPhaseFinal,
      date: challenge.round_3_zoom_at,
    },
    {
      phase: 4,
      icon: Trophy,
      label: copy.detailPhaseComplete,
      date: null,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{copy.detailPhaseTitle}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <ol className="grid gap-2 sm:grid-cols-5">
          {phases.map(({ phase, icon: Icon, label, date }, index) => {
            const isCurrent = currentPhase === phase;
            const isPast = currentPhase > phase;
            return (
              <li key={phase} className="relative">
                <div
                  className={cn(
                    "flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors",
                    isCurrent && "border-primary/50 bg-primary/10",
                    isPast && !isCurrent && "border-emerald-500/30 bg-emerald-500/5",
                    !isCurrent && !isPast && "border-border/60 bg-muted/15"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        isCurrent && "bg-primary/20 text-primary",
                        isPast && !isCurrent && "bg-emerald-500/15 text-emerald-300",
                        !isCurrent && !isPast && "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                        {copy.detailPhaseCurrent}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold leading-snug">{label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {date ? format(new Date(date), "MMM d, yyyy") : copy.detailPhaseDateTbd}
                  </p>
                </div>
                {index < phases.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
