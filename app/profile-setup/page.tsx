'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { triggerWelcomeEmail } from '@/lib/email-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'

const SERVICE_TYPES = ['AC', 'Lift', 'RO Water Purifier', 'CCTV', 'Pest Control', 'Generator', 'Fire Safety', 'UPS', 'Other']

import { useEffect } from 'react'

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [checkingProfile, setCheckingProfile] = useState(true)

  // Check if user already has completed profile
  useEffect(() => {
    const checkProfile = async () => {
      if (!user?.id) return
      
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', user.id)
          .single()

        // If profile is complete, redirect to dashboard
        if (profileData?.company_name) {
          router.push('/')
        }
      } catch (error) {
        // Profile doesn't exist yet, allow setup
        console.log('No profile found, allowing setup')
      } finally {
        setCheckingProfile(false)
      }
    }

    checkProfile()
  }, [user?.id, router])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!fullName.trim()) newErrors.fullName = 'Your name is required'
    if (!companyName.trim()) newErrors.companyName = 'Company name is required'
    if (!phone.trim()) newErrors.phone = 'Phone number is required'
    if (!city.trim()) newErrors.city = 'City is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    
    if (!validateForm() || !user?.id || !user?.email) return

    setSaving(true)
    try {
      const { error } = await supabase
  .from('profiles')
  .upsert({
    id: user.id,
    full_name: fullName,
    company_name: companyName,
    phone: phone,
    city: city,
    service_types: selectedServices.length > 0 
      ? selectedServices : null,
  }, {
    onConflict: 'id'
  })

      if (error) throw error
      
      // Send welcome email after profile is created (non-blocking)
      try {
        await triggerWelcomeEmail(user.email, fullName)
      } catch (emailError) {
        console.error('Welcome email failed:', emailError)
        // Don't fail profile setup if email fails
      }
      
      toast.success('Profile setup completed!')
      router.push('/')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save profile'
      console.error('Error saving profile:', error)
      setSubmitError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }

  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary">
        <Spinner className="h-12 w-12" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Welcome! Set up your business 👋</CardTitle>
          <CardDescription>Just a few details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Your Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company">Company Name *</Label>
              <Input
                id="company"
                placeholder="Enter company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={errors.companyName ? 'border-red-500' : ''}
              />
              {errors.companyName && <p className="text-sm text-red-500">{errors.companyName}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={errors.city ? 'border-red-500' : ''}
              />
              {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
            </div>

            {/* Service Types */}
            <div className="space-y-2">
              <Label>Service Types</Label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_TYPES.map(service => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedServices.includes(service)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Setting up...
                </>
              ) : (
                'Start Using Remindi →'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
