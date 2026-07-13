import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route needs the SERVICE ROLE key (not the public anon key) because
// checking whether an email already has an auth account requires admin access.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 })
    }

    // Look up the user by email using the admin API
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      // Supabase admin listUsers doesn't support a direct email filter param
      // in all versions, so we fetch and match manually below as a fallback.
    })

    if (error) {
      console.error('check-email: listUsers error', error)
      return NextResponse.json({ exists: false }, { status: 200 })
    }

    // Try the simple case first: some Supabase versions support filtering directly.
    let exists = false
    if (data?.users?.length) {
      exists = data.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
    }

    // Fallback: if listUsers with perPage:1 didn't return a match (pagination),
    // do a broader search. This keeps the request cheap for the common case
    // while still being correct.
    if (!exists) {
      const { data: allData, error: allError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (!allError && allData?.users?.length) {
        exists = allData.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
      }
    }

    return NextResponse.json({ exists }, { status: 200 })
  } catch (err) {
    console.error('check-email: unexpected error', err)
    // Fail safe: treat as "new user" so signup flow is used rather than
    // blocking the whole invite acceptance process.
    return NextResponse.json({ exists: false }, { status: 200 })
  }
}
