"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function DashboardDayDetailShell({
  children,
  backHref = "/dashboard",
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const platform = usePlatformCopy();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="-ml-2 h-9 gap-1.5 px-2">
          <ArrowLeft className="h-4 w-4" />
          {platform.common.back}
        </Button>
      </Link>
      {children}
    </div>
  );
}
