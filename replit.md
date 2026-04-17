# Project Overview

Remindi is a Next.js application for managing Annual Maintenance Contracts, customers, technicians, service schedules, alerts, reports, authentication, and push notifications.

# Project Architecture

- Framework: Next.js App Router with React and TypeScript.
- Styling/UI: Tailwind CSS with Radix UI components and shared UI primitives under `components/`.
- Data/auth: Supabase client usage is centralized in `lib/supabase.ts` for browser-safe public anon-key operations.
- Server-only functionality: API routes under `app/api/` use server-side environment variables for privileged Supabase and push-notification operations.
- Runtime: The Replit workflow runs `pnpm run dev` on port 5000 and binds to `0.0.0.0` for web preview compatibility.

# Environment Configuration

Required public variables are configured for the client-side Supabase and push notification setup:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `VAPID_EMAIL`

Server-side API routes also expect private server environment variables when notification/contract-check endpoints are used:

- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`

# Recent Changes

- Imported/migrated the project to run in Replit without rewriting the application.
- Installed project dependencies with pnpm.
- Verified the Replit workflow starts successfully and the app responds with HTTP 200 on `/`.
- Replaced the PWA install prompt UI with a direct APK download link using `public/remindi.apk`.
