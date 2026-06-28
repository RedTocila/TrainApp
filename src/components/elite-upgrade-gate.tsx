"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Trophy, Users, Video } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { PLATFORM_ELITE_NAME } from "@/lib/brand";
import { buildPricingHref } from "@/lib/pricing-nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EliteUpgradeGate({
  title = PLATFORM_ELITE_NAME,
}: {
  title?: string;
  description?: string;
}) {
  const platform = usePlatformCopy();
  const pathname = usePathname();
  const copy = platform.eliteUpgrade;

  const features = [
    { icon: Video, label: copy.liveClasses },
    { icon: Trophy, label: copy.challenges },
    { icon: Users, label: copy.community },
    { icon: Crown, label: copy.exclusive },
  ];

  return (
    <Card className="border-amber-500/20">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
          <Crown className="h-7 w-7 text-amber-400" />
        </div>
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.unlockFeature}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <Link href={buildPricingHref(pathname)} className={buttonVariants({ className: "w-full" })}>
          {copy.viewElitePlan}
        </Link>
      </CardContent>
    </Card>
  );
}
