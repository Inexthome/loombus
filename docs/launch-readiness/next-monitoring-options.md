# Next Monitoring Options

This document tracks monitoring tools to consider after the launch-readiness docs are in place.

## Option 1: stay simple for early users

Use:
- Vercel dashboard
- Supabase reports
- Loombus admin health
- Loombus admin billing
- Loombus admin AI access
- manual weekly review

Best for:
- 50–100 early users
- low traffic
- low AI usage
- low storage usage

## Option 2: add Sentry

Use Sentry for runtime error visibility.

Best when:
- users report issues you cannot reproduce;
- client-side errors become common;
- API route failures need better traces;
- you want alerting.

## Option 3: add privacy-safe analytics

Use privacy-conscious analytics only after deciding what events are necessary.

Possible metrics:
- page views;
- signup conversion;
- discussion views;
- reply creation;
- Premium page visits;
- checkout button clicks;
- support/contact submissions.

Avoid tracking:
- sensitive content;
- private notes;
- raw AI prompts beyond what is needed for feature operation;
- unnecessary personal data.

## Option 4: external object storage later

Use Cloudflare R2, Backblaze B2, or similar only when storage/media costs justify it.

Move later:
- media uploads;
- exports;
- generated files;
- backups.

Do not move:
- relational records;
- billing metadata;
- audit logs;
- moderation records;
- entitlements;
- support state.
