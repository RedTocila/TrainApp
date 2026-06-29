import { redirect } from "next/navigation";
import { FlashChallengeCheckoutClient } from "@/components/flash-challenge-checkout-client";
import { CheckoutLayout } from "@/components/checkout-layout";
import { getPreferredLocale } from "@/lib/actions/profile";
import { getPlatformCopy } from "@/lib/platform-copy";
import { formatCurrencyAmount } from "@/lib/checkout-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function FlashChallengeCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ localOrderId?: string }>;
}) {
  const { localOrderId } = await searchParams;
  if (!localOrderId) redirect("/dashboard/classes");

  const locale = await getPreferredLocale();
  const platform = getPlatformCopy(locale);
  const flow = platform.checkoutFlow;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("subscription_orders")
    .select("*")
    .eq("id", localOrderId)
    .eq("user_id", user.id)
    .single();

  if (!order?.pokpay_order_id || order.order_kind !== "flash_challenge_entry") {
    redirect("/dashboard/classes");
  }

  const metadata = (order.metadata ?? {}) as {
    challenge_slug?: string;
    challenge_title?: string;
  };
  const challengeTitle = metadata.challenge_title ?? "Flash challenge";
  const backHref = metadata.challenge_slug
    ? `/dashboard/challenges/${metadata.challenge_slug}`
    : "/dashboard/classes";
  const totalLabel = formatCurrencyAmount(order.amount_cents ?? 0);

  return (
    <CheckoutLayout
      backHref={backHref}
      title={platform.challenges.join.flashCheckoutTitle}
      subtitle={challengeTitle}
      totalLabel={totalLabel}
      summary={
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <p className="text-sm font-semibold text-muted-foreground">{flow.orderLabel}</p>
            <p className="mt-1 text-lg font-black leading-tight">{challengeTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {platform.challenges.join.flashCheckoutSummary}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">{flow.total}</p>
              <p className="text-xl font-black">{totalLabel}</p>
            </div>
          </div>
        </div>
      }
      payment={
        <FlashChallengeCheckoutClient
          localOrderId={order.id}
          pokpayOrderId={order.pokpay_order_id}
          locale={locale}
          challengeTitle={challengeTitle}
          backHref={backHref}
        />
      }
    />
  );
}
