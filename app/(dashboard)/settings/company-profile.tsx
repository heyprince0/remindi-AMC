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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Form fields
  const [companyName, setCompanyName] = useState("")
  const [tagline, setTagline] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [gstin, setGstin] = useState("")
  const [pan, setPan] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState("")
  const [themeColor, setThemeColor] = useState("#185FA5")
  const [bankName, setBankName] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [upi, setUpi] = useState("")

  // Load existing profile data
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
          const profile = data as CompanyProfile
          setCompanyName(profile.company_name || "")
          setTagline(profile.tagline || "")
          setEmail(profile.email || "")
          setPhone(profile.phone || "")
          setAddress(profile.address || "")
          setCity(profile.city || "")
          setState(profile.state || "")
          setZipCode(profile.zip_code || "")
          setGstin(profile.gstin || "")
          setPan(profile.pan || "")
          setLogoUrl(profile.logo_url || "")
          setLogoPreview(profile.logo_url || "")
          setThemeColor(profile.theme_color || "#185FA5")
          setBankName(profile.bank_name || "")
          setAccountNo(profile.account_no || "")
          setIfsc(profile.ifsc || "")
          setUpi(profile.upi || "")
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

  // Handle logo upload to Supabase storage
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setUploading(true)
    try {
      // Create a unique filename
      const timestamp = Date.now()
      const fileName = `${user.id}/${timestamp}-${file.name}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      const publicUrl = data.publicUrl
      setLogoUrl(publicUrl)

      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)

      toast.success('Logo uploaded successfully')
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  // Save company profile with upsert
  const handleSaveProfile = async () => {
    if (!user?.id) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('company_profile')
        .upsert({
          user_id: user.id,
          company_name: companyName || null,
          tagline: tagline || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zip_code: zipCode || null,
          gstin: gstin || null,
          pan: pan || null,
          logo_url: logoUrl || null,
          theme_color: themeColor,
          bank_name: bankName || null,
          account_no: accountNo || null,
          ifsc: ifsc || null,
          upi: upi || null,
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error
      toast.success('Company profile saved successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
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
              className="w-10 h-10 rounded-lg border border-border flex-shrink-0"
              style={{ backgroundColor: themeColor }}
            />
            <span className="text-sm text-muted-foreground flex-shrink-0">{themeColor}</span>
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
                placeholder="Company tagline or motto"
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAPFU0192R1Z5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan">PAN</Label>
                <Input
                  id="pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  placeholder="AAPFU0192R"
                />
              </div>
            </div>
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
                  placeholder="SBIN0000001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upi">UPI ID</Label>
              <Input
                id="upi"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="yourname@bank"
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
