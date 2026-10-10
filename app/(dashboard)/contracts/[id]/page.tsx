"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase, type Contract, type Customer, type ServiceHistory, type Technician, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, FileText, Phone, MapPin, Calendar, CalendarDays, CalendarRange, DollarSign, StickyNote, Wrench, ArrowUpRight, MessageSquare, PhoneCall, Clock, RefreshCw, AlertTriangle, CheckCircle2, Timer } from "lucide-react"
import { toast } from "sonner"
import { WHATSAPP_LANGUAGES, DEFAULT_WHATSAPP_LANGUAGE, normalizeWhatsAppLanguage, buildReminderMessage, type WhatsAppLanguage } from "@/lib/whatsapp-messages"
import { MarkCompleteModal } from "@/components/mark-complete-modal"

interface ContractDisplay extends Contract {
  daysUntilService: number
  endDate: string | null
  customerName: string
}

interface ServiceRecord extends ServiceHistory {
  technicianName: string
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
  if (days === 0) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Today Servicing</Badge>
  if (days <= 3) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Upcoming</Badge>
  if (status === "active") return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Active</Badge>
  return <Badge variant="outline">{status}</Badge>
}

// Desktop table badge — normal size
function getServiceStatusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Completed</Badge>
    case "partial": return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Partial</Badge>
    case "cancelled": return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Cancelled</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

