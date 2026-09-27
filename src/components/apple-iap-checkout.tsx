"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { parseIapProductId } from "@/lib/iap/products";
import {
  fetchIapProducts,
  purchaseIapSubscription,
  type NativeIapProduct,
} from "@/lib/native-iap";

const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

type Props = {
  productId: string;
  appAccountToken: string;
  fallbackPriceLabel?: string;
  ctaLabel: string;
  preparingLabel: string;
  processorNote: string;
  onPurchased: (result: {
    productId: string;
    signedTransaction: string;
    transactionId: string;
  }) => Promise<void> | void;
  onError: (message: string) => void;
};

export function AppleIapCheckout({
  productId,
  appAccountToken,
  fallbackPriceLabel,
  ctaLabel,
  preparingLabel,
  processorNote,
  onPurchased,
  onError,
}: Props) {
  const platform = usePlatformCopy();
  const copy = platform.checkoutFlow;
  const [product, setProduct] = useState<NativeIapProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [isPending, startTransition] = useTransition();
  const interval = parseIapProductId(productId)?.interval ?? "monthly";

  useEffect(() => {
    let cancelled = false;
    setLoadingProduct(true);
    fetchIapProducts([productId])
      .then((products) => {
        if (cancelled) return;
        setProduct(products.find((p) => p.identifier === productId) ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Could not load App Store prices.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProduct(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, onError]);

  const priceLabel = product?.priceString ?? fallbackPriceLabel;

  const buy = () => {
    startTransition(async () => {
      try {
        const purchase = await purchaseIapSubscription({
          productId,
          appAccountToken,
        });
        await onPurchased(purchase);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Apple purchase failed. Please try again.";
        onError(message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
        {loadingProduct ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {preparingLabel}
          </p>
        ) : (
          <>
            <p className="font-semibold text-foreground">
              {product?.title ?? "App Store subscription"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {copy.appleAutoRenewLabel(interval)}
            </p>
            {product?.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
            ) : null}
            {priceLabel ? (
              <p className="mt-3 text-2xl font-black tracking-tight">
                {priceLabel}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  / {interval === "annual" ? copy.billingAnnual : copy.billingMonthly}
                </span>
              </p>
            ) : null}
          </>
        )}
      </div>

      <Button
        className="w-full"
        onClick={buy}
        disabled={isPending || loadingProduct || !product}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {preparingLabel}
          </>
        ) : (
          ctaLabel
        )}
      </Button>

      <div className="space-y-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        {priceLabel ? <p>{copy.appleRenewalDisclosure(priceLabel, interval)}</p> : <p>{processorNote}</p>}
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-medium">
          <a
            href={APPLE_STANDARD_EULA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {copy.appleTermsLink}
          </a>
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {copy.applePrivacyLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
