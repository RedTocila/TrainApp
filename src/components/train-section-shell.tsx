"use client";

import { usePathname } from "next/navigation";
import { isActiveWorkoutSessionPath, isTrainPath } from "@/lib/train-nav";
import { TrainSectionTabs } from "@/components/train-section-tabs";

export function TrainSectionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isTrainPath(pathname) || isActiveWorkoutSessionPath(pathname)) {
    return children;
  }

  return (
    <>
      <div className="mb-3 hidden lg:block">
        <TrainSectionTabs className="mb-0" />
      </div>
      {children}
    </>
  );
}
