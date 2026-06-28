"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  getPricingReturnLabel,
  parsePricingReturnPath,
} from "@/lib/pricing-nav";

export function PricingBackButton() {
  const searchParams = useSearchParams();
  const platform = usePlatformCopy();
  const returnPath = parsePricingReturnPath(searchParams.get("from"));
  const label = getPricingReturnLabel(returnPath, {
    home: platform.nav.home,
    programs: platform.nav.programs,
    aiCoach: platform.nav.aiCoach,
    liveCoaching: platform.nav.liveCoaching,
    profile: platform.profile.title,
    back: platform.common.back,
  });

  return (
    <Link href={returnPath}>
      <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  );
}
