'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { ArrowRight, CheckCircle2, BarChart3, Users, Clock } from 'lucide-react'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(dashboard)')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600">Remindi</div>
          <Link
            href="/login"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Manage Your Annual Maintenance Contracts Effortlessly
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Remindi is the all-in-one AMC management system designed to help you track contracts, schedule services, manage technicians, and keep your customers satisfied.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Contract Tracking</h3>
                <p className="text-gray-600">
                  Keep track of all your Annual Maintenance Contracts in one centralized location with easy-to-access information.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition">
            <div className="flex items-start gap-4">
              <Clock className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Service Scheduling</h3>
                <p className="text-gray-600">
                  Never miss a service date. Automated reminders keep you informed about upcoming maintenance schedules.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition">
            <div className="flex items-start gap-4">
              <Users className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Technician Management</h3>
                <p className="text-gray-600">
                  Manage your team of technicians, assign them to jobs, and track their performance metrics efficiently.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-lg hover:shadow-xl transition">
            <div className="flex items-start gap-4">
              <BarChart3 className="w-8 h-8 text-orange-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics & Reports</h3>
                <p className="text-gray-600">
                  Get detailed insights into your business with comprehensive reports and analytics dashboards.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to simplify your AMC management?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join hundreds of businesses already using Remindi to streamline their maintenance operations.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Start Your Free Trial Today
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 mt-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>&copy; 2024 Remindi - AMC Management System. All rights reserved.</p>
          <div className="flex gap-6 justify-center mt-4 text-sm">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
