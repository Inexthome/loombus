import { registerPlugin } from "@capacitor/core";
import { getNativePlatform } from "@/lib/native-app";

type PasswordManagerPlugin = {
  savePassword(input: {
    email: string;
    password: string;
  }): Promise<{ saved: boolean }>;
  clearCredentialState(): Promise<{ cleared: boolean }>;
};

const PasswordManager = registerPlugin<PasswordManagerPlugin>(
  "LoombusPasswordManager"
);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function saveLoginToSystemPasswordManager(
  email: string,
  password: string
) {
  const platform = getNativePlatform();

  if (platform !== "ios" && platform !== "android") {
    return { ok: true, skipped: true, cancelled: false };
  }

  try {
    await PasswordManager.savePassword({ email, password });
    return { ok: true, skipped: false, cancelled: false };
  } catch (error) {
    const message = errorMessage(
      error,
      "The device password manager could not save this login."
    );

    return {
      ok: false,
      skipped: false,
      cancelled: /cancel|user.*declin|interrupted/i.test(message),
      error: message,
    };
  }
}

export async function clearNativePasswordManagerCredentialState() {
  if (getNativePlatform() !== "android") {
    return { ok: true, skipped: true };
  }

  try {
    await PasswordManager.clearCredentialState();
    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: errorMessage(
        error,
        "The Android credential provider state could not be cleared."
      ),
    };
  }
}
