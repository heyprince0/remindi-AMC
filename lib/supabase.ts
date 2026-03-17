import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

// Types
export type Contract = {
  id: string
  user_id: string
  customer_id: string
  contract_name: string
  service_type: string
  frequency_days: number
  start_date: string
  next_service_date: string
  status: string
  notes: string | null
  created_at?: string
}

export type Customer = {
  id: string
  user_id: string
  name: string
  phone: string
  email?: string
  address: string
  created_at?: string
}

export type Technician = {
  id: string
  user_id: string
  name: string
  phone: string
  specialization: string | string[]
  status: string
  created_at?: string
}

export type Profile = {
  id?: string
  user_id: string
  full_name: string
  company_name: string
  phone: string
  whatsapp_number: string
  city: string
  service_types: string[]
  created_at?: string
}

export type ServiceHistory = {
  id: string
  contract_id: string
  technician_id: string
  service_date: string
  status: string
  notes: string
  created_at?: string
}

// Utility functions
export function getDaysUntilService(nextServiceDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const serviceDate = new Date(nextServiceDate)
  serviceDate.setHours(0, 0, 0, 0)
  const diffTime = serviceDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function calculateNextServiceDate(startDate: string, frequencyDays: number): string {
  const start = new Date(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let nextDate = new Date(start)
  while (nextDate <= today) {
    nextDate.setDate(nextDate.getDate() + frequencyDays)
  }
  return nextDate.toISOString().split('T')[0]
}

export async function getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export const signIn = async (
  email: string, 
  password: string
) => {
  const { data, error } = await supabase.auth
    .signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signUp = async (
  email: string, 
  password: string
) => {
  const { data, error } = await supabase.auth
    .signUp({ email, password })
  if (error) throw error
  return data
}

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth
    .signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + 
          '/auth/callback'
      }
    })
  if (error) throw error
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
