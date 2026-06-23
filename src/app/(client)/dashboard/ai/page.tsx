import { requireClient } from "@/lib/actions/auth";
import { PageTransition } from "@/components/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default async function AIPage() {
  await requireClient();

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-6">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-black">AI Coach</h1>
        <p className="mt-2 text-muted-foreground">Coming Soon</p>
        <Card className="mt-8 w-full border-primary/20">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Your personal AI coaching assistant is on the way. Get ready for
              smart workout tips, nutrition advice, and form guidance — powered
              by AI, tailored to your plan.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
