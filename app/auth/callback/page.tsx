'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  
  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await 
        supabase.auth.getSession()
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', session.user.id)
          .single()
        
        if (!profile?.company_name) {
          router.push('/profile-setup')
        } else {
          router.push('/dashboard')
        }
      } else {
        router.push('/login')
      }
    }
    handleCallback()
  }, [router])

  return (
    <div style={{
      display:'flex',
      justifyContent:'center',
      alignItems:'center',
      height:'100vh'
    }}>
      <p>Logging you in...</p>
    </div>
  )
}
