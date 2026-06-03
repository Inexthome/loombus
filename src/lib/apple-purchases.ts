import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase/client";

declare global {
  interface Window {
    CdvPurchase?: any;
  }
}

export const APPLE_PRODUCT_IDS = {
  premium_monthly: "loombus_premium_monthly",
  premium_annual: "loombus_premium_annual",
  premium_plus_monthly: "loombus_premium_plus_monthly",
  premium_plus_annual: "loombus_premium_plus_annual",
  extra_ai_pack: "loombus_extra_ai_pack",
} as const;

export type ApplePlanKey = keyof typeof APPLE_PRODUCT_IDS;

let appleStoreInitialized = false;

export function isIosNativeApp() {
  if (typeof window === "undefined") return false;

  const capacitorRuntime = (window as any).Capacitor;
  const runtimePlatform =
    capacitorRuntime?.getPlatform?.() ??
    Capacitor.getPlatform();

  const nativeRuntime =
    capacitorRuntime?.isNativePlatform?.() ??
    Capacitor.isNativePlatform();

  return Boolean(nativeRuntime) && runtimePlatform === "ios";
}

function getCdvPurchase() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.CdvPurchase ?? null;
}

function getAppleProductId(planKey: string) {
  return APPLE_PRODUCT_IDS[planKey as ApplePlanKey] ?? null;
}

async function fulfillApplePurchase({
  productId,
  transactionId,
}: {
  productId: string;
  transactionId: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    throw new Error("Please log in before purchasing.");
  }

  const response = await fetch("/api/billing/apple-transaction", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId,
      transactionId,
    }),
  });

  const result = await response.json().catch(() => ({
    error: "Apple purchase fulfillment returned an unreadable response.",
  }));

  if (!response.ok) {
    throw new Error(
      result.detail
        ? `${result.error ?? "Unable to fulfill Apple purchase."} ${result.detail}`
        : result.error ?? "Unable to fulfill Apple purchase."
    );
  }

  return result;
}

export async function initializeApplePurchases() {
  if (!isIosNativeApp()) {
    return false;
  }

  if (appleStoreInitialized) {
    return true;
  }

  const CdvPurchase = getCdvPurchase();

  if (!CdvPurchase?.store) {
    throw new Error("Apple purchases are not available yet. Please restart the app and try again.");
  }

  const { store } = CdvPurchase;

  store.register([
    {
      id: APPLE_PRODUCT_IDS.premium_monthly,
      type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    },
    {
      id: APPLE_PRODUCT_IDS.premium_annual,
      type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    },
    {
      id: APPLE_PRODUCT_IDS.premium_plus_monthly,
      type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    },
    {
      id: APPLE_PRODUCT_IDS.premium_plus_annual,
      type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    },
    {
      id: APPLE_PRODUCT_IDS.extra_ai_pack,
      type: CdvPurchase.ProductType.CONSUMABLE,
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
    },
  ]);

  store.when()
    .approved((transaction: any) => {
      transaction.verify();
    })
    .verified(async (receipt: any) => {
      const transactions = receipt?.transactions ?? [];
      const transaction = transactions[transactions.length - 1];
      const productId =
        transaction?.products?.[0]?.id ??
        transaction?.productId ??
        receipt?.products?.[0]?.id ??
        receipt?.productId;

      const transactionId =
        transaction?.transactionId ??
        transaction?.id ??
        receipt?.transactionId ??
        receipt?.id;

      if (productId && transactionId) {
        await fulfillApplePurchase({
          productId,
          transactionId,
        });
      }

      receipt.finish();
    });

  await store.initialize([
    {
      platform: CdvPurchase.Platform.APPLE_APPSTORE,
      options: {
        needAppReceipt: true,
      },
    },
  ]);

  await store.update();

  appleStoreInitialized = true;
  return true;
}

export async function purchaseApplePlan(planKey: string) {
  const productId = getAppleProductId(planKey);

  if (!productId) {
    throw new Error("This Apple purchase is not configured.");
  }

  await initializeApplePurchases();

  const CdvPurchase = getCdvPurchase();
  const product = CdvPurchase?.store?.get(productId);

  if (!product) {
    throw new Error("Apple product was not found. Make sure the product is Ready to Submit in App Store Connect.");
  }

  const offer = product.getOffer?.();

  if (!offer) {
    throw new Error("Apple product offer was not available yet. Please try again.");
  }

  const error = await offer.order();

  if (error) {
    if (error.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) {
      throw new Error("Apple purchase was cancelled.");
    }

    throw new Error(error.message ?? "Apple purchase failed.");
  }

  return true;
}
