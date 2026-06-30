"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Save, Upload, Loader2, X } from "lucide-react"
import { toast } from "sonner"

const MAX_FILE_SIZE_MB = 2
const MAX_WIDTH_PX = 1536
const MAX_HEIGHT_PX = 1536

// Storage path now uses orgId instead of userId
const STAMP_FILE_PATH = (orgId: string) => `${orgId}/stamp`

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
  const { user, orgId } = useAuth()   // ✅ use orgId from context
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Clean storage path saved in DB (e.g. "org-id/stamp")
  const [stampStoragePath, setStampStoragePath] = useState<string | null>(null)

  // Public URL for displaying the saved stamp
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)

  // Pending file selected but NOT yet saved
  const [newStampFile, setNewStampFile] = useState<File | null>(null)

  // Local base64 preview while file is pending
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const stampInputRef = useRef<HTMLInputElement>(null)

  // Load existing stamp path from DB using org_id
  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!orgId) return

        const { data, error } = await supabase
          .from('company_profile')
          .select('stamp_url')
          .eq('org_id', orgId)          // ✅ changed from user_id
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error

        if (data?.stamp_url) {
          setStampStoragePath(data.stamp_url)

          const { data: publicData } = supabase.storage
            .from('company-assets')
            .getPublicUrl(data.stamp_url)

          setDisplayUrl(`${publicData.publicUrl}?t=${Date.now()}`)
        }
      } catch (error) {
        console.error('Error loading stamp:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [orgId])   // ✅ depend on orgId

  // Step 1: User selects file — validate then show local preview only
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PNG, JPG, or WEBP only')
      if (stampInputRef.current) stampInputRef.current.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File size must be less than ${MAX_FILE_SIZE_MB}MB`)
      if (stampInputRef.current) stampInputRef.current.value = ''
      return
    }

    const { valid, width, height } = await validateImageDimensions(file)
    if (!valid) {
      toast.error(
        `Image too large: ${width}×${height}px. Maximum allowed is ${MAX_WIDTH_PX}×${MAX_HEIGHT_PX}px`
      )
      if (stampInputRef.current) stampInputRef.current.value = ''
      return
    }

    setNewStampFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setLocalPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Step 2: User clicks Save — upload and save PATH to DB
  const handleSaveStamp = async () => {
    if (!newStampFile || !orgId) return

    setSaving(true)
    try {
      const filePath = STAMP_FILE_PATH(orgId)   // ✅ now uses orgId

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, newStampFile, {
          upsert: true,
          contentType: newStampFile.type,
        })

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes('bucket')) {
          toast.error('Storage bucket not found. Please create the "company-assets" bucket in Supabase Storage first.')
        } else {
          toast.error('Upload failed: ' + uploadError.message)
        }
        return
      }

      // ✅ Update using org_id
      const { error: dbError } = await supabase
        .from('company_profile')
        .upsert({
          org_id: orgId,
          stamp_url: filePath,
        }, {
          onConflict: 'org_id'    // ✅ now conflicts on org_id
        })

      if (dbError) {
        toast.error('Failed to save: ' + dbError.message)
        return
      }

      const { data: publicData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath)

      const freshUrl = `${publicData.publicUrl}?t=${Date.now()}`

      setStampStoragePath(filePath)
      setDisplayUrl(freshUrl)
      setNewStampFile(null)
      setLocalPreview(null)
      if (stampInputRef.current) stampInputRef.current.value = ''

      toast.success('Stamp saved successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save stamp')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSelect = () => {
    setNewStampFile(null)
    setLocalPreview(null)
    if (stampInputRef.current) stampInputRef.current.value = ''
  }

  // Remove stamp from DB (does not delete from storage)
  const handleRemoveStamp = async () => {
    if (!orgId) return
    try {
      const { error } = await supabase
        .from('company_profile')
        .update({ stamp_url: null })
        .eq('org_id', orgId)     // ✅ changed from user_id

      if (error) throw error

      setStampStoragePath(null)
      setDisplayUrl(null)
      setNewStampFile(null)
      setLocalPreview(null)
      if (stampInputRef.current) stampInputRef.current.value = ''
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

  const imageToShow = localPreview ?? displayUrl

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

          {/* STATE 1: No image at all — show upload dropzone */}
          {!imageToShow && (
            <label htmlFor="stamp-upload" className="cursor-pointer block">
              <input
                ref={stampInputRef}
                id="stamp-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Click to upload stamp</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, or WEBP · max {MAX_FILE_SIZE_MB}MB · max {MAX_WIDTH_PX}×{MAX_HEIGHT_PX}px
                </p>
              </div>
            </label>
          )}

          {/* STATE 2 & 4: Image exists (local preview or saved) — show it */}
          {imageToShow && (
            <div className="flex items-center justify-center w-full h-40 rounded-lg border border-border overflow-hidden bg-secondary">
              <img
                src={imageToShow}
                alt="Company stamp"
                className="max-w-full max-h-full object-contain p-2"
              />
            </div>
          )}

          {/* STATE 3: New file selected, NOT saved — Save + Cancel */}
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

          {/* STATE 4: Stamp saved, no pending file — Change + Remove */}
          {stampStoragePath && !newStampFile && (
            <div className="flex gap-2">
              <label htmlFor="stamp-upload-change" className="flex-1 cursor-pointer">
                <input
                  ref={stampInputRef}
                  id="stamp-upload-change"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full pointer-events-none"
                >
                  <Upload className="mr-2 size-4" />
                  Change Stamp
                </Button>
              </label>
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
