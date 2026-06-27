import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export const EMAIL_CONFIG = {
  FROM_EMAIL: 'hello@remindi.online',
  FROM_NAME: 'Remindi',
} as const

export interface EmailResponse {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'welcome-email', variables: { name: userName } },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendInvoiceEmail(userEmail: string, invoiceNumber: string, clientName: string, grandTotal: number): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'invoice', variables: { invoiceNumber, clientName, grandTotal: grandTotal.toFixed(2) } },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendPasswordResetEmail(userEmail: string, resetLink: string, userName: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'password-reset', variables: { name: userName, resetLink } },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendServiceReminderEmail(userEmail: string, contractName: string, serviceDate: string, customerName: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'service-reminder', variables: { contractName, serviceDate, customerName } },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendAMCExpiryReminderEmail(userEmail: string, contractName: string, expiryDate: string, customerName: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'amc-expiry-reminder', variables: { contractName, expiryDate, customerName } },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// NEW — for the red-banner "already expired" template
export async function sendAMCExpiredEmail(userEmail: string, contractName: string, expiryDate: string, customerName: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    console.log(`[Email Service] Sending AMC expired email to ${userEmail}`)
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: { id: 'amc-expired', variables: { contractName, expiryDate, customerName } },
    })
    if (response.error) {
      console.error(`[Email Service] AMC expired email failed:`, response.error)
      return { success: false, error: response.error.message }
    }
    console.log(`[Email Service] AMC expired email sent. Message ID: ${response.data?.id}`)
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendInviteMemberEmail(inviteeEmail: string, inviterName: string, businessName: string, role: string, acceptLink: string): Promise<EmailResponse> {
  try {
    if (!resend) return { success: false, error: 'Email service is not configured.' }
    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: inviteeEmail,
      template: {
        id: 'invitation-accepted',
        variables: { name: inviteeEmail, inviter_name: inviterName, business_name: businessName, role, invite_link: acceptLink, email: inviteeEmail },
      },
    })
    if (response.error) return { success: false, error: response.error.message }
    return { success: true, messageId: response.data?.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
