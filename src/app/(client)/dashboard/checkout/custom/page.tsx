import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomPlanCheckoutClient } from "@/components/custom-plan-checkout-client";
import { getCustomPlanProduct } from "@/lib/custom-plan-products";
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

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <Link
          href={
            planType === "workout"
              ? "/dashboard/workout"
              : "/dashboard/nutrition"
          }
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{product.title}</h1>
        <p className="text-muted-foreground">{product.description}</p>
        <p className="mt-2 text-xl font-semibold">
          €{(product.amountCents / 100).toFixed(0)}
        </p>
      </div>
      <CustomPlanCheckoutClient
        localOrderId={order.id}
        pokpayOrderId={order.pokpay_order_id}
        planType={planType}
      />
    </div>
  );
}
