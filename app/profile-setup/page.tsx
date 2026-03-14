'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
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

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [yourName, setYourName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [city, setCity] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!companyName.trim()) newErrors.companyName = 'Company name is required'
    if (!yourName.trim()) newErrors.yourName = 'Your name is required'
    if (!phone.trim()) newErrors.phone = 'Phone number is required'
    if (!whatsapp.trim()) newErrors.whatsapp = 'WhatsApp number is required'
    if (!city.trim()) newErrors.city = 'City is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !user?.id) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          company_name: companyName,
          phone: phone,
          whatsapp_number: whatsapp,
          city: city,
          service_types: selectedServices.length > 0 ? selectedServices : null,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
      
      toast.success('Profile setup completed!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
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

  if (authLoading) {
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
          <CardTitle className="text-2xl">Welcome! Set up your business</CardTitle>
          <CardDescription>Tell us about your company</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Your Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                className={errors.yourName ? 'border-red-500' : ''}
              />
              {errors.yourName && <p className="text-sm text-red-500">{errors.yourName}</p>}
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

            {/* WhatsApp Number */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number *</Label>
              <Input
                id="whatsapp"
                placeholder="+91 XXXXX XXXXX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={errors.whatsapp ? 'border-red-500' : ''}
              />
              {errors.whatsapp && <p className="text-sm text-red-500">{errors.whatsapp}</p>}
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="Nashik"
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
                'Complete Setup →'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
