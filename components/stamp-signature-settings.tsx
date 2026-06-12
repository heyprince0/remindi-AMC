"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Upload, Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface CompanyProfile {
  stamp_url?: string | null
  signature_url?: string | null
}

export function StampSignatureSettings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [stampUploading, setStampUploading] = useState(false)
  const [signatureUploading, setSignatureUploading] = useState(false)

  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [stampPreview, setStampPreview] = useState<string | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return

        const { data, error } = await supabase
          .from('company_profile')
          .select('stamp_url, signature_url')
          .eq('user_id', user.id)
          .single()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          setProfile(data)
          setStampUrl(data.stamp_url ?? null)
          setSignatureUrl(data.signature_url ?? null)
        }
      } catch (error) {
        console.error('Error loading company profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user?.id])

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validate file type
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

    setStampUploading(true)
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setStampPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to storage
      const fileName = `stamp.png`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(`${user.id}/${fileName}`, file, { upsert: true })

      if (uploadError) {
        toast.error('Stamp upload failed: ' + uploadError.message)
        setStampUploading(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(`${user.id}/${fileName}`)

      const newStampUrl = urlData.publicUrl

      // Save to database
      const { error: dbError } = await supabase
        .from('company_profile')
        .update({ stamp_url: newStampUrl })
        .eq('user_id', user.id)

      if (dbError) {
        toast.error('Failed to save stamp: ' + dbError.message)
        setStampUploading(false)
        return
      }

      setStampUrl(newStampUrl)
      toast.success('Stamp uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload stamp')
    } finally {
      setStampUploading(false)
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validate file type
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

    setSignatureUploading(true)
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setSignaturePreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to storage
      const fileName = `signature.png`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(`${user.id}/${fileName}`, file, { upsert: true })

      if (uploadError) {
        toast.error('Signature upload failed: ' + uploadError.message)
        setSignatureUploading(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(`${user.id}/${fileName}`)

      const newSignatureUrl = urlData.publicUrl

      // Save to database
      const { error: dbError } = await supabase
        .from('company_profile')
        .update({ signature_url: newSignatureUrl })
        .eq('user_id', user.id)

      if (dbError) {
        toast.error('Failed to save signature: ' + dbError.message)
        setSignatureUploading(false)
        return
      }

      setSignatureUrl(newSignatureUrl)
      toast.success('Signature uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload signature')
    } finally {
      setSignatureUploading(false)
    }
  }

  const handleRemoveStamp = async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('company_profile')
        .update({ stamp_url: null })
        .eq('user_id', user.id)

      if (error) throw error
      setStampUrl(null)
      setStampPreview(null)
      toast.success('Stamp removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove stamp')
    }
  }

  const handleRemoveSignature = async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('company_profile')
        .update({ signature_url: null })
        .eq('user_id', user.id)

      if (error) throw error
      setSignatureUrl(null)
      setSignaturePreview(null)
      toast.success('Signature removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove signature')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground">Loading stamp & signature...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stamp & Signature</CardTitle>
        <CardDescription>Upload your company stamp and authorized signature for PDFs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Company Stamp Card */}
          <div className="space-y-3">
            <Label>Company Stamp</Label>
            <div className="space-y-3">
              {(stampPreview ?? stampUrl) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-full h-32 rounded-lg border border-border overflow-hidden bg-secondary">
                    <img
                      src={stampPreview ?? stampUrl ?? ''}
                      alt="Stamp preview"
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveStamp}
                    className="w-full"
                  >
                    <X className="mr-2 size-4" />
                    Remove
                  </Button>
                </div>
              )}
              {!(stampPreview ?? stampUrl) && (
                <label htmlFor="stamp-upload" className="cursor-pointer block">
                  <input
                    id="stamp-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleStampUpload}
                    className="hidden"
                    disabled={stampUploading}
                  />
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    {stampUploading ? (
                      <Loader2 className="mx-auto size-8 mb-2 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {stampUploading ? 'Uploading...' : 'Click to upload stamp'}
                    </p>
                    {!stampUploading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, or WEBP, max 2MB
                      </p>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Authorized Signature Card */}
          <div className="space-y-3">
            <Label>Authorized Signature</Label>
            <div className="space-y-3">
              {(signaturePreview ?? signatureUrl) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-full h-32 rounded-lg border border-border overflow-hidden bg-secondary">
                    <img
                      src={signaturePreview ?? signatureUrl ?? ''}
                      alt="Signature preview"
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveSignature}
                    className="w-full"
                  >
                    <X className="mr-2 size-4" />
                    Remove
                  </Button>
                </div>
              )}
              {!(signaturePreview ?? signatureUrl) && (
                <label htmlFor="signature-upload" className="cursor-pointer block">
                  <input
                    id="signature-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSignatureUpload}
                    className="hidden"
                    disabled={signatureUploading}
                  />
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    {signatureUploading ? (
                      <Loader2 className="mx-auto size-8 mb-2 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {signatureUploading ? 'Uploading...' : 'Click to upload signature'}
                    </p>
                    {!signatureUploading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, or WEBP, max 2MB
                      </p>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
