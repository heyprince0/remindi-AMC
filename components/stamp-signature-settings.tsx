"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Save, Upload, Loader2, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"

const MAX_FILE_SIZE_MB = 2
const MAX_WIDTH_PX = 1536
const MAX_HEIGHT_PX = 1536

// Storage path now uses orgId and includes file extension
const STAMP_FILE_PATH = (orgId: string, extension: string) => `${orgId}/stamp.${extension}`

// Validate image dimensions using a browser Image object
const validateImageDimensions = (file: File): Promise<{ valid: boolean; width: number; height: number }> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        valid: img.width <= MAX_WIDTH_PX && img.height <= MAX_HEIGHT_PX,
        width: img.width,
        height: img.height,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, width: 0, height: 0 })
    }
    img.src = url
  })
}

export function StampSignatureSettings() {
  const { user, orgId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageError, setImageError] = useState(false)

  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [newStampFile, setNewStampFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing stamp URL from DB using org_id
  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!orgId) return

        const { data, error } = await supabase
          .from('company_profile')
          .select('stamp_url')
          .eq('org_id', orgId)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error

        if (data?.stamp_url) {
          // If it's a path (old format), construct the public URL
          if (!data.stamp_url.startsWith('http')) {
            const { data: publicData } = supabase.storage
              .from('company-assets')
              .getPublicUrl(data.stamp_url)
            setStampUrl(publicData.publicUrl)
          } else {
            setStampUrl(data.stamp_url)
          }
        }
      } catch (error) {
        console.error('Error loading stamp:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [orgId])

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PNG, JPG, or WEBP only')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size must be less than ${MAX_FILE_SIZE_MB}MB`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { valid, width, height } = await validateImageDimensions(file)
    if (!valid) {
      toast.error(
        `Image too large: ${width}×${height}px. Maximum allowed is ${MAX_WIDTH_PX}×${MAX_HEIGHT_PX}px`
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setNewStampFile(file)
    setImageError(false)
    const reader = new FileReader()
    reader.onload = (event) => {
      setLocalPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Save stamp
  const handleSaveStamp = async () => {
    if (!newStampFile || !orgId) {
      toast.error('Missing file or organization')
      return
    }

    setSaving(true)
    try {
      const extension = newStampFile.name.split('.').pop() || 'png'
      const filePath = STAMP_FILE_PATH(orgId, extension)

      // Attempt upload
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, newStampFile, {
          upsert: true,
          contentType: newStampFile.type,
        })

      if (uploadError) {
        console.error('[Upload] Error:', uploadError)
        let msg = uploadError.message
        if (uploadError.statusCode === 400) {
          msg = 'Bad request – check bucket name, file path, or file format.'
        } else if (uploadError.statusCode === 403) {
          msg = 'Permission denied – check storage policies.'
        } else if (uploadError.statusCode === 404) {
          msg = 'Bucket "company-assets" not found – please create it in Supabase Storage.'
        }
        toast.error('Upload failed: ' + msg)
        return
      }

      // Get the FULL public URL
      const { data: publicData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath)

      const publicUrl = publicData.publicUrl

      // Update DB with the full URL (safer for cross-component usage)
      const { error: dbError } = await supabase
        .from('company_profile')
        .upsert({
          org_id: orgId,
          stamp_url: publicUrl,
        }, {
          onConflict: 'org_id'
        })

      if (dbError) {
        console.error('[DB] Error:', dbError)
        toast.error('Failed to save to database: ' + dbError.message)
        return
      }

      // Add cache buster to force UI refresh
      const freshUrl = `${publicUrl}?t=${Date.now()}`
      setStampUrl(freshUrl)
      setNewStampFile(null)
      setLocalPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      toast.success('Stamp saved successfully')
    } catch (error) {
      console.error('[Upload] Exception:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save stamp')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSelect = () => {
    setNewStampFile(null)
    setLocalPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveStamp = async () => {
    if (!orgId) return
    try {
      const { error } = await supabase
        .from('company_profile')
        .update({ stamp_url: null })
        .eq('org_id', orgId)

      if (error) throw error

      setStampUrl(null)
      setNewStampFile(null)
      setLocalPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Stamp removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove stamp')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading stamp settings...
          </div>
        </CardContent>
      </Card>
    )
  }

  const imageToShow = localPreview ?? stampUrl

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Stamp</CardTitle>
        <CardDescription>
          Upload your company stamp — it will appear on quotation and invoice PDFs when enabled.
          Max size: {MAX_WIDTH_PX}×{MAX_HEIGHT_PX}px, {MAX_FILE_SIZE_MB}MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm space-y-3">
          <Label>Company Stamp</Label>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!imageToShow ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Click to upload stamp</p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, or WEBP · max {MAX_FILE_SIZE_MB}MB · max {MAX_WIDTH_PX}×{MAX_HEIGHT_PX}px
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-40 rounded-lg border border-border overflow-hidden bg-secondary relative">
              {imageError ? (
                <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
                  <AlertCircle className="size-8 mb-2 text-red-500" />
                  <p className="text-sm font-medium text-red-500">Image failed to load</p>
                  <p className="text-xs mt-1">Check if your 'company-assets' bucket is set to <b>Public</b> in Supabase.</p>
                </div>
              ) : (
                <img
                  src={imageToShow}
                  alt="Company stamp"
                  className="max-w-full max-h-full object-contain p-2"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          )}

          {newStampFile && (
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSaveStamp}
                disabled={saving}
                className="flex-1"
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" />
                    Save Stamp
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelSelect}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          )}

          {stampUrl && !newStampFile && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" />
                Change Stamp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveStamp}
              >
                <X className="mr-2 size-4" />
                Remove
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
