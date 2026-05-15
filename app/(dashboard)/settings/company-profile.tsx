"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Save, Upload, Loader2, ImageIcon, LayoutTemplate } from "lucide-react"
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
  bank_name: string | null
  account_no: string | null
  ifsc_code: string | null
  upi_id: string | null
  payment_terms: string | null
  logo_url: string | null
  theme_color: string
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
  const [bankName, setBankName] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [ifscCode, setIfscCode] = useState("")
  const [upiId, setUpiId] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("100% advance along with work order")
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [headerStyle, setHeaderStyle] = useState<"single_logo" | "thumbnail">("single_logo")
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)


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
          setBankName(data.bank_name || "")
          setAccountNo(data.account_no || "")
          setIfscCode(data.ifsc_code || "")
          setUpiId(data.upi_id || "")
          setPaymentTerms(data.payment_terms || "100% advance along with work order")
          // Set existing logo URL for preview
          setExistingLogoUrl(data.logo_url ?? null)
          // Reset any pending upload
          setNewImageFile(null)
          setPreviewUrl(null)
          // Load header style settings
          setHeaderStyle(data.header_style ?? "single_logo")
          setThumbnailUrl(data.header_thumbnail_url ?? null)
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
      let logoUrl = existingLogoUrl
      let finalThumbnailUrl = thumbnailUrl

      // Step 1: if new logo selected, upload it first
      if (newImageFile) {
        const fileName = `logo-${user.id}-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, newImageFile, { upsert: true })

        if (uploadError) {
          toast.error('Logo upload failed: ' + uploadError.message)
          setSaving(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)

        logoUrl = urlData.publicUrl // update logoUrl with new URL
      }

      // Step 1b: if new thumbnail selected, upload it
      if (newThumbnailFile) {
        const fileName = `thumbnail-${user.id}-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('header-thumbnails')
          .upload(fileName, newThumbnailFile, { upsert: true })

        if (uploadError) {
          toast.error('Thumbnail upload failed: ' + uploadError.message)
          setSaving(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('header-thumbnails')
          .getPublicUrl(fileName)

        finalThumbnailUrl = urlData.publicUrl
      }

      // Step 2: now save profile with correct logoUrl and thumbnail
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
          bank_name: bankName,
          account_no: accountNo,
          ifsc_code: ifscCode,
          upi_id: upiId,
          payment_terms: paymentTerms,
          theme_color: themeColor,
          logo_url: logoUrl,
          header_style: headerStyle,
          header_thumbnail_url: finalThumbnailUrl,
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        toast.error('Failed to save: ' + error.message)
        setSaving(false)
        return
      }

      toast.success('Profile saved successfully')
      // Update existing logo URL after successful save
      setExistingLogoUrl(logoUrl)
      setNewImageFile(null)
      setPreviewUrl(null)
      // Reset thumbnail after save
      setNewThumbnailFile(null)
      setThumbnailPreviewUrl(null)
      setThumbnailUrl(finalThumbnailUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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

    // Store the file
    setNewImageFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setNewImageFile(null)
    setPreviewUrl(null)
    setExistingLogoUrl(null)
    // this will clear logo on next save
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type - only PNG, JPG, JPEG
    const allowedTypes = ['image/png', 'image/jpeg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PNG or JPG only')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }

    // Validate aspect ratio (5:1 to 10:1)
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const aspectRatio = img.width / img.height
        if (aspectRatio < 5 || aspectRatio > 10) {
          toast.error("Please upload a wide banner image (recommended: 1500×200px)")
          return
        }
        // Valid - store the file
        setNewThumbnailFile(file)
        setThumbnailPreviewUrl(event.target?.result as string)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveThumbnail = () => {
    setNewThumbnailFile(null)
    setThumbnailPreviewUrl(null)
    setThumbnailUrl(null)
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
            {(previewUrl ?? existingLogoUrl) && (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
                  <img src={previewUrl ?? existingLogoUrl ?? ''} alt="Logo preview" className="w-full h-full object-contain p-2" />
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
            {!(previewUrl ?? existingLogoUrl) && (
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

        {/* Payment Details */}
        <div className="border-t border-border pt-6">
          <h3 className="font-semibold text-sm mb-4">Payment Details</h3>
          <p className="text-xs text-muted-foreground mb-4">These details will appear on your invoices</p>
          
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI, ICICI Bank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-no">Account Number</Label>
                <Input
                  id="account-no"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ifsc-code">IFSC Code</Label>
                <Input
                  id="ifsc-code"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="e.g. HDFC0001234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upi-id">UPI ID</Label>
                <Input
                  id="upi-id"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@hdfc"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-terms">Payment Terms</Label>
              <Textarea
                id="payment-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. 100% advance along with work order"
                className="min-h-[60px] resize-none"
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

        {/* Header Style Section */}
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="font-semibold text-sm mb-4">Header Style</h3>
          
          {companyName.trim() === "" || email.trim() === "" ? (
            <div className="text-sm text-muted-foreground">
              Please save your Company Information above before choosing a header style.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Option Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Single Logo Card */}
                <div
                  onClick={() => setHeaderStyle("single_logo")}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    headerStyle === "single_logo"
                      ? `border-[${themeColor}] bg-blue-50`
                      : "border-border bg-secondary/30 hover:bg-secondary/50"
                  }`}
                  style={headerStyle === "single_logo" ? { borderColor: themeColor } : {}}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ImageIcon className="size-5 text-muted-foreground" />
                    <span className="font-medium">Single Logo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your logo + company info shown in PDF header
                  </p>
                </div>

                {/* Thumbnail Header Card */}
                <div
                  onClick={() => setHeaderStyle("thumbnail")}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    headerStyle === "thumbnail"
                      ? `border-[${themeColor}] bg-blue-50`
                      : "border-border bg-secondary/30 hover:bg-secondary/50"
                  }`}
                  style={headerStyle === "thumbnail" ? { borderColor: themeColor } : {}}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <LayoutTemplate className="size-5 text-muted-foreground" />
                    <span className="font-medium">Thumbnail Header</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a pre-designed full-width banner image
                  </p>
                </div>
              </div>

              {/* Thumbnail Upload Section */}
              {headerStyle === "thumbnail" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  {(thumbnailPreviewUrl || thumbnailUrl) ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border overflow-hidden bg-secondary flex items-center justify-center max-h-20">
                        <img 
                          src={thumbnailPreviewUrl ?? thumbnailUrl ?? ''} 
                          alt="Thumbnail preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveThumbnail}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label htmlFor="thumbnail-upload" className="cursor-pointer block">
                      <input
                        id="thumbnail-upload"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleThumbnailChange}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Click to upload banner</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Wide banner image, PNG or JPG, max 2MB. Recommended: 1500×200px
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Save Header Style Button */}
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full sm:w-auto"
                variant="outline"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" />
                    Save Header Style
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
