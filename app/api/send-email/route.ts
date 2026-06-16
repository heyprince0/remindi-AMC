import { NextRequest, NextResponse } from 'next/server'
import {
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
} from '@/lib/email-service'

/**
 * POST /api/send-email
 * Generic email sending endpoint
 * 
 * Request body:
 * {
 *   "type": "welcome" | "invoice" | "password-reset" | "service-reminder" | "amc-expiry-reminder",
 *   "userEmail": "user@example.com",
 *   "data": { ... }
 * }
 */
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
        if (!userName) {
          return NextResponse.json(
            { error: 'Missing required field: userName' },
            { status: 400 }
          )
        }
        result = await sendWelcomeEmail(userEmail, userName)
        break
      }

      case 'invoice': {
        const { invoiceNumber, clientName, grandTotal } = data
        if (!invoiceNumber || !clientName || grandTotal === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields: invoiceNumber, clientName, or grandTotal' },
            { status: 400 }
          )
        }
        result = await sendInvoiceEmail(userEmail, invoiceNumber, clientName, grandTotal)
        break
      }

      case 'password-reset': {
        const { resetLink, userName } = data
        if (!resetLink || !userName) {
          return NextResponse.json(
            { error: 'Missing required fields: resetLink or userName' },
            { status: 400 }
          )
        }
        result = await sendPasswordResetEmail(userEmail, resetLink, userName)
        break
      }

      case 'service-reminder': {
        const { contractName, serviceDate, customerName } = data
        if (!contractName || !serviceDate || !customerName) {
          return NextResponse.json(
            { error: 'Missing required fields: contractName, serviceDate, or customerName' },
            { status: 400 }
          )
        }
        result = await sendServiceReminderEmail(userEmail, contractName, serviceDate, customerName)
        break
      }

      case 'amc-expiry-reminder': {
        const { contractName, expiryDate, customerName } = data
        if (!contractName || !expiryDate || !customerName) {
          return NextResponse.json(
            { error: 'Missing required fields: contractName, expiryDate, or customerName' },
            { status: 400 }
          )
        }
        result = await sendAMCExpiryReminderEmail(userEmail, contractName, expiryDate, customerName)
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        messageId: result.messageId,
        type,
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('[API] Email sending error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
