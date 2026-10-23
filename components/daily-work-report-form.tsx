"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Save, Trash2, CheckSquare } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import ProductAutocompleteInput from "@/components/ProductAutocompleteInput"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
