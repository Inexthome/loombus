# Loombus Deployment Guide

## Production Environment Variables

Create production environment variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Never commit real secrets into Git.

---

# Recommended Deployment

Recommended platform:
- Vercel

Recommended database/auth:
- Supabase

---

# Production Build

Build locally:

    npm run build

Run locally:

    npm run start

---

# Domain Setup

Recommended:
- loombus.com

Configure:
- SSL/HTTPS
- Vercel custom domain
- DNS records

---

# Security Checklist

Before production launch:

- Enable HTTPS
- Verify RLS policies
- Review admin permissions
- Verify moderation tools
- Verify audit logging
- Review security headers
- Review middleware protection
- Verify API route protections

---

# Admin Routes

Protected admin routes:

    /admin
    /admin/reports
    /admin/audit
    /admin/deleted

---

# Current Infrastructure

Loombus currently includes:

- Protected middleware
- Server-side APIs
- Anti-spam cooldowns
- Moderation validation
- Audit logging
- Soft-delete workflow
- Restore workflow
- Admin tooling
- Security headers

---

# Future Production Work

Planned future work:

- Rate limiting
- Email verification
- Password reset flow
- Semantic search
- Notifications
- Realtime updates
- Reputation systems
- AI-assisted moderation
- Analytics
- CDN optimization
