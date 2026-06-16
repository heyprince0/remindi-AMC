import { Resend } from 'resend'

// Initialize Resend with API key (only if available)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Email configuration
export const EMAIL_CONFIG = {
  FROM_EMAIL: 'hello@remindi.online',
  FROM_NAME: 'Remindi',
} as const

/**
 * Email response type
 */
export interface EmailResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Sends a welcome email to a new user
 * @param userEmail - User's email address
 * @param userName - User's full name
 * @returns Promise with email sending status
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string
): Promise<EmailResponse> {
  try {
    if (!resend) {
      console.warn('[Email Service] Resend API key not configured')
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      }
    }

    console.log(`[Email Service] Sending welcome email to ${userEmail}`)

    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: {
        id: 'welcome',
        variables: {
          name: userName,
        },
      },
    })

    if (response.error) {
      console.error(`[Email Service] Welcome email failed for ${userEmail}:`, response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send welcome email',
      }
    }

    console.log(`[Email Service] Welcome email sent successfully to ${userEmail}. Message ID: ${response.data?.id}`)
    return {
      success: true,
      messageId: response.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[Email Service] Exception sending welcome email to ${userEmail}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Sends an invoice email to a customer
 * @param userEmail - User's email address
 * @param invoiceNumber - Invoice number
 * @param clientName - Client/customer name
 * @param grandTotal - Invoice total amount
 * @returns Promise with email sending status
 */
export async function sendInvoiceEmail(
  userEmail: string,
  invoiceNumber: string,
  clientName: string,
  grandTotal: number
): Promise<EmailResponse> {
  try {
    if (!resend) {
      console.warn('[Email Service] Resend API key not configured')
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      }
    }

    console.log(`[Email Service] Sending invoice email to ${userEmail}`)

    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: {
        id: 'invoice',
        variables: {
          invoiceNumber,
          clientName,
          grandTotal: grandTotal.toFixed(2),
        },
      },
    })

    if (response.error) {
      console.error(`[Email Service] Invoice email failed for ${userEmail}:`, response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send invoice email',
      }
    }

    console.log(`[Email Service] Invoice email sent successfully to ${userEmail}. Message ID: ${response.data?.id}`)
    return {
      success: true,
      messageId: response.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[Email Service] Exception sending invoice email to ${userEmail}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Sends a password reset email
 * @param userEmail - User's email address
 * @param resetLink - Password reset link
 * @param userName - User's full name
 * @returns Promise with email sending status
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string,
  userName: string
): Promise<EmailResponse> {
  try {
    if (!resend) {
      console.warn('[Email Service] Resend API key not configured')
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      }
    }

    console.log(`[Email Service] Sending password reset email to ${userEmail}`)

    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: {
        id: 'password-reset',
        variables: {
          name: userName,
          resetLink,
        },
      },
    })

    if (response.error) {
      console.error(`[Email Service] Password reset email failed for ${userEmail}:`, response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send password reset email',
      }
    }

    console.log(`[Email Service] Password reset email sent successfully to ${userEmail}. Message ID: ${response.data?.id}`)
    return {
      success: true,
      messageId: response.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[Email Service] Exception sending password reset email to ${userEmail}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Sends a service reminder email
 * @param userEmail - User's email address
 * @param contractName - Contract/service name
 * @param serviceDate - Upcoming service date
 * @param customerName - Customer name
 * @returns Promise with email sending status
 */
export async function sendServiceReminderEmail(
  userEmail: string,
  contractName: string,
  serviceDate: string,
  customerName: string
): Promise<EmailResponse> {
  try {
    if (!resend) {
      console.warn('[Email Service] Resend API key not configured')
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      }
    }

    console.log(`[Email Service] Sending service reminder email to ${userEmail}`)

    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: {
        id: 'service-reminder',
        variables: {
          contractName,
          serviceDate,
          customerName,
        },
      },
    })

    if (response.error) {
      console.error(`[Email Service] Service reminder email failed for ${userEmail}:`, response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send service reminder email',
      }
    }

    console.log(`[Email Service] Service reminder email sent successfully to ${userEmail}. Message ID: ${response.data?.id}`)
    return {
      success: true,
      messageId: response.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[Email Service] Exception sending service reminder email to ${userEmail}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Sends an AMC expiry reminder email
 * @param userEmail - User's email address
 * @param contractName - Contract/AMC name
 * @param expiryDate - Contract expiry date
 * @param customerName - Customer name
 * @returns Promise with email sending status
 */
export async function sendAMCExpiryReminderEmail(
  userEmail: string,
  contractName: string,
  expiryDate: string,
  customerName: string
): Promise<EmailResponse> {
  try {
    if (!resend) {
      console.warn('[Email Service] Resend API key not configured')
      return {
        success: false,
        error: 'Email service is not configured. Please add RESEND_API_KEY to environment variables.',
      }
    }

    console.log(`[Email Service] Sending AMC expiry reminder email to ${userEmail}`)

    const response = await resend.emails.send({
      from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: userEmail,
      template: {
        id: 'amc-expiry-reminder',
        variables: {
          contractName,
          expiryDate,
          customerName,
        },
      },
    })

    if (response.error) {
      console.error(`[Email Service] AMC expiry reminder email failed for ${userEmail}:`, response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send AMC expiry reminder email',
      }
    }

    console.log(`[Email Service] AMC expiry reminder email sent successfully to ${userEmail}. Message ID: ${response.data?.id}`)
    return {
      success: true,
      messageId: response.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`[Email Service] Exception sending AMC expiry reminder email to ${userEmail}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}
