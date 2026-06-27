"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase, type Contract, type Customer, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, Mail, Loader2 } from "lucide-react"
import { MarkCompleteModal } from "@/components/mark-complete-modal"
import { toast } from "sonner"
import {
  triggerServiceReminderEmail,
  triggerAMCExpiryReminderEmail,
  triggerAMCExpiredEmail,
} from "@/lib/email-actions"

interface ServiceAlert {
  id: string
  customer: string
  contract: string
  serviceType: string
  dueDate: string
  daysOverdue?: number
  technician: string | null
  contractData?: Contract
}

function ServiceAlertCard({
  service,
  variant,
  onMarkComplete,
  onSendEmail,
  sendingEmail,
}: {
  service: ServiceAlert
  variant: "overdue" | "due-today" | "upcoming"
  onMarkComplete: (contract: Contract) => void
  onSendEmail: (service: ServiceAlert) => void
  sendingEmail: boolean
}) {
  const borderColor = {
    overdue: "border-l-alert-overdue",
    "due-today": "border-l-alert-due-today",
    upcoming: "border-l-alert-upcoming",
  }[variant]

  const bgColor = {
    overdue: "bg-alert-overdue/5",
    "due-today": "bg-alert-due-today/5",
    upcoming: "bg-alert-upcoming/5",
  }[variant]

  const emailLabel = {
    overdue: "Send Expired Alert",
    "due-today": "Send Reminder",
    upcoming: "Send Expiry Warning",
  }[variant]

  return (
    <Card className={`border-l-4 ${borderColor} ${bgColor}`}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-card-foreground">{service.customer}</h3>
              <Badge variant="outline" className="text-xs font-normal">
                {service.serviceType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{service.contract}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" />
                <span>
                  {variant === "overdue"
                    ? `${service.daysOverdue} days expired`
                    : variant === "due-today"
                    ? "Today"
                    : service.dueDate}
                </span>
              </div>
              {service.technician && (
                <div className="flex items-center gap-1.5">
                  <span>Assigned to:</span>
                  <span className="font-medium text-foreground">{service.technician}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendEmail(service)}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Mail className="mr-2 size-4" />
              )}
              {emailLabel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => service.contractData && onMarkComplete(service.contractData)}
            >
              <CheckCircle2 className="mr-2 size-4" />
              Mark Complete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ServiceAlertsPage() {
  const { user } = useAuth()
  const [overdueServices, setOverdueServices] = useState<ServiceAlert[]>([])
  const [dueTodayServices, setDueTodayServices] = useState<ServiceAlert[]>([])
  const [upcomingServices, setUpcomingServices] = useState<ServiceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to fetch organization:", error)
            toast.error("Could not determine your organization")
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId) loadServices()
  }, [currentOrgId])

  const loadServices = async () => {
    try {
      if (!currentOrgId) return

      const { data: contractsData } = await supabase
        .from("contracts")
        .select("*")
        .eq("org_id", currentOrgId)

      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("org_id", currentOrgId)

      const overdue: ServiceAlert[] = []
      const dueToday: ServiceAlert[] = []
      const upcoming: ServiceAlert[] = []

      for (const contract of (contractsData as Contract[]) || []) {
        const customer = (customersData as Customer[])?.find((c) => c.id === contract.customer_id)
        const days = getDaysUntilService(contract.next_service_date)

        const alert: ServiceAlert = {
          id: contract.id,
          customer: customer?.name || "Unknown",
          contract: contract.contract_name,
          serviceType: contract.service_type || "Service",
          dueDate: contract.next_service_date,
          technician: null,
          contractData: contract,
        }

        if (days < 0) overdue.push({ ...alert, daysOverdue: Math.abs(days) })
        else if (days === 0) dueToday.push(alert)
        else if (days <= 7) upcoming.push(alert)
      }

      setOverdueServices(overdue)
      setDueTodayServices(dueToday)
      setUpcomingServices(upcoming)
    } catch (error) {
      console.error("Error loading service alerts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkComplete = (contract: Contract) => {
    setSelectedContract(contract)
    setModalOpen(true)
  }

  const handleModalSuccess = () => loadServices()

  const handleSendEmail = async (
    service: ServiceAlert,
    variant: "overdue" | "due-today" | "upcoming"
  ) => {
    if (!user?.email) {
      toast.error("Your account email is not available")
      return
    }

    setSendingEmailId(service.id)
    try {
      let result

      if (variant === "overdue") {
        result = await triggerAMCExpiredEmail(
          user.email,
          service.contract,
          service.dueDate,
          service.customer
        )
      } else if (variant === "due-today") {
        result = await triggerServiceReminderEmail(
          user.email,
          service.contract,
          service.dueDate,
          service.customer
        )
      } else {
        result = await triggerAMCExpiryReminderEmail(
          user.email,
          service.contract,
          service.dueDate,
          service.customer
        )
      }

      if (result.success) {
        toast.success(`Email sent for ${service.contract}`)
      } else {
        toast.error(`Failed to send email: ${result.error}`)
      }
    } catch (error) {
      toast.error("Something went wrong sending the email")
    } finally {
      setSendingEmailId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service Alerts</h1>
            <p className="text-muted-foreground">Monitor and manage upcoming and overdue services</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-alert-overdue bg-alert-overdue/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-alert-overdue" />
                Expired Services
              </CardDescription>
              <CardTitle className="text-3xl">{overdueServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-alert-due-today bg-alert-due-today/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CalendarClock className="size-4 text-alert-due-today" />
                Due Today
              </CardDescription>
              <CardTitle className="text-3xl">{dueTodayServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Scheduled for today</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-alert-upcoming bg-alert-upcoming/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="size-4 text-alert-upcoming" />
                Expiring Soon
              </CardDescription>
              <CardTitle className="text-3xl">{upcomingServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming up soon</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overdue" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="overdue" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-overdue" />
              Expired ({overdueServices.length})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-due-today" />
              Today ({dueTodayServices.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-upcoming" />
              Expiring Soon ({upcomingServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : overdueServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No expired services</div>
              ) : (
                overdueServices.map((service) => (
                  <ServiceAlertCard
                    key={service.id}
                    service={service}
                    variant="overdue"
                    onMarkComplete={handleMarkComplete}
                    onSendEmail={(s) => handleSendEmail(s, "overdue")}
                    sendingEmail={sendingEmailId === service.id}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="today" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : dueTodayServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No services due today</div>
              ) : (
                dueTodayServices.map((service) => (
                  <ServiceAlertCard
                    key={service.id}
                    service={service}
                    variant="due-today"
                    onMarkComplete={handleMarkComplete}
                    onSendEmail={(s) => handleSendEmail(s, "due-today")}
                    sendingEmail={sendingEmailId === service.id}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : upcomingServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No services expiring soon</div>
              ) : (
                upcomingServices.map((service) => (
                  <ServiceAlertCard
                    key={service.id}
                    service={service}
                    variant="upcoming"
                    onMarkComplete={handleMarkComplete}
                    onSendEmail={(s) => handleSendEmail(s, "upcoming")}
                    sendingEmail={sendingEmailId === service.id}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {user && currentOrgId && (
          <MarkCompleteModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            contract={selectedContract}
            userId={user.id}
            orgId={currentOrgId}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
