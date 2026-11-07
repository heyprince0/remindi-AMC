"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase, type Contract, type Customer, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  AlertTriangle, Clock, CalendarClock, CheckCircle2,
  History, Loader2, Share2, MapPin, StickyNote, Phone,
} from "lucide-react"
import { MarkCompleteModal } from "@/components/mark-complete-modal"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Types ─────────────────────────────────────────────────────────────────────

interface TechnicianAlert {
  jobId: string
  contractId: string
  customerId: string | null
  customer: string
  customerPhone: string
  contractName: string
  serviceType: string
  nextServiceDate: string
  daysUntilService: number
  daysOverdue?: number
  contractData: Contract
  location?: string
}

interface CompletedRecord {
  id: string
  contractName: string
  customer: string
  serviceDate: string
  serviceType: string
  location: string
  notes: string | null
  completedAt: string | null
}

// ── Pending Alert Card ────────────────────────────────────────────────────────

function TechnicianAlertCard({
  alert,
  variant,
  onMarkComplete,
  onViewCustomer,
}: {
  alert: TechnicianAlert
  variant: "overdue" | "due-today"
  onMarkComplete: (alert: TechnicianAlert) => void
  onViewCustomer: (customerId: string) => void
}) {
  const styles = {
    overdue: {
      border: "border-l-alert-overdue",
      bg: "bg-alert-overdue/5",
      badge: "bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20",
      label: `${alert.daysOverdue} day${alert.daysOverdue !== 1 ? "s" : ""} overdue`,
    },
    "due-today": {
      border: "border-l-alert-due-today",
      bg: "bg-alert-due-today/5",
      badge: "bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20",
      label: "Due today",
    },
  }[variant]

  return (
    <Card className={`border-l-4 ${styles.border} ${styles.bg}`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-card-foreground">{alert.customer}</h3>
              <Badge variant="outline" className="text-xs font-normal">{alert.serviceType}</Badge>
              <Badge className={`text-xs ${styles.badge}`}>{styles.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{alert.contractName}</p>
            {alert.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3 shrink-0" />{alert.location}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onMarkComplete(alert)}
            >
              <CheckCircle2 className="size-3.5 shrink-0" />
              Mark Complete
            </Button>
            {alert.customerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewCustomer(alert.customerId!)}
              >
                View
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Completed Service Card ────────────────────────────────────────────────────

function CompletedCard({
  record,
  onShare,
  generating,
}: {
  record: CompletedRecord
  onShare: (record: CompletedRecord) => void
  generating: boolean
}) {
  return (
    <Card className="border-l-4 border-l-alert-success bg-alert-success/5">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">

          {/* Top row: customer + date */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="size-2 rounded-full bg-alert-success shrink-0" />
                <p className="font-semibold text-card-foreground">{record.customer}</p>
                <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20 text-xs">
                  Completed
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{record.contractName}</p>
            </div>
            <p className="text-xs text-muted-foreground shrink-0 mt-0.5">
              {formatDateShort(record.serviceDate)}
            </p>
          </div>

          {/* Meta: type + location */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {record.serviceType && (
              <span className="flex items-center gap-1">
                <span className="font-medium text-foreground">{record.serviceType}</span>
              </span>
            )}
            {record.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3 shrink-0" />{record.location}
              </span>
            )}
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2">
              <StickyNote className="size-3 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">
                "{record.notes}"
              </p>
            </div>
          )}

          {/* Action: Share Report */}
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
              onClick={() => onShare(record)}
              disabled={generating}
            >
              {generating
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Share2 className="size-3.5" />}
              {generating ? "Generating…" : "Share Report"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              PDF · pick contact in WhatsApp
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function safeStr(val: unknown): string {
  return String(val ?? "—")
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildServiceReportPdf(
  record: CompletedRecord,
  technicianName: string,
  orgName: string,
): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = 210
  const margin = 15
  const blue: [number, number, number] = [24, 95, 165]

  doc.setFillColor(...blue)
  doc.rect(0, 0, pageW, 28, "F")

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("SERVICE COMPLETION REPORT", margin, 12)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(orgName || "Remindi", margin, 20)
  doc.text(
    "Generated: " + new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    pageW - margin,
    20,
    { align: "right" },
  )

  let y = 40
  doc.setFillColor(220, 252, 231)
  doc.setDrawColor(34, 197, 94)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y - 5, 42, 10, 3, 3, "FD")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(21, 128, 61)
  doc.text("✓  COMPLETED", margin + 4, y + 1.5)

  y = 55
  doc.setTextColor(40, 40, 40)
  autoTable(doc, {
    startY: y,
    head: [["SERVICE DETAILS", ""]],
    body: [
      ["Customer",      safeStr(record.customer)],
      ["Contract",      safeStr(record.contractName)],
      ["Service Type",  safeStr(record.serviceType)],
      ["Service Date",  formatDateShort(record.serviceDate)],
      ["Location",      safeStr(record.location) || "—"],
      ["Technician",    safeStr(technicianName)],
      ["Status",        "Completed"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: blue,
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold", fillColor: [248, 250, 252] },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  })

  y = (doc as any).lastAutoTable.finalY + 8

  if (record.notes) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...blue)
    doc.text("NOTES / REMARKS", margin, y)
    y += 5
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    const noteLines = doc.splitTextToSize(record.notes, pageW - 2 * margin - 8)
    const noteBoxH = noteLines.length * 5 + 8
    doc.roundedRect(margin, y, pageW - 2 * margin, noteBoxH, 2, 2, "FD")
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text(noteLines, margin + 4, y + 6)
    y += noteBoxH + 8
  }

  y = Math.max(y, 220)
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.4)
  doc.line(pageW - margin - 55, y, pageW - margin, y)
  y += 4
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  doc.text("Technician Signature", pageW - margin, y, { align: "right" })
  doc.text(technicianName, pageW - margin, y + 4, { align: "right" })

  doc.setFontSize(7.5)
  doc.setTextColor(160, 160, 160)
  doc.text("Generated by Remindi · remindi.online", pageW / 2, 285, { align: "center" })

  const safeName = (record.contractName || "service").replace(/[^a-z0-9]/gi, "_")
  const filename  = `Service-Report-${safeName}-${record.serviceDate || "date"}.pdf`
  return { blob: doc.output("blob"), filename }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TechnicianAlertsPage() {
  const { user } = useAuth()

  const [currentOrgId, setCurrentOrgId]         = useState<string | null>(null)
  const [linkedTechId, setLinkedTechId]          = useState<string | null>(null)
  const [linkedTechName, setLinkedTechName]      = useState<string>("")
  const [orgName, setOrgName]                    = useState<string>("")

  const [overdueAlerts, setOverdueAlerts]        = useState<TechnicianAlert[]>([])
  const [dueTodayAlerts, setDueTodayAlerts]      = useState<TechnicianAlert[]>([])
  const [completedRecords, setCompletedRecords]  = useState<CompletedRecord[]>([])

  const [loading, setLoading]                    = useState(true)
  const [modalOpen, setModalOpen]                = useState(false)
  const [selectedAlert, setSelectedAlert]        = useState<TechnicianAlert | null>(null)
  const [generatingReportFor, setGeneratingReportFor] = useState<string | null>(null)

  // ── Customer info popup state ───────────────────────────────────────────
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null)
  const [customerInfoLoading, setCustomerInfoLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data?.org_id) setCurrentOrgId(data.org_id) })
  }, [user?.id])

  useEffect(() => {
    if (!currentOrgId) return
    supabase
      .from("company_profile")
      .select("company_name")
      .eq("org_id", currentOrgId)
      .maybeSingle()
      .then(({ data }) => { if (data?.company_name) setOrgName(data.company_name) })
  }, [currentOrgId])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from("technicians")
      .select("id, name")
      .eq("linked_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setLinkedTechId(data.id)
          setLinkedTechName(data.name)
        } else {
          setLoading(false)
        }
      })
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId && linkedTechId) loadMyAlerts()
  }, [currentOrgId, linkedTechId])

  const loadMyAlerts = async () => {
    if (!currentOrgId || !linkedTechId) return
    setLoading(true)
    try {
      // ────────────────────────────────────────────────────────────────────
      // 1. My raw pending jobs
      // ────────────────────────────────────────────────────────────────────
      const { data: myPendingJobs } = await supabase
        .from("technician_jobs")
        .select("*")
        .eq("org_id", currentOrgId)
        .eq("technician_id", linkedTechId)
        .eq("status", "pending")

      // ────────────────────────────────────────────────────────────────────
      // 2. REASSIGNMENT GUARD
      //    For each contract I still have a pending job on, fetch ALL
      //    pending jobs across every technician. Keep only rows where MY
      //    job is the most recent pending job — otherwise the contract has
      //    been reassigned away from me (or has no valid pending job),
      //    and it must NOT show up.
      // ────────────────────────────────────────────────────────────────────
      let pendingJobs: typeof myPendingJobs = []
      if (myPendingJobs && myPendingJobs.length > 0) {
        const contractIds = [
          ...new Set(myPendingJobs.map(j => j.contract_id).filter(Boolean)),
        ] as string[]

        if (contractIds.length > 0) {
          const { data: allPendingForContracts } = await supabase
            .from("technician_jobs")
            .select("id, contract_id, technician_id, created_at")
            .eq("org_id", currentOrgId)
            .in("contract_id", contractIds)
            .eq("status", "pending")

          // Build map: contract_id → latest pending job (null-safe by created_at)
          const latestJobByContract = new Map<
            string,
            { id: string; contract_id: string; technician_id: string; created_at: string | null }
          >()

          for (const j of allPendingForContracts ?? []) {
            if (!j.contract_id) continue
            const existing = latestJobByContract.get(j.contract_id)
            if (!existing) {
              latestJobByContract.set(j.contract_id, j as any)
              continue
            }
            const jTime = j.created_at ?? ""
            const eTime = existing.created_at ?? ""
            if (jTime > eTime) {
              latestJobByContract.set(j.contract_id, j as any)
            }
          }

          pendingJobs = myPendingJobs.filter((job) => {
            if (!job.contract_id) return true
            const latest = latestJobByContract.get(job.contract_id)
            if (!latest) return false                     // no valid pending → hide
            return latest.technician_id === linkedTechId  // reassigned → hide
          })
        } else {
          // All my pending jobs have null contract_id → keep as-is (edge case)
          pendingJobs = myPendingJobs
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // 3. Completed jobs (historical, always scoped to me)
      // ────────────────────────────────────────────────────────────────────
      const { data: completedJobs } = await supabase
        .from("technician_jobs")
        .select("id, title, customer_id, contract_id, assigned_date, notes, completed_at")
        .eq("org_id", currentOrgId)
        .eq("technician_id", linkedTechId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(30)

      if (!pendingJobs?.length && !completedJobs?.length) {
        setOverdueAlerts([])
        setDueTodayAlerts([])
        setCompletedRecords([])
        setLoading(false)
        return
      }

      // ────────────────────────────────────────────────────────────────────
      // 4. Batch-fetch contracts + customers for the surviving jobs only
      // ────────────────────────────────────────────────────────────────────
      const allJobs = [...(pendingJobs ?? []), ...(completedJobs ?? [])]
      const contractIdsForFetch = [
        ...new Set(allJobs.map(j => j.contract_id).filter(Boolean)),
      ] as string[]
      const customerIds = [
        ...new Set(allJobs.map(j => j.customer_id).filter(Boolean)),
      ] as string[]

      const [{ data: contractsData }, { data: customersData }] = await Promise.all([
        contractIdsForFetch.length
          ? supabase.from("contracts").select("*").in("id", contractIdsForFetch).eq("org_id", currentOrgId)
          : Promise.resolve({ data: [] as Contract[] }),
        customerIds.length
          ? supabase
              .from("customers")
              .select("id, name, phone")
              .in("id", customerIds)
              .eq("org_id", currentOrgId)
          : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
      ])

      // ────────────────────────────────────────────────────────────────────
      // 5. Build pending alert lists — ONLY overdue + due today
      // ────────────────────────────────────────────────────────────────────
      const overdue: TechnicianAlert[]  = []
      const dueToday: TechnicianAlert[] = []

      for (const job of pendingJobs ?? []) {
        const contract = (contractsData as Contract[] | undefined)?.find(c => c.id === job.contract_id)
        const customer = (customersData as { id: string; name: string; phone: string | null }[] | undefined)?.find(
          c => c.id === job.customer_id
        )
        if (!contract) continue

        const days = getDaysUntilService(contract.next_service_date)
        const alert: TechnicianAlert = {
          jobId: job.id,
          contractId: contract.id,
          customerId: job.customer_id || null,
          customer: customer?.name ?? "Unknown Customer",
          customerPhone: customer?.phone ?? "",
          contractName: contract.contract_name,
          serviceType: (contract as any).service_type ?? "Service",
          nextServiceDate: contract.next_service_date,
          daysUntilService: days,
          contractData: contract,
          location: contract.location ?? "",
        }

        if (days < 0)        overdue.push({ ...alert, daysOverdue: Math.abs(days) })
        else if (days === 0) dueToday.push(alert)
        // Upcoming (days > 0) intentionally ignored
      }

      setOverdueAlerts(overdue)
      setDueTodayAlerts(dueToday)

      // ────────────────────────────────────────────────────────────────────
      // 6. Build completed history (unchanged — historical)
      // ────────────────────────────────────────────────────────────────────
      const history: CompletedRecord[] = (completedJobs ?? []).map(job => {
        const contract = (contractsData as Contract[] | undefined)?.find(c => c.id === job.contract_id)
        const customer = (customersData as { id: string; name: string; phone: string | null }[] | undefined)?.find(
          c => c.id === job.customer_id
        )
        return {
          id:           job.id,
          contractName: job.title ?? contract?.contract_name ?? "—",
          customer:     customer?.name ?? "Unknown",
          serviceDate:  job.assigned_date ?? "—",
          serviceType:  (contract as any)?.service_type ?? "Service",
          location:     contract?.location ?? "",
          notes:        job.notes ?? null,
          completedAt:  job.completed_at ?? null,
        }
      })
      setCompletedRecords(history)
    } catch (err) {
      console.error("Error loading technician alerts:", err)
      toast.error("Failed to load your service alerts")
    } finally {
      setLoading(false)
    }
  }

  // ── Customer info popup ────────────────────────────────────────────────
  const openCustomerInfo = async (customerId: string) => {
    if (!currentOrgId) return
    setCustomerInfoOpen(true)
    setCustomerInfoLoading(true)
    setCustomerInfo(null)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('org_id', currentOrgId)
        .single()
      if (error) throw error
      setCustomerInfo(data as Customer)
    } catch (err) {
      console.error('Error loading customer info:', err)
      toast.error('Failed to load customer info')
      setCustomerInfoOpen(false)
    } finally {
      setCustomerInfoLoading(false)
    }
  }

  const handleMarkComplete = (alert: TechnicianAlert) => {
    setSelectedAlert(alert)
    setModalOpen(true)
  }

  const handleModalSuccess = async () => {
    await loadMyAlerts()
    toast.success("Service marked complete! Check the History tab to share the report.")
  }

  const handleShareReport = async (record: CompletedRecord) => {
    setGeneratingReportFor(record.id)
    try {
      const { blob, filename } = buildServiceReportPdf(record, linkedTechName, orgName)
      const file = new File([blob], filename, { type: "application/pdf" })

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Service Report — ${record.contractName}`,
          text: `Hi, please find the service completion report for ${record.contractName} (completed on ${formatDateShort(record.serviceDate)}).`,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement("a")
        a.href     = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)

        const waText = encodeURIComponent(
          `Hi, please find the service completion report for *${record.contractName}* ` +
          `(completed on ${formatDateShort(record.serviceDate)}) attached as a PDF.\n\n` +
          `Technician: ${linkedTechName}`
        )
        window.open(`https://wa.me/?text=${waText}`, "_blank")
        toast.info("PDF saved. Open WhatsApp and attach it there.")
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return
      console.error("Report generation failed:", err)
      toast.error("Could not generate the report. Please try again.")
    } finally {
      setGeneratingReportFor(null)
    }
  }

  if (!loading && !linkedTechId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Clock className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Account not linked</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your account is not linked to a technician profile yet. Ask your admin to link it.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  const totalPending = overdueAlerts.length + dueTodayAlerts.length

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:gap-6">

        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">My Service Alerts</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            {loading
              ? "Loading..."
              : `${totalPending} service${totalPending !== 1 ? "s" : ""} need attention${linkedTechName ? ` · ${linkedTechName}` : ""}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <div className="rounded-lg border-l-4 border-l-alert-overdue bg-alert-overdue/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="size-3.5 text-alert-overdue shrink-0" />
              <p className="text-[11px] text-muted-foreground">Overdue</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : overdueAlerts.length}</p>
          </div>
          <div className="rounded-lg border-l-4 border-l-alert-due-today bg-alert-due-today/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarClock className="size-3.5 text-alert-due-today shrink-0" />
              <p className="text-[11px] text-muted-foreground">Today</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : dueTodayAlerts.length}</p>
          </div>
        </div>

        <Tabs defaultValue="overdue" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overdue" className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="size-2 rounded-full bg-alert-overdue shrink-0" />
              <span className="hidden sm:inline">Overdue </span>
              <span>({overdueAlerts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="size-2 rounded-full bg-alert-due-today shrink-0" />
              Today ({dueTodayAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">Done</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-4">
            <div className="flex flex-col gap-3">
              {loading ? (
                <EmptyState icon={<Loader2 className="size-5 animate-spin text-muted-foreground" />} label="Loading..." />
              ) : overdueAlerts.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="size-5 text-muted-foreground" />} label="No overdue services assigned to you" />
              ) : (
                overdueAlerts.map(a => (
                  <TechnicianAlertCard
                    key={a.jobId}
                    alert={a}
                    variant="overdue"
                    onMarkComplete={handleMarkComplete}
                    onViewCustomer={openCustomerInfo}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="today" className="mt-4">
            <div className="flex flex-col gap-3">
              {loading ? (
                <EmptyState icon={<Loader2 className="size-5 animate-spin text-muted-foreground" />} label="Loading..." />
              ) : dueTodayAlerts.length === 0 ? (
                <EmptyState icon={<CalendarClock className="size-5 text-muted-foreground" />} label="No services due today" />
              ) : (
                dueTodayAlerts.map(a => (
                  <TechnicianAlertCard
                    key={a.jobId}
                    alert={a}
                    variant="due-today"
                    onMarkComplete={handleMarkComplete}
                    onViewCustomer={openCustomerInfo}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loading ? (
              <EmptyState icon={<Loader2 className="size-5 animate-spin text-muted-foreground" />} label="Loading..." />
            ) : completedRecords.length === 0 ? (
              <EmptyState icon={<History className="size-5 text-muted-foreground" />} label="No completed services yet" />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground px-0.5">
                  Tap <span className="font-medium text-foreground">Share Report</span> to send the PDF to your manager or owner via WhatsApp.
                </p>
                {completedRecords.map(record => (
                  <CompletedCard
                    key={record.id}
                    record={record}
                    onShare={handleShareReport}
                    generating={generatingReportFor === record.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {user && currentOrgId && (
          <MarkCompleteModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            contract={selectedAlert?.contractData ?? null}
            userId={user.id}
            orgId={currentOrgId}
            preselectedTechnicianId={linkedTechId ?? undefined}
            onSuccess={handleModalSuccess}
          />
        )}

        {/* Customer Info Dialog */}
        <Dialog open={customerInfoOpen} onOpenChange={setCustomerInfoOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="size-5 text-primary" />
                Customer Details
              </DialogTitle>
            </DialogHeader>
            {customerInfoLoading || !customerInfo ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-base font-semibold text-primary">
                      {customerInfo.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{customerInfo.name}</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Phone className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                    <a
                      href={`tel:${customerInfo.phone}`}
                      className="font-medium text-primary hover:underline text-sm"
                    >
                      {customerInfo.phone}
                    </a>
                  </div>
                </div>

                {customerInfo.address && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</p>
                      <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{customerInfo.address}</p>
                    </div>
                  </div>
                )}

                {customerInfo.notes && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <StickyNote className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
                      <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{customerInfo.notes}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setCustomerInfoOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

// ── Shared empty state ────────────────────────────────────────────────────────
function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">{icon}</div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
