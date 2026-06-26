import { redirect } from "next/navigation";
import { CustomPlanCheckoutClient } from "@/components/custom-plan-checkout-client";
import { CheckoutLayout } from "@/components/checkout-layout";
import { getCustomPlanProduct } from "@/lib/custom-plan-products";
import { getPreferredLocale } from "@/lib/actions/profile";
import { formatCurrencyAmount } from "@/lib/checkout-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlanRequestType } from "@/lib/types";

export default async function CustomCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ localOrderId?: string; type?: string }>;
}) {
  const { localOrderId, type } = await searchParams;
  if (!localOrderId || !type) redirect("/dashboard");

  const planType = type as PlanRequestType;
  const product = getCustomPlanProduct(planType);
  if (!product) redirect("/dashboard");

  const locale = await getPreferredLocale();

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

  if (!order?.pokpay_order_id) redirect("/dashboard");

  const totalLabel = formatCurrencyAmount(order.amount_cents ?? 0);

  return (
    <CheckoutLayout
      backHref={planType === "workout" ? "/dashboard/workout" : "/dashboard/nutrition"}
      title={product.title}
      subtitle={product.description}
      totalLabel={totalLabel}
      summary={
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <p className="text-sm font-semibold text-muted-foreground">Order</p>
            <p className="mt-1 text-lg font-black leading-tight">{product.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Total</p>
              <p className="text-xl font-black">{totalLabel}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/25 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What happens next</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>You’ll see your purchase confirmation immediately after payment.</li>
              <li>Your plan request will appear in your dashboard.</li>
            </ul>
          </div>
        </div>
      }
      payment={
        <CustomPlanCheckoutClient
          localOrderId={order.id}
          pokpayOrderId={order.pokpay_order_id}
          planType={planType}
          locale={locale}
        />
      }
    />
  );
}
