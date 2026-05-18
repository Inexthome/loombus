# Loombus

Loombus is a signal-first discussion platform focused on thoughtful conversations, durable knowledge, and meaningful contribution.

## Stack

Frontend:
- Next.js 16
- React
- TypeScript
- Tailwind CSS

Backend:
- Supabase
- PostgreSQL
- Authentication
- Row Level Security

## Current Features

Authentication:
- Signup
- Login
- Persistent sessions
- Auth-aware navigation
- Protected route middleware

Discussions:
- Public discussion feed
- Discussion detail pages
- Replies
- Reply counts
- View counts
- Signal score ranking
- Sorting controls
- Following feed
- Saved discussions

Profiles:
- Public profiles
- Follower counts
- Following system

Moderation:
- Discussion reporting
- Admin reports dashboard
- Audit logs
- Soft delete workflow
- Deleted content restore
- Server-side moderation validation
- Server-side anti-spam cooldowns

Admin:
- Admin dashboard
- Audit viewer
- Deleted content viewer
- Moderation workflow

## Local Development

Install dependencies:

    npm install

Run development server:

    npm run dev -- --port 3001

Local URL:

    http://localhost:3001

## Production Build

    npm run build

## Environment Variables

Create `.env.local` with:

    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=

## Admin Routes

    /admin
    /admin/reports
    /admin/audit
    /admin/deleted

## Current Status

Loombus has moved beyond prototype stage and now includes protected APIs, moderation infrastructure, auditability, operational admin tooling, soft-delete recovery, and production-oriented architecture foundations.
