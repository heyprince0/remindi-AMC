export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId, subscription } = await req.json()
    if (!userId || !subscription) {
      return NextResponse.json({ error: 'Missing userId or subscription' }, { status: 400 })
    }
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, subscription }, { onConflict: 'user_id' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
