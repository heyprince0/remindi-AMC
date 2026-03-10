"use client"

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
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, UserPlus } from "lucide-react"

const overdueServices = [
  {
    id: 1,
    customer: "Sunrise Tower",
    contract: "HVAC Maintenance",
    serviceType: "AC",
    dueDate: "2026-03-08",
    daysOverdue: 2,
    technician: null,
  },
  {
    id: 2,
    customer: "DataTech Inc",
    contract: "UPS System Service",
    serviceType: "UPS",
    dueDate: "2026-03-07",
    daysOverdue: 3,
    technician: null,
  },
  {
    id: 3,
    customer: "Prime Enterprises",
    contract: "Generator Check",
    serviceType: "Generator",
    dueDate: "2026-03-05",
    daysOverdue: 5,
    technician: "Robert Wilson",
  },
]

const dueTodayServices = [
  {
    id: 4,
    customer: "TechCorp Industries",
    contract: "Annual AC Maintenance",
    serviceType: "AC",
    dueDate: "2026-03-10",
    time: "10:00 AM",
    technician: "Mike Johnson",
  },
  {
    id: 5,
    customer: "Global Solutions Ltd",
    contract: "CCTV System Maintenance",
    serviceType: "CCTV",
    dueDate: "2026-03-10",
    time: "2:00 PM",
    technician: "Sarah Smith",
  },
  {
    id: 6,
    customer: "Metro Office Complex",
    contract: "Fire Safety System",
    serviceType: "Fire Safety",
    dueDate: "2026-03-10",
    time: "4:00 PM",
    technician: null,
  },
]

const upcomingServices = [
  {
    id: 7,
    customer: "Prime Enterprises",
    contract: "Elevator Service Agreement",
    serviceType: "Lift",
    dueDate: "2026-03-11",
    technician: "John Davis",
  },
  {
    id: 8,
    customer: "Green Valley Apartments",
    contract: "Generator Maintenance",
    serviceType: "Generator",
    dueDate: "2026-03-15",
    technician: "Robert Wilson",
  },
  {
    id: 9,
    customer: "CloudNet Solutions",
    contract: "UPS System Service",
    serviceType: "UPS",
    dueDate: "2026-03-15",
    technician: null,
  },
  {
    id: 10,
    customer: "TechCorp Industries",
    contract: "Annual AC Maintenance",
    serviceType: "AC",
    dueDate: "2026-03-15",
    technician: "Mike Johnson",
  },
]

const technicians = [
  { id: 1, name: "Mike Johnson", status: "available" },
  { id: 2, name: "Sarah Smith", status: "busy" },
  { id: 3, name: "John Davis", status: "available" },
  { id: 4, name: "Emily Brown", status: "available" },
  { id: 5, name: "Robert Wilson", status: "busy" },
  { id: 6, name: "Amanda Lee", status: "available" },
]

interface ServiceAlertCardProps {
  service: {
    id: number
    customer: string
    contract: string
    serviceType: string
    dueDate: string
    daysOverdue?: number
    time?: string
    technician: string | null
  }
  variant: "overdue" | "due-today" | "upcoming"
}

function ServiceAlertCard({ service, variant }: ServiceAlertCardProps) {
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
                    ? `Today at ${service.time}`
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
            {!service.technician && (
              <Select>
                <SelectTrigger className="w-[180px]">
                  <UserPlus className="mr-2 size-4" />
                  <SelectValue placeholder="Assign Technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians
                    .filter((t) => t.status === "available")
                    .map((tech) => (
                      <SelectItem key={tech.id} value={tech.name}>
                        {tech.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
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
              {overdueServices.map((service) => (
                <ServiceAlertCard key={service.id} service={service} variant="overdue" />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="today" className="mt-6">
            <div className="flex flex-col gap-4">
              {dueTodayServices.map((service) => (
                <ServiceAlertCard key={service.id} service={service} variant="due-today" />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            <div className="flex flex-col gap-4">
              {upcomingServices.map((service) => (
                <ServiceAlertCard key={service.id} service={service} variant="upcoming" />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
