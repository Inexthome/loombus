# Consolidated iOS and Android release comparison

Status: release candidate work in progress. Do not merge to production or submit to either store yet.

## Comparison basis

The repository does not contain an App Store Connect or Google Play artifact manifest that identifies the exact binaries currently installed by testers. This comparison therefore uses the last identifiable native release baseline in Git:

| Item | Installed-build source baseline | Current release branch |
| --- | --- | --- |
| Git revision | `6a80b6b2` | `fb61415b` |
| Date | 2026-06-23 | 2026-08-18 |
| iOS metadata | 1.0.3, build 1 | 1.0.3, build 1, not bumped yet |
| Android metadata | 1.0.2, version code 4 | 1.0.2, version code 4, not bumped yet |
| Change volume | Baseline | 3,671 commits; 1,477 files; 349,810 insertions; 40,026 deletions |

Before store submission, confirm the actual latest TestFlight and Play Console version/build numbers. The candidate must then receive new, monotonically increasing build numbers on both platforms.

## Mobile behavior matrix

| Area | Previous build | Current candidate | Release status |
| --- | --- | --- | --- |
| Remembered login | Browser storage session behavior could diverge inside iOS and Android WebViews | Cookie-backed Supabase session, legacy session migration, and transient-network preservation | Implemented; device restart tests pending |
| Remain signed in after closing app | Not reliable on mobile | Session persists unless the user explicitly logs out or the server invalidates the refresh token | Implemented; force-quit and token-refresh tests pending |
| Logout | Could leave native push registration active | Current-device push token is disabled before Supabase sign-out | Implemented; device test pending |
| Password manager association | No verified iOS web-credential association | iOS associated domain plus hosted Apple App Site Association file | Implemented; Associated Domains entitlement/device test pending |
| Approximate location | No native permission workflow | Native coarse-location request only after the user chooses a Local/nearby action | Implemented; iOS and Android tests pending |
| Camera and photos | Web-oriented upload behavior | Native Camera/Photo Picker support, iOS limited-library handling, Android selected-media picker | Implemented; device tests pending |
| Permission visibility | No consolidated native status view | Mobile permission center under Privacy & Account Security | Implemented |
| Notifications and badges | Standard push delivery | Exact unread count included in APNs and FCM delivery | Implemented; push environment/device tests pending |
| Background App Refresh | No configured background runner | System-scheduled, push-driven badge refresh with no periodic content polling | Implemented; native lifecycle tests pending |
| iOS Live Activities | Not declared | `NSSupportsLiveActivities` declared | Capability foundation only; Widget extension and appointment lifecycle wiring still required |
| Android Live Updates | Not declared | Android 16 promoted-notification permission declared | Capability foundation only; promoted ongoing appointment notification still required |
| Cross-app tracking | No advertising tracking | Still no cross-app advertising tracking and no ATT prompt | Correct as implemented; add a prompt only if tracking is introduced later |
| Biometrics | Native biometric support present | Shown in the mobile permission center and retained for local session protection | Regression test pending |

## Egress and runtime impact

- Keeping a user signed in while the app is closed does not itself continuously consume egress. Stored cookies and native secure state are local to the device.
- Opening or foregrounding the app can refresh an expired access token and then load normal app data.
- Background refresh performs no periodic network fetch or content polling.
- Each actual native push now performs one small unread-count database query so the push can carry an accurate badge count. This is event-driven work, not continuous background traffic.
- Live Activities and Android Live Updates are not yet wired to an update stream, so they currently add no update traffic.

## Verification completed on the branch

- Next.js production build: passed for all 319 routes with synthetic build-time Supabase values.
- TypeScript: passed.
- Mobile auth persistence verifier: passed.
- Mobile permission verifier: passed.
- Mobile background refresh verifier: passed.
- Targeted ESLint: no errors; two pre-existing `no-explicit-any` warnings remain in push delivery.
- Capacitor iOS and Android synchronization: passed.

## Required release gates

1. Finish the iOS Live Activity Widget extension and Android promoted ongoing-notification implementation for active appointments, or explicitly remove Live Activities from this release scope.
2. Obtain the exact current TestFlight and Play Console version/build numbers, then bump both native projects.
3. Build and archive iOS on macOS with Xcode. Validate signing, Associated Domains, APNs, Background Modes, and the Live Activities capability.
4. Build Android release with Android Studio/Gradle and validate target SDK 36 behavior.
5. Test upgrade installation over the currently distributed iOS and Android builds, not only clean installs.
6. Complete the device matrix below and record evidence before merge.
7. Merge to production only after every blocking row passes.

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

Current decision: **NO-GO for production**. The web and static mobile checks are green, but native compilation, upgrade testing, store version confirmation, and the actual Live Activity/Live Update presentation are incomplete.
