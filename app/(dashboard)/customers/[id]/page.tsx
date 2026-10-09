"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase, type Customer, type Contract, type ServiceHistory, type Technician, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, Phone, MapPin, Mail, FileText, Wrench, Calendar, CalendarDays, CalendarRange, MessageSquare, PhoneCall, StickyNote, ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Timer, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface ServiceRecord extends ServiceHistory {
  technicianName: string
}

interface ContractDisplay extends Contract {
  daysUntilService: number
  endDate: string | null
}

function getContractEndDate(startDate: string | null, durationYears: number | null): string | null {
  if (!startDate || !durationYears || durationYears <= 0) return null
  const start = new Date(startDate)
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + durationYears)
  return end.toISOString().split('T')[0]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getStatusBadge(days: number, status: string) {
  if (days < 0) return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Overdue</Badge>
  if (days === 0) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Today</Badge>
  if (days <= 3) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Soon</Badge>
  if (status === "active") return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Active</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function getServiceStatusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20 text-[11px] px-1.5 py-0">Completed</Badge>
    case "partial": return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20 text-[11px] px-1.5 py-0">Partial</Badge>
    case "cancelled": return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20 text-[11px] px-1.5 py-0">Cancelled</Badge>
    default: return <Badge variant="outline" className="text-[11px] px-1.5 py-0">{status}</Badge>
  }
}

