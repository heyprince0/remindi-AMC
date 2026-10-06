'use server'

import {
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
  sendAMCExpiredEmail,
  sendDemoBookingNotificationEmail,
} from './email-service'

export async function triggerWelcomeEmail(userEmail: string, userName: string) {
  try {
    if (!userEmail || !userName) return { success: false, error: 'Missing required email or name' }
    const result = await sendWelcomeEmail(userEmail, userName)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerWelcomeEmail: ${msg}`)
    return { success: false, error: msg }
  }
}

export async function triggerInvoiceEmail(userEmail: string, invoiceNumber: string, clientName: string, grandTotal: number) {
  try {
    if (!userEmail || !invoiceNumber || !clientName || grandTotal === undefined) return { success: false, error: 'Missing required fields' }
    const result = await sendInvoiceEmail(userEmail, invoiceNumber, clientName, grandTotal)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function triggerPasswordResetEmail(userEmail: string, resetLink: string, userName: string) {
  try {
    if (!userEmail || !resetLink || !userName) return { success: false, error: 'Missing required fields' }
    const result = await sendPasswordResetEmail(userEmail, resetLink, userName)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function triggerServiceReminderEmail(userEmail: string, contractName: string, serviceDate: string, customerName: string) {
  try {
    if (!userEmail || !contractName || !serviceDate || !customerName) return { success: false, error: 'Missing required fields' }
    const result = await sendServiceReminderEmail(userEmail, contractName, serviceDate, customerName)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function triggerAMCExpiryReminderEmail(userEmail: string, contractName: string, expiryDate: string, customerName: string) {
  try {
    if (!userEmail || !contractName || !expiryDate || !customerName) return { success: false, error: 'Missing required fields' }
    const result = await sendAMCExpiryReminderEmail(userEmail, contractName, expiryDate, customerName)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

export async function triggerDemoBookingNotificationEmail(
  full_name: string,
  phone: string,
  company_name: string,
  service_type: string,
  message: string,
  preferred_date: string,
  preferred_time: string,
  created_at: string
) {
  try {
    if (!full_name || !phone) return { success: false, error: 'Missing required fields' }
    const result = await sendDemoBookingNotificationEmail(
      full_name, phone, company_name, service_type,
      message, preferred_date, preferred_time, created_at
    )
    if (!result.success) {
      console.error(`[Email Actions] Demo booking notification failed: ${result.error}`)
      return { success: false, error: result.error }
    }
    console.log(`[Email Actions] Demo booking notification sent. ID: ${result.messageId}`)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email Actions] Exception in triggerDemoBookingNotificationEmail: ${msg}`)
    return { success: false, error: msg }
  }
}

// NEW
export async function triggerAMCExpiredEmail(userEmail: string, contractName: string, expiryDate: string, customerName: string) {
  try {
    if (!userEmail || !contractName || !expiryDate || !customerName) return { success: false, error: 'Missing required fields' }
    const result = await sendAMCExpiredEmail(userEmail, contractName, expiryDate, customerName)
    if (!result.success) { console.error(`[Email Actions] ${result.error}`); return { success: false, error: result.error } }
    return { success: true, messageId: result.messageId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}
