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
- Native push notifications

Do not add sensitive permissions until Loombus has a feature that clearly needs them.
