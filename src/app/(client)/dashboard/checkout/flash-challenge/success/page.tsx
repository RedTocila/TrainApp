import Link from "next/link";
import { redirect } from "next/navigation";
import { activateFlashChallengeEntryFromLocalOrder } from "@/lib/actions/flash-challenge-checkout";
import { getPreferredLocale } from "@/lib/actions/profile";
import { getPlatformCopy } from "@/lib/platform-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/page-transition";
import { CheckCircle2 } from "lucide-react";

export default async function FlashChallengeCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ localOrderId?: string }>;
}) {
  const { localOrderId } = await searchParams;
  if (!localOrderId) redirect("/dashboard/classes");

  const result = await activateFlashChallengeEntryFromLocalOrder(localOrderId);
  const locale = await getPreferredLocale();
  const copy = getPlatformCopy(locale).challenges.join;

  if (!("success" in result) || !result.success) {
    const errorMessage = "error" in result ? result.error : "Payment could not be confirmed.";
    return (
      <PageTransition>
        <div className="mx-auto max-w-lg space-y-4 py-12">
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Link href="/dashboard/classes">
                <Button variant="outline">Back to challenges</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const challengeHref =
    "challengeSlug" in result && result.challengeSlug
      ? `/dashboard/challenges/${result.challengeSlug}`
      : "/dashboard/classes";

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="text-xl font-black">{copy.flashPaymentSuccessTitle}</h1>
            <p className="text-sm text-muted-foreground">{copy.flashPaymentSuccessBody}</p>
            <Link href={challengeHref}>
              <Button className="w-full">{copy.flashPaymentSuccessCta}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
