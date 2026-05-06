"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Save, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"

export interface CompanyProfile {
  id: string
  user_id: string
  company_name: string | null
  tagline: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  gstin: string | null
  logo_url: string | null
  theme_color: string
  bank_name: string | null
  account_no: string | null
  ifsc: string | null
  upi: string | null
  created_at: string
  updated_at: string
}

export function CompanyProfileSettings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [companyName, setCompanyName] = useState("")
  const [tagline, setTagline] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [gstin, setGstin] = useState("")
  const [themeColor, setThemeColor] = useState("#185FA5")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [upi, setUpi] = useState("")

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
          setTagline(data.tagline || "")
          setEmail(data.email || "")
          setPhone(data.phone || "")
          setAddress(data.address || "")
          setCity(data.city || "")
          setState(data.state || "")
          setZipCode(data.zip_code || "")
          setGstin(data.gstin || "")
          setThemeColor(data.theme_color || "#185FA5")
          setLogoUrl(data.logo_url || "")
          setLogoPreview(data.logo_url || "")
          setBankName(data.bank_name || "")
          setAccountNo(data.account_no || "")
          setIfsc(data.ifsc || "")
          setUpi(data.upi || "")
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
      let finalLogoUrl = logoUrl

      // If there's a preview but no logoUrl (new upload), upload the file
      if (logoPreview && logoPreview.startsWith('data:') && !logoUrl.startsWith('http')) {
        // Get the actual file from the input
        const fileInput = document.getElementById('logo-upload') as HTMLInputElement
        const file = fileInput?.files?.[0]

        if (file) {
          try {
            const fileName = `logo-${user.id}-${Date.now()}.png`
            const { error: uploadError } = await supabase.storage
              .from('logos')
              .upload(fileName, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
              .from('logos')
              .getPublicUrl(fileName)

            finalLogoUrl = urlData.publicUrl
          } catch (error) {
            console.error('Error uploading logo:', error)
            toast.error('Failed to upload logo')
            setSaving(false)
            return
          }
        }
      }

      const { error } = await supabase
        .from('company_profile')
        .upsert({
          user_id: user.id,
          company_name: companyName,
          tagline: tagline,
          email: email,
          phone: phone,
          address: address,
          city: city,
          state: state,
          zip_code: zipCode,
          gstin: gstin,
          theme_color: themeColor,
          logo_url: finalLogoUrl,
          bank_name: bankName,
          account_no: accountNo,
          ifsc: ifsc,
          upi: upi,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
      toast.success('Company profile saved successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validate file type - only PNG, JPG, JPEG, WEBP
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PNG, JPG, JPEG, or WEBP only')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoUrl("")
    setLogoPreview("")
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
        <CardDescription>Manage your company information, branding, and bank details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Company Logo</Label>
          <div className="space-y-4">
            {logoPreview && (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                >
                  Remove
                </Button>
              </div>
            )}
            {!logoPreview && (
              <label htmlFor="logo-upload" className="cursor-pointer block">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Click to upload logo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Square image, PNG or JPG, max 2MB
                  </p>
                </div>
              </label>
            )}
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
            <span className="text-sm text-muted-foreground font-mono">{themeColor}</span>
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

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Brief company description"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="company@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip-code">ZIP Code</Label>
                <Input
                  id="zip-code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="ZIP code"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-sm mb-4">Tax Information</h3>
          
          <div className="space-y-2">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="GSTIN"
            />
          </div>
        </div>

        {/* Bank Details */}
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-sm mb-4">Bank Details</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-no">Account Number</Label>
                <Input
                  id="account-no"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc">IFSC Code</Label>
                <Input
                  id="ifsc"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="IFSC code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upi">UPI ID</Label>
              <Input
                id="upi"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="UPI ID"
              />
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
