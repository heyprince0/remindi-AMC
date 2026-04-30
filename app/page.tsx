'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user) {
      window.location.href = '/'
    } else {
      window.location.href = '/landing.html'
    }
  }, [user, loading])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}
