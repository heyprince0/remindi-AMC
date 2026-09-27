import { NextRequest, NextResponse } from 'next/server'
import {
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
  sendAMCExpiredEmail,
} from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, userEmail, data } = body

    if (!type || !userEmail || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, userEmail, or data' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'welcome': {
        const { userName } = data
        if (!userName) return NextResponse.json({ error: 'Missing: userName' }, { status: 400 })
        result = await sendWelcomeEmail(userEmail, userName)
        break
      }

      case 'invoice': {
        const { invoiceNumber, clientName, grandTotal } = data
        if (!invoiceNumber || !clientName || grandTotal === undefined)
          return NextResponse.json({ error: 'Missing: invoiceNumber, clientName, or grandTotal' }, { status: 400 })
        result = await sendInvoiceEmail(userEmail, invoiceNumber, clientName, grandTotal)
        break
      }

      case 'password-reset': {
        const { resetLink, userName } = data
        if (!resetLink || !userName)
          return NextResponse.json({ error: 'Missing: resetLink or userName' }, { status: 400 })
        result = await sendPasswordResetEmail(userEmail, resetLink, userName)
        break
      }

      // ✅ FIXED — now requires all 5 correct fields
      case 'service-reminder': {
        const { contractorName, customerName, serviceType, serviceDate, customerPhone } = data
        if (!contractorName || !customerName || !serviceType || !serviceDate || !customerPhone)
          return NextResponse.json(
            { error: 'Missing: contractorName, customerName, serviceType, serviceDate, or customerPhone' },
            { status: 400 }
          )
        result = await sendServiceReminderEmail(userEmail, contractorName, customerName, serviceType, serviceDate, customerPhone)
        break
      }

      case 'amc-expiry-reminder': {
        const { contractName, expiryDate, customerName } = data
        if (!contractName || !expiryDate || !customerName)
          return NextResponse.json({ error: 'Missing: contractName, expiryDate, or customerName' }, { status: 400 })
        result = await sendAMCExpiryReminderEmail(userEmail, contractName, expiryDate, customerName)
        break
      }

      case 'amc-expired': {
        const { contractName, expiryDate, customerName } = data
        if (!contractName || !expiryDate || !customerName)
          return NextResponse.json({ error: 'Missing: contractName, expiryDate, or customerName' }, { status: 400 })
        result = await sendAMCExpiredEmail(userEmail, contractName, expiryDate, customerName)
        break
      }

      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true, messageId: result.messageId, type }, { status: 200 })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API] Email sending error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
