"use client";

import { usePathname } from "next/navigation";
import { isTrainPath } from "@/lib/train-nav";
import { TrainSectionTabs } from "@/components/train-section-tabs";

export function TrainSectionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isTrainPath(pathname)) {
    return children;
  }

  return (
    <>
      <TrainSectionTabs />
      {children}
    </>
  );
}
