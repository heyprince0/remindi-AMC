import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.https://xgiwnrhdduybbuiyquxd.supabase.co!
const supabaseAnonKey = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaXducmhkZHV5YmJ1aXlxdXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjIwMTgsImV4cCI6MjA4ODczODAxOH0.4_Sho7D91ghC8vuznQeQfmYeQF3GWk9GoOTOsnveIl0!

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
