import { disableNativePushNotificationsForCurrentSession } from "@/lib/native-push";
import { endAllAppointmentLiveUpdates } from "@/lib/native-live-updates";
import { supabase } from "@/lib/supabase/client";

type SignOutOptions = Parameters<typeof supabase.auth.signOut>[0];

export async function signOutCurrentDevice(options?: SignOutOptions) {
  const [pushResult, liveUpdateResult] = await Promise.allSettled([
    disableNativePushNotificationsForCurrentSession(),
    endAllAppointmentLiveUpdates(),
  ]);

  if (pushResult.status === "rejected" || !pushResult.value.ok) {
    console.warn(
      "Loombus could not disable this device's push token before sign-out.",
      pushResult.status === "fulfilled" ? pushResult.value.error : pushResult.reason
    );
  }

  if (liveUpdateResult.status === "rejected") {
    console.warn(
      "Loombus could not close this device's appointment live updates before sign-out.",
      liveUpdateResult.reason
    );
  }

  return supabase.auth.signOut(options);
}
