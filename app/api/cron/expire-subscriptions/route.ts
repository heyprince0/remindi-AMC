import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // ✅ Allows Vercel to run up to 60 seconds

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatPhone(phone: string): string | null {
  let digits = String(phone ?? '').replace(/\D/g, '')
  digits = digits.replace(/^0+/, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}

function clean(value: unknown, fallback = '-'): string {
  const s = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 200)
  return s || fallback
}

const TEMPLATE_LANGUAGE: Record<string, string> = {
  remindi_subscription_expired: 'en',
  remindi_subscription_expiring_soon: 'en',
  remindi_trial_ending: 'en',
}

async function sendWA(templateName: string, phone: string, components: any) {
  const authkey = process.env.MSG91_AUTHKEY
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER
  const namespace = process.env.MSG91_NAMESPACE
  
  if (!authkey || !integratedNumber || !namespace) {
    return { delivered: false, result: 'Missing MSG91 config in Vercel' }
  }

  const cleanPhone = formatPhone(phone)
  if (!cleanPhone) {
    return { delivered: false, result: 'Invalid phone number format' }
  }

  try {
    const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: templateName,
            language: { code: TEMPLATE_LANGUAGE[templateName] || 'en', policy: 'deterministic' },
            namespace,
            to_and_components: [{ to: [cleanPhone], components }]
          }
        }
      })
    })

    const result = await res.json().catch(() => ({}))
    const delivered = res.ok && result?.hasError !== true
    return { delivered, result }
  } catch (error) {
    return { delivered: false, result: String(error) }
  }
}

export async function GET(req: Request) {
  // 1. Auth Guard
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // 3. Fetch Subscriptions
  const baseQuery = '*, plan:subscription_plans!fk_subscriptions_plan(*), organizations(owner_id)';

  const { data: expiringSoon } = await supabase.from('subscriptions').select(baseQuery).eq('status', 'active').gte('end_date', todayStr).lte('end_date', in7DaysStr);
  const { data: justExpired } = await supabase.from('subscriptions').select(baseQuery).eq('status', 'expired').gte('end_date', yesterdayStr).lte('end_date', todayStr);
  const { data: trialEnding } = await supabase.from('subscriptions').select(baseQuery).eq('status', 'trial').gte('end_date', todayStr).lte('end_date', in7DaysStr);

  let waSent = 0;
  let waSkipped = 0;

  // 4. Helper Function to Process & Send Directly via MSG91
  async function processReminder(sub: any, type: 'expired' | 'expiring_soon' | 'trial_ending') {
    const orgId = sub.org_id;
    const ownerId = sub.organizations?.owner_id;
    if (!ownerId) { waSkipped++; return; }

    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', ownerId).single();
    if (!profile?.phone) { waSkipped++; return; }

    const dedupKey = `${type}_${sub.id}`;

    const { data: alreadySent } = await supabase
      .from('reminders_log')
      .select('id')
      .eq('org_id', orgId)
      .eq('message_type', `whatsapp_${dedupKey}`)
      .eq('status', 'sent')
      .maybeSingle();

    if (alreadySent) { waSkipped++; return; }

    // Extract plan details
    const planName = sub.plan?.name || 'Basic Plan';
    const planPrice = sub.plan?.price_monthly || sub.plan?.price || ''; 
    const formattedPlan = planPrice ? `${planPrice} ${planName}` : planName;

    let templateName = '';
    let components = {};

    if (type === 'expired') {
      templateName = 'remindi_subscription_expired';
      components = {
        body_1: { type: 'text', value: clean(profile.full_name || 'User') },
        body_2: { type: 'text', value: clean(sub.end_date) },
        body_3: { type: 'text', value: clean(formattedPlan) },
      };
    } else if (type === 'expiring_soon') {
      templateName = 'remindi_subscription_expiring_soon';
      components = {
        body_1: { type: 'text', value: clean(profile.full_name || 'User') },
        body_2: { type: 'text', value: clean(sub.end_date) },
        body_3: { type: 'text', value: clean(formattedPlan) },
      };
    } else if (type === 'trial_ending') {
      templateName = 'remindi_trial_ending';
      components = {
        body_1: { type: 'text', value: clean(profile.full_name || 'User') },
        body_2: { type: 'text', value: clean(sub.end_date) },
      };
    }

    // Random delay to avoid MSG91 spam blocking
    await new Promise(r => setTimeout(r, Math.random() * 1000));

    const { delivered, result } = await sendWA(templateName, profile.phone, components);
    if (delivered) { waSent++; } else { waSkipped++; }

    await supabase.from('reminders_log').insert({
      org_id: orgId,
      sent_at: new Date().toISOString(),
      message_type: `whatsapp_${dedupKey}`,
      status: delivered ? 'sent' : 'failed',
      recipient_phone: formatPhone(profile.phone) || profile.phone,
      whatsapp_sent: delivered,
      whatsapp_response: result,
    });
  }

  // 5. Execute all reminders in PARALLEL (No timeouts)
  const tasks: Promise<void>[] = [];
  
  for (const sub of expiringSoon || []) tasks.push(processReminder(sub, 'expiring_soon'));
  for (const sub of justExpired || []) tasks.push(processReminder(sub, 'expired'));
  for (const sub of trialEnding || []) tasks.push(processReminder(sub, 'trial_ending'));

  await Promise.all(tasks);

  // 6. Return Stats
  return NextResponse.json({ 
    success: true, 
    expiredInDb: expiredCount,
    waSent,
    waSkipped
  });
}
