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
