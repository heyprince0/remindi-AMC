"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Users,
  Wrench,
  CalendarClock,
  CalendarCheck,
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react"

const upcomingServices = [
  {
    id: 1,
    customer: "TechCorp Industries",
    service: "AC Maintenance",
    date: "Today",
    time: "10:00 AM",
    technician: "Mike Johnson",
    status: "due-today",
  },
  {
    id: 2,
    customer: "Global Solutions Ltd",
    service: "CCTV Inspection",
    date: "Today",
    time: "2:00 PM",
    technician: "Sarah Smith",
    status: "due-today",
  },
  {
    id: 3,
    customer: "Prime Enterprises",
    service: "Lift Maintenance",
    date: "Tomorrow",
    time: "9:00 AM",
    technician: "John Davis",
    status: "upcoming",
  },
  {
    id: 4,
    customer: "Metro Office Complex",
    service: "Fire Safety Check",
    date: "Tomorrow",
    time: "11:00 AM",
    technician: "Mike Johnson",
    status: "upcoming",
  },
]

const recentActivity = [
  {
    id: 1,
    action: "Service completed",
    description: "AC Maintenance at Sunrise Tower",
    time: "2 hours ago",
    type: "completed",
  },
  {
    id: 2,
    action: "New contract added",
    description: "Annual CCTV maintenance for DataTech Inc",
    time: "5 hours ago",
    type: "contract",
  },
  {
    id: 3,
    action: "Technician assigned",
    description: "Mike Johnson assigned to Metro Office Complex",
    time: "Yesterday",
    type: "assignment",
  },
  {
    id: 4,
    action: "Customer added",
    description: "New customer: Green Valley Apartments",
    time: "Yesterday",
    type: "customer",
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case "due-today":
      return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Due Today</Badge>
    case "upcoming":
      return <Badge className="bg-alert-upcoming/10 text-alert-upcoming border-alert-upcoming/20">Upcoming</Badge>
    case "overdue":
      return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Overdue</Badge>
    default:
      return null
  }
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here{"'"}s your service overview.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 size-4" />
              Add Customer
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 size-4" />
              Add Technician
            </Button>
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              Add Contract
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Active Contracts"
            value={48}
            icon={FileText}
            description="+3 this month"
          />
          <StatCard
            title="Due Today"
            value={5}
            icon={CalendarClock}
            description="Needs attention"
            iconClassName="bg-alert-due-today/10"
          />
          <StatCard
            title="Due This Week"
            value={12}
            icon={CalendarCheck}
            description="Scheduled"
          />
          <StatCard
            title="Total Customers"
            value={156}
            icon={Users}
            description="+8 this month"
          />
          <StatCard
            title="Technicians"
            value={12}
            icon={Wrench}
            description="8 available"
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Services */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Upcoming Services</CardTitle>
                <CardDescription>Services scheduled for the next few days</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {upcomingServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start justify-between rounded-lg border border-border bg-secondary/30 p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-card-foreground">{service.customer}</span>
                      <span className="text-sm text-muted-foreground">{service.service}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{service.date}, {service.time}</span>
                        <span>•</span>
                        <span>{service.technician}</span>
                      </div>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest updates and actions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 rounded-lg border border-border bg-secondary/30 p-4"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {activity.type === "completed" && <CalendarCheck className="size-5 text-alert-success" />}
                      {activity.type === "contract" && <FileText className="size-5 text-primary" />}
                      {activity.type === "assignment" && <Wrench className="size-5 text-primary" />}
                      {activity.type === "customer" && <Users className="size-5 text-primary" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-card-foreground">{activity.action}</span>
                      <span className="text-sm text-muted-foreground">{activity.description}</span>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
