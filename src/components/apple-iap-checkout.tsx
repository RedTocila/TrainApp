"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchIapProducts,
  purchaseIapSubscription,
  type NativeIapProduct,
} from "@/lib/native-iap";

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
  const [product, setProduct] = useState<NativeIapProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [isPending, startTransition] = useTransition();

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
        // User cancelled StoreKit sheet — don't treat as a hard error banner if possible
        if (/cancel/i.test(message)) {
          onError(message);
          return;
        }
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
            {product?.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
            ) : null}
            {priceLabel ? (
              <p className="mt-3 text-2xl font-black tracking-tight">{priceLabel}</p>
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

      <p className="text-center text-xs text-muted-foreground">{processorNote}</p>
    </div>
  );
}
