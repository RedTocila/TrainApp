"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { activateSubscriptionFromLocalOrder } from "@/lib/actions/subscriptions";
import type { PlatformCopy } from "@/lib/platform-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CheckoutSuccessClient({
  copy,
}: {
  copy: PlatformCopy["checkout"];
}) {
  const searchParams = useSearchParams();
  const localOrderId = searchParams.get("localOrderId");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!localOrderId) {
      setStatus("error");
      setMessage(copy.missingOrder);
      return;
    }

    startTransition(async () => {
      const result = await activateSubscriptionFromLocalOrder(localOrderId);
      if ("error" in result && result.error) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      setStatus("success");
    });
  }, [localOrderId, copy.missingOrder]);

  return (
    <div className="mx-auto max-w-md pt-8">
      <Card>
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <CardTitle className="mt-4">{copy.confirming}</CardTitle>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <CardTitle className="mt-4">{copy.successTitle}</CardTitle>
            </>
          )}
          {status === "error" && <CardTitle>{copy.errorTitle}</CardTitle>}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "success" && (
            <p className="text-sm text-muted-foreground">{copy.successBody}</p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-400">
              {message ?? copy.paymentUnconfirmed}
            </p>
          )}
          <Link href="/dashboard">
            <Button className="w-full">{copy.goDashboard}</Button>
          </Link>
          {status === "error" && (
            <Link href="/dashboard/pricing">
              <Button variant="outline" className="w-full">
                {copy.backPricing}
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
