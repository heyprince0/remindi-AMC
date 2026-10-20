import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      orgId 
    } = await req.json();

    // 1. Fetch technician details (phone & name)
    const { data: tech, error: techError } = await supabase
      .from('technicians')
      .select('name, phone')
      .eq('id', technicianId)
      .eq('org_id', orgId)
      .single();

    if (techError || !tech) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    // 2. Fetch organization name for the "From" field
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const senderName = org?.name || 'Remindi';

    // 3. Prepare variables for MSG91
    // Template 1: work_assigned (ID: 565522)
    // Template 2: service_visit_assigned (ID: 565520)
    const isWork = templateType === 'work';
    const templateId = isWork ? '565522' : '565520';
    const templateName = isWork ? 'work_assigned' : 'service_visit_assigned';

    // Format phone (ensure it has country code, e.g., 91)
    const toPhone = tech.phone.startsWith('91') ? tech.phone : `91${tech.phone.replace(/\D/g, '')}`;

    // MSG91 WhatsApp API Payload
    const msg91Payload = {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
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
                { type: 'text', text: tech.name },
                { type: 'text', text: title },
                { type: 'text', text: customerName },
                { type: 'text', text: customerPhone || '-' },
                { type: 'text', text: assignedDate },
                { type: 'text', text: dueDate || '-' },
                { type: 'text', text: notes || '-' },
                { type: 'text', text: senderName },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                { type: 'text', text: technicianId }, // Appends to the URL
              ],
            },
          ],
        },
      },
    };

    // 4. Send to MSG91
    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': process.env.MSG91_AUTH_KEY!,
      },
      body: JSON.stringify(msg91Payload),
    });

    const data = await response.json();
    console.log('MSG91 Response:', data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
