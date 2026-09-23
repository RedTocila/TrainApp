import { Capacitor } from "@capacitor/core";
import { ALL_IAP_PRODUCT_IDS } from "@/lib/iap/products";

export function shouldUseAppleIap(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export type NativeIapProduct = {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  price: number;
};

export type NativeIapPurchaseResult = {
  productId: string;
  transactionId: string;
  signedTransaction: string;
};

async function getNativePurchases() {
  const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
  return { NativePurchases, PURCHASE_TYPE };
}

export async function fetchIapProducts(
  productIds: string[] = ALL_IAP_PRODUCT_IDS
): Promise<NativeIapProduct[]> {
  if (!shouldUseAppleIap()) return [];
  const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases();
  const supported = await NativePurchases.isBillingSupported();
  if (!supported.isBillingSupported) {
    throw new Error("In-App Purchases are not available on this device.");
  }
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: productIds,
    productType: PURCHASE_TYPE.SUBS,
  });
  return products.map((product) => ({
    identifier: product.identifier,
    title: product.title,
    description: product.description,
    priceString: product.priceString,
    price: product.price,
  }));
}

export async function purchaseIapSubscription(args: {
  productId: string;
  appAccountToken: string;
}): Promise<NativeIapPurchaseResult> {
  const { NativePurchases, PURCHASE_TYPE } = await getNativePurchases();
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: args.productId,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: args.appAccountToken,
  });

  const signedTransaction = transaction.jwsRepresentation?.trim() ?? "";
  if (!signedTransaction) {
    throw new Error(
      "Apple did not return a signed transaction (jwsRepresentation). Check StoreKit / plugin version."
    );
  }

  const transactionId = transaction.transactionId?.trim() ?? "";
  if (!transactionId) {
    throw new Error(
      "Apple did not return a transaction id. Check StoreKit / plugin version."
    );
  }

  return {
    productId: args.productId,
    transactionId,
    signedTransaction,
  };
}

export async function openAppleSubscriptionManagement() {
  if (!shouldUseAppleIap()) return;
  const { NativePurchases } = await getNativePurchases();
  await NativePurchases.manageSubscriptions();
}

export async function restoreApplePurchases() {
  if (!shouldUseAppleIap()) return;
  const { NativePurchases } = await getNativePurchases();
  await NativePurchases.restorePurchases();
}
