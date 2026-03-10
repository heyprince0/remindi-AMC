"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Download, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react"

const serviceHistory = [
  {
    id: 1,
    customer: "TechCorp Industries",
    contract: "Annual AC Maintenance",
    serviceType: "AC",
    technician: "Mike Johnson",
    serviceDate: "2026-03-08",
    completedTime: "11:30 AM",
    status: "completed",
    notes: "Replaced air filter, cleaned condenser coils",
  },
  {
    id: 2,
    customer: "Global Solutions Ltd",
    contract: "CCTV System Maintenance",
    serviceType: "CCTV",
    technician: "Sarah Smith",
    serviceDate: "2026-03-07",
    completedTime: "3:45 PM",
    status: "completed",
    notes: "All cameras operational, adjusted angles on 2 units",
  },
  {
    id: 3,
    customer: "Metro Office Complex",
    contract: "Fire Safety System",
    serviceType: "Fire Safety",
    technician: "Emily Brown",
    serviceDate: "2026-03-06",
    completedTime: "2:00 PM",
    status: "completed",
    notes: "Fire extinguisher check complete, replaced 3 units",
  },
  {
    id: 4,
    customer: "Prime Enterprises",
    contract: "Elevator Service Agreement",
    serviceType: "Lift",
    technician: "John Davis",
    serviceDate: "2026-03-05",
    completedTime: "4:30 PM",
    status: "completed",
    notes: "Routine maintenance, lubrication of components",
  },
  {
    id: 5,
    customer: "Sunrise Tower",
    contract: "HVAC Maintenance",
    serviceType: "AC",
    technician: "Mike Johnson",
    serviceDate: "2026-03-04",
    completedTime: "1:15 PM",
    status: "completed",
    notes: "Repaired compressor issue, system now operational",
  },
  {
    id: 6,
    customer: "DataTech Inc",
    contract: "Security System Check",
    serviceType: "CCTV",
    technician: "Sarah Smith",
    serviceDate: "2026-03-03",
    completedTime: "10:00 AM",
    status: "completed",
    notes: "Updated firmware on all cameras",
  },
  {
    id: 7,
    customer: "Green Valley Apartments",
    contract: "Generator Maintenance",
    serviceType: "Generator",
    technician: "Robert Wilson",
    serviceDate: "2026-03-02",
    completedTime: "5:00 PM",
    status: "partial",
    notes: "Generator tested, awaiting parts for full repair",
  },
  {
    id: 8,
    customer: "CloudNet Solutions",
    contract: "UPS System Service",
    serviceType: "UPS",
    technician: "Robert Wilson",
    serviceDate: "2026-03-01",
    completedTime: "11:00 AM",
    status: "completed",
    notes: "Battery replacement completed, system tested",
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">
          <CheckCircle2 className="mr-1 size-3" />
          Completed
        </Badge>
      )
    case "partial":
      return (
        <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">
          <Clock className="mr-1 size-3" />
          Partial
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">
          <XCircle className="mr-1 size-3" />
          Cancelled
        </Badge>
      )
    default:
      return null
  }
}

export default function ServiceHistoryPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service History</h1>
            <p className="text-muted-foreground">View completed services and maintenance records</p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by customer, technician, or service type..."
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Service Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="cctv">CCTV</SelectItem>
                    <SelectItem value="lift">Lift</SelectItem>
                    <SelectItem value="fire-safety">Fire Safety</SelectItem>
                    <SelectItem value="generator">Generator</SelectItem>
                    <SelectItem value="ups">UPS</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="this-month">
                  <SelectTrigger className="w-[160px]">
                    <Calendar className="mr-2 size-4" />
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This Week</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Service Records</CardTitle>
            <CardDescription>
              Showing {serviceHistory.length} records from this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="max-w-[200px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.customer}</TableCell>
                    <TableCell>{record.contract}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {record.serviceType}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.technician}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{record.serviceDate}</span>
                        <span className="text-xs text-muted-foreground">{record.completedTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {record.notes}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
