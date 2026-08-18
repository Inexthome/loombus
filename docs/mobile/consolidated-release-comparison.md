# Consolidated iOS and Android release comparison

Status: release candidate work in progress. Do not merge to production or submit to either store yet.

## Comparison basis

App Store Connect and Google Play Console were verified on August 18, 2026. The distributed iOS baseline is 1.0.2, build 1. The distributed Android production baseline is 1.0.2, version code 4. The public [Apple App Store listing](https://apps.apple.com/us/app/loombus/id6774788429) independently shows version 1.0.2, and the public [Google Play listing](https://play.google.com/store/apps/details?id=com.loombus.app) shows the corresponding June release.

| Item | Installed-build source baseline | Current release branch |
| --- | --- | --- |
| Git revision | `6a80b6b2` | `agent/mobile-release-auth-persistence` release branch |
| Date | 2026-06-23 | 2026-08-18 |
| iOS metadata | Distributed: 1.0.2, build 1 | 1.0.3, build 4 |
| Android metadata | Distributed: 1.0.2, version code 4 | 1.0.3, version code 5 |
| Change volume | Baseline | 3,671 commits; 1,477 files; 349,810 insertions; 40,026 deletions |

The candidate version identifiers are newer than both verified store baselines. Recheck the consoles immediately before upload in case another build is uploaded first.

## Mobile behavior matrix

| Area | Previous build | Current candidate | Release status |
| --- | --- | --- | --- |
| Remembered login | Browser storage session behavior could diverge inside iOS and Android WebViews | Cookie-backed Supabase session, legacy session migration, and transient-network preservation | Implemented; device restart tests pending |
| Remain signed in after closing app | Not reliable on mobile | Session persists unless the user explicitly logs out or the server invalidates the refresh token | Implemented; force-quit and token-refresh tests pending |
| Logout | Could leave native push registration active | Current-device push token is disabled before Supabase sign-out | Implemented; device test pending |
| Password manager association | No verified native credential association | iOS Associated Domains and AASA plus Android Digital Asset Links endpoint | Implemented; Android Play signing fingerprint and device tests pending |
| Approximate location | No native permission workflow | Native coarse-location request only after the user chooses a Local/nearby action; Android precise-location permission removed | Implemented; iOS and Android tests pending |
| Camera and photos | Web-oriented upload behavior | Native Camera/Photo Picker support, iOS limited-library handling, Android selected-media picker | Implemented; device tests pending |
| Permission visibility | No consolidated native status view | Mobile permission center under Privacy & Account Security | Implemented |
| Notifications and badges | Standard push delivery | Exact unread count included in APNs and FCM delivery | Implemented; push environment/device tests pending |
| Background App Refresh | No configured background runner | System-scheduled, push-driven badge refresh with no periodic content polling | Implemented; native lifecycle tests pending |
| iOS Live Activities | Not declared | Loombus ActivityKit bridge, embedded Widget extension, Lock Screen and Dynamic Island appointment presentation | Implemented; Xcode archive and device lifecycle tests pending |
| Android Live Updates | Not declared | Ongoing appointment notification with Android 16 promotion request and countdown | Implemented; Android 16 device test pending |
| Cross-app tracking | No advertising tracking | Still no cross-app advertising tracking and no ATT prompt | Correct as implemented; add a prompt only if tracking is introduced later |
| Biometrics | Native biometric support present | Shown in the mobile permission center and retained for local session protection | Regression test pending |

## Egress and runtime impact

- Keeping a user signed in while the app is closed does not itself continuously consume egress. Stored cookies and native secure state are local to the device.
- Opening or foregrounding the app can refresh an expired access token and then load normal app data.
- Background refresh performs no periodic network fetch or content polling.
- Each actual native push now performs one small unread-count database query so the push can carry an accurate badge count. This is event-driven work, not continuous background traffic.
- Live Activities and Android Live Updates use appointment timing already loaded by the signed-in app. They do not add a polling stream or recurring server egress.
- The countdown continues on the device. Appointment changes and completed surfaces reconcile when the app next syncs; precise server-driven background changes would require a future event-driven APNs/FCM update path.

## Verification completed on the branch

- Next.js production build: passed for all 319 routes with synthetic build-time Supabase values.
- TypeScript: passed.
- Mobile auth persistence verifier: passed.
- Mobile permission verifier: passed.
- Mobile background refresh verifier: passed.
- Mobile live update verifier: passed.
- Mobile release metadata verifier: passed against the verified App Store Connect and Play Console baselines.
- Targeted ESLint: no errors; two pre-existing `no-explicit-any` warnings remain in push delivery.
- Capacitor iOS and Android synchronization: passed.
- Android backup and device-transfer exclusion: passed static verification.
- Android FileProvider scope: restricted to app-owned Pictures and cache paths.
- Included 64-bit Android native libraries: passed 16 KB ELF alignment verification.
- iOS app privacy manifest: attached to the app target; archive privacy report pending.
- Public Google Play link: corrected to `com.loombus.app`.

## Required release gates

1. On the secured release machine, provide the ignored `android/app/google-services.json`, the Play app-signing SHA-256 fingerprint, and production APNs/FCM environment values. Run `npm run verify:mobile-release-hardening -- --require-production-config`.
2. Build and archive iOS on macOS with Xcode 26 or later and the iOS 26 SDK. Validate signing, Associated Domains, APNs, Background Modes, the privacy report, and the embedded Live Activities extension.
3. Build the Android release with Android Studio/Gradle and validate target SDK 36 behavior. Run `npm run verify:android-page-size -- --artifact=/absolute/path/to/app-release.aab`, then confirm `PAGE_ALIGNMENT_16K` using the current Android bundle analysis tools.
4. Test upgrade installation over the currently distributed iOS and Android builds, not only clean installs.
5. Complete the device matrix below and record evidence before merge.
6. Complete the App Store Privacy, Google Play Data Safety, and Apple social-media age-rating review in `docs/mobile/store-submission-readiness.md`.
7. Re-run `LOOMBUS_IOS_STORE_VERSION=1.0.2 LOOMBUS_IOS_STORE_BUILD=1 LOOMBUS_ANDROID_STORE_VERSION_CODE=4 npm run verify:mobile-release-metadata -- --require-store-baseline` immediately before upload.
8. Merge to production only after every blocking row passes.

## Device test matrix

| Test | iOS | Android | Blocking |
| --- | --- | --- | --- |
| Existing user upgrades and remains signed in | Pending | Pending | Yes |
| New login survives background, force quit, and relaunch | Pending | Pending | Yes |
| Offline relaunch does not sign the user out | Pending | Pending | Yes |
| Explicit logout stays logged out and disables push token | Pending | Pending | Yes |
| Password manager/autofill works | Pending | Pending | Yes |
| Approximate location allow/deny/settings recovery | Pending | Pending | Yes |
| Camera and selected-photo flows | Pending | Pending | Yes |
| Push received in foreground, background, and terminated states | Pending | Pending | Yes |
| Badge increments accurately and clears after reads | Pending | Pending | Yes |
| Background refresh does not create duplicate notifications | Pending | Pending | Yes |
| Active appointment starts, updates, deep-links, and ends its live surface | Pending | Pending | Yes if retained in scope |
| Biometrics unlock remembered session | Pending | Pending | Yes |
| Tracking prompt is absent | Pending | Pending | Yes |

## Release decision

Current decision: **NO-GO for production**. The code and static mobile hardening are ready, but production credentials, Play signing association, native compilation, upgrade testing, store declarations, and on-device Live Activity/Live Update validation are incomplete.
