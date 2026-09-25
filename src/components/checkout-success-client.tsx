"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { activateSubscriptionFromLocalOrder } from "@/lib/actions/subscriptions";
import type { PlatformCopy } from "@/lib/platform-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_ATTEMPTS = 8;
const RETRY_MS = 2000;

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
  const attemptRef = useRef(0);

  const activate = useCallback(() => {
    if (!localOrderId) {
      setStatus("error");
      setMessage(copy.missingOrder);
      return;
    }

    startTransition(async () => {
      const result = await activateSubscriptionFromLocalOrder(localOrderId);
      if ("error" in result && result.error) {
        const pending = /not completed yet|not started/i.test(result.error);
        attemptRef.current += 1;
        if (pending && attemptRef.current < MAX_ATTEMPTS) {
          window.setTimeout(() => activate(), RETRY_MS);
          return;
        }
        setStatus("error");
        setMessage(result.error);
        return;
      }
      setStatus("success");
    });
  }, [localOrderId, copy.missingOrder, startTransition]);

  useEffect(() => {
    attemptRef.current = 0;
    activate();
  }, [activate]);

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
          {status === "error" && localOrderId && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                attemptRef.current = 0;
                setStatus("loading");
                setMessage(null);
                activate();
              }}
            >
              Try again
            </Button>
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
