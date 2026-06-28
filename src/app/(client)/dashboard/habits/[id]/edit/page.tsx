import { notFound } from "next/navigation";
import { requireClient } from "@/lib/actions/auth";
import { getClientHabit } from "@/lib/actions/habits";
import { HabitFormPage } from "@/components/habit-form-page";
import { PageTransition } from "@/components/page-transition";

export default async function EditHabitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireClient();
  const { id } = await params;
  const habit = await getClientHabit(profile.id, id);

  if (!habit) {
    notFound();
  }

  return (
    <PageTransition>
      <HabitFormPage clientId={profile.id} habit={habit} />
    </PageTransition>
  );
}
