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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, MoreHorizontal, Eye, Edit, Filter } from "lucide-react"

const contracts = [
  {
    id: 1,
    name: "Annual AC Maintenance",
    customer: "TechCorp Industries",
    serviceType: "AC",
    frequency: "Monthly",
    startDate: "2025-01-15",
    nextService: "2026-03-15",
    status: "active",
  },
  {
    id: 2,
    name: "CCTV System Maintenance",
    customer: "Global Solutions Ltd",
    serviceType: "CCTV",
    frequency: "Quarterly",
    startDate: "2025-03-01",
    nextService: "2026-03-10",
    status: "active",
  },
  {
    id: 3,
    name: "Elevator Service Agreement",
    customer: "Prime Enterprises",
    serviceType: "Lift",
    frequency: "Monthly",
    startDate: "2024-06-10",
    nextService: "2026-03-11",
    status: "active",
  },
  {
    id: 4,
    name: "Fire Safety System",
    customer: "Metro Office Complex",
    serviceType: "Fire Safety",
    frequency: "Quarterly",
    startDate: "2025-02-20",
    nextService: "2026-03-20",
    status: "active",
  },
  {
    id: 5,
    name: "HVAC Maintenance",
    customer: "Sunrise Tower",
    serviceType: "AC",
    frequency: "Monthly",
    startDate: "2024-11-01",
    nextService: "2026-03-08",
    status: "overdue",
  },
  {
    id: 6,
    name: "Security System Check",
    customer: "DataTech Inc",
    serviceType: "CCTV",
    frequency: "Monthly",
    startDate: "2025-01-05",
    nextService: "2026-04-05",
    status: "active",
  },
  {
    id: 7,
    name: "Generator Maintenance",
    customer: "Green Valley Apartments",
    serviceType: "Generator",
    frequency: "Quarterly",
    startDate: "2024-09-15",
    nextService: "2026-03-15",
    status: "active",
  },
  {
    id: 8,
    name: "UPS System Service",
    customer: "CloudNet Solutions",
    serviceType: "UPS",
    frequency: "Monthly",
    startDate: "2025-02-01",
    nextService: "2026-03-01",
    status: "expiring",
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Active</Badge>
    case "overdue":
      return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Overdue</Badge>
    case "expiring":
      return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Expiring Soon</Badge>
    default:
      return null
  }
}

function getServiceTypeBadge(type: string) {
  return (
    <Badge variant="outline" className="font-normal">
      {type}
    </Badge>
  )
}

export default function ContractsPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
            <p className="text-muted-foreground">Manage your AMC contracts and service agreements</p>
          </div>
          <Button>
            <Plus className="mr-2 size-4" />
            Add Contract
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
                  placeholder="Search contracts..."
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
                <Select defaultValue="all">
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="expiring">Expiring Soon</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Filter className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Contracts</CardTitle>
            <CardDescription>
              You have {contracts.length} contracts in total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Next Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell>{contract.customer}</TableCell>
                    <TableCell>{getServiceTypeBadge(contract.serviceType)}</TableCell>
                    <TableCell>{contract.frequency}</TableCell>
                    <TableCell>{contract.startDate}</TableCell>
                    <TableCell>{contract.nextService}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 size-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 size-4" />
                            Edit Contract
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
