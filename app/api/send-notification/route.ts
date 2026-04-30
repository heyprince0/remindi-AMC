export const runtime = 'nodejs'

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId, title, body, url } = await req.json()

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)

    if (!subscriptions?.length) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
    }

    const payload = JSON.stringify({ title, body, url })

    await Promise.all(
      subscriptions.map(({ subscription }) =>
        webpush.sendNotification(
          subscription as webpush.PushSubscription,
          payload
        )
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
