import type { ReactNode } from "react";
import ClientLayout from "./client-layout";
import { NativeBiometricSessionGate } from "@/components/native-biometric-session-gate";
import { NativePushRegistration } from "@/components/native-push-registration";

export function AppRuntime({ children }: { children: ReactNode }) {
  return (
    <>
      <ClientLayout>{children}</ClientLayout>
      <NativeBiometricSessionGate />
      <NativePushRegistration />
    </>
  );
}
