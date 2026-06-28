import { requireClient } from "@/lib/actions/auth";
import { HabitFormPage } from "@/components/habit-form-page";
import { PageTransition } from "@/components/page-transition";

export default async function NewHabitPage() {
  const profile = await requireClient();

  return (
    <PageTransition>
      <HabitFormPage clientId={profile.id} />
    </PageTransition>
  );
}
