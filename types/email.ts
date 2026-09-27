/**
 * Email Service Type Definitions
 * 
 * These types are used throughout the email service to ensure
 * type-safe operations across all email-related functions.
 */

/**
 * Response type from email sending functions
 */
export interface EmailResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Email configuration
 */
export interface EmailConfig {
  FROM_EMAIL: string
  FROM_NAME: string
}

/**
 * Server action result wrapper
 */
export interface ServerActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Email template types supported by the service
 */
export type EmailTemplateType = 
  | 'welcome'
  | 'invoice'
  | 'password-reset'
  | 'service-reminder'
  | 'amc-expiry-reminder'

/**
 * Email request body for the /api/send-email endpoint
 */
export interface EmailRequest {
  type: EmailTemplateType
  userEmail: string
  data: EmailTemplateData
}

/**
 * Union type of all possible email template data
 */
export type EmailTemplateData = 
  | WelcomeEmailData
  | InvoiceEmailData
  | PasswordResetEmailData
  | ServiceReminderEmailData
  | AMCExpiryReminderEmailData

/**
 * Welcome email template data
 */
export interface WelcomeEmailData {
  userName: string
}

/**
 * Invoice email template data
 */
export interface InvoiceEmailData {
  invoiceNumber: string
  clientName: string
  grandTotal: number
}

/**
 * Password reset email template data
 */
export interface PasswordResetEmailData {
  userName: string
  resetLink: string
}

/**
 * Service reminder email template data
 */
export interface ServiceReminderEmailData {
  contractName: string
  serviceDate: string
  customerName: string
}

/**
 * AMC expiry reminder email template data
 */
export interface AMCExpiryReminderEmailData {
  contractName: string
  expiryDate: string
  customerName: string
}

/**
 * Email function parameters
 */
export interface SendWelcomeEmailParams {
  userEmail: string
  userName: string
}

export interface SendInvoiceEmailParams {
  userEmail: string
  invoiceNumber: string
  clientName: string
  grandTotal: number
}

export interface SendPasswordResetEmailParams {
  userEmail: string
  resetLink: string
  userName: string
}

export interface SendServiceReminderEmailParams {
  userEmail: string
  contractName: string
  serviceDate: string
  customerName: string
}

export interface SendAMCExpiryReminderEmailParams {
  userEmail: string
  contractName: string
  expiryDate: string
  customerName: string
}
