import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same normalisation your working wa.me links use (page 20 / page 21).
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-().]/g, '');
  if (!p) return null;
  if (p.startsWith('0')) p = '91' + p.slice(1);
  if (!p.startsWith('+')) p = p.startsWith('91') ? p : '91' + p;
  p = p.replace(/^\+/, '');
  return /^\d{10,15}$/.test(p) ? p : null;
}

export async function POST(req: NextRequest) {
  try {
    const {
      templateType, // 'work' | 'service'
      technicianId,
      title,
      customerName,
      customerPhone,
      assignedDate,
      dueDate,
      notes,
      orgId,
    } = await req.json();

    if (!technicianId || !orgId) {
      return NextResponse.json(
        { error: 'Missing technicianId or orgId' },
        { status: 400 }
      );
    }

    // 1. Technician
    const { data: tech, error: techError } = await supabase
      .from('technicians')
      .select('name, phone')
      .eq('id', technicianId)
      .eq('org_id', orgId)
      .single();

    if (techError || !tech) {
      console.error('notify-technician: technician lookup failed', techError);
      return NextResponse.json(
        { error: 'Technician not found', details: techError?.message },
        { status: 404 }
      );
    }

    const toPhone = normalizePhone(tech.phone);
    if (!toPhone) {
      return NextResponse.json(
        { error: `Invalid technician phone: ${tech.phone}` },
        { status: 400 }
      );
    }

    // 2. Organization name (sender)
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();
    const senderName = org?.name || 'Remindi';

    // 3. Template
    const isWork = templateType === 'work';
    const templateName = isWork ? 'work_assigned' : 'service_visit_assigned';

    // ── CHANGED HERE: using MSG91_AUTHKEY as it is spelled in Vercel ──
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER;
    const authKey = process.env.MSG91_AUTHKEY; 
    
    if (!integratedNumber || !authKey) {
      console.error('notify-technician: MSG91 env vars missing');
      return NextResponse.json(
        { error: 'MSG91 not configured' },
        { status: 500 }
      );
    }

    const msg91Payload = {
      integrated_number: integratedNumber,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en', policy: 'deterministic' },
          to: toPhone,
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: tech.name || 'Technician' },
                { type: 'text', text: title || '-' },
                { type: 'text', text: customerName || '-' },
                { type: 'text', text: customerPhone || '-' },
                { type: 'text', text: assignedDate || '-' },
                { type: 'text', text: dueDate || '-' },
                { type: 'text', text: notes || '-' },
                { type: 'text', text: senderName },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: technicianId }],
            },
          ],
        },
      },
    };

    // 4. Send — single-message endpoint (not /bulk/) for one recipient.
    const response = await fetch(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify(msg91Payload),
      }
    );

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }
    console.log('MSG91 status:', response.status, 'body:', data);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'MSG91 send failed', status: response.status, data },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
