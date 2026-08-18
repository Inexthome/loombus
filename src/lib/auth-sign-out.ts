import { disableNativePushNotificationsForCurrentSession } from "@/lib/native-push";
import { supabase } from "@/lib/supabase/client";

type SignOutOptions = Parameters<typeof supabase.auth.signOut>[0];

export async function signOutCurrentDevice(options?: SignOutOptions) {
  const pushResult = await disableNativePushNotificationsForCurrentSession();

  if (!pushResult.ok) {
    console.warn(
      "Loombus could not disable this device's push token before sign-out.",
      pushResult.error
    );
  }

  return supabase.auth.signOut(options);
}