// Mobile timeline badge — compact size
function getMobileServiceBadge(status: string) {
  switch (status) {
    case "completed": return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20 text-[11px] px-1.5 py-0">Completed</Badge>
    case "partial": return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20 text-[11px] px-1.5 py-0">Partial</Badge>
    case "cancelled": return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20 text-[11px] px-1.5 py-0">Cancelled</Badge>
    default: return <Badge variant="outline" className="text-[11px] px-1.5 py-0">{status}</Badge>
  }
}

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, role } = useAuth()
  const isAdmin = role === "admin"
  const isTechnician = role === "technician"
  const contractId = params.id as string

  const [contract, setContract] = useState<ContractDisplay | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [senderName, setSenderName] = useState<string>("")
  const [langDialogOpen, setLangDialogOpen] = useState(false)
  const [defaultLang, setDefaultLang] = useState<WhatsAppLanguage>(DEFAULT_WHATSAPP_LANGUAGE)
  const [selectedLang, setSelectedLang] = useState<WhatsAppLanguage>(DEFAULT_WHATSAPP_LANGUAGE)
  const [renewModalOpen, setRenewModalOpen] = useState(false)

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
    const loadSenderName = async () => {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('company_name, full_name')
          .eq('id', user.id)
          .single()
        if (data) {
          setSenderName(data.company_name || data.full_name || "")
        }
      } catch {
        // silently fail
      }
    }
    loadSenderName()
  }, [user?.id])

  useEffect(() => {
    const loadWhatsAppLanguage = async () => {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('whatsapp_language')
          .eq('id', user.id)
          .single()
        const lang = normalizeWhatsAppLanguage(data?.whatsapp_language)
        setDefaultLang(lang)
        setSelectedLang(lang)
      } catch {
        // silently fail, English stays as default
      }
    }
    loadWhatsAppLanguage()
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId && contractId) loadContractDetails()
  }, [currentOrgId, contractId])

  const loadContractDetails = async () => {
    try {
      if (!currentOrgId) return

      const { data: contractData, error: contractError } = await supabase
        .from('contracts').select('*').eq('id', contractId).eq('org_id', currentOrgId).single()

      if (contractError) throw contractError
      if (!contractData) {
        toast.error('Contract not found')
        router.push('/contracts')
        return
      }

      const { data: customerData, error: customerError } = await supabase
        .from('customers').select('*').eq('id', contractData.customer_id).eq('org_id', currentOrgId).single()

      if (customerError) console.error('Failed to fetch customer:', customerError)

      const daysUntilService = getDaysUntilService(contractData.next_service_date)
      const endDate = contractData.contract_type === 'old'
        ? (contractData.end_date || null)
        : getContractEndDate(contractData.start_date, contractData.duration_years)

      setCustomer(customerData as Customer)
      setContract({ ...contractData as Contract, daysUntilService, endDate, customerName: customerData?.name || 'Unknown' })

      const { data: historyData, error: historyError } = await supabase
        .from('service_history').select('*').eq('contract_id', contractId).eq('org_id', currentOrgId)

      if (historyError) throw historyError

      const { data: techniciansData } = await supabase
        .from('technicians').select('*').eq('org_id', currentOrgId)

      const historyWithTechnicianNames = (historyData as ServiceHistory[])?.map(record => {
        const technician = (techniciansData as Technician[])?.find(t => t.id === record.technician_id)
        return { ...record, technicianName: technician?.name || 'Unknown' }
      }) || []

      setServiceHistory(historyWithTechnicianNames)
    } catch (error) {
      console.error('Error loading contract details:', error)
      toast.error('Failed to load contract details')
    } finally {
      setLoading(false)
    }
  }

  // Step 1: validate the phone number, then open the language dialog
  const handleSendWhatsApp = () => {
    if (!contract || !customer) return

    const rawPhone = customer.phone?.trim()
    if (!rawPhone) {
      toast.error("No phone number found for this customer")
      return
    }

    setSelectedLang(defaultLang)
    setLangDialogOpen(true)
  }

  // Step 2: build the message in the chosen language and open WhatsApp
  const sendWhatsAppInLanguage = (lang: WhatsAppLanguage) => {
    if (!contract || !customer) return

    const rawPhone = customer.phone?.trim()
    if (!rawPhone) {
      toast.error("No phone number found for this customer")
      return
    }

    let phone = rawPhone.replace(/[\s\-().]/g, '')
    if (phone.startsWith('0')) phone = '91' + phone.slice(1)
    if (!phone.startsWith('+')) phone = phone.startsWith('91') ? phone : '91' + phone
    phone = phone.replace(/^\+/, '')

    const message = buildReminderMessage({
      lang,
      days: contract.daysUntilService,
      customerName: contract.customerName,
      contractName: contract.contract_name,
      senderName,
      lastService: formatDate(contract.start_date),
      nextService: formatDate(contract.next_service_date),
    })

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    setLangDialogOpen(false)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col gap-6 pb-20 md:pb-0">
          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <div className="size-9 rounded-md bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </div>
          {/* Banner skeleton */}
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
          {/* Card skeleton */}
          <div className="rounded-xl border bg-card p-6 space-y-4 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-4 rounded bg-muted shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!contract) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Contract not found</p>
            <p className="text-sm text-muted-foreground mt-1">This contract may have been deleted or you don't have access.</p>
          </div>
          <Button onClick={() => router.push('/contracts')} variant="outline" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Back to Contracts
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const frequencyMonths = Math.round(contract.frequency_days / 30)
  const days = contract.daysUntilService
  const isOverdue = days < 0
  const isDueToday = days === 0
  const isUpcoming = days > 0 && days <= 3
  const isActive = !isOverdue && !isDueToday && !isUpcoming

  // Countdown banner config
  const bannerConfig = isOverdue
    ? { bg: "bg-alert-overdue/10 border-alert-overdue/20", icon: <AlertTriangle className="size-5 text-alert-overdue shrink-0" />, text: `Service overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`, sub: "Contact the customer immediately", accent: "text-alert-overdue" }
    : isDueToday
    ? { bg: "bg-alert-due-today/10 border-alert-due-today/20", icon: <Timer className="size-5 text-alert-due-today shrink-0" />, text: "Service due today", sub: `Scheduled for ${formatDate(contract.next_service_date)}`, accent: "text-alert-due-today" }
    : isUpcoming
    ? { bg: "bg-alert-due-today/10 border-alert-due-today/20", icon: <Clock className="size-5 text-alert-due-today shrink-0" />, text: `Service in ${days} day${days !== 1 ? 's' : ''}`, sub: `Scheduled for ${formatDate(contract.next_service_date)}`, accent: "text-alert-due-today" }
    : { bg: "bg-alert-success/10 border-alert-success/20", icon: <CheckCircle2 className="size-5 text-alert-success shrink-0" />, text: `Next service in ${days} days`, sub: `Scheduled for ${formatDate(contract.next_service_date)}`, accent: "text-alert-success" }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 pb-20 md:pb-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/contracts')} className="size-9 shrink-0 mt-0.5">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight truncate">
                {contract.contract_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">{contract.customerName}</p>
                <span className="text-muted-foreground/40">·</span>
                {getStatusBadge(days, contract.status)}
              </div>
            </div>
          </div>

          {/* Desktop actions in header */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {customer?.phone && (
              <a href={`tel:${customer.phone}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PhoneCall className="size-4" />
                  Call
                </Button>
              </a>
            )}
            {!isTechnician && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setRenewModalOpen(true)}
              >
                <RefreshCw className="size-4" />
                Renew
              </Button>
            )}
          </div>
        </div>

        {/* ── Service countdown banner ── */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bannerConfig.bg}`}>
          {bannerConfig.icon}
          <div className="min-w-0 flex-1">
            <p className={`font-semibold text-sm ${bannerConfig.accent}`}>{bannerConfig.text}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{bannerConfig.sub}</p>
          </div>
          {/* Mobile: WhatsApp quick action in banner */}
          {customer?.phone && (
            <Button
              size="sm"
              onClick={handleSendWhatsApp}
              className="md:hidden shrink-0 bg-[#25D366] text-white hover:bg-[#25D366]/90 h-8 px-3 gap-1.5 text-xs"
            >
              <MessageSquare className="size-3.5" />
              Remind
            </Button>
          )}
        </div>

        {/* ── Mobile quick-action buttons ── */}
        <div className="flex gap-2 md:hidden">
          {customer?.phone && (
            <a href={`tel:${customer.phone}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2 h-10">
                <PhoneCall className="size-4" />
                Call
              </Button>
            </a>
          )}
          {!isTechnician && (
            <Button
              variant="outline"
              className="flex-1 gap-2 h-10"
              onClick={() => setRenewModalOpen(true)}
            >
              <RefreshCw className="size-4" />
              Renew
            </Button>
          )}
        </div>

        {/* ── Contract Information Card ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="size-4 text-primary" />
              </span>
              Contract Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Section: Customer */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Customer</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Phone className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Customer</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate">{contract.customerName}</p>
                      {customer && (
                        <Link href={`/customers/${customer.id}`}>
                          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-primary shrink-0">
                            <ArrowUpRight className="size-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                {customer?.phone && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <PhoneCall className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                      <a href={`tel:${customer.phone}`} className="font-medium text-primary hover:underline">
                        {customer.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Section: Dates */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Service Dates</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Service</p>
                    <p className="font-medium text-foreground text-sm">{formatDate(contract.start_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${isOverdue ? 'bg-alert-overdue/10' : isDueToday || isUpcoming ? 'bg-alert-due-today/10' : 'bg-muted'}`}>
                    <Calendar className={`size-3.5 ${isOverdue ? 'text-alert-overdue' : isDueToday || isUpcoming ? 'text-alert-due-today' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Next Service</p>
                    <p className={`font-medium text-sm ${isOverdue ? 'text-alert-overdue' : isDueToday || isUpcoming ? 'text-alert-due-today' : 'text-foreground'}`}>
                      {formatDate(contract.next_service_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 col-span-2 sm:col-span-1">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <CalendarRange className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contract End</p>
                    <p className="font-medium text-foreground text-sm">{formatDate(contract.endDate)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Section: Contract Details */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contract Details</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <RefreshCw className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Frequency</p>
                    <p className="font-medium text-foreground text-sm">Every {frequencyMonths}mo</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</p>
                    <p className="font-medium text-foreground text-sm">
                      {contract.contracts_price != null
                        ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 col-span-2 sm:col-span-1">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                    <div className="mt-0.5">{getStatusBadge(days, contract.status)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Notes */}
            {(contract.location || contract.notes) && (
              <>
                <div className="border-t border-border" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {contract.location && (
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                        <MapPin className="size-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Location</p>
                        <p className="font-medium text-foreground text-sm">{contract.location}</p>
                      </div>
                    </div>
                  )}
                  {contract.notes && (
                    <div className="flex items-start gap-2.5 sm:col-span-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                        <StickyNote className="size-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
                        <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{contract.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </CardContent>
        </Card>

        {/* ── Service History — shared header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wrench className="size-4 text-muted-foreground" />
              Service History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {serviceHistory.length} record{serviceHistory.length !== 1 ? 's' : ''} for this contract
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
                      <TableRow key={record.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
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
                    {/* Status-colored dot */}
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                      <div className={`size-2.5 rounded-full ${dotColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{formatDate(record.service_date)}</p>
                        {getMobileServiceBadge(record.status)}
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

        {/* ── Renew Contract Modal ── */}
        <MarkCompleteModal
          open={renewModalOpen}
          onOpenChange={setRenewModalOpen}
          contract={contract}
          userId={user?.id ?? ""}
          orgId={currentOrgId ?? ""}
          customerId={contract?.customer_id}
          onSuccess={() => {
            setRenewModalOpen(false)
            loadContractDetails()
          }}
        />

        {/* Language selection dialog for WhatsApp message */}
        <Dialog open={langDialogOpen} onOpenChange={setLangDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Select message language</DialogTitle>
              <DialogDescription>Choose the language for the WhatsApp message.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {WHATSAPP_LANGUAGES.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setSelectedLang(l.value)}
                  className={`flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    selectedLang === l.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  <span>{l.native}</span>
                  {l.native !== l.label && <span className="text-xs opacity-80">{l.label}</span>}
                </button>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setLangDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => sendWhatsAppInLanguage(selectedLang)}
                className="bg-[#25D366] text-white hover:bg-[#25D366]/90"
              >
                <MessageSquare className="mr-2 size-4" />
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}
