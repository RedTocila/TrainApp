import Link from "next/link";
import { requireAdmin } from "@/lib/actions/auth";
import { getAllChallenges } from "@/lib/actions/challenges";
import { AdminChallengesList } from "@/components/admin-challenges-list";
import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function AdminChallengesPage() {
  await requireAdmin();
  const challenges = await getAllChallenges();

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black">Challenges</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Multi-month transformation tournaments — monthly Zoom eliminations in groups of 10,
              winners from platform reports and live peer voting
            </p>
          </div>
          <Link href="/admin/challenges/new" className="w-full shrink-0 sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New challenge
            </Button>
          </Link>
        </div>

        <AdminChallengesList challenges={challenges} />
      </div>
    </PageTransition>
  );
}
