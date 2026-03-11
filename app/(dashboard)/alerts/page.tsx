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

interface ServiceAlert {
  id: string
  customer: string
  contract: string
  serviceType: string
  dueDate: string
  daysOverdue?: number
  time?: string
  technician: string | null
}

function ServiceAlertCard({ service, variant }: { service: ServiceAlert; variant: "overdue" | "due-today" | "upcoming" }) {
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
                    ? `${service.daysOverdue} days overdue`
                    : variant === "due-today"
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
            <Button variant="outline" size="sm">
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

  useEffect(() => {
    const loadServices = async () => {
      try {
        if (!user?.id) return

        const { data: contractsData } = await supabase.from('contracts').select('*').eq('user_id', user.id)
        const { data: customersData } = await supabase.from('customers').select('*').eq('user_id', user.id)

        const overdue: ServiceAlert[] = []
        const dueToday: ServiceAlert[] = []
        const upcoming: ServiceAlert[] = []

        for (const contract of (contractsData as Contract[]) || []) {
          const customer = (customersData as Customer[])?.find(c => c.id === contract.customer_id)
          const days = getDaysUntilService(contract.next_service_date)

          const alert: ServiceAlert = {
            id: contract.id,
            customer: customer?.name || 'Unknown',
            contract: contract.contract_name,
            serviceType: contract.service_type,
            dueDate: contract.next_service_date,
            technician: null
          }

          if (days < 0) {
            overdue.push({ ...alert, daysOverdue: Math.abs(days) })
          } else if (days === 0) {
            dueToday.push(alert)
          } else if (days <= 7) {
            upcoming.push(alert)
          }
        }

        setOverdueServices(overdue)
        setDueTodayServices(dueToday)
        setUpcomingServices(upcoming)
      } catch (error) {
        console.error('Error loading service alerts:', error)
      } finally {
        setLoading(false)
      }
    }

    loadServices()
  }, [user?.id])

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service Alerts</h1>
            <p className="text-muted-foreground">Monitor and manage upcoming and overdue services</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-alert-overdue bg-alert-overdue/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-alert-overdue" />
                Overdue Services
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
                Upcoming This Week
              </CardDescription>
              <CardTitle className="text-3xl">{upcomingServices.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coming up soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Service Categories */}
        <Tabs defaultValue="overdue" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overdue" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-overdue" />
              Overdue ({overdueServices.length})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-due-today" />
              Today ({dueTodayServices.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-alert-upcoming" />
              Upcoming ({upcomingServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : overdueServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No overdue services</div>
              ) : (
                overdueServices.map((service) => (
                  <ServiceAlertCard key={service.id} service={service} variant="overdue" />
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
                  <ServiceAlertCard key={service.id} service={service} variant="due-today" />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : upcomingServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No upcoming services this week</div>
              ) : (
                upcomingServices.map((service) => (
                  <ServiceAlertCard key={service.id} service={service} variant="upcoming" />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
