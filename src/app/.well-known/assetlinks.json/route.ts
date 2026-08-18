const ANDROID_PACKAGE_NAME = "com.loombus.app";
const SHA256_FINGERPRINT_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export const dynamic = "force-dynamic";

function signingFingerprints() {
  return (process.env.LOOMBUS_ANDROID_APP_SIGNING_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => SHA256_FINGERPRINT_PATTERN.test(value));
}

export function GET() {
  const sha256CertFingerprints = signingFingerprints();

  if (sha256CertFingerprints.length === 0) {
    return Response.json(
      {
        error:
          "Android credential association is not configured. Set LOOMBUS_ANDROID_APP_SIGNING_SHA256 to the Google Play app-signing SHA-256 fingerprint.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  return Response.json(
    [
      {
        relation: ["delegate_permission/common.get_login_creds"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE_NAME,
          sha256_cert_fingerprints: sha256CertFingerprints,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
