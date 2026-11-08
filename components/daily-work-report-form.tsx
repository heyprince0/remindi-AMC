"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Save, Trash2, CheckSquare, ImagePlus, X, Camera, RefreshCw, ZoomIn } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import ProductAutocompleteInput from "@/components/ProductAutocompleteInput"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import SignaturePad, { type SignaturePadRef } from "@/components/SignaturePad"
import { supabase, type DailyWorkItem, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

type Props = { edit?: boolean }

interface ChecklistResponse {
  template_id: string
  name: string
  status: "OK" | "Not OK" | "NA"
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (sr_no: number): DailyWorkItem => ({
  sr_no,
  description: "",
  material_used: "",
  status: "Completed",
})

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export function DailyWorkReportForm({ edit = false }: Props) {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const { user } = useAuth()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(edit)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<DailyWorkReport | null>(null)

  // ⭐ Checklist state
  const [checklistTemplates, setChecklistTemplates] = useState<
    { id: string; name: string; display_order: number }[]
  >([])
  const [checklistResponses, setChecklistResponses] = useState<ChecklistResponse[]>([])

  // ⭐ Signature Refs & State
  const techSignRef     = useRef<SignaturePadRef>(null)
  const customerSignRef = useRef<SignaturePadRef>(null)

  const [techSignDataURL,     setTechSignDataURL]     = useState<string | null>(null)
  const [customerSignDataURL, setCustomerSignDataURL] = useState<string | null>(null)

  // ── Site images ───────────────────────────────────────────────────────
  const [reportImages, setReportImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  // ── Camera ────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [cameraOpen,    setCameraOpen]    = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)   // base64 preview after capture
  const [savingPhoto,   setSavingPhoto]   = useState(false)
  const [facingMode,    setFacingMode]    = useState<'environment' | 'user'>('environment')
  const [cameraError,   setCameraError]   = useState<string | null>(null)

  // ⭐ Only columns that ACTUALLY exist in daily_work_reports
  const [form, setForm] = useState({
    report_date: today(),
    work_order_no: "",
    lift_no: "",
    technician_name: "",
    customer_name: "",
    operational_test_status: "Yes",
    safety_observations: "",
    pending_recommendations: "",
    tech_sign_name: "",
    tech_sign_datetime: "",
    customer_sign_name: "",
    customer_sign_datetime: "",
  })

  const [items, setItems] = useState<DailyWorkItem[]>([emptyItem(1)])

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            toast.error("Could not determine your organization")
          } else {
            setOrgId(data.org_id)
            
            // ⭐ Load active checklist templates for this org
            supabase
              .from("checklist_templates")
              .select("id, name, display_order")
              .eq("org_id", data.org_id)
              .eq("is_active", true)
              .order("display_order")
              .then(({ data: templates }) => {
                if (templates && templates.length > 0) {
                  setChecklistTemplates(templates)
                }
              })
          }
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (!edit || !params.id || !orgId) return
    supabase
      .from("daily_work_reports")
      .select("*")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Failed to load report")
          router.push("/daily-work-reports")
          return
        }
        const r = data as DailyWorkReport
        setReport(r)
        setForm({
          report_date: r.report_date || today(),
          work_order_no: r.work_order_no || "",
          lift_no: r.lift_no || "",
          technician_name: r.technician_name || "",
          customer_name: r.customer_name || "",
          operational_test_status: r.operational_test_status || "Yes",
          safety_observations: r.safety_observations || "",
          pending_recommendations: r.pending_recommendations || "",
          tech_sign_name: r.tech_sign_name || "",
          tech_sign_datetime: toDatetimeLocal(r.tech_sign_datetime),
          customer_sign_name: r.customer_sign_name || "",
          customer_sign_datetime: toDatetimeLocal(r.customer_sign_datetime),
        })
        setItems(r.work_items?.length ? r.work_items : [emptyItem(1)])
        // Load existing images
        if (Array.isArray((r as any).report_images)) {
          setReportImages((r as any).report_images as string[])
        }
        setLoading(false)
      })
  }, [edit, params.id, orgId, router])

  // ⭐ Initialize checklistResponses when templates or report data load
  useEffect(() => {
    if (checklistTemplates.length === 0) return

    let savedResponses: ChecklistResponse[] = []
    if (edit && report?.checklist_responses) {
      // Handle both stringified JSON and raw arrays from the DB
      if (typeof report.checklist_responses === "string") {
        try { savedResponses = JSON.parse(report.checklist_responses) } catch {}
      } else if (Array.isArray(report.checklist_responses)) {
        savedResponses = report.checklist_responses as ChecklistResponse[]
      }
    }

    const savedMap = new Map(savedResponses.map((r) => [r.template_id, r]))
    
    setChecklistResponses(
      checklistTemplates.map((t) =>
        savedMap.get(t.id) ?? { template_id: t.id, name: t.name, status: "NA" }
      )
    )
  }, [checklistTemplates, report, edit])

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const updateItem = (index: number, field: keyof DailyWorkItem, value: string) =>
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value, sr_no: i + 1 } : item))
    )

  const handleProductSelect = (
    itemId: string,
    product: { description: string; unit: string; unit_price: number }
  ) => {
    setItems((prev) =>
      prev.map((item, index) =>
        String(index) === itemId ? { ...item, description: product.description } : item
      )
    )
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error("You must have at least one work item")
      return
    }
    setItems((prev) =>
      prev.filter((_, i) => i !== index).map((v, i) => ({ ...v, sr_no: i + 1 }))
    )
  }

  // ⭐ Upload helper
  const uploadSignature = async (
    dataURL: string,
    prefix: "tech" | "customer",
    reportId: string
  ): Promise<string | null> => {
    try {
      // dataURL → Blob
      const res  = await fetch(dataURL)
      const blob = await res.blob()
      const path = `${orgId}/${reportId}/${prefix}-sign-${Date.now()}.png`
      const { error } = await supabase.storage
        .from("work-report-signatures")
        .upload(path, blob, { contentType: "image/png", upsert: true })
      if (error) throw error
      const { data } = supabase.storage
        .from("work-report-signatures")
        .getPublicUrl(path)
      return data.publicUrl
    } catch (err: any) {
      console.error("Signature upload failed:", err)
      toast.error(`Signature upload failed. Check bucket permissions.`)
      return null
    }
  }

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !orgId) return
    if (reportImages.length + files.length > 8) {
      toast.error("Maximum 8 images allowed")
      e.target.value = ""
      return
    }
    setUploadingImage(true)
    const uploaded: string[] = []
    try {
      for (const file of files) {
        const ext  = file.name.split(".").pop() ?? "jpg"
        const path = `${orgId}/report-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage
          .from("work-report-signatures")
          .upload(path, file, { contentType: file.type, upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from("work-report-signatures").getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setReportImages((prev) => [...prev, ...uploaded])
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`)
    } catch (err: any) {
      console.error("Image upload failed:", err)
      toast.error("Image upload failed")
    } finally {
      setUploadingImage(false)
      e.target.value = ""
    }
  }

  const handleRemoveImage = (index: number) => {
    setReportImages((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Camera helpers ────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    stopStream()
    setCameraError(null)
    setCapturedPhoto(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err: any) {
      console.error("Camera error:", err)
      if (err.name === 'NotAllowedError') {
        setCameraError("Camera permission denied. Please allow camera access and try again.")
      } else if (err.name === 'NotFoundError') {
        setCameraError("No camera found on this device.")
      } else {
        setCameraError("Could not open camera. Try uploading an image instead.")
      }
    }
  }, [stopStream])

  const handleOpenCamera = async () => {
    if (reportImages.length >= 8) { toast.error("Maximum 8 images allowed"); return }
    setCameraOpen(true)
    await startCamera(facingMode)
  }

  const handleFlipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    await startCamera(next)
  }

  const handleCapture = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataURL = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedPhoto(dataURL)
    stopStream()   // pause camera after capture — save battery
  }

  const handleRetake = async () => {
    setCapturedPhoto(null)
    await startCamera(facingMode)
  }

  const handleUsePhoto = async () => {
    if (!capturedPhoto || !orgId) return
    setSavingPhoto(true)
    try {
      const res  = await fetch(capturedPhoto)
      const blob = await res.blob()
      const path = `${orgId}/report-images/cam-${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from("work-report-signatures")
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from("work-report-signatures").getPublicUrl(path)
      setReportImages((prev) => [...prev, data.publicUrl])
      toast.success("Photo added")
      setCapturedPhoto(null)
      setCameraOpen(false)
      stopStream()
    } catch (err: any) {
      console.error("Photo save failed:", err)
      toast.error("Failed to save photo")
    } finally {
      setSavingPhoto(false)
    }
  }

  const handleCloseCamera = () => {
    stopStream()
    setCapturedPhoto(null)
    setCameraError(null)
    setCameraOpen(false)
  }

  const handleSave = async () => {
    if (!user?.id || !orgId) return

    if (!form.customer_name.trim() || !form.report_date) {
      toast.error("Please complete the customer and report date fields")
      return
    }
    if (items.some((item) => !item.description.trim())) {
      toast.error("Please enter a description for each work item")
      return
    }

    setSaving(true)
    try {
      let reportNo = report?.report_no
      if (!edit) {
        const { data, error } = await supabase
          .from("daily_work_reports")
          .select("report_no")
          .eq("org_id", orgId)
          .is("deleted_at", null)
        if (error) throw error
        const max = (data || []).reduce(
          (n, row) =>
            Math.max(n, Number((row.report_no || "").match(/(\d+)$/)?.[1] || 0)),
          0
        )
        reportNo = `DWR-${String(max + 1).padStart(3, "0")}`
      }

      // Upload any new signature drawings
      const reportId = edit ? String(params.id) : `new-${Date.now()}`
      let techSignUrl     = report?.tech_sign_url    ?? null
      let customerSignUrl = report?.customer_sign_url ?? null

      // ⭐ Read directly from the canvas ref to avoid asynchronous state delays
      const currentTechSign = techSignRef.current?.getDataURL() || techSignDataURL
      const currentCustomerSign = customerSignRef.current?.getDataURL() || customerSignDataURL

      if (currentTechSign) {
        const url = await uploadSignature(currentTechSign, "tech", reportId)
        if (url) techSignUrl = url
      }
      if (currentCustomerSign) {
        const url = await uploadSignature(currentCustomerSign, "customer", reportId)
        if (url) customerSignUrl = url
      }

      const payload = {
        report_date:              form.report_date,
        work_order_no:            form.work_order_no || null,
        lift_no:                  form.lift_no || null,
        technician_name:          form.technician_name || null,
        customer_name:            form.customer_name,
        operational_test_status:  form.operational_test_status || null,
        safety_observations:      form.safety_observations || null,
        pending_recommendations:  form.pending_recommendations || null,
        tech_sign_name:           form.tech_sign_name || null,
        tech_sign_datetime:       fromDatetimeLocal(form.tech_sign_datetime),
        customer_sign_name:       form.customer_sign_name || null,
        customer_sign_datetime:   fromDatetimeLocal(form.customer_sign_datetime),
        tech_sign_url:            techSignUrl,
        customer_sign_url:        customerSignUrl,
        report_no:                reportNo,
        work_items:               items.map((item, i) => ({ ...item, sr_no: i + 1 })),
        checklist_responses:      checklistResponses.length > 0 ? checklistResponses : null,
        report_images:            reportImages.length > 0 ? reportImages : null,
        org_id:                   orgId,
        user_id:                  user.id,
        status:                   edit ? report?.status || "Draft" : "Draft",
        updated_at:               new Date().toISOString(),
      }

      const result = edit
        ? await supabase
            .from("daily_work_reports")
            .update(payload)
            .eq("id", params.id)
            .eq("org_id", orgId)
            .select("id")
            .single()
        : await supabase
            .from("daily_work_reports")
            .insert(payload)
            .select("id")
            .single()

      if (result.error) throw result.error

      toast.success(
        edit ? "Daily work report updated successfully" : "Daily work report created successfully"
      )
      router.push(`/daily-work-reports/${result.data.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/daily-work-reports">
            <Button variant="outline" size="icon" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {edit ? "Edit Work Report" : "Create Work Report"}
            </h1>
            <p className="text-muted-foreground">
              Record completed work and site acknowledgement
            </p>
          </div>
        </div>

        {/* Report Information */}
        <Card>
          <CardHeader>
            <CardTitle>Report Information</CardTitle>
            <CardDescription>Enter the basic report information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-no">Report No</Label>
              <Input id="report-no" value={report?.report_no || "Generated on save"} readOnly />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer Name*</Label>
                <Input
                  id="customer-name"
                  value={form.customer_name}
                  onChange={(e) => setField("customer_name", e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-date">Report Date*</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={form.report_date}
                  onChange={(e) => setField("report_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="work-order-no">
                  Work Order No{" "}
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="work-order-no"
                  value={form.work_order_no}
                  onChange={(e) => setField("work_order_no", e.target.value)}
                  placeholder="e.g. WO-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment</Label>
                <Input
                  id="equipment"
                  value={form.lift_no}
                  onChange={(e) => setField("lift_no", e.target.value)}
                  placeholder="e.g. LIFT-04"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician-name">Technician Name</Label>
              <Input
                id="technician-name"
                value={form.technician_name}
                onChange={(e) => setField("technician_name", e.target.value)}
                placeholder="Enter technician name"
              />
            </div>
          </CardContent>
        </Card>

        {/* Work Items */}
        <Card>
          <CardHeader>
            <CardTitle>Work Items</CardTitle>
            <CardDescription>List each completed or pending work item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`desc-${index}`} className="text-xs">
                    Description of Work / Service
                  </Label>
                  <ProductAutocompleteInput
                    id={`desc-${index}`}
                    value={item.description}
                    orgId={orgId}
                    onChange={(value) => updateItem(index, "description", value)}
                    onProductSelect={(product) => handleProductSelect(String(index), product)}
                  />
                </div>

                <div className="sm:w-48 space-y-2">
                  <Label htmlFor={`material-${index}`} className="text-xs">
                    Material Used
                  </Label>
                  <Input
                    id={`material-${index}`}
                    value={item.material_used}
                    onChange={(e) => updateItem(index, "material_used", e.target.value)}
                    placeholder="e.g. Rail grease"
                  />
                </div>

                <div className="sm:w-36 space-y-2">
                  <Label htmlFor={`status-${index}`} className="text-xs">
                    Status
                  </Label>
                  <Select
                    value={item.status}
                    onValueChange={(v) => updateItem(index, "status", v)}
                  >
                    <SelectTrigger id={`status-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end sm:items-end justify-end sm:justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-700"
                    aria-label="Remove work item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              className="w-full"
            >
              <Plus className="mr-2 size-4" />
              Add Work Item
            </Button>
          </CardContent>
        </Card>

        {/* ⭐ Safety Checklist */}
        {checklistTemplates.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Safety Checklist</CardTitle>
                  <CardDescription className="text-xs">
                    Mark each item as OK, Not OK, or NA
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {checklistResponses.map((item, index) => (
                  <div
                    key={item.template_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    {/* Item name */}
                    <span className="text-sm font-medium flex-1 truncate">
                      {item.name}
                    </span>

                    {/* Status toggle buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(["OK", "Not OK", "NA"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setChecklistResponses((prev) =>
                              prev.map((r, i) =>
                                i === index ? { ...r, status } : r
                              )
                            )
                          }
                          className={`
                            rounded-md px-2.5 py-1 text-xs font-semibold transition-all border
                            ${item.status === status
                              ? status === "OK"
                                ? "bg-green-600 text-white border-green-600"
                                : status === "Not OK"
                                  ? "bg-red-600 text-white border-red-600"
                                  : "bg-muted text-foreground border-border"
                              : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground"}
                          `}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary badges */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border flex-wrap">
                <span className="text-xs text-muted-foreground">Summary:</span>
                <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                  OK: {checklistResponses.filter((r) => r.status === "OK").length}
                </Badge>
                <Badge className="bg-red-500/10 text-red-700 border-red-500/20 text-xs">
                  Not OK: {checklistResponses.filter((r) => r.status === "Not OK").length}
                </Badge>
                <Badge className="bg-muted text-muted-foreground border-border text-xs">
                  NA: {checklistResponses.filter((r) => r.status === "NA").length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inspection / Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Inspection / Testing</CardTitle>
            <CardDescription>Record test results and observations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operational-test">Operational Test Status</Label>
              <Select
                value={form.operational_test_status}
                onValueChange={(v) => setField("operational_test_status", v)}
              >
                <SelectTrigger id="operational-test">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="safety-observations">Safety Observations</Label>
              <Textarea
                id="safety-observations"
                value={form.safety_observations}
                onChange={(e) => setField("safety_observations", e.target.value)}
                placeholder="e.g. All OK, no issues found"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pending-recommendations">Pending Recommendations</Label>
              <Textarea
                id="pending-recommendations"
                value={form.pending_recommendations}
                onChange={(e) => setField("pending_recommendations", e.target.value)}
                placeholder="e.g. Replace brake lining on next visit"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Acknowledgement */}
        <Card>
          <CardHeader>
            <CardTitle>Acknowledgement</CardTitle>
            <CardDescription>
              Enter names, date/time, and draw signatures for technician and customer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Technician ──────────────────────────────────────── */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Technician / Engineer
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tech-sign-name">Name</Label>
                  <Input
                    id="tech-sign-name"
                    value={form.tech_sign_name}
                    onChange={(e) => setField("tech_sign_name", e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tech-sign-datetime">Date &amp; Time</Label>
                  <Input
                    id="tech-sign-datetime"
                    type="datetime-local"
                    value={form.tech_sign_datetime}
                    onChange={(e) => setField("tech_sign_datetime", e.target.value)}
                  />
                </div>
              </div>
              <SignaturePad
                ref={techSignRef}
                label="Technician Signature"
                existingUrl={report?.tech_sign_url ?? null}
                onChange={(dataURL) => setTechSignDataURL(dataURL)}
              />
            </div>

            {/* ── Customer ────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer / Site Representative
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-sign-name">Name</Label>
                  <Input
                    id="customer-sign-name"
                    value={form.customer_sign_name}
                    onChange={(e) => setField("customer_sign_name", e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-sign-datetime">Date &amp; Time</Label>
                  <Input
                    id="customer-sign-datetime"
                    type="datetime-local"
                    value={form.customer_sign_datetime}
                    onChange={(e) => setField("customer_sign_datetime", e.target.value)}
                  />
                </div>
              </div>
              <SignaturePad
                ref={customerSignRef}
                label="Customer Signature"
                existingUrl={report?.customer_sign_url ?? null}
                onChange={(dataURL) => setCustomerSignDataURL(dataURL)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Site Images */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImagePlus className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Site Images</CardTitle>
                  <CardDescription className="text-xs">
                    Add photos of the work done — printed on page 2 of the PDF
                    <span className="ml-1 text-muted-foreground">({reportImages.length}/8)</span>
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Action buttons row */}
            <div className={`grid grid-cols-2 gap-3 ${reportImages.length >= 8 ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Camera capture */}
              <button
                type="button"
                onClick={handleOpenCamera}
                disabled={uploadingImage || reportImages.length >= 8}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 py-5 transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-950/40 disabled:opacity-50"
              >
                <Camera className="size-7 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Take Photo</span>
                <span className="text-[11px] text-blue-500 dark:text-blue-500">Use camera</span>
              </button>

              {/* File upload */}
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-5 cursor-pointer transition-colors hover:bg-muted/50 ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleImageUpload}
                  disabled={uploadingImage || reportImages.length >= 8}
                />
                {uploadingImage ? (
                  <>
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Uploading...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-7 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Upload Files</span>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP</span>
                  </>
                )}
              </label>
            </div>

            {/* Image preview grid */}
            {reportImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {reportImages.map((url, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                    <img src={url} alt={`Site image ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="rounded-full bg-red-600 p-1.5 text-white hover:bg-red-700 transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Camera Dialog ────────────────────────────────────────────────── */}
        <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) handleCloseCamera() }}>
          <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl gap-0">

            {/* Hidden canvas for capturing frames */}
            <canvas ref={canvasRef} className="hidden" />

            {cameraError ? (
              /* ── Error state ── */
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[320px]">
                <Camera className="size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-xs">{cameraError}</p>
                <Button variant="outline" onClick={handleCloseCamera}>Close</Button>
              </div>

            ) : capturedPhoto ? (
              /* ── Preview captured photo ── */
              <div className="flex flex-col">
                <div className="relative bg-black">
                  <img src={capturedPhoto} alt="Captured" className="w-full max-h-[65dvh] object-contain" />
                </div>
                <div className="flex gap-3 p-4 bg-background">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleRetake}
                    disabled={savingPhoto}
                  >
                    <RefreshCw className="size-4" />
                    Retake
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleUsePhoto}
                    disabled={savingPhoto}
                  >
                    {savingPhoto
                      ? <Loader2 className="size-4 animate-spin" />
                      : <ZoomIn className="size-4" />}
                    {savingPhoto ? 'Saving...' : 'Use Photo'}
                  </Button>
                </div>
              </div>

            ) : (
              /* ── Live camera preview ── */
              <div className="flex flex-col">
                {/* Video preview */}
                <div className="relative bg-black flex items-center justify-center min-h-[55dvh]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[65dvh] object-cover"
                  />
                  {/* Close button overlay */}
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                    aria-label="Close camera"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Controls bar */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 bg-background">
                  {/* Flip camera */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 rounded-full"
                    onClick={handleFlipCamera}
                    title="Flip camera"
                  >
                    <RefreshCw className="size-5" />
                  </Button>

                  {/* Capture button — large, prominent for field use */}
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="size-16 rounded-full bg-white border-4 border-blue-500 shadow-lg hover:border-blue-600 active:scale-95 transition-all flex items-center justify-center"
                    aria-label="Capture photo"
                  >
                    <div className="size-11 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors" />
                  </button>

                  {/* Spacer to balance layout */}
                  <div className="size-11" />
                </div>
              </div>
            )}

          </DialogContent>
        </Dialog>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link href="/daily-work-reports">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving || !orgId}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {edit ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                {edit ? "Save Changes" : "Create Report"}
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default DailyWorkReportForm
