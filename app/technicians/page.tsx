"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Eye, Edit, Phone, Briefcase } from "lucide-react"

const technicians = [
  {
    id: 1,
    name: "Mike Johnson",
    phone: "+91 98765 11111",
    email: "mike.j@anthora.com",
    specialization: ["AC", "HVAC"],
    assignedJobs: 5,
    completedThisMonth: 12,
    status: "available",
  },
  {
    id: 2,
    name: "Sarah Smith",
    phone: "+91 98765 22222",
    email: "sarah.s@anthora.com",
    specialization: ["CCTV", "Security Systems"],
    assignedJobs: 3,
    completedThisMonth: 8,
    status: "busy",
  },
  {
    id: 3,
    name: "John Davis",
    phone: "+91 98765 33333",
    email: "john.d@anthora.com",
    specialization: ["Lift", "Elevator"],
    assignedJobs: 4,
    completedThisMonth: 10,
    status: "available",
  },
  {
    id: 4,
    name: "Emily Brown",
    phone: "+91 98765 44444",
    email: "emily.b@anthora.com",
    specialization: ["Fire Safety"],
    assignedJobs: 2,
    completedThisMonth: 6,
    status: "available",
  },
  {
    id: 5,
    name: "Robert Wilson",
    phone: "+91 98765 55555",
    email: "robert.w@anthora.com",
    specialization: ["Generator", "UPS"],
    assignedJobs: 6,
    completedThisMonth: 15,
    status: "busy",
  },
  {
    id: 6,
    name: "Amanda Lee",
    phone: "+91 98765 66666",
    email: "amanda.l@anthora.com",
    specialization: ["AC", "Electrical"],
    assignedJobs: 4,
    completedThisMonth: 11,
    status: "available",
  },
  {
    id: 7,
    name: "David Chen",
    phone: "+91 98765 77777",
    email: "david.c@anthora.com",
    specialization: ["CCTV", "Networking"],
    assignedJobs: 3,
    completedThisMonth: 9,
    status: "on-leave",
  },
  {
    id: 8,
    name: "Lisa Taylor",
    phone: "+91 98765 88888",
    email: "lisa.t@anthora.com",
    specialization: ["Fire Safety", "Security Systems"],
    assignedJobs: 5,
    completedThisMonth: 13,
    status: "busy",
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case "available":
      return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Available</Badge>
    case "busy":
      return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Busy</Badge>
    case "on-leave":
      return <Badge className="bg-muted text-muted-foreground border-muted">On Leave</Badge>
    default:
      return null
  }
}

export default function TechniciansPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Technicians</h1>
            <p className="text-muted-foreground">Manage your service technicians and their assignments</p>
          </div>
          <Button>
            <Plus className="mr-2 size-4" />
            Add Technician
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search technicians by name or specialization..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Technicians Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {technicians.map((tech) => (
            <Card key={tech.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span className="text-sm font-semibold">
                        {tech.name.split(" ").map((n) => n[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-base">{tech.name}</CardTitle>
                      <CardDescription className="text-xs">{tech.email}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 size-4" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 size-4" />
                        Edit Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-4" />
                  <span>{tech.phone}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tech.specialization.map((spec) => (
                    <Badge key={spec} variant="outline" className="text-xs font-normal">
                      {spec}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="size-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{tech.assignedJobs}</span>
                    <span className="text-muted-foreground">jobs</span>
                  </div>
                  {getStatusBadge(tech.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
