import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/actions/auth";
import { parseCheckoutLocale } from "@/lib/checkout-i18n";
import { getPlatformCopy } from "@/lib/platform-copy";
import { CheckoutSuccessClient } from "@/components/checkout-success-client";

export default async function CheckoutSuccessPage() {
  await requireClient();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_locale")
    .eq("id", user!.id)
    .single();

  const platform = getPlatformCopy(parseCheckoutLocale(profile?.preferred_locale));

  return <CheckoutSuccessClient copy={platform.checkout} />;
}
