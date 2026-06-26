import Link from "next/link";
import { ArrowRight, CreditCard, ExternalLink, Share2, Sparkles } from "lucide-react";
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
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="overflow-hidden">
        <CardContent className="flex h-full flex-col p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">{copy.yourPackages}</p>
              <p className="text-[11px] text-muted-foreground">{copy.activatePackagesHint}</p>
            </div>
          </div>

          {onAi ? (
            <div className="mt-auto flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold">
                {PLATFORM_AI_NAME}
              </span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary">
                {copy.currentPlanLabel}
              </span>
            </div>
          ) : (
            <Link href={REFERRAL_CHECKOUT_PATH} className="mt-auto block">
              <Button className="w-full gap-2">
                {copy.activateAi}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}

          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {copy.qualifyingPlanNote}
          </p>
          <Link
            href="/dashboard/pricing"
            className="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {copy.viewAllPlans}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex h-full flex-col p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">{copy.inviteFriends}</p>
              <p className="text-[11px] text-muted-foreground">{copy.inviteFriendAi}</p>
            </div>
          </div>

          <Link href={referralLink} className="mt-auto block">
            <Button variant="secondary" className="w-full gap-2">
              <Share2 className="h-4 w-4" />
              {copy.inviteFriends}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
