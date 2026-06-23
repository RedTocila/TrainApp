import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/actions/auth";
import { getClientCardioList } from "@/lib/actions/user-cardio";
import { CardioListPage } from "@/components/cardio-list-page";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";

export default async function WorkoutCardioPage() {
  await requireClient();
  const cardio = await getClientCardioList();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/dashboard/workout">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to workouts
          </Button>
        </Link>
        <CardioListPage initialCardio={cardio} />
      </div>
    </PageTransition>
  );
}
