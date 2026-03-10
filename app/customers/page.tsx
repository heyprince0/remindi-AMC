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
import { Plus, Search, MoreHorizontal, Eye, Edit, Phone, MapPin, FileText } from "lucide-react"

const customers = [
  {
    id: 1,
    name: "TechCorp Industries",
    contact: "+91 98765 43210",
    email: "contact@techcorp.com",
    address: "123 Tech Park, Sector 12, Mumbai",
    totalContracts: 3,
    status: "active",
  },
  {
    id: 2,
    name: "Global Solutions Ltd",
    contact: "+91 98765 43211",
    email: "info@globalsolutions.com",
    address: "456 Business Hub, Bangalore",
    totalContracts: 2,
    status: "active",
  },
  {
    id: 3,
    name: "Prime Enterprises",
    contact: "+91 98765 43212",
    email: "admin@primeent.com",
    address: "789 Commerce Tower, Delhi",
    totalContracts: 4,
    status: "active",
  },
  {
    id: 4,
    name: "Metro Office Complex",
    contact: "+91 98765 43213",
    email: "facilities@metrooffice.com",
    address: "101 Metro Plaza, Chennai",
    totalContracts: 5,
    status: "active",
  },
  {
    id: 5,
    name: "Sunrise Tower",
    contact: "+91 98765 43214",
    email: "manager@sunrisetower.com",
    address: "202 Sunrise Avenue, Hyderabad",
    totalContracts: 2,
    status: "active",
  },
  {
    id: 6,
    name: "DataTech Inc",
    contact: "+91 98765 43215",
    email: "ops@datatech.com",
    address: "303 Data Center Road, Pune",
    totalContracts: 3,
    status: "active",
  },
  {
    id: 7,
    name: "Green Valley Apartments",
    contact: "+91 98765 43216",
    email: "admin@greenvalley.com",
    address: "404 Green Valley, Kolkata",
    totalContracts: 1,
    status: "new",
  },
  {
    id: 8,
    name: "CloudNet Solutions",
    contact: "+91 98765 43217",
    email: "support@cloudnet.com",
    address: "505 Cloud Campus, Noida",
    totalContracts: 2,
    status: "active",
  },
]

export default function CustomersPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their contact information</p>
          </div>
          <Button>
            <Plus className="mr-2 size-4" />
            Add Customer
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customers by name, email, or phone..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <span className="text-lg font-semibold text-primary">
                        {customer.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      <CardDescription className="text-xs">{customer.email}</CardDescription>
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
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 size-4" />
                        Edit Customer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-4" />
                  <span>{customer.contact}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{customer.address}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{customer.totalContracts}</span>
                    <span className="text-muted-foreground">contracts</span>
                  </div>
                  {customer.status === "new" && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">New</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
