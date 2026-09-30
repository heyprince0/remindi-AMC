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
import { ArrowLeft, FileText, Phone, MapPin, Calendar, DollarSign, StickyNote, Wrench, ArrowUpRight, MessageSquare, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { WHATSAPP_LANGUAGES, DEFAULT_WHATSAPP_LANGUAGE, normalizeWhatsAppLanguage, buildReminderMessage, type WhatsAppLanguage } from "@/lib/whatsapp-messages"

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
  if (days < 0) return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Expired</Badge>
  if (days === 0) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Today Servicing</Badge>
  if (days <= 3) return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Expiring Soon</Badge>
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
  const contractId = params.id as string
  const [testing, setTesting] = useState(false)

  const [contract, setContract] = useState<ContractDisplay | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [serviceHistory, setServiceHistory] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [senderName, setSenderName] = useState<string>("")
  const [langDialogOpen, setLangDialogOpen] = useState(false)
  const [defaultLang, setDefaultLang] = useState<WhatsAppLanguage>(DEFAULT_WHATSAPP_LANGUAGE)
  const [selectedLang, setSelectedLang] = useState<WhatsAppLanguage>(DEFAULT_WHATSAPP_LANGUAGE)

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

  // Sends the "soon_service" template to the contractor right now
  const handleTestReminder = async () => {
    if (!contract || testing) return
    setTesting(true)
    const toastId = toast.loading("Sending test reminder...")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Please log in again")

      const res = await fetch("/api/whatsapp/test-contract-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to send test reminder")

      toast.success(
        `Reminder sent to ${data.sentTo?.name ?? "contractor"} (${data.sentTo?.phone ?? ""})`,
        { id: toastId }
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test reminder", { id: toastId })
    } finally {
      setTesting(false)
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
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading contract details...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!contract) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Contract not found</p>
        </div>
      </DashboardLayout>
    )
  }

  const frequencyMonths = Math.round(contract.frequency_days / 30)

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => router.push('/contracts')} className="size-9 shrink-0">
                <ArrowLeft className="size-4" />
                <span className="sr-only">Back to contracts</span>
              </Button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">{contract.contract_name}</h1>
                <p className="text-muted-foreground">Contract Details</p>
              </div>
            </div>
            {/* Desktop: buttons inline in header row */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {customer?.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendWhatsApp}
                  className="border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                >
                  <MessageSquare className="mr-2 size-4" />
                  Send WhatsApp
                </Button>
              )}
            </div>
          </div>
          {/* Mobile: buttons on their own row below the title */}
          <div className="md:hidden pl-[52px] flex flex-wrap gap-2">
            {customer?.phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendWhatsApp}
                className="border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
              >
                <MessageSquare className="mr-2 size-4" />
                Send WhatsApp
              </Button>
            )}
          </div>
        </div>

        {/* Contract Information Card — unchanged */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="size-5 text-primary" />
              </span>
              Contract Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Contract Name</p>
                  <p className="font-medium text-foreground">{contract.contract_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="size-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{contract.customerName}</p>
                    {customer && (
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                          <ArrowUpRight className="size-4" />
                          <span className="sr-only">View Customer</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Service Frequency</p>
                  <p className="font-medium text-foreground">Every {frequencyMonths} months</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DollarSign className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-medium text-foreground">
                    {contract.contracts_price != null
                      ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Contract End Date</p>
                  <p className="font-medium text-foreground">{formatDate(contract.endDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Service</p>
                  <p className="font-medium text-foreground">{formatDate(contract.start_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Next Service</p>
                  <p className="font-medium text-foreground">{formatDate(contract.next_service_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {getStatusBadge(contract.daysUntilService, contract.status)}
                </div>
              </div>

              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium text-foreground">{contract.location || '—'}</p>
                </div>
              </div>

              {contract.notes && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <StickyNote className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="font-medium text-foreground whitespace-pre-wrap">{contract.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── DESKTOP: Service History Table ── */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5" />
              Service History
            </CardTitle>
            <CardDescription>
              {serviceHistory.length} service record{serviceHistory.length !== 1 ? 's' : ''} for this contract
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serviceHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No service history found for this contract</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="max-w-[200px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            {formatDate(record.service_date)}
                          </div>
                        </TableCell>
                        <TableCell>{record.technicianName}</TableCell>
                        <TableCell>{getServiceStatusBadge(record.status)}</TableCell>
                        <TableCell className="max-w-[200px]">
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

        {/* ── MOBILE: Service History — compact timeline log ── */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-1.5">
                <Wrench className="size-4 text-muted-foreground" />
                Service History
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {serviceHistory.length} record{serviceHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {serviceHistory.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              No service history found for this contract
            </div>
          ) : (
            <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
              {serviceHistory.map((record) => (
                <div key={record.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                    <Calendar className="size-3 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatDate(record.service_date)}</p>
                      {getMobileServiceBadge(record.status)}
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      {record.technicianName}
                    </p>

                    {record.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                        {record.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
