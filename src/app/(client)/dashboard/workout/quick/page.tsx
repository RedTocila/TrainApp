import { Suspense } from "react";
import { QuickWorkoutClient } from "@/components/quick-workout-client";

export default function QuickWorkoutPage() {
  return (
    <Suspense fallback={null}>
      <QuickWorkoutClient />
    </Suspense>
  );
}
