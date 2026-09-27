export interface EmailResponse {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailConfig {
  FROM_EMAIL: string
  FROM_NAME: string
}

export interface ServerActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export type EmailTemplateType =
  | 'welcome'
  | 'invoice'
  | 'password-reset'
  | 'service-reminder'
  | 'amc-expiry-reminder'
  | 'amc-expired'

export interface EmailRequest {
  type: EmailTemplateType
  userEmail: string
  data: EmailTemplateData
}

export type EmailTemplateData =
  | WelcomeEmailData
  | InvoiceEmailData
  | PasswordResetEmailData
  | ServiceReminderEmailData
  | AMCExpiryReminderEmailData
  | AMCExpiredEmailData

export interface WelcomeEmailData {
  userName: string
}

export interface InvoiceEmailData {
  invoiceNumber: string
  clientName: string
  grandTotal: number
}

export interface PasswordResetEmailData {
  userName: string
  resetLink: string
}

// ✅ FIXED — matches HTML template variables exactly
export interface ServiceReminderEmailData {
  contractorName: string  // was contractName before
  customerName: string
  serviceType: string     // was missing before
  serviceDate: string
  customerPhone: string   // was missing before
}

export interface AMCExpiryReminderEmailData {
  contractName: string
  expiryDate: string
  customerName: string
}

export interface AMCExpiredEmailData {
  contractName: string
  expiryDate: string
  customerName: string
}

// Params interfaces
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

// ✅ FIXED
export interface SendServiceReminderEmailParams {
  userEmail: string
  contractorName: string
  customerName: string
  serviceType: string
  serviceDate: string
  customerPhone: string
}

export interface SendAMCExpiryReminderEmailParams {
  userEmail: string
  contractName: string
  expiryDate: string
  customerName: string
}

export interface SendAMCExpiredEmailParams {
  userEmail: string
  contractName: string
  expiryDate: string
  customerName: string
}
