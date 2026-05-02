export const runtime = 'nodejs'

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const vapidConfigured =
  process.env.VAPID_EMAIL &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  if (!vapidConfigured) {
    console.error('VAPID keys are not configured. Set VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.')
    return NextResponse.json({ error: 'Push notifications not configured: missing VAPID keys' }, { status: 503 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set.')
    return NextResponse.json({ error: 'Server misconfiguration: missing service role key' }, { status: 503 })
  }

  try {
    const { userId, title, body, url } = await req.json()

    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)

    if (dbError) {
      console.error('DB error fetching subscriptions:', dbError)
      return NextResponse.json({ error: 'DB error', detail: dbError.message }, { status: 500 })
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const payload = JSON.stringify({ title, body, url })

    const results = await Promise.allSettled(
      subscriptions.map(({ subscription }) =>
        webpush.sendNotification(
          subscription as webpush.PushSubscription,
          payload
        )
      )
    )

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length) {
      console.error('Some push notifications failed:', failed)
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ success: true, sent: succeeded, failed: failed.length })
  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json({ error: 'Failed to send', detail: String(error) }, { status: 500 })
  }
}
