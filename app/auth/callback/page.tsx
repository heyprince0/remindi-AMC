'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the current session after OAuth redirect
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth error:', error)
          router.push('/login?error=auth_failed')
          return
        }

        if (session) {
          // Session is established, redirect to dashboard
          router.push('/')
        } else {
          // No session found, redirect back to login
          router.push('/login?error=no_session')
        }
      } catch (error) {
        console.error('Callback error:', error)
        router.push('/login?error=callback_failed')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Spinner />
          <p className="text-lg text-foreground font-medium">Logging you in...</p>
          <p className="text-sm text-muted-foreground">Please wait while we complete your authentication.</p>
        </CardContent>
      </Card>
    </div>
  )
}
