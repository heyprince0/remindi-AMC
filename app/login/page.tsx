'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase, signInWithGoogle } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { user, loading: authLoading, recovery } = useAuth()

  // Immediate hash detection for password reset
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      router.replace('/reset-password')
    }
  }, [router])

  // Listen for hash changes
  useEffect(() => {
    const checkHash = () => {
      if (typeof window !== 'undefined' && !recovery) {
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          router.replace('/reset-password')
        }
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [recovery, router])

  // ⚠️ REMOVED the auto-redirect to '/' or '/profile-setup'
  // We only handle password reset hash detection. After login, the user stays on this page
  // until they have a membership or profile, then they can navigate manually or we redirect.

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials') || error.message.toLowerCase().includes('invalid credentials')) {
          setError('No account found with these credentials. Please check your email and password, or sign up for a new account.')
        } else {
          setError(error.message)
        }
        return
      }
      if (data.session) {
        const userId = data.session.user.id

        // Check membership
        const { data: membership } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()

        if (membership) {
          window.location.href = '/'
          return
        }

        // Check profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', userId)
          .maybeSingle()

        if (profile?.company_name) {
          window.location.href = '/'
          return
        }

        // ✅ No membership and no profile → stay on login page with a message
        toast.info('You need to complete your profile setup before accessing the dashboard.', {
          duration: 5000,
        })
        // Clear password field for security
        setPassword('')
        // Keep user logged in but stay here
        setLoading(false)
        // Optionally, you can show a button to go to /profile-setup manually
        // but we'll just keep them on this page.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Please enter your email address first')
      return
    }
    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Password reset email sent! Check your inbox.')
      }
    } catch (err) {
      toast.error('Failed to send reset email')
    } finally {
      setResetting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  // If user is logged in but no membership/profile, we still show the login page
  // but they can see the toast message. We could also show a special message.
  // We'll let the login form render for all users (except when loading).

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Remindi</h1>
          <p className="text-gray-500">AMC Management System</p>
        </div>
        <a
          href="/remindi.apk"
          download="Remindi.apk"
          type="application/vnd.android.package-archive"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-medium text-white shadow hover:bg-green-700"
        >
          <Download className="size-5" />
          Download Android APK
        </a>
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-6">Sign In</h2>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border rounded-md p-3 outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium mb-1">Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetting}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                >
                  {resetting ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-md p-3 outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="my-4 text-center text-gray-400">Or</div>
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full border py-3 rounded-md font-medium hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Image src="/google-logo.png" alt="Google" width={18} height={18} style={{ width: 18, height: 18 }} />
            Sign in with Google
          </button>
          <p className="text-center text-sm text-gray-500 mt-4">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
