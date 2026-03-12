import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xgiwnrhdduybbuiyquxd.supabase.co'
const supabaseAnonKey = 'sb_publishable_ZCwEuyyKASPdUosoJ2QEyg_AAX2zHm_'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Profile {
  id: string
  user_id: string
  company_name: string
  phone: string
  whatsapp_number: string
  created_at?: string
}

export interface Customer {
  id: string
  user_id: string
  name: string
  phone: string
  address: string
  email?: string
  created_at?: string
}

export interface Contract {
  id: string
  user_id: string
  customer_id: string
  contract_name: string
  service_type: string
  frequency_days: number
  start_date: string
  next_service_date: string
  status: string
  notes?: string
  created_at?: string
}

export interface Technician {
  id: string
  user_id: string
  name: string
  phone: string
  specialization: string[]
  status: string
  created_at?: string
}

export interface ServiceHistory {
  id: string
  contract_id: string
  technician_id: string
  service_date: string
  notes: string
  status: string
  created_at?: string
}

export interface RemindersLog {
  id: string
  contract_id: string
  sent_at: string
  message_type: string
  status: string
  created_at?: string
}

// Helper functions
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const calculateNextServiceDate = (startDate: string, frequencyDays: number): string => {
  const start = new Date(startDate)
  const next = addDays(start, frequencyDays)
  return next.toISOString().split('T')[0]
}

export const getDaysUntilService = (nextServiceDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const serviceDate = new Date(nextServiceDate)
  serviceDate.setHours(0, 0, 0, 0)
  const diff = serviceDate.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Auth functions
export const getAuthUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://anthora-amc.netlify.app/auth/callback',
    },
  })
  if (error) throw error
  return data
}
