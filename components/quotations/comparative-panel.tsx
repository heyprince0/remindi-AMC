"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, GitCompare, Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Detail { label: string; value: string }

interface ComparativePanelProps {
  open: boolean
  onClose: () => void
  quotationId: number
  orgId: string
  isComparative: boolean
  details: Detail[]
  attachedPages: string[]
  onSave: (data: { isComparative: boolean; details: Detail[]; attachedPages: string[] }) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

function displayFileName(url: string) {
  const name = decodeURIComponent(url.split("/").pop() ?? "Attached PDF")
  return name.replace(/^\d+-/, "")
}

export default function ComparativePanel({ open, onClose, quotationId, orgId, isComparative, details, attachedPages, onSave }: ComparativePanelProps) {
  const [enabled, setEnabled] = useState(isComparative)
  const [rows, setRows] = useState<Detail[]>(details)
  const [pages, setPages] = useState(attachedPages)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setEnabled(isComparative)
      setRows(details)
      setPages(attachedPages)
    }
  }, [open, isComparative, details, attachedPages])

  const updateRow = (index: number, key: keyof Detail, value: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  const handleUpload = async (file?: File) => {
    if (!file) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("PDF must be under 10 MB")
      return
    }
    setUploading(true)
    try {
      const path = `comparative/${orgId}/${quotationId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      const { error } = await supabase.storage.from("comparative-pages").upload(path, file, { contentType: "application/pdf" })
      if (error) throw error
      const { data } = supabase.storage.from("comparative-pages").getPublicUrl(path)
      setPages((current) => [...current, data.publicUrl])
      toast.success("PDF page attached")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload PDF")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from("quotations").update({
        is_comparative_quotation: enabled,
        comparative_details: rows,
        comparative_attached_pages: pages,
      }).eq("id", quotationId)
      if (error) throw error
      onSave({ isComparative: enabled, details: rows, attachedPages: pages })
      toast.success("Comparative quotation saved")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save comparative quotation")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitCompare className="size-4" /> Comparative Quotation</DialogTitle>
          <DialogDescription>Add contract details and extra vendor quotation pages.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-col gap-1"><Label htmlFor="comparative-mode">Comparative Mode</Label><p className="text-xs text-muted-foreground">Replaces payment &amp; tax info with contract details on page 1</p></div>
          <Switch id="comparative-mode" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && <div className="flex flex-col gap-6 pt-2">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Contract Details</h3><p className="text-xs text-muted-foreground">Add the key terms to compare.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { label: "", value: "" }])}><Plus data-icon="inline-start" /> Add Row</Button></div>
            <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground"><span>Label</span><span>Value</span><span /></div>
            <div className="flex flex-col gap-2">
              {rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2"><Input aria-label={`Detail label ${index + 1}`} value={row.label} placeholder="Label" onChange={(event) => updateRow(index, "label", event.target.value)} /><Input aria-label={`Detail value ${index + 1}`} value={row.value} placeholder="Value" onChange={(event) => updateRow(index, "value", event.target.value)} /><Button type="button" variant="ghost" size="icon" aria-label={`Delete detail ${index + 1}`} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="text-muted-foreground hover:text-destructive" /></Button></div>)}
              {rows.length === 0 && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No contract details yet</div>}
            </div>
          </section>

          <section className="flex flex-col gap-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Attach Extra Pages (PDF)</h3><p className="text-xs text-muted-foreground">Upload additional quotation pages, up to 10 MB each.</p></div><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />} Upload PDF</Button><input ref={fileInputRef} className="hidden" type="file" accept=".pdf,application/pdf" onChange={(event) => handleUpload(event.target.files?.[0])} /></div>
            {pages.length === 0 ? <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground"><FileText className="size-7" /><span className="text-sm">No pages attached yet</span></div> : <div className="flex flex-col gap-2">{pages.map((page, index) => <div key={`${page}-${index}`} className="flex items-center gap-3 rounded-lg border px-3 py-2"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{displayFileName(page)}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${displayFileName(page)}`} onClick={() => setPages((current) => current.filter((_, pageIndex) => pageIndex !== index))}><X /></Button></div>)}</div>}
          </section>
        </div>}

        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" onClick={handleSave} disabled={saving || uploading}>{saving && <Loader2 className="animate-spin" data-icon="inline-start" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
