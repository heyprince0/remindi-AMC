import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

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

export const calculateNextServiceDate = (
  startDate: string,
  frequencyDays: number
): string => {
  const date = new Date(startDate)
  date.setDate(date.getDate() + frequencyDays)
  return date.toISOString().split('T')[0]
}

export type Customer = {
  id: string
  user_id: string
  name: string
  phone: string
  address: string
  created_at: string
}

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
  notes: string
  created_at: string
}

export type Technician = {
  id: string
  user_id: string
  name: string
  phone: string
  specialization: string
  status: string
  created_at: string
}

export type ServiceHistory = {
  id: string
  contract_id: string
  technician_id: string
  service_date: string
  status: string
  notes: string
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  whatsapp_number: string | null
  city: string | null
  service_types: string[] | null
}

export const getDaysUntilService = calculateNextServiceDate
