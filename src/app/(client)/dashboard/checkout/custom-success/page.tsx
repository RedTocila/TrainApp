import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { activateCustomPlanFromOrder } from "@/lib/actions/custom-plans";
import { getCustomPlanProduct, TRAINER_NAME } from "@/lib/custom-plan-products";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlanRequestType } from "@/lib/types";

export default async function CustomCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ localOrderId?: string; type?: string }>;
}) {
  const { localOrderId, type } = await searchParams;
  if (!localOrderId || !type) redirect("/dashboard");

  const planType = type as PlanRequestType;
  const product = getCustomPlanProduct(planType);
  if (!product) redirect("/dashboard");

  await activateCustomPlanFromOrder(localOrderId);

  const backHref =
    planType === "workout" ? "/dashboard/workout" : "/dashboard/nutrition";

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <h1 className="text-xl font-bold">Payment received</h1>
              <p className="text-sm text-muted-foreground">{product.title}</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm">
              Waiting for trainer <strong>{TRAINER_NAME}</strong> to accept your
              proposal. If it is not accepted, your payment will be refunded.
            </p>
          </div>
          <Link href={backHref} className={buttonVariants({ className: "w-full" })}>
            Back to {planType === "workout" ? "workout" : "nutrition"}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
