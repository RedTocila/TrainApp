import { Sparkles } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { AiCoachNav } from "@/components/ai-coach-nav";

export default function AiCoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6 pb-24 lg:pb-8">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black">AI Coach</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Smart nutrition, progress insights, and weekly coaching
          </p>
        </div>
        <AiCoachNav />
        {children}
      </div>
    </PageTransition>
  );
}
