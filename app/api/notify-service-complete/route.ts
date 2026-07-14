import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      companyName,
      customerName,
      customerPhone,
      technicianName,
      serviceDate,
      nextServiceDate,
      companyPhone,
      companyEmail,
    } = body

    // Validate required field
    if (!customerPhone) {
      return NextResponse.json(
        { error: 'customerPhone is required' },
        { status: 400 }
      )
    }

    // Format phone to E.164 format
    let formattedPhone = customerPhone.trim()
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone
    }

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER
    const templateSid = process.env.TWILIO_TEMPLATE_SID

    if (!accountSid || !authToken || !whatsappNumber || !templateSid) {
      console.error('Missing Twilio environment variables')
      return NextResponse.json(
        { error: 'Twilio configuration missing' },
        { status: 500 }
      )
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Map content variables to template placeholders (must be JSON string of an object)
    const contentVariables = JSON.stringify({
      1: companyName || '',
      2: customerName || '',
      3: technicianName || '',
      4: serviceDate || '',
      5: nextServiceDate || '',
      6: companyPhone || '',
      7: companyEmail || '',
    })

    // Ensure "from" has whatsapp: prefix only once
    const fromNumber = whatsappNumber.startsWith('whatsapp:')
      ? whatsappNumber
      : `whatsapp:${whatsappNumber}`

    // Send WhatsApp message via Twilio Content API
    const message = await client.messages.create({
      from: fromNumber,
      to: `whatsapp:${formattedPhone}`,
      contentSid: templateSid,
      contentVariables: contentVariables,
    })

    console.log(`WhatsApp message sent successfully: ${message.sid}`)
    return NextResponse.json(
      { success: true, messageSid: message.sid },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
