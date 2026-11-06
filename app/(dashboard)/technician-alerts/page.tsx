"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase, type Contract, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, MessageSquare, History } from "lucide-react"
import { MarkCompleteModal } from "@/components/mark-complete-modal"
import { toast } from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────

interface TechnicianAlert {
  jobId: string
  contractId: string
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
  notes: string | null
}

// ── Alert Card ───────────────────────────────────────────────────────────────

function TechnicianAlertCard({
  alert,
  variant,
  onMarkComplete,
  onWhatsApp,
}: {
  alert: TechnicianAlert
  variant: "overdue" | "due-today" | "upcoming"
  onMarkComplete: (alert: TechnicianAlert) => void
  onWhatsApp: (alert: TechnicianAlert) => void
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
    upcoming: {
      border: "border-l-alert-upcoming",
      bg: "bg-alert-upcoming/5",
      badge: "bg-alert-upcoming/10 text-alert-upcoming border-alert-upcoming/20",
      label: formatDateShort(alert.nextServiceDate),
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
              <p className="text-xs text-muted-foreground">{alert.location}</p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {alert.customerPhone && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 md:flex-none gap-1.5 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                onClick={() => onWhatsApp(alert)}
              >
                <MessageSquare className="size-3.5 shrink-0" />
                <span>WhatsApp</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none gap-1.5"
              onClick={() => onMarkComplete(alert)}
            >
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>Mark Complete</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function buildCompletionMessage(customerName: string, contractName: string, technicianName: string): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })
  return (
    `Dear ${customerName},\n\n` +
    `Your *${contractName}* service has been successfully completed on ${today} by technician *${technicianName}*.\n\n` +
    `Thank you for trusting us with your service. We will notify you again before the next scheduled service.\n\n` +
    `For any queries, feel free to contact us.`
  )
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/[\s\-().]/g, "")
  if (phone.startsWith("0")) phone = "91" + phone.slice(1)
  if (!phone.startsWith("+")) phone = phone.startsWith("91") ? phone : "91" + phone
  return phone.replace(/^\+/, "")
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TechnicianAlertsPage() {
  const { user } = useAuth()

  const [currentOrgId, setCurrentOrgId]       = useState<string | null>(null)
  const [linkedTechId, setLinkedTechId]        = useState<string | null>(null)
  const [linkedTechName, setLinkedTechName]    = useState<string>("")

  const [overdueAlerts, setOverdueAlerts]      = useState<TechnicianAlert[]>([])
  const [dueTodayAlerts, setDueTodayAlerts]    = useState<TechnicianAlert[]>([])
  const [upcomingAlerts, setUpcomingAlerts]    = useState<TechnicianAlert[]>([])
  const [completedRecords, setCompletedRecords] = useState<CompletedRecord[]>([])

  const [loading, setLoading]                  = useState(true)
  const [modalOpen, setModalOpen]              = useState(false)
  const [selectedAlert, setSelectedAlert]      = useState<TechnicianAlert | null>(null)

  // ── Org ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data?.org_id) setCurrentOrgId(data.org_id) })
  }, [user?.id])

  // ── Linked technician ──────────────────────────────────────────────────────
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

  // ── Load alerts once both IDs are ready ───────────────────────────────────
  useEffect(() => {
    if (currentOrgId && linkedTechId) loadMyAlerts()
  }, [currentOrgId, linkedTechId])

  const loadMyAlerts = async () => {
    if (!currentOrgId || !linkedTechId) return
    setLoading(true)
    try {
      // 1. All pending jobs assigned to this technician
      const { data: pendingJobs } = await supabase
        .from("technician_jobs")
        .select("*")
        .eq("org_id", currentOrgId)
        .eq("technician_id", linkedTechId)
        .eq("status", "pending")

      // 2. Recent completed jobs for history (last 20)
      const { data: completedJobs } = await supabase
        .from("technician_jobs")
        .select("id, title, customer_id, contract_id, assigned_date, notes")
        .eq("org_id", currentOrgId)
        .eq("technician_id", linkedTechId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20)

      if (!pendingJobs?.length && !completedJobs?.length) {
        setOverdueAlerts([])
        setDueTodayAlerts([])
        setUpcomingAlerts([])
        setCompletedRecords([])
        setLoading(false)
        return
      }

      // 3. Collect unique IDs to batch-fetch
      const allJobs = [...(pendingJobs ?? []), ...(completedJobs ?? [])]
      const contractIds = [...new Set(allJobs.map(j => j.contract_id).filter(Boolean))]
      const customerIds = [...new Set(allJobs.map(j => j.customer_id).filter(Boolean))]

      const [{ data: contractsData }, { data: customersData }] = await Promise.all([
        supabase.from("contracts").select("*").in("id", contractIds).eq("org_id", currentOrgId),
        supabase.from("customers").select("id, name, phone").in("id", customerIds).eq("org_id", currentOrgId),
      ])

      // 4. Build alert list from pending jobs
      const overdue: TechnicianAlert[]  = []
      const dueToday: TechnicianAlert[] = []
      const upcoming: TechnicianAlert[] = []

      for (const job of pendingJobs ?? []) {
        const contract = contractsData?.find(c => c.id === job.contract_id)
        const customer = customersData?.find(c => c.id === job.customer_id)
        if (!contract) continue

        const days = getDaysUntilService(contract.next_service_date)
        const alert: TechnicianAlert = {
          jobId: job.id,
          contractId: contract.id,
          customer: customer?.name ?? "Unknown Customer",
          customerPhone: customer?.phone ?? "",
          contractName: contract.contract_name,
          serviceType: contract.service_type ?? "Service",
          nextServiceDate: contract.next_service_date,
          daysUntilService: days,
          contractData: contract,
          location: contract.location ?? "",
        }

        if (days < 0)       overdue.push({ ...alert, daysOverdue: Math.abs(days) })
        else if (days === 0) dueToday.push(alert)
        else                 upcoming.push(alert)
      }

      // Sort upcoming by nearest date first
      upcoming.sort((a, b) => a.daysUntilService - b.daysUntilService)

      setOverdueAlerts(overdue)
      setDueTodayAlerts(dueToday)
      setUpcomingAlerts(upcoming)

      // 5. Build history list from completed jobs
      const history: CompletedRecord[] = (completedJobs ?? []).map(job => {
        const customer = customersData?.find(c => c.id === job.customer_id)
        return {
          id: job.id,
          contractName: job.title ?? "—",
          customer: customer?.name ?? "Unknown",
          serviceDate: job.assigned_date ?? "—",
          notes: job.notes ?? null,
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

  // ── Mark complete ──────────────────────────────────────────────────────────
  const handleMarkComplete = (alert: TechnicianAlert) => {
    setSelectedAlert(alert)
    setModalOpen(true)
  }

  // ── After modal success: reload + WhatsApp ─────────────────────────────────
  const handleModalSuccess = async () => {
    await loadMyAlerts()
    if (!selectedAlert?.customerPhone) return

    const phone = normalizePhone(selectedAlert.customerPhone)
    const message = buildCompletionMessage(
      selectedAlert.customer,
      selectedAlert.contractName,
      linkedTechName,
    )
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    toast.success("Service marked complete!", {
      description: `Tap below to notify ${selectedAlert.customer} via WhatsApp.`,
      action: {
        label: "Send WhatsApp",
        onClick: () => window.open(waUrl, "_blank"),
      },
      duration: 10000,
    })
  }

  // ── Reminder WhatsApp ──────────────────────────────────────────────────────
  const handleWhatsApp = (alert: TechnicianAlert) => {
    if (!alert.customerPhone) return
    const phone = normalizePhone(alert.customerPhone)
    const daysText =
      alert.daysUntilService < 0
        ? `was due ${Math.abs(alert.daysUntilService)} day${Math.abs(alert.daysUntilService) !== 1 ? "s" : ""} ago`
        : alert.daysUntilService === 0
        ? "is due today"
        : `is coming up on ${formatDateShort(alert.nextServiceDate)}`

    const message =
      `Dear ${alert.customer},\n\n` +
      `This is a reminder that your *${alert.contractName}* service ${daysText}.\n\n` +
      `Our technician *${linkedTechName}* will be visiting you. Please ensure someone is available at the premises.\n\n` +
      `Thank you.`

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
  }

  // ── Not linked ─────────────────────────────────────────────────────────────
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

  const totalPending = overdueAlerts.length + dueTodayAlerts.length + upcomingAlerts.length

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:gap-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">My Service Alerts</h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            {loading
              ? "Loading..."
              : `${totalPending} service${totalPending !== 1 ? "s" : ""} pending${linkedTechName ? ` · ${linkedTechName}` : ""}`}
          </p>
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
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
          <div className="rounded-lg border-l-4 border-l-alert-upcoming bg-alert-upcoming/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="size-3.5 text-alert-upcoming shrink-0" />
              <p className="text-[11px] text-muted-foreground">Upcoming</p>
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : upcomingAlerts.length}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overdue" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overdue" className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="size-2 rounded-full bg-alert-overdue shrink-0" />
              <span className="hidden sm:inline">Overdue </span>
              <span>({overdueAlerts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="size-2 rounded-full bg-alert-due-today shrink-0" />
              Today ({dueTodayAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="size-2 rounded-full bg-alert-upcoming shrink-0" />
              <span className="hidden sm:inline">Upcoming </span>
              <span>({upcomingAlerts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">Done</span>
            </TabsTrigger>
          </TabsList>

          {/* Overdue */}
          <TabsContent value="overdue" className="mt-4">
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
              ) : overdueAlerts.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="size-5 text-muted-foreground" />} label="No overdue services" />
              ) : (
                overdueAlerts.map(a => (
                  <TechnicianAlertCard key={a.jobId} alert={a} variant="overdue"
                    onMarkComplete={handleMarkComplete} onWhatsApp={handleWhatsApp} />
                ))
              )}
            </div>
          </TabsContent>

          {/* Today */}
          <TabsContent value="today" className="mt-4">
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
              ) : dueTodayAlerts.length === 0 ? (
                <EmptyState icon={<CalendarClock className="size-5 text-muted-foreground" />} label="No services due today" />
              ) : (
                dueTodayAlerts.map(a => (
                  <TechnicianAlertCard key={a.jobId} alert={a} variant="due-today"
                    onMarkComplete={handleMarkComplete} onWhatsApp={handleWhatsApp} />
                ))
              )}
            </div>
          </TabsContent>

          {/* Upcoming */}
          <TabsContent value="upcoming" className="mt-4">
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
              ) : upcomingAlerts.length === 0 ? (
                <EmptyState icon={<Clock className="size-5 text-muted-foreground" />} label="No upcoming services" />
              ) : (
                upcomingAlerts.map(a => (
                  <TechnicianAlertCard key={a.jobId} alert={a} variant="upcoming"
                    onMarkComplete={handleMarkComplete} onWhatsApp={handleWhatsApp} />
                ))
              )}
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
            ) : completedRecords.length === 0 ? (
              <EmptyState icon={<History className="size-5 text-muted-foreground" />} label="No completed services yet" />
            ) : (
              <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
                {completedRecords.map(record => (
                  <div key={record.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="flex size-2.5 rounded-full bg-alert-success mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{record.customer}</p>
                        <p className="text-xs text-muted-foreground shrink-0">{formatDateShort(record.serviceDate)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{record.contractName}</p>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">"{record.notes}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Mark Complete Modal ── */}
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
