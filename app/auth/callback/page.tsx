'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/spinner'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[v0] Auth callback page loaded')
        
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.log('[v0] Session error:', sessionError)
          throw sessionError
        }

        if (session) {
          console.log('[v0] Session found, redirecting to dashboard')
          // Small delay to ensure session is fully established
          setTimeout(() => {
            router.push('/dashboard')
          }, 500)
        } else {
          console.log('[v0] No session found, redirecting to login')
          router.push('/login')
        }
      } catch (error) {
        console.error('[v0] Auth callback error:', error)
        router.push('/login')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary">
      <div className="text-center space-y-4">
        <Spinner className="h-12 w-12 mx-auto" />
        <p className="text-lg text-foreground">Logging you in...</p>
      </div>
    </div>
  )
}
