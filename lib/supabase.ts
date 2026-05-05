import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'remindi-auth-token',
    },
  }
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
  contracts_price: number | null
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
  price: number | null
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  city: string | null
  service_types: string[] | null
}

export const getDaysUntilService = (nextServiceDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const serviceDate = new Date(nextServiceDate)
  serviceDate.setHours(0, 0, 0, 0)
  if (isNaN(serviceDate.getTime())) return 0
  const diffTime = serviceDate.getTime() - today.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

export const getAuthUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Quotations
export type QuotationItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export type Quotation = {
  id: string
  user_id: string
  customer_id: string | null
  quotation_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  items: QuotationItem[]
  subtotal: number
  gst_amount: number
  total_amount: number
  include_gst: boolean
  gst_rate: number
  notes: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  updated_at: string
}

export type CompanyProfile = {
  id: string
  user_id: string
  company_name: string | null
  company_email: string | null
  company_phone: string | null
  company_address: string | null
  company_city: string | null
  company_state: string | null
  company_zip: string | null
  logo_url: string | null
  theme_color: string
  created_at: string
  updated_at: string
}

export type Invoice = {
  id: string
  user_id: string
  quotation_id: string | null
  invoice_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  items: QuotationItem[]
  subtotal: number
  gst_amount: number
  total_amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
}
