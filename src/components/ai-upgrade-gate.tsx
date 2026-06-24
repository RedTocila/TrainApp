import Link from "next/link";
import { Camera, Dumbbell, Salad, Sparkles, Type, Video } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Dumbbell, label: "AI workout plan" },
  { icon: Salad, label: "AI nutrition plan" },
  { icon: Camera, label: "Photo log" },
  { icon: Type, label: "Text log" },
  { icon: Video, label: "Live sessions" },
];

export function AiUpgradeGate({
  title = "TrainApp AI",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-primary/20">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to the €19/month AI plan to unlock this feature
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <Link href="/dashboard/pricing" className={buttonVariants({ className: "w-full" })}>
          View AI plan
        </Link>
      </CardContent>
    </Card>
  );
}
