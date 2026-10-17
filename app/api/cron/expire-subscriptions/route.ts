import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // 1. Auth Guard
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://remindi.online';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
  const in7DaysStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  // 2. Update DB: Mark active subscriptions as expired
  const { error: updateError, count: expiredCount } = await supabase
    .from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('end_date', todayStr);

  if (updateError) {
    console.error('Cron update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Fetch Subscriptions for WhatsApp Notifications
  // A) Expiring Soon (Next 7 days, active)
  const { data: expiringSoon } = await supabase
    .from('subscriptions')
    .select('*, organizations(owner_id)')
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .lte('end_date', in7DaysStr);

  // B) Just Expired (Expired yesterday or today)
  const { data: justExpired } = await supabase
    .from('subscriptions')
    .select('*, organizations(owner_id)')
    .eq('status', 'expired')
    .gte('end_date', yesterdayStr)
    .lte('end_date', todayStr);

  // C) Trials Ending Soon (Next 7 days, trialing)
  // Note: If your DB doesn't have 'trialing' status, this will safely return empty
  const { data: trialEnding } = await supabase
    .from('subscriptions')
    .select('*, organizations(owner_id)')
    .eq('status', 'trialing')
    .gte('end_date', todayStr)
    .lte('end_date', in7DaysStr);

  let waSent = 0;
  let waSkipped = 0;

  // 4. Helper Function to Process & Send
  async function processReminder(sub: any, type: 'expired' | 'expiring_soon' | 'trial_ending') {
    const orgId = sub.org_id || sub.organization_id;
    const ownerId = sub.organizations?.owner_id;
    if (!ownerId) return waSkipped++;

    // Get Owner Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', ownerId)
      .single();

    if (!profile?.phone) return waSkipped++;

    const dedupKey = `${type}_${sub.id}`;

    // Deduplication Check (Don't send if already sent)
    const { data: alreadySent } = await supabase
      .from('reminders_log')
      .select('id')
      .eq('org_id', orgId)
      .eq('message_type', `whatsapp_${dedupKey}`)
      .eq('status', 'sent')
      .maybeSingle();

    if (alreadySent) return waSkipped++;

    // Trigger the Sender API
    try {
      const res = await fetch(`${appUrl}/api/send-subscription-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.CRON_SECRET!,
        },
        body: JSON.stringify({
          orgId: orgId,
          userPhone: profile.phone,
          userName: profile.full_name || 'User',
          expiryDate: sub.end_date,
          planName: sub.plan_name || 'Basic Plan', // Adjust column name if needed
          type: type,
          dedupKey: dedupKey,
        }),
      });

      if (res.ok) {
        waSent++;
      } else {
        console.error(`Failed to send ${type} WA for sub ${sub.id}`);
        waSkipped++;
      }
    } catch (err) {
      console.error(`Error triggering WA for sub ${sub.id}:`, err);
      waSkipped++;
    }
  }

  // 5. Loop through all fetched subscriptions
  for (const sub of expiringSoon || []) await processReminder(sub, 'expiring_soon');
  for (const sub of justExpired || []) await processReminder(sub, 'expired');
  for (const sub of trialEnding || []) await processReminder(sub, 'trial_ending');

  // 6. Return Stats
  return NextResponse.json({ 
    success: true, 
    expiredInDb: expiredCount,
    waSent,
    waSkipped
  });
}
