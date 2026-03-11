"use client"

import { useEffect, useState } from "react"
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
import { supabase, type ServiceHistory, type Contract, type Technician, type Customer } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Search, Download, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react"

interface ServiceRecord extends ServiceHistory {
  customerName: string
  contractName: string
  serviceType: string
  technicianName: string
}

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
  const { user } = useAuth()
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    const loadServiceHistory = async () => {
      try {
        if (!user?.id) return

        const { data: historyData } = await supabase.from('service_history').select('*')
        const { data: contractsData } = await supabase.from('contracts').select('*').eq('user_id', user.id)
        const { data: techniciansData } = await supabase.from('technicians').select('*').eq('user_id', user.id)
        const { data: customersData } = await supabase.from('customers').select('*').eq('user_id', user.id)

        const records = (historyData as ServiceHistory[]).map(record => {
          const contract = (contractsData as Contract[])?.find(c => c.id === record.contract_id)
          const technician = (techniciansData as Technician[])?.find(t => t.id === record.technician_id)
          const customer = (customersData as Customer[])?.find(c => c.id === contract?.customer_id)

          return {
            ...record,
            customerName: customer?.name || 'Unknown',
            contractName: contract?.contract_name || 'Unknown',
            serviceType: contract?.service_type || 'Unknown',
            technicianName: technician?.name || 'Unknown'
          }
        })

        setServiceRecords(records)
        setFilteredRecords(records)
      } catch (error) {
        console.error('Error loading service history:', error)
      } finally {
        setLoading(false)
      }
    }

    loadServiceHistory()
  }, [user?.id])

  const handleFilter = () => {
    let filtered = serviceRecords

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.contractName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.technicianName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.serviceType.toLowerCase() === filterType.toLowerCase())
    }

    setFilteredRecords(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, filterType, serviceRecords])

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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Service Records</CardTitle>
            <CardDescription>
              Showing {filteredRecords.length} records {filterType !== 'all' ? 'matching filter' : 'total'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading service history...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No service records found</div>
            ) : (
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
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.customerName}</TableCell>
                      <TableCell>{record.contractName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {record.serviceType}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.technicianName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{record.service_date}</span>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
