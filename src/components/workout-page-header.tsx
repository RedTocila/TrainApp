"use client";

import { BuildWorkoutButton } from "@/components/build-workout-button";
import { ProgramsPageHeader } from "@/components/programs/programs-page-header";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";

export function WorkoutPageHeader({ title }: { title: string }) {
  return (
    <ProgramsPageHeader
      title={title}
      tabs={<WorkoutSectionTabs />}
      actions={<BuildWorkoutButton />}
    />
  );
}
