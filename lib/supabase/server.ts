// lib/supabase/server.ts
// New file. Server-side Supabase client for API routes and Server Components.
// Distinct from lib/supabase.ts, which is the browser/client-side client
// (uses localStorage via storageKey: 'remindi-auth-token' and cannot read
// auth cookies inside an API route running on the server).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component without write access —
            // safe to ignore if you have middleware refreshing sessions.
            // If you don't have auth middleware yet, sessions may not
            // refresh correctly on expiry; flag this if login starts
            // unexpectedly logging people out after ~1hr.
          }
        },
      },
    }
  )
}
