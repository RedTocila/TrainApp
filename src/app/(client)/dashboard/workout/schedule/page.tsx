import { redirect } from "next/navigation";

/** Schedule moved into the full calendar — keep URL for old links. */
export default function WorkoutSchedulePage() {
  redirect("/dashboard/workout/plans");
}
