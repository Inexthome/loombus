# Loombus mobile authentication

Loombus keeps users signed in by preserving the Supabase browser session.

Rules:
- Do not store raw passwords.
- Do not add an iOS permission for remembered login because remembered login is not a phone permission.
- Keep Supabase browser sessions persistent.
- Keep automatic token refresh enabled.
- Use logout to clear the saved session.
- Add Face ID later as an optional unlock layer on top of the saved session, not as the primary account credential.

Native iOS permission rows such as Photos, Camera, Notifications, Live Activities, Siri, and Location should only be added when Loombus has a real feature that requests them.

## iOS permissions

Current native iOS permission descriptions:
- Photos: used when a user chooses an existing image for a profile avatar, discussion attachment, or message attachment.
- Camera: used only when a user chooses to take a new photo for a profile avatar, discussion attachment, or message attachment.

Not currently enabled:
- Location
- Microphone
- Siri/App Intents
- Live Activities

Do not add sensitive permissions until Loombus has a feature that clearly needs them.

## Native push notifications

Native push notification support is built in layers:
- Capacitor push plugin registration runs only inside the iOS native app.
- The app requests notification permission only after a signed-in session exists.
- Registered APNs tokens are sent to `/api/push/device-tokens`.
- Push tokens are stored in `public.user_push_device_tokens`.
- Server-side delivery is still a later layer and should reuse existing Loombus notification creation events.

Native push still requires Apple/Xcode Push Notifications capability and valid APNs credentials before production delivery will work.

## Server-side push delivery

Initial APNs delivery is intentionally narrow. Native pushes are only sent for:
- New private messages
- Message replies
- Replies to your discussions
- New followers

Loombus does not push every in-app notification type by default. Topic alerts, followed-discussion alerts, followed-reply alerts, mentions, admin notices, and digests should be evaluated separately before native push delivery is enabled for them.

Required server environment variables:
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY` or `APNS_PRIVATE_KEY_BASE64`
- `APNS_BUNDLE_ID`, default `com.loombus.mobile`
- `APNS_ENVIRONMENT`, `development` or `production`

Do not commit APNs private keys to the repository.

## Admin report push alerts

Admin report push alerts are intentionally limited to moderation-critical events:
- Discussion reports
- Reply reports
- Profile reports
- Private message reports
- Private conversation reports

These alerts use the `admin_report` notification type and route admins to `/admin/reports`.

## Native push preference controls

Native push delivery is controlled by `public.notification_preferences`:
- `push_messages_enabled`
- `push_replies_enabled`
- `push_follows_enabled`
- `push_admin_reports_enabled`

The delivery helper checks these preferences before sending APNs notifications. Admin report push alerts are only useful for admin accounts and should stay hidden from non-admin users in the UI.

## APNs environment rule

Loombus supports both APNs environments through `APNS_ENVIRONMENT`.

Use:
- `development` for Xcode-installed development builds with `aps-environment=development`
- `production` for TestFlight and App Store builds signed with production APNs entitlement/provisioning

If the app token comes from one APNs environment and Vercel sends through the other, delivery can fail with APNs token/environment errors.

## Android push notifications

Android push notifications use Firebase Cloud Messaging.

Current Android identity:
- Android package/applicationId: `com.loombus.app`
- Capacitor web app id remains `com.loombus.mobile` for the shared app config

Android push requirements:
- Firebase Android app registered with package name `com.loombus.app`
- `android/app/google-services.json` from Firebase
- Android notification permission `POST_NOTIFICATIONS`
- Device tokens stored as `platform=android` and `token_type=fcm`

Do not use the iOS bundle id `com.loombus.mobile` when creating the Firebase Android app unless the Android applicationId is intentionally changed.


### Android server-side FCM delivery

Android native push delivery uses Firebase Cloud Messaging HTTP v1 from the Loombus server. The Android app registers device tokens as `platform=android` and `token_type=fcm`; server delivery requires Firebase service-account credentials in Vercel.

Preferred Vercel environment variable:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`

Alternative Vercel environment variable:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Granular fallback variables are also supported:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` or `FIREBASE_PRIVATE_KEY_BASE64`
- `FIREBASE_TOKEN_URI`, optional, defaults to `https://oauth2.googleapis.com/token`

Do not commit Firebase service account JSON or private keys. Keep `android/app/google-services.json` local and ignored.

## Native biometric sign-in

Loombus supports optional saved biometric sign-in in the native mobile app.

Rules:
- Supabase login/session remains the real account authentication layer.
- Face ID, Touch ID, fingerprint, or device passcode is used only to unlock a saved device login.
- Loombus does not receive or store biometric templates.
- Users can manage Face ID/biometric access from their device settings.
- Web browser sessions do not use native biometric sign-in.
