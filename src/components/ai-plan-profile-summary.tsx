import Link from "next/link";
import { AlertTriangle, UserRound } from "lucide-react";
import { buildIntakeSummary } from "@/lib/intake-display";
import { isClientIntakeComplete } from "@/lib/client-intake-utils";
import type { Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function AiPlanProfileSummary({ profile }: { profile: Profile }) {
  const complete = isClientIntakeComplete(profile);
  const items = buildIntakeSummary(profile);

  return (
    <Card className={!complete ? "border-amber-500/30 bg-amber-500/[0.03]" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <p className="font-bold">Your profile</p>
          </div>
          {complete ? (
            <Badge className="bg-green-500/15 text-green-400">Ready</Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-400">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Incomplete
            </Badge>
          )}
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg bg-secondary/40 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Add health info for better plans.</p>
        )}

        {!complete && (
          <Link
            href="/dashboard/profile"
            className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
          >
            Complete profile
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
