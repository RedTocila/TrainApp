"use client";

import { usePathname } from "next/navigation";
import { BuildWorkoutButton } from "@/components/build-workout-button";
import { ProgramsPageHeader } from "@/components/programs/programs-page-header";
import { ProgramsExercisesToggle } from "@/components/programs-exercises-toggle";
import { WorkoutSectionTabs } from "@/components/workout-section-tabs";

export function WorkoutPageHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const showProgramsToggle =
    pathname === "/dashboard/workout" ||
    pathname.startsWith("/dashboard/workout/exercises") ||
    pathname.startsWith("/dashboard/workout/folder") ||
    pathname.startsWith("/dashboard/workout/workouts") ||
    pathname === "/dashboard/workout/plans";

  return (
    <ProgramsPageHeader
      title={title}
      tabs={
        <div className="space-y-2">
          <WorkoutSectionTabs />
          {showProgramsToggle ? <ProgramsExercisesToggle /> : null}
        </div>
      }
      actions={<BuildWorkoutButton />}
    />
  );
}
