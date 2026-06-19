"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase, type Contract, type Customer, type Technician, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, UserPlus } from "lucide-react"
import { MarkCompleteModal } from "@/components/mark-complete-modal"

interface ServiceAlert {
  id: string
  customer: string
  contract: string
  serviceType: string
  dueDate: string
  daysOverdue?: number
  time?: string
  technician: string | null
  contractData?: Contract
}

function ServiceAlertCard({ service, variant, onMarkComplete }: { service: ServiceAlert; variant: "expired" | "today-servicing" | "expiring-soon"; onMarkComplete: (contract: Contract) => void }) {
  const borderColor = {
    expired: "border-l-alert-overdue",
    "today-servicing": "border-l-alert-due-today",
    "expiring-soon": "border-l-alert-upcoming",
  }[variant]

  const bgColor = {
    expired: "bg-alert-overdue/5",
    "today-servicing": "bg-alert-due-today/5",
    "expiring-soon": "bg-alert-upcoming/5",
  }[variant]

  // Get status label for display
  const getStatusDisplay = () => {
    switch(variant) {
      case "expired": return "Expired"
      case "today-servicing": return "Today Servicing"
      case "expiring-soon": return "Expiring Soon"
      default: return ""
    }
  }

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
              <Badge className={`text-xs ${
                variant === "expired" ? "bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20" :
                variant === "today-servicing" ? "bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20" :
                "bg-alert-upcoming/10 text-alert-upcoming border-alert-upcoming/20"
              }`}>
                {getStatusDisplay()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{service.contract}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" />
                <span>
                  {variant === "expired"
                    ? `${service.daysOverdue} days expired`
                    : variant === "today-servicing"
                    ? `Today`
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
  const [expiredServices, setExpiredServices] = useState<ServiceAlert[]>([])
  const [todayServicingServices, setTodayServicingServices] = useState<ServiceAlert[]>([])
  const [expiringSoonServices, setExpiringSoonServices] = useState<ServiceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  const loadServices = async () => {
    try {
      if (!user?.id) return

      const { data: contractsData } = await supabase.from('contracts').select('*').eq('user_id', user.id)
      const { data: customersData } = await supabase.from('customers').select('*').eq('user_id', user.id)

      const expired: ServiceAlert[] = []
      const todayServicing: ServiceAlert[] = []
      const expiringSoon: ServiceAlert[] = []

      for (const contract of (contractsData as Contract[]) || []) {
        const customer = (customersData as Customer[])?.find(c => c.id === contract.customer_id)
        const days = getDaysUntilService(contract.next_service_date)

        const alert: ServiceAlert = {
          id: contract.id,
          customer: customer?.name || 'Unknown',
          contract: contract.contract_name,
          serviceType: contract.service_type,
          dueDate: contract.next_service_date,
          technician: null,
          contractData: contract
        }

        if (days < 0) {
          expired.push({ ...alert, daysOverdue: Math.abs(days) })
        } else if (days === 0) {
          todayServicing.push(alert)
        } else if (days <= 3) {
          expiringSoon.push(alert)
        }
      }

      setExpiredServices(expired)
      setTodayServicingServices(todayServicing)
      setExpiringSoonServices(expiringSoon)
    } catch (error) {
      console.error('Error loading service alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [user?.id])

  const handleMarkComplete = (contract: Contract) => {
    setSelectedContract(contract)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    loadServices()
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service Alerts</h1>
            <p className="text-muted-foreground">Monitor and manage expired, today servicing, and expiring soon services</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-alert-overdue bg-alert-overdue/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-alert-overdue" />
                Expired Services
              </CardDescription>
              <CardTitle className="text-3xl">{expiredServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-alert-due-today bg-alert-due-today/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CalendarClock className="size-4 text-alert-due-today" />
                Today Servicing
              </CardDescription>
              <CardTitle className="text-3xl">{todayServicingServices.length}</CardTitle>
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
              <CardTitle className="text-3xl">{expiringSoonServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming up in next 3 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Service Categories */}
        <Tabs defaultValue="expired" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="expired" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-overdue" />
              Expired ({expiredServices.length})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-due-today" />
              Today Servicing ({todayServicingServices.length})
            </TabsTrigger>
            <TabsTrigger value="expiring" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-upcoming" />
              Expiring Soon ({expiringSoonServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expired" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : expiredServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No expired services</div>
              ) : (
                expiredServices.map((service) => (
                  <ServiceAlertCard key={service.id} service={service} variant="expired" onMarkComplete={handleMarkComplete} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="today" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : todayServicingServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No services due today</div>
              ) : (
                todayServicingServices.map((service) => (
                  <ServiceAlertCard key={service.id} service={service} variant="today-servicing" onMarkComplete={handleMarkComplete} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="expiring" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : expiringSoonServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No services expiring soon</div>
              ) : (
                expiringSoonServices.map((service) => (
                  <ServiceAlertCard key={service.id} service={service} variant="expiring-soon" onMarkComplete={handleMarkComplete} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Mark Complete Modal */}
        {user && (
          <MarkCompleteModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            contract={selectedContract}
            userId={user.id}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