export default function CustomerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, role } = useAuth()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [contracts, setContracts] = useState<ContractDisplay[]>([])
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
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
    if (currentOrgId && customerId) loadCustomerDetails()
  }, [currentOrgId, customerId])

  const loadCustomerDetails = async () => {
    try {
      if (!currentOrgId) return

      const { data: customerData, error: customerError } = await supabase
        .from('customers').select('*').eq('id', customerId).eq('org_id', currentOrgId).single()

      if (customerError) throw customerError
      if (!customerData) {
        toast.error('Customer not found')
        router.push('/customers')
        return
      }

      setCustomer(customerData as Customer)

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts').select('*').eq('customer_id', customerId).eq('org_id', currentOrgId)

      if (contractsError) throw contractsError

      const contractsWithExtra = (contractsData as Contract[]).map(contract => ({
        ...contract,
        daysUntilService: getDaysUntilService(contract.next_service_date),
        endDate: contract.contract_type === 'old'
          ? (contract.end_date || null)
          : getContractEndDate(contract.start_date, contract.duration_years),
      }))

      setContracts(contractsWithExtra)

      if (contractsData && contractsData.length > 0) {
        const contractIds = (contractsData as Contract[]).map(c => c.id)

        const { data: historyData, error: historyError } = await supabase
          .from('service_history').select('*').in('contract_id', contractIds).eq('org_id', currentOrgId)

        if (historyError) throw historyError

        const { data: techniciansData } = await supabase
          .from('technicians').select('*').eq('org_id', currentOrgId)

        const historyWithTechnicianNames = (historyData as ServiceHistory[]).map(record => {
          const technician = (techniciansData as Technician[])?.find(t => t.id === record.technician_id)
          return { ...record, technicianName: technician?.name || 'Unknown' }
        })

        setServiceHistory(historyWithTechnicianNames)
      }
    } catch (error) {
      console.error('Error loading customer details:', error)
      toast.error('Failed to load customer details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col gap-5 pb-20 md:pb-0">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-muted animate-pulse shrink-0" />
            <div className="flex size-14 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-muted rounded w-2/5 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </div>
          {/* Action buttons skeleton */}
          <div className="flex gap-2 ml-[108px]">
            <div className="h-9 w-24 bg-muted rounded-md animate-pulse" />
            <div className="h-9 w-28 bg-muted rounded-md animate-pulse" />
          </div>
          {/* Info card skeleton */}
          <div className="rounded-xl border bg-card p-5 space-y-4 animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-muted rounded w-1/5" />
                  <div className="h-4 bg-muted rounded w-2/5" />
                </div>
              </div>
            ))}
          </div>
          {/* Contract cards skeleton */}
          <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
          {[1,2].map(i => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </DashboardLayout>
    )
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Phone className="size-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Customer not found</p>
            <p className="text-sm text-muted-foreground mt-1">This customer may have been deleted or you don't have access.</p>
          </div>
          <Button onClick={() => router.push('/customers')} variant="outline" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Back to Customers
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const overdueContracts = contracts.filter(c => c.daysUntilService < 0).length

  // Build WhatsApp URL for the customer
  const buildWhatsAppUrl = () => {
    if (!customer.phone) return null
    let phone = customer.phone.trim().replace(/[\s\-().]/g, '')
    if (phone.startsWith('0')) phone = '91' + phone.slice(1)
    if (!phone.startsWith('+')) phone = phone.startsWith('91') ? phone : '91' + phone
    phone = phone.replace(/^\+/, '')
    return `https://wa.me/${phone}`
  }
  const whatsappUrl = buildWhatsAppUrl()

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 pb-20 md:pb-6">

        {/* ── Page Header ── */}
        <div className="flex items-start gap-3">
          {role !== 'technician' && (
            <Button variant="ghost" size="icon" onClick={() => router.push('/customers')} className="size-9 shrink-0 mt-1">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Button>
          )}

          {/* Large avatar initial */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-2xl font-bold text-primary leading-none">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight truncate">
              {customer.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
              </span>
              {overdueContracts > 0 && (
                <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20 text-[10px] px-1.5 py-0">
                  {overdueContracts} overdue
                </Badge>
              )}
              {activeContracts > 0 && overdueContracts === 0 && (
                <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20 text-[10px] px-1.5 py-0">
                  {activeContracts} active
                </Badge>
              )}
            </div>
          </div>

          {/* Desktop actions in header */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <a href={`tel:${customer.phone}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <PhoneCall className="size-4" />
                Call
              </Button>
            </a>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10">
                  <MessageSquare className="size-4" />
                  WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* ── Mobile quick-action buttons ── */}
        <div className="flex gap-2 md:hidden">
          <a href={`tel:${customer.phone}`} className="flex-1">
            <Button variant="outline" className="w-full h-10 gap-2">
              <PhoneCall className="size-4" />
              Call
            </Button>
          </a>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" className="w-full h-10 gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10">
                <MessageSquare className="size-4" />
                WhatsApp
              </Button>
            </a>
          )}
        </div>

        {/* ── Contact Information Card ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                <Phone className="size-3.5 text-primary" />
              </span>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Phone — tappable */}
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <PhoneCall className="size-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                <a href={`tel:${customer.phone}`} className="font-medium text-primary hover:underline text-sm">
                  {customer.phone}
                </a>
              </div>
            </div>

            {/* Email — tappable */}
            {customer.email && (
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Mail className="size-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</p>
                  <a href={`mailto:${customer.email}`} className="font-medium text-primary hover:underline text-sm">
                    {customer.email}
                  </a>
                </div>
              </div>
            )}

            {/* Address */}
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                <MapPin className="size-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</p>
                <p className="font-medium text-foreground text-sm">{customer.address}</p>
              </div>
            </div>

            {/* Notes */}
            {customer.notes && (
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                  <StickyNote className="size-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
                  <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{customer.notes}</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* ── Shared section header: Contracts ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              Contracts
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contracts.length} contract{contracts.length !== 1 ? 's' : ''} for this customer
            </p>
          </div>
        </div>

        {/* ── DESKTOP: Contracts Table ── */}
        <Card className="hidden md:block -mt-2">
          <CardContent className="p-0">
            {contracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No contracts yet for this customer</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold text-foreground">Contract</TableHead>
                      <TableHead className="font-semibold text-foreground">Frequency</TableHead>
                      <TableHead className="font-semibold text-foreground">Price</TableHead>
                      <TableHead className="font-semibold text-foreground">Contract End</TableHead>
                      <TableHead className="font-semibold text-foreground">Last Service</TableHead>
                      <TableHead className="font-semibold text-foreground">Next Service</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract, i) => {
                      const frequencyMonths = Math.round(contract.frequency_days / 30)
                      const d = contract.daysUntilService
                      return (
                        <TableRow
                          key={contract.id}
                          className={`cursor-pointer transition-colors ${i % 2 !== 0 ? 'bg-muted/20' : ''}`}
                          onClick={() => router.push(`/contracts/${contract.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-muted-foreground shrink-0" />
                              {contract.contract_name}
                            </div>
                          </TableCell>
                          <TableCell>{frequencyMonths}mo</TableCell>
                          <TableCell>
                            {contract.contracts_price != null
                              ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                          <TableCell>{formatDate(contract.endDate)}</TableCell>
                          <TableCell>{formatDate(contract.start_date)}</TableCell>
                          <TableCell>
                            <span className={d < 0 ? 'text-alert-overdue font-medium' : d <= 3 ? 'text-alert-due-today font-medium' : ''}>
                              {formatDate(contract.next_service_date)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(contract.daysUntilService, contract.status)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── MOBILE: Contract Cards ── */}
        <div className="flex flex-col gap-3 md:hidden -mt-2">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-10 gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No contracts yet for this customer</p>
            </div>
          ) : (
            contracts.map((contract) => {
              const frequencyMonths = Math.round(contract.frequency_days / 30)
              const d = contract.daysUntilService
              const isOverdue = d < 0
              const isDueToday = d === 0
              const isUpcoming = d > 0 && d <= 3

              const borderColor =
                isOverdue ? 'border-l-[3px] border-l-alert-overdue' :
                isDueToday || isUpcoming ? 'border-l-[3px] border-l-alert-due-today' :
                contract.status === 'active' ? 'border-l-[3px] border-l-alert-success' : ''

              const countdownLabel =
                isOverdue ? `${Math.abs(d)}d overdue` :
                isDueToday ? 'Due today' :
                isUpcoming ? `in ${d}d` : null

              return (
                <Card
                  key={contract.id}
                  className={`cursor-pointer transition-all active:scale-[0.99] hover:shadow-md overflow-hidden ${borderColor}`}
                  onClick={() => router.push(`/contracts/${contract.id}`)}
                >
                  <CardHeader className="pb-0 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight text-foreground truncate">
                            {contract.contract_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {frequencyMonths}mo · {contract.contracts_price != null ? `₹${contract.contracts_price.toLocaleString('en-IN')}` : '—'}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(d, contract.status)}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pt-3 pb-0">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Last Service</p>
                        <p className="text-sm font-medium">{formatDate(contract.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Next Service</p>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium ${isOverdue ? 'text-alert-overdue' : isDueToday || isUpcoming ? 'text-alert-due-today' : ''}`}>
                            {formatDate(contract.next_service_date)}
                          </p>
                          {countdownLabel && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-alert-overdue/10 text-alert-overdue' : 'bg-alert-due-today/10 text-alert-due-today'}`}>
                              {countdownLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Contract End</p>
                        <p className="text-sm font-medium">{formatDate(contract.endDate)}</p>
                      </div>
                    </div>
                  </CardContent>

                  <div className="flex items-center justify-end px-4 pt-2 pb-3 border-t border-border mt-3">
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                </Card>
              )
            })
          )}
        </div>

        {/* ── Shared section header: Service History ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wrench className="size-4 text-muted-foreground" />
              Service History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {serviceHistory.length} record{serviceHistory.length !== 1 ? 's' : ''} across all contracts
            </p>
          </div>
        </div>

        {/* ── DESKTOP: Service History Table ── */}
        <Card className="hidden md:block -mt-2">
          <CardContent className="p-0">
            {serviceHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Wrench className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No service records yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold text-foreground">Date</TableHead>
                      <TableHead className="font-semibold text-foreground">Technician</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground max-w-[240px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceHistory.map((record, i) => (
                      <TableRow key={record.id} className={i % 2 !== 0 ? 'bg-muted/20' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                            {formatDate(record.service_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              {record.technicianName.charAt(0)}
                            </div>
                            {record.technicianName}
                          </div>
                        </TableCell>
                        <TableCell>{getServiceStatusBadge(record.status)}</TableCell>
                        <TableCell className="max-w-[240px]">
                          <span className="text-sm text-muted-foreground line-clamp-2">{record.notes || '—'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── MOBILE: Service History — timeline ── */}
        <div className="md:hidden -mt-2">
          {serviceHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-10 gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Wrench className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No service records yet</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
              {serviceHistory.map((record) => {
                const dotColor =
                  record.status === 'completed' ? 'bg-alert-success' :
                  record.status === 'partial' ? 'bg-alert-due-today' :
                  record.status === 'cancelled' ? 'bg-alert-overdue' : 'bg-muted-foreground'
                return (
                  <div key={record.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="flex flex-col items-center shrink-0 mt-1.5">
                      <div className={`size-2.5 rounded-full ${dotColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{formatDate(record.service_date)}</p>
                        {getServiceStatusBadge(record.status)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                          {record.technicianName.charAt(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">{record.technicianName}</p>
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 italic">
                          "{record.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
