# Mobile store submission readiness

Status: release checklist only. Do not merge, deploy, upload, or submit until every blocking item is verified with the signed artifacts.

## Locked candidate

- iOS: `1.0.3 (1)`, bundle `com.loombus.mobile`
- Live Activities extension: `1.0.3 (1)`, bundle `com.loombus.mobile.LiveActivities`
- Android: `1.0.3`, version code `5`, package `com.loombus.app`
- Distributed comparison: iOS `1.0.2 (1)` and Android `1.0.2`, version code `4`

## App Store Connect

- Build with Xcode 26 or later and the iOS 26 SDK, following [Apple's submission requirements](https://developer.apple.com/news/upcoming-requirements/).
- Inspect the archived privacy report. Confirm the Loombus app manifest and the privacy manifests supplied by Capacitor are present. Resolve any required-reason API warning before upload.
- Confirm the production provisioning profile includes Push Notifications, Associated Domains, and Background Modes.
- Confirm the Live Activities extension is embedded, signed by team `AA9H676YU8`, and version-aligned with the app.
- App Privacy must truthfully cover account identifiers, user-generated photos and videos, approximate location used by Local, push device tokens, purchases, messages, diagnostics, and other data already described in the public Loombus Privacy Policy.
- Tracking remains **No**. Do not add App Tracking Transparency or `NSUserTrackingUsageDescription` unless Loombus later tracks users across other companies' apps or websites.
- Complete Apple's current age-rating questionnaire and answer the social-media or user-generated interaction questions truthfully. Do not change the Loombus minimum age to 18 without a separate product decision.
- Confirm review notes explain that location is on-demand, background work is push-driven with no periodic content polling, and Live Activities are user-initiated appointment surfaces.

## Google Play Console

- Keep target and compile SDK at API 36, consistent with [Google Play target API requirements](https://developer.android.com/google/play/requirements/target-sdk).
- Provide the production `google-services.json` for package `com.loombus.app` only on the secured build machine. It must remain ignored by Git.
- Copy the Play **app-signing** SHA-256 certificate fingerprint from App integrity into `LOOMBUS_ANDROID_APP_SIGNING_SHA256`. Do not substitute only the local upload-key fingerprint.
- Confirm `https://loombus.com/.well-known/assetlinks.json` returns the credential relation for `com.loombus.app` after the production environment variable is configured.
- Data Safety must truthfully cover account identifiers, user-generated photos and videos, approximate location used by Local, messages, purchases, push device tokens, and diagnostics. Declare collection, sharing, purpose, encryption, and deletion behavior based on the verified production flow.
- Photo access uses the system selected-media picker. Do not add broad photo-library permissions.
- Location remains foreground, on-demand, and approximate. Do not add precise or background location declarations.
- Tracking and advertising ID remain unused. Do not add `AD_ID` merely to expose a setting.

## Signed artifact gates

- Run `npm run verify:mobile-release-hardening -- --require-production-config --require-native-toolchains` on the release Mac.
- Run `npm run verify:android-page-size -- --artifact=/absolute/path/to/app-release.aab` and confirm `PAGE_ALIGNMENT_16K` with the current bundle analysis tools, following [Android's 16 KB guidance](https://developer.android.com/guide/practices/page-sizes).
- Install each signed candidate as an upgrade over its distributed predecessor.
- Verify session persistence after backgrounding, force quit, device restart, offline relaunch, and token refresh.
- Verify explicit logout clears the session, removes saved biometric credentials when selected, disables the current push token, and ends active appointment surfaces.
- Verify approximate location allow, deny, and Settings recovery.
- Verify camera and selected-photo flows without broad library access.
- Verify push in foreground, background, and terminated states with accurate badges and no duplicates.
- Verify iOS Live Activities and Android Live Updates start, update, deep-link, and end correctly.
- Verify VoiceOver, Dynamic Type, TalkBack, display scaling, reduced motion, and contrast on the release candidate before claiming accessibility support in either store.

## Final release decision

The release remains **NO-GO** until the signed artifact, device, store-declaration, and production-configuration gates above are recorded as passed.
