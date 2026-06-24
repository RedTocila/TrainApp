"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Clock,
  Radio,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ClassStatusBadge } from "@/components/class-session-panel";
import { FlowStep } from "@/components/ai/feature-tile";
import { Card, CardContent } from "@/components/ui/card";
import {
  CLASS_CATEGORIES,
  categoryStyles,
  classExcerpt,
  getClassStatus,
  partitionClasses,
} from "@/lib/class-utils";
import type { ClassCategory, FitnessClass } from "@/lib/types";

function LiveClassCard({ fitnessClass }: { fitnessClass: FitnessClass }) {
  const styles = categoryStyles[fitnessClass.category];

  return (
    <Link href={`/dashboard/classes/${fitnessClass.slug}`} className="group block">
      <motion.article
        layout
        className={cn(
          "relative overflow-hidden rounded-2xl border border-red-500/30 bg-card",
          "shadow-2xl shadow-red-500/10 transition-shadow duration-300 group-hover:shadow-red-500/25",
          styles.glow
        )}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <div
          className={cn("absolute inset-0 bg-gradient-to-br opacity-90", styles.gradient)}
        />
        {fitnessClass.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fitnessClass.cover_image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />

        <div className="relative flex min-h-[240px] flex-col justify-between p-6 sm:min-h-[280px] sm:p-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-red-500/40 bg-red-500/25 text-red-100">
                <Radio className="mr-1 h-3 w-3 animate-pulse" />
                Live now
              </Badge>
              <Badge
                variant="outline"
                className="border-white/20 bg-zinc-900/40 text-white/90 backdrop-blur-sm"
              >
                {fitnessClass.category}
              </Badge>
            </div>
            <h2 className="max-w-2xl text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
              {fitnessClass.title}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {classExcerpt(fitnessClass.description)}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {fitnessClass.duration_minutes} min
              </span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/25">
              Join now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

function ClassCard({ fitnessClass }: { fitnessClass: FitnessClass }) {
  const styles = categoryStyles[fitnessClass.category];
  const status = getClassStatus(fitnessClass);

  return (
    <Link href={`/dashboard/classes/${fitnessClass.slug}`} className="group block h-full">
      <motion.article
        layout
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card",
          "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
        )}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className={cn("relative h-36 shrink-0 bg-gradient-to-br", styles.gradient)}>
          {fitnessClass.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fitnessClass.cover_image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("border backdrop-blur-sm", styles.badge)}>
              {fitnessClass.category}
            </Badge>
            <ClassStatusBadge fitnessClass={fitnessClass} />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <h3 className="font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
              {fitnessClass.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {classExcerpt(fitnessClass.description)}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {status === "replay"
                ? "Replay"
                : format(new Date(fitnessClass.scheduled_at), "MMM d · h:mm a")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fitnessClass.duration_minutes} min
            </span>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

export function ClassesCatalog({ classes }: { classes: FitnessClass[] }) {
  const [activeCategory, setActiveCategory] = useState<ClassCategory | "All">("All");

  const filtered = useMemo(() => {
    if (activeCategory === "All") return classes;
    return classes.filter((c) => c.category === activeCategory);
  }, [classes, activeCategory]);

  const { live, upcoming, replays, ended } = useMemo(
    () => partitionClasses(filtered),
    [filtered]
  );

  const hasContent = live.length + upcoming.length + replays.length + ended.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black">Live coaching</h1>
              <p className="text-xs text-muted-foreground">Join live · schedule · watch replays</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 font-semibold text-red-300">
              <Radio className="h-3.5 w-3.5" />
              Live {live.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
              <Calendar className="h-3.5 w-3.5" />
              Next {upcoming.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-1 font-semibold text-muted-foreground">
              <Video className="h-3.5 w-3.5" />
              Replays {replays.length}
            </span>
          </div>
        </div>

        <Card className="border-border bg-secondary/20">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FlowStep icon={Calendar} label="Pick" />
                <div className="h-px w-8 bg-border" />
                <FlowStep icon={Radio} label="Join" active={live.length > 0} />
                <div className="h-px w-8 bg-border" />
                <FlowStep icon={Video} label="Replay" />
              </div>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Tap any card below to open details.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory("All")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            activeCategory === "All"
              ? "border border-primary/30 bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All topics
        </button>
        {CLASS_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
              activeCategory === cat
                ? cn("shadow-md", categoryStyles[cat].badge)
                : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {!hasContent ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No classes yet. Check back soon for new live sessions.
        </div>
      ) : (
        <div className="space-y-10">
          {live.length > 0 && (
            <section className="space-y-4">
              {live.map((fitnessClass) => (
                <LiveClassCard key={fitnessClass.id} fitnessClass={fitnessClass} />
              ))}
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Upcoming
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((fitnessClass) => (
                  <ClassCard key={fitnessClass.id} fitnessClass={fitnessClass} />
                ))}
              </div>
            </section>
          )}

          {replays.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Replays
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {replays.map((fitnessClass) => (
                  <ClassCard key={fitnessClass.id} fitnessClass={fitnessClass} />
                ))}
              </div>
            </section>
          )}

          {ended.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Past sessions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ended.map((fitnessClass) => (
                  <ClassCard key={fitnessClass.id} fitnessClass={fitnessClass} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
