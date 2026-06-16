'use server'

import { sendWelcomeEmail, sendInvoiceEmail, sendPasswordResetEmail, sendServiceReminderEmail, sendAMCExpiryReminderEmail } from './email-service'

/**
 * Server action to send welcome email after user registration
 * This is called after successful signup and profile setup
 * 
 * @param userEmail - User's email address
 * @param userName - User's full name
 * @returns Object with success status and optional error message
 */
export async function triggerWelcomeEmail(userEmail: string, userName: string) {
  try {
    if (!userEmail || !userName) {
      return {
        success: false,
        error: 'Missing required email or name',
      }
    }

    const result = await sendWelcomeEmail(userEmail, userName)
    
    if (!result.success) {
      console.error(`[Email Actions] Failed to send welcome email: ${result.error}`)
      // Don't throw error - profile setup should succeed even if email fails
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerWelcomeEmail: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Server action to send invoice email
 * 
 * @param userEmail - User's email address
 * @param invoiceNumber - Invoice number
 * @param clientName - Client/customer name
 * @param grandTotal - Invoice total amount
 * @returns Object with success status and optional error message
 */
export async function triggerInvoiceEmail(
  userEmail: string,
  invoiceNumber: string,
  clientName: string,
  grandTotal: number
) {
  try {
    if (!userEmail || !invoiceNumber || !clientName || grandTotal === undefined) {
      return {
        success: false,
        error: 'Missing required fields for invoice email',
      }
    }

    const result = await sendInvoiceEmail(userEmail, invoiceNumber, clientName, grandTotal)
    
    if (!result.success) {
      console.error(`[Email Actions] Failed to send invoice email: ${result.error}`)
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerInvoiceEmail: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Server action to send password reset email
 * 
 * @param userEmail - User's email address
 * @param resetLink - Password reset link
 * @param userName - User's full name
 * @returns Object with success status and optional error message
 */
export async function triggerPasswordResetEmail(
  userEmail: string,
  resetLink: string,
  userName: string
) {
  try {
    if (!userEmail || !resetLink || !userName) {
      return {
        success: false,
        error: 'Missing required fields for password reset email',
      }
    }

    const result = await sendPasswordResetEmail(userEmail, resetLink, userName)
    
    if (!result.success) {
      console.error(`[Email Actions] Failed to send password reset email: ${result.error}`)
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerPasswordResetEmail: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Server action to send service reminder email
 * 
 * @param userEmail - User's email address
 * @param contractName - Contract/service name
 * @param serviceDate - Upcoming service date
 * @param customerName - Customer name
 * @returns Object with success status and optional error message
 */
export async function triggerServiceReminderEmail(
  userEmail: string,
  contractName: string,
  serviceDate: string,
  customerName: string
) {
  try {
    if (!userEmail || !contractName || !serviceDate || !customerName) {
      return {
        success: false,
        error: 'Missing required fields for service reminder email',
      }
    }

    const result = await sendServiceReminderEmail(userEmail, contractName, serviceDate, customerName)
    
    if (!result.success) {
      console.error(`[Email Actions] Failed to send service reminder email: ${result.error}`)
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerServiceReminderEmail: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Server action to send AMC expiry reminder email
 * 
 * @param userEmail - User's email address
 * @param contractName - Contract/AMC name
 * @param expiryDate - Contract expiry date
 * @param customerName - Customer name
 * @returns Object with success status and optional error message
 */
export async function triggerAMCExpiryReminderEmail(
  userEmail: string,
  contractName: string,
  expiryDate: string,
  customerName: string
) {
  try {
    if (!userEmail || !contractName || !expiryDate || !customerName) {
      return {
        success: false,
        error: 'Missing required fields for AMC expiry reminder email',
      }
    }

    const result = await sendAMCExpiryReminderEmail(userEmail, contractName, expiryDate, customerName)
    
    if (!result.success) {
      console.error(`[Email Actions] Failed to send AMC expiry reminder email: ${result.error}`)
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerAMCExpiryReminderEmail: ${errorMessage}`)
    return {
      success: false,
      error: errorMessage,
    }
  }
}
