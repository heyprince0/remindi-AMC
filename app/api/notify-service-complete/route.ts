import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      companyName,
      customerName,
      customerPhone,
      contractName,
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
      console.error('Missing Twilio environment variables', {
        hasSid: !!accountSid,
        hasToken: !!authToken,
        hasNumber: !!whatsappNumber,
        hasTemplate: !!templateSid,
      })
      return NextResponse.json(
        { error: 'Twilio configuration missing' },
        { status: 500 }
      )
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Map content variables to new 8-variable template
    // 1=companyName, 2=customerName, 3=contractName, 4=technicianName,
    // 5=serviceDate, 6=nextServiceDate, 7=companyPhone, 8=companyEmail
    const contentVariables = JSON.stringify({
      1: companyName || '',
      2: customerName || '',
      3: contractName || '',
      4: technicianName || '',
      5: serviceDate || '',
      6: nextServiceDate || '',
      7: companyPhone || '',
      8: companyEmail || '',
    })

    // Ensure "from" has whatsapp: prefix only once
    const fromNumber = whatsappNumber.startsWith('whatsapp:')
      ? whatsappNumber
      : `whatsapp:${whatsappNumber}`

    console.log('Attempting to send WhatsApp message', {
      from: fromNumber,
      to: `whatsapp:${formattedPhone}`,
      templateSid,
      contentVariables,
    })

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
  } catch (error: any) {
    console.error('=== TWILIO ERROR DETAILS ===')
    console.error('Message:', error?.message)
    console.error('Code:', error?.code)
    console.error('Status:', error?.status)
    console.error('More info:', error?.moreInfo)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    console.error('=== END ERROR DETAILS ===')

    return NextResponse.json(
      {
        error: error?.message || 'Failed to send notification',
        code: error?.code,
        moreInfo: error?.moreInfo,
      },
      { status: 500 }
    )
  }
}
