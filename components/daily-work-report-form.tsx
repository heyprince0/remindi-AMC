"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase, type DailyWorkItem, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

type Props = { edit?: boolean }
const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (sr_no: number): DailyWorkItem => ({ sr_no, description: "", material_used: "", status: "Completed" })

export function DailyWorkReportForm({ edit = false }: Props) {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const { user } = useAuth()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(edit)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<DailyWorkReport | null>(null)
  const [form, setForm] = useState({ report_date: today(), work_order_no: "", lift_no: "", technician_name: "", contact_no: "", customer_name: "", site_name: "", site_address: "", operational_test_status: "Yes", safety_observations: "", pending_recommendations: "", tech_sign_name: "", tech_sign_datetime: "", customer_sign_name: "", customer_sign_datetime: "", office_status: "Approved", checked_by: "" })
  const [items, setItems] = useState<DailyWorkItem[]>([emptyItem(1)])

  useEffect(() => { if (user?.id) supabase.from("memberships").select("org_id").eq("user_id", user.id).single().then(({ data, error }) => { if (error) toast.error("Could not determine your organization"); else setOrgId(data.org_id) }) }, [user?.id])
  useEffect(() => {
    if (!edit || !params.id || !orgId) return
    supabase.from("daily_work_reports").select("*").eq("id", params.id).eq("org_id", orgId).is("deleted_at", null).single().then(({ data, error }) => {
      if (error || !data) { toast.error("Failed to load report"); router.push("/daily-work-reports"); return }
      const r = data as DailyWorkReport; setReport(r); setForm({ report_date: r.report_date || today(), work_order_no: r.work_order_no || "", lift_no: r.lift_no || "", technician_name: r.technician_name || "", contact_no: r.contact_no || "", customer_name: r.customer_name || "", site_name: r.site_name || "", site_address: r.site_address || "", operational_test_status: r.operational_test_status || "Yes", safety_observations: r.safety_observations || "", pending_recommendations: r.pending_recommendations || "", tech_sign_name: r.tech_sign_name || "", tech_sign_datetime: r.tech_sign_datetime || "", customer_sign_name: r.customer_sign_name || "", customer_sign_datetime: r.customer_sign_datetime || "", office_status: r.office_status || "Approved", checked_by: r.checked_by || "" }); setItems(r.work_items?.length ? r.work_items : [emptyItem(1)]); setLoading(false)
    })
  }, [edit, params.id, orgId, router])

  const setField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const updateItem = (index: number, field: keyof DailyWorkItem, value: string) => setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value, sr_no: i + 1 } : item))
  const handleSave = async () => {
    if (!user?.id || !orgId) return
    if (!form.customer_name.trim() || !form.technician_name.trim() || !form.report_date) { toast.error("Please complete the customer, technician, and report date fields"); return }
    if (items.some(item => !item.description.trim())) { toast.error("Please enter a description for each work item"); return }
    setSaving(true)
    try {
      let reportNo = report?.report_no
      if (!edit) { const { data, error } = await supabase.from("daily_work_reports").select("report_no").eq("org_id", orgId).is("deleted_at", null); if (error) throw error; const max = (data || []).reduce((n, row) => Math.max(n, Number((row.report_no || "").match(/(\d+)$/)?.[1] || 0)), 0); reportNo = `DWR-${String(max + 1).padStart(3, "0")}` }
      const payload = { ...form, report_no: reportNo, report_date: form.report_date, work_items: items.map((item, i) => ({ ...item, sr_no: i + 1 })), org_id: orgId, user_id: user.id, status: edit ? report?.status || "Draft" : "Draft", updated_at: new Date().toISOString() }
      const result = edit ? await supabase.from("daily_work_reports").update(payload).eq("id", params.id).eq("org_id", orgId).select("id").single() : await supabase.from("daily_work_reports").insert(payload).select("id").single()
      if (result.error) throw result.error
      toast.success(edit ? "Daily work report updated successfully" : "Daily work report created successfully")
      router.push(`/daily-work-reports/${result.data.id}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save report") } finally { setSaving(false) }
  }

  if (loading) return <DashboardLayout><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>
  return <DashboardLayout><div className="mx-auto flex max-w-5xl flex-col gap-6">
    <div className="flex items-center gap-3"><Link href="/daily-work-reports"><Button variant="outline" size="icon" aria-label="Back"><ArrowLeft /></Button></Link><div><h1 className="text-2xl font-bold">{edit ? "Edit Daily Work Report" : "Create Daily Work Report"}</h1><p className="text-muted-foreground">Record completed work and site acknowledgement</p></div></div>
    <Card><CardHeader><CardTitle>Report Header</CardTitle><CardDescription>Enter the basic report information</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label="Report No"><Input value={report?.report_no || "Generated on save"} readOnly /></Field><Field label="Report Date"><Input type="date" value={form.report_date} onChange={e => setField("report_date", e.target.value)} /></Field><Field label="Work Order No"><Input value={form.work_order_no} onChange={e => setField("work_order_no", e.target.value)} /></Field><Field label="Lift No"><Input value={form.lift_no} onChange={e => setField("lift_no", e.target.value)} /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Technician & Site</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label="Technician Name*"><Input value={form.technician_name} onChange={e => setField("technician_name", e.target.value)} /></Field><Field label="Contact No"><Input value={form.contact_no} onChange={e => setField("contact_no", e.target.value)} /></Field><Field label="Customer Name*"><Input value={form.customer_name} onChange={e => setField("customer_name", e.target.value)} /></Field><Field label="Site Name"><Input value={form.site_name} onChange={e => setField("site_name", e.target.value)} /></Field><div className="sm:col-span-2"><Field label="Site Address"><Textarea value={form.site_address} onChange={e => setField("site_address", e.target.value)} /></Field></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Work Items</CardTitle><CardDescription>List each completed or pending work item</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Sr. No</th><th className="p-2">Description of Work / Service</th><th className="p-2">Material Used</th><th className="p-2">Status</th><th className="p-2" /></tr></thead><tbody>{items.map((item, index) => <tr className="border-b" key={index}><td className="p-2">{index + 1}</td><td className="p-2"><Input value={item.description} onChange={e => updateItem(index, "description", e.target.value)} /></td><td className="p-2"><Input value={item.material_used} onChange={e => updateItem(index, "material_used", e.target.value)} /></td><td className="p-2"><Select value={item.status} onValueChange={v => updateItem(index, "status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select></td><td className="p-2"><Button type="button" variant="ghost" size="icon" disabled={items.length === 1} onClick={() => setItems(prev => prev.filter((_, i) => i !== index).map((v, i) => ({ ...v, sr_no: i + 1 })))} aria-label="Remove work item"><Trash2 /></Button></td></tr>)}</tbody></table></div><Button type="button" variant="outline" className="w-fit" onClick={() => setItems(prev => [...prev, emptyItem(prev.length + 1)])}><Plus data-icon="inline-start" />Add Work Item</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Inspection / Testing</CardTitle></CardHeader><CardContent className="grid gap-4"><Field label="Operational Test Status"><Select value={form.operational_test_status} onValueChange={v => setField("operational_test_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="Not Applicable">Not Applicable</SelectItem></SelectContent></Select></Field><Field label="Safety Observations"><Textarea value={form.safety_observations} onChange={e => setField("safety_observations", e.target.value)} /></Field><Field label="Pending Recommendations"><Textarea value={form.pending_recommendations} onChange={e => setField("pending_recommendations", e.target.value)} /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Acknowledgement</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label="Technician / Engineer Signature Name"><Input value={form.tech_sign_name} onChange={e => setField("tech_sign_name", e.target.value)} /></Field><Field label="Technician Signature Date & Time"><Input type="datetime-local" value={form.tech_sign_datetime} onChange={e => setField("tech_sign_datetime", e.target.value)} /></Field><Field label="Customer / Site Representative Name"><Input value={form.customer_sign_name} onChange={e => setField("customer_sign_name", e.target.value)} /></Field><Field label="Customer Signature Date & Time"><Input type="datetime-local" value={form.customer_sign_datetime} onChange={e => setField("customer_sign_datetime", e.target.value)} /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Office Use</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Field label="Office Status"><Select value={form.office_status} onValueChange={v => setField("office_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Approved">Approved</SelectItem><SelectItem value="Follow-up Required">Follow-up Required</SelectItem></SelectContent></Select></Field><Field label="Checked By"><Input value={form.checked_by} onChange={e => setField("checked_by", e.target.value)} /></Field></CardContent></Card>
    <div className="flex justify-end gap-3"><Link href="/daily-work-reports"><Button variant="outline">Cancel</Button></Link><Button onClick={handleSave} disabled={saving || !orgId}>{saving ? <Loader2 className="animate-spin" /> : <Save data-icon="inline-start" />}Save Report</Button></div>
  </div></DashboardLayout>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div> }

export default DailyWorkReportForm
