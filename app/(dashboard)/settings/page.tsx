"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { supabase, type Profile, signOut } from "@/lib/supabase"
import { Save, LogOut } from "lucide-react"
import { toast } from "sonner"
import { CompanyProfileSettings } from "./company-profile"
import { StampSignatureSettings } from "@/components/stamp-signature-settings"

const SERVICE_TYPES = ['AC', 'Lift', 'RO Water Purifier', 'CCTV', 'Pest Control', 'Generator', 'Fire Safety', 'UPS', 'Other']

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          setProfile(data as Profile)
          setFullName(data.full_name || "")
          setCompanyName(data.company_name || "")
          setPhone(data.phone || "")
          setCity(data.city || "")
          setSelectedServices(data.service_types || [])
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user?.id])

  const handleSaveProfile = async () => {
    if (!user?.id) return

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
          service_types: selectedServices.length > 0 ? selectedServices : null,
        }, {
          onConflict: 'id'
        })

      if (error) throw error
      toast.success('Settings saved!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
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

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to logout')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your business settings and preferences</p>
        </div>

        <CompanyProfileSettings />

        <StampSignatureSettings />

        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Update your company details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-muted-foreground">Loading profile...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Your Name</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your company name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-email">Email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={user?.email || ""}
                      placeholder="company@gmail.com"
                      disabled
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Nashik"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Service Types</Label>
                  <div className="grid grid-cols-3 gap-2">
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
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    <Save className="mr-2 size-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
                <div className="border-t border-border pt-6 mt-6">
                  <div className="space-y-3">
                    <Label>Account Actions</Label>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 size-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
