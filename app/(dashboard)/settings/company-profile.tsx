"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { supabase, type CompanyProfile } from "@/lib/supabase"
import { Save, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function CompanyProfileSettings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [companyName, setCompanyName] = useState("")
  const [companyEmail, setCompanyEmail] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")
  const [companyCity, setCompanyCity] = useState("")
  const [companyState, setCompanyState] = useState("")
  const [companyZip, setCompanyZip] = useState("")
  const [themeColor, setThemeColor] = useState("#3b82f6")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return

        const { data, error } = await supabase
          .from('company_profile')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          setProfile(data as CompanyProfile)
          setCompanyName(data.company_name || "")
          setCompanyEmail(data.company_email || "")
          setCompanyPhone(data.company_phone || "")
          setCompanyAddress(data.company_address || "")
          setCompanyCity(data.company_city || "")
          setCompanyState(data.company_state || "")
          setCompanyZip(data.company_zip || "")
          setThemeColor(data.theme_color || "#3b82f6")
          setLogoUrl(data.logo_url || "")
          setLogoPreview(data.logo_url || "")
        }
      } catch (error) {
        console.error('Error loading company profile:', error)
        toast.error('Failed to load company profile')
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
        .from('company_profile')
        .upsert({
          user_id: user.id,
          company_name: companyName,
          company_email: companyEmail,
          company_phone: companyPhone,
          company_address: companyAddress,
          company_city: companyCity,
          company_state: companyState,
          company_zip: companyZip,
          theme_color: themeColor,
          logo_url: logoUrl,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
      toast.success('Company profile saved!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // For now, we'll store the base64 data URL
    // In production, you'd want to use Vercel Blob or similar
    const reader2 = new FileReader()
    reader2.onload = (event) => {
      setLogoUrl(event.target?.result as string)
    }
    reader2.readAsDataURL(file)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground">Loading company profile...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <CardDescription>Manage your company information and branding</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              {logoPreview ? (
                <div className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-secondary flex items-center justify-center">
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-secondary/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground text-center">No logo</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label htmlFor="logo-upload" className="cursor-pointer">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={uploading}
                />
                <Button type="button" variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="mr-2 size-4" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPG or GIF (Max. 5MB)
              </p>
            </div>
          </div>
        </div>

        {/* Theme Color */}
        <div className="space-y-2">
          <Label htmlFor="theme-color">Theme Color</Label>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                id="theme-color"
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-10"
              />
            </div>
            <div
              className="w-10 h-10 rounded-lg border border-border"
              style={{ backgroundColor: themeColor }}
            />
            <span className="text-sm text-muted-foreground">{themeColor}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            This color will be used in quotation PDFs and throughout your documents
          </p>
        </div>

        {/* Company Information */}
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-sm mb-4">Company Information</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="company@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-phone">Phone</Label>
                <Input
                  id="company-phone"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-address">Address</Label>
              <Input
                id="company-address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="company-city">City</Label>
                <Input
                  id="company-city"
                  value={companyCity}
                  onChange={(e) => setCompanyCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-state">State</Label>
                <Input
                  id="company-state"
                  value={companyState}
                  onChange={(e) => setCompanyState(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-zip">ZIP Code</Label>
                <Input
                  id="company-zip"
                  value={companyZip}
                  onChange={(e) => setCompanyZip(e.target.value)}
                  placeholder="ZIP code"
                />
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveProfile}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" />
              Save Company Profile
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
