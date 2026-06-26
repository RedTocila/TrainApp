import Link from "next/link";
import { CreditCard, UserPlus } from "lucide-react";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { REFERRAL_CHECKOUT_PATH } from "@/lib/referral-config";
import { hasAiAccess } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

export type ReferralPackageCopy = {
  activatePackagesTitle: string;
  activatePackagesHint: string;
  activateAi: string;
  upgradeAi: string;
  viewAllPlans: string;
  currentPlanLabel: string;
  yourPackages: string;
  inviteFriends: string;
  inviteFriendAi: string;
  qualifyingPlanNote: string;
};

export function ReferralPackageActions({
  profile,
  referralLink,
  copy,
}: {
  profile: Profile;
  referralLink: string;
  copy: ReferralPackageCopy;
}) {
  const onAi = hasAiAccess(profile);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-black">{copy.activatePackagesTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.activatePackagesHint}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {copy.yourPackages}
          </p>
          {onAi ? (
            <Button className="w-full" disabled>
              {copy.currentPlanLabel}: {PLATFORM_AI_NAME}
            </Button>
          ) : (
            <Link href={REFERRAL_CHECKOUT_PATH} className="block w-full">
              <Button className="w-full">{copy.activateAi}</Button>
            </Link>
          )}
          <p className="text-center text-xs text-muted-foreground">{copy.qualifyingPlanNote}</p>
          <Link
            href="/dashboard/pricing"
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            {copy.viewAllPlans}
          </Link>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <UserPlus className="mr-1 inline h-3 w-3" />
            {copy.inviteFriends}
          </p>
          <Link href={referralLink} className="block w-full">
            <Button variant="secondary" className="w-full">
              {copy.inviteFriendAi}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
