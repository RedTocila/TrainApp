import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { getClassBySlug, getPublishedClasses } from "@/lib/actions/classes";
import { ClassSessionPanel } from "@/components/class-session-panel";
import { AiUpgradeGate } from "@/components/ai-upgrade-gate";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categoryStyles } from "@/lib/class-utils";
import { hasAiAccess } from "@/lib/subscription";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireClient();
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  if (!profile || !hasAiAccess(profile)) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-4">
          <AiUpgradeGate
            title="TrainApp AI required for live coaching"
            description="Upgrade to the €24/month AI plan to join live coaching sessions and watch replays."
          />
        </div>
      </PageTransition>
    );
  }

  const [fitnessClass, allClasses] = await Promise.all([
    getClassBySlug(slug),
    getPublishedClasses(),
  ]);

  if (!fitnessClass) notFound();

  const related = allClasses
    .filter((c) => c.slug !== slug && c.category === fitnessClass.category)
    .slice(0, 3);
  const styles = categoryStyles[fitnessClass.category];

  return (
    <PageTransition>
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/dashboard/classes">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Live coaching
          </Button>
        </Link>

        <header className="relative overflow-hidden rounded-2xl border border-border">
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", styles.gradient)} />
          {fitnessClass.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fitnessClass.cover_image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          )}
          <div className="relative space-y-4 p-6 sm:p-8">
            <Badge
              variant="outline"
              className="border-white/30 bg-zinc-900/40 text-white backdrop-blur-sm"
            >
              {fitnessClass.category}
            </Badge>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
              {fitnessClass.title}
            </h1>
          </div>
        </header>

        <ClassSessionPanel fitnessClass={fitnessClass} />

        {fitnessClass.slug === "demo-full-body-strength" && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            This is a sample class for preview. Create real sessions in{" "}
            <strong className="text-foreground">Admin → Classes</strong>.
          </p>
        )}

        {fitnessClass.description.trim() && (
          <div className="prose prose-invert max-w-none prose-headings:font-bold prose-a:text-primary">
            <ReactMarkdown>{fitnessClass.description}</ReactMarkdown>
          </div>
        )}

        {related.length > 0 && (
          <section className="space-y-4 border-t border-border pt-8">
            <h2 className="text-lg font-bold">More {fitnessClass.category} classes</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((relatedClass) => (
                <Link
                  key={relatedClass.id}
                  href={`/dashboard/classes/${relatedClass.slug}`}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <Badge variant="secondary" className="mb-2 text-xs">
                    {relatedClass.category}
                  </Badge>
                  <p className="text-sm font-semibold leading-snug group-hover:text-primary">
                    {relatedClass.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </PageTransition>
  );
}
