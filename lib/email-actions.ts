'use server'

import {
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendPasswordResetEmail,
  sendServiceReminderEmail,
  sendAMCExpiryReminderEmail,
  sendAMCExpiredEmail,
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
