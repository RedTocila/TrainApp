"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import { REFERRAL_CHECKOUT_PATH } from "@/lib/referral-config";
import { buildPricingHref } from "@/lib/pricing-nav";
import { hasAiAccess } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  yourCode: string;
  copyCode: string;
  copied: string;
};

export function ReferralPackageActions({
  profile,
  referralCode,
  copy,
}: {
  profile: Profile;
  referralCode: string;
  copy: ReferralPackageCopy;
}) {
  const onAi = hasAiAccess(profile);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

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
            href={buildPricingHref("/dashboard/referrals")}
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
              <Copy className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black">{copy.inviteFriends}</p>
              <p className="text-[11px] text-muted-foreground">{copy.inviteFriendAi}</p>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {copy.yourCode}
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={referralCode}
                className="font-mono text-sm font-bold tracking-widest"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopy()}
                className="shrink-0 gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only sm:not-sr-only">
                  {copied ? copy.copied : copy.copyCode}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
