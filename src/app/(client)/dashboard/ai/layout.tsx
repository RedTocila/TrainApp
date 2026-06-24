import { Sparkles } from "lucide-react";
import { AiCoachNav } from "@/components/ai-coach-nav";

export default function AiCoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 lg:pb-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-black">AI Coach</h1>
        </div>
        <AiCoachNav />
        {children}
    </div>
  );
}
