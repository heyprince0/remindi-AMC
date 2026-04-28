'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase, signInWithGoogle } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(dashboard)')
    }
  }, [user, authLoading, router])

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', data.session.user.id)
          .single()
        if (!profile?.company_name) {
          router.replace('/profile-setup')
        } else {
          router.replace('/(dashboard)')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Remindi</h1>
          <p className="text-gray-500">AMC Management System</p>
        </div>
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
              <label className="block text-sm font-medium mb-1">Password</label>
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
