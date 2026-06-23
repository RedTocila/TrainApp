import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AiUpgradeGate({
  title = "TrainApp AI required",
  description = "Upgrade to unlock AI Coach features — photo & text meal logging, smart suggestions, progress predictions, and weekly reports.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link href="/dashboard/pricing" className={buttonVariants({ className: "w-full sm:w-auto" })}>
          View AI plan
        </Link>
      </CardContent>
    </Card>
  );
}
