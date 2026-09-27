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

// service-reminder template
export interface ServiceReminderEmailData {
  contractorName: string
  customerName: string
  serviceType: string
  serviceDate: string
  customerPhone: string
}

// amc-expiry-reminder template (contract ending soon)
export interface AMCExpiryReminderEmailData {
  contractName: string
  expiryDate: string
  customerName: string
}

// ✅ FIXED — amc-expired template (service visit overdue, red banner)
// Same shape as service-reminder — different template ID
export interface AMCExpiredEmailData {
  contractorName: string
  customerName: string
  serviceType: string
  serviceDate: string
  customerPhone: string
}

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
  contractorName: string
  customerName: string
  serviceType: string
  serviceDate: string
  customerPhone: string
}
