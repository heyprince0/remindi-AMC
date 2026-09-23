"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase, type Contract, type Customer, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  Loader2,
  Eye,
  Check,
  ChevronsUpDown,
  MoreHorizontal,
  FileText,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { AddContractModal } from "@/components/add-contract-modal"
import Link from "next/link"
import LimitReachedModal, { LimitModalType } from "@/components/billing/limit-reached-modal"
import PlanSelectionModal from "@/components/billing/PlanSelectionModal"
import * as XLSX from "xlsx"

interface ContractDisplay extends Contract {
  customerName: string
  customerPhone: string | null
  endDate: string | null
}

// ── Contract import: column alias map ─────────────────────────────────────────
const CONTRACT_COLUMN_ALIASES: Record<string, string> = {
  // customer phone
  customer_phone: "customer_phone",
  "customer phone": "customer_phone",
  phone: "customer_phone",
  mobile: "customer_phone",
  "phone number": "customer_phone",
  contact: "customer_phone",
  // contract name
  contract_name: "contract_name",
  "contract name": "contract_name",
  name: "contract_name",
  // frequency
  frequency_months: "frequency_months",
  "frequency (months)": "frequency_months",
  "frequency months": "frequency_months",
  frequency: "frequency_months",
  // start date
  start_date: "start_date",
  "start date": "start_date",
  "last service": "start_date",
  last_service: "start_date",
  // duration
  duration_years: "duration_years",
  "duration (years)": "duration_years",
  "duration years": "duration_years",
  duration: "duration_years",
  // optional
  price: "price",
  "price (rs.)": "price",
  "price (rs)": "price",
  amount: "price",
  location: "location",
  area: "location",
  notes: "notes",
  note: "notes",
}

const CONTRACT_REQUIRED_FIELDS = [
  "customer_phone",
  "contract_name",
  "frequency_months",
  "start_date",
  "duration_years",
]

function normalizeContractHeader(raw: string): string | null {
  const cleaned = raw.toString().toLowerCase().trim()
  return CONTRACT_COLUMN_ALIASES[cleaned] ?? null
}

function getContractEndDate(startDate: string | null, durationYears: number | null): string | null {
  if (!startDate || !durationYears || durationYears <= 0) return null
  const start = new Date(startDate)
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + durationYears)
  return end.toISOString().split('T')[0]
}

function getStatusBadge(days: number, status: string) {
  if (days < 0) {
    return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Expired</Badge>
  } else if (days === 0) {
    return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Today Servicing</Badge>
  } else if (days <= 3) {
    return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Expiring Soon</Badge>
  } else if (status === "active") {
    return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Active</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}

function getStatusLabel(days: number, status: string): string {
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today Servicing'
  if (days <= 3) return 'Expiring Soon'
  if (status === 'active') return 'Active'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getFilterStatusValue(days: number, status: string): string {
  if (days < 0) return 'expired'
  if (days === 0) return 'today-servicing'
  if (days <= 3) return 'expiring-soon'
  if (status === 'active') return 'active'
  return status
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function formatTableDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [22, 45, 60]
}

const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '0', label: 'Jan' },
  { value: '1', label: 'Feb' },
  { value: '2', label: 'Mar' },
  { value: '3', label: 'Apr' },
  { value: '4', label: 'May' },
  { value: '5', label: 'Jun' },
  { value: '6', label: 'Jul' },
  { value: '7', label: 'Aug' },
  { value: '8', label: 'Sep' },
  { value: '9', label: 'Oct' },
  { value: '10', label: 'Nov' },
  { value: '11', label: 'Dec' },
]

export default function ContractsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [contracts, setContracts] = useState<ContractDisplay[]>([])
  const [filteredContracts, setFilteredContracts] = useState<ContractDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterLocation, setFilterLocation] = useState("all")
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contractToDelete, setContractToDelete] = useState<ContractDisplay | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ✅ NEW: import state + ref
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [subscription, setSubscription] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [contractCount, setContractCount] = useState(0)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})
  const [limitValue, setLimitValue] = useState(0)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [autoShown, setAutoShown] = useState(false)
  const [senderName, setSenderName] = useState<string>("")

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to fetch organization:", error)
            toast.error("Could not determine your organization")
            setLoading(false)
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
            setUserRole(data.role)
          } else {
            setLoading(false)
          }
        })
    } else {
      setLoading(false)
    }
  }, [user?.id])

  // Load sender name from profile (company_name preferred, fallback to full_name)
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
        // silently fail — sender name is optional
      }
    }
    loadSenderName()
  }, [user?.id])

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!currentOrgId) return
      setSubscriptionLoading(true)
      try {
        const { data: subData, error } = await supabase
          .from('subscriptions')
          .select('*, plan:plan_id(*)')
          .eq('org_id', currentOrgId)
          .maybeSingle()
        if (error) throw error
        if (subData) {
          setSubscription(subData)
          setPlan(subData.plan)
        } else {
          const { data: freePlan } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('id', 'free')
            .single()
          setPlan(freePlan)
        }
      } catch (error) {
        console.error('Error fetching subscription:', error)
      } finally {
        setSubscriptionLoading(false)
      }
    }
    fetchSubscription()
  }, [currentOrgId])

  const fetchContractCount = async () => {
    if (!currentOrgId) return
    try {
      const { count, error } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', currentOrgId)
      if (error) throw error
      setContractCount(count || 0)
    } catch (error) {
      console.error('Error fetching contract count:', error)
    }
  }

  useEffect(() => {
    if (currentOrgId) {
      const loadData = async () => {
        setLoading(true)
        await Promise.all([loadContracts(), fetchContractCount()])
        setLoading(false)
        setDataReady(true)
      }
      loadData()
    }
  }, [currentOrgId])

  const checkAndShowLimitModal = (showOnLoad = false) => {
    if (userRole === 'technician') return false
    if (showOnLoad && autoShown) return

    let isExpired = false
    if (subscription) {
      if (subscription.status === 'expired') {
        isExpired = true
      } else if (subscription.trial_end_date) {
        const trialEnd = new Date(subscription.trial_end_date)
        const today = new Date()
        if (trialEnd < today && subscription.status !== 'active') {
          isExpired = true
        }
      }
    }

    if (isExpired) {
      setLimitModalType('expired')
      setLimitModalCustom({
        title: `Your ${plan?.name || 'current'} plan has expired`,
        description: `Renew your ${plan?.name || 'current'} plan to continue adding contracts.`,
      })
      setShowLimitModal(true)
      if (showOnLoad) setAutoShown(true)
      return true
    }

    const maxContracts = plan?.max_contracts ?? 99999
    if (contractCount >= maxContracts) {
      setLimitModalType('contracts-limit')
      setLimitModalCustom({})
      setLimitValue(maxContracts)
      setShowLimitModal(true)
      if (showOnLoad) setAutoShown(true)
      return true
    }

    return false
  }

  useEffect(() => {
    if (dataReady && !autoShown && userRole !== 'technician') {
      checkAndShowLimitModal(true)
    }
  }, [dataReady, autoShown, subscription, plan, contractCount, userRole])

  const handleFilter = () => {
    let filtered = contracts

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.contract_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => {
        const days = getDaysUntilService(c.next_service_date)
        const statusLabel = getFilterStatusValue(days, c.status)
        return statusLabel === filterStatus
      })
    }

    if (filterMonth !== 'all') {
      const monthNum = parseInt(filterMonth)
      filtered = filtered.filter(c => {
        if (!c.next_service_date) return false
        const date = new Date(c.next_service_date)
        return date.getMonth() === monthNum
      })
    }

    if (filterLocation !== 'all') {
      filtered = filtered.filter(c => c.location === filterLocation)
    }

    setFilteredContracts(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, filterStatus, filterMonth, filterLocation, contracts])

  const availableLocations = Array.from(
    new Set(
      contracts
        .map(c => c.location?.trim())
        .filter((loc): loc is string => !!loc)
    )
  ).sort()

  const handleDelete = async () => {
    if (!contractToDelete || !currentOrgId) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractToDelete.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      setContracts(contracts.filter(c => c.id !== contractToDelete.id))
      toast.success('Contract deleted successfully')
      setDeleteDialogOpen(false)
      setContractToDelete(null)
    } catch (error) {
      toast.error('Failed to delete contract')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (contract: ContractDisplay) => {
    setEditingContract(contract as Contract)
    setModalOpen(true)
  }

  const handleViewPlans = () => {
    setShowLimitModal(false)
    setShowPlanModal(true)
  }

  const handleSelectPlan = (plan: any, billingCycle: any) => {
    alert(`Selected plan: ${plan.name} (${billingCycle})`)
    setShowPlanModal(false)
  }

  const handleAddClick = () => {
    if (userRole === 'technician') return
    if (subscriptionLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    const blocked = checkAndShowLimitModal(false)
    if (blocked) return
    setEditingContract(null)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    const refresh = async () => {
      setLoading(true)
      await Promise.all([loadContracts(), fetchContractCount()])
      setLoading(false)
    }
    refresh()
  }

  const loadContracts = async () => {
    try {
      if (!currentOrgId) return

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('org_id', currentOrgId)

      if (contractsError) throw contractsError

      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('org_id', currentOrgId)

      const displayed = (contractsData as Contract[]).map(contract => {
        const customer = (customersData as Customer[])?.find(c => c.id === contract.customer_id)
        const endDate = contract.contract_type === 'old'
          ? (contract.end_date || null)
          : getContractEndDate(contract.start_date, contract.duration_years)
        return {
          ...contract,
          customerName: customer?.name || 'Unknown',
          customerPhone: (customer as any)?.phone || null,
          endDate,
        }
      })

      setContracts(displayed)
      setFilteredContracts(displayed)
    } catch (error) {
      console.error('Error loading contracts:', error)
      toast.error('Failed to load contracts')
    }
  }

  const getStatusCounts = (data: ContractDisplay[]) => {
    let active = 0, expired = 0, todayServicing = 0, expiringSoon = 0
    data.forEach(c => {
      const days = getDaysUntilService(c.next_service_date)
      if (days < 0) expired++
      else if (days === 0) todayServicing++
      else if (days <= 3) expiringSoon++
      else if (c.status === 'active') active++
    })
    return { active, expired, todayServicing, expiringSoon }
  }

  const exportContractsExcel = () => {
    if (filteredContracts.length === 0) {
      toast.error("No contracts to export")
      return
    }
    try {
      const counts = getStatusCounts(filteredContracts)
      const rows = filteredContracts.map(c => {
        const days = getDaysUntilService(c.next_service_date)
        const frequencyMonths = Math.round(c.frequency_days / 30)
        return {
          "Contract Name": c.contract_name || "",
          "Customer": c.customerName || "",
          "Customer Phone": c.customerPhone || "",
          "Frequency (Months)": frequencyMonths,
          "Price (Rs.)": c.contracts_price != null ? Number(c.contracts_price) : "",
          "Contract End": c.endDate || "",
          "Last Service": c.start_date || "",
          "Next Service": c.next_service_date || "",
          "Location": c.location || "",
          "Status": getStatusLabel(days, c.status),
          "Notes": c.notes || "",
        }
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      ws["!cols"] = [
        { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 20 }, { wch: 16 }, { wch: 30 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Contracts")

      const summaryRows = [
        { "Summary": "Total Contracts", "Count": filteredContracts.length },
        { "Summary": "Active", "Count": counts.active },
        { "Summary": "Expired", "Count": counts.expired },
        { "Summary": "Today Servicing", "Count": counts.todayServicing },
        { "Summary": "Expiring Soon", "Count": counts.expiringSoon },
        { "Summary": "Exported On", "Count": new Date().toLocaleDateString("en-IN") },
      ]
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
      wsSummary["!cols"] = [{ wch: 22 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")

      XLSX.writeFile(wb, `Contracts_Report_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Excel exported successfully")
    } catch (error) {
      console.error("Error exporting Excel:", error)
      toast.error("Failed to export Excel")
    }
  }

  const handleImportContracts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (importInputRef.current) importInputRef.current.value = ""
    if (!file || !currentOrgId) return

    if (subscriptionLoading) {
      toast.error("Checking your plan status, please try again...")
      return
    }

    // Read all sheets
    let rows: Record<string, unknown>[] = []
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        const sheetRows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[]
        rows.push(...sheetRows)
      }
    } catch {
      toast.error("Could not read file. Make sure it is a valid .xlsx or .xls file.")
      return
    }

    if (rows.length === 0) {
      toast.error("The Excel file is empty.")
      return
    }

    // Normalize headers
    const firstRow = rows[0]
    const headerMap: Record<string, string> = {}
    for (const key of Object.keys(firstRow)) {
      const normalized = normalizeContractHeader(key)
      if (normalized) headerMap[key] = normalized
    }

    // Check required columns exist
    const foundFields = new Set(Object.values(headerMap))
    const missingCols = CONTRACT_REQUIRED_FIELDS.filter(f => !foundFields.has(f))
    if (missingCols.length > 0) {
      toast.error(
        `Missing required column${missingCols.length > 1 ? "s" : ""}: ${missingCols.join(", ")}.`
      )
      return
    }

    // Fetch all org customers → build phone → customer_id map
    const { data: customersData, error: custError } = await supabase
      .from("customers")
      .select("id, phone")
      .eq("org_id", currentOrgId)

    if (custError) {
      toast.error("Failed to load customers for linking. Please try again.")
      return
    }

    const phoneToCustomerId = new Map<string, string>()
    for (const c of (customersData || [])) {
      const normalized = (c.phone || "").replace(/\s+/g, "")
      if (normalized) phoneToCustomerId.set(normalized, c.id)
    }

    // Parse rows
    type ParsedContract = {
      customer_id: string
      contract_name: string
      frequency_days: number
      start_date: string
      duration_years: number
      next_service_date: string
      end_date: string
      contracts_price: number | null
      location: string | null
      notes: string | null
      status: string
      contract_type: string
      org_id: string
      user_id: string | undefined
    }

    const validRows: ParsedContract[] = []
    let skippedMissing = 0
    let skippedNoCustomer = 0
    let skippedBadData = 0
    const seenKeys = new Set<string>()

    for (const row of rows) {
      const mapped: Record<string, string> = {}
      for (const [origKey, fieldName] of Object.entries(headerMap)) {
        mapped[fieldName] = String(row[origKey] ?? "").trim()
      }

      const missingVals = CONTRACT_REQUIRED_FIELDS.filter(f => !mapped[f])
      if (missingVals.length > 0) {
        skippedMissing++
        continue
      }

      const freqMonths = parseInt(mapped.frequency_months)
      const durationYears = parseInt(mapped.duration_years)
      if (isNaN(freqMonths) || freqMonths < 1 || freqMonths > 12 || isNaN(durationYears) || durationYears < 1) {
        skippedBadData++
        continue
      }

      const startDateObj = new Date(mapped.start_date)
      if (isNaN(startDateObj.getTime())) {
        skippedBadData++
        continue
      }
      const startDateStr = startDateObj.toISOString().split("T")[0]

      const phoneNorm = mapped.customer_phone.replace(/\s+/g, "")
      const customerId = phoneToCustomerId.get(phoneNorm)
      if (!customerId) {
        skippedNoCustomer++
        continue
      }

      const dupeKey = `${customerId}__${mapped.contract_name.toLowerCase()}`
      if (seenKeys.has(dupeKey)) continue
      seenKeys.add(dupeKey)

      const frequencyDays = freqMonths * 30
      const nextServiceDate = new Date(startDateObj)
      nextServiceDate.setDate(nextServiceDate.getDate() + frequencyDays)
      const nextServiceDateStr = nextServiceDate.toISOString().split("T")[0]

      const endDateObj = new Date(startDateObj)
      endDateObj.setFullYear(endDateObj.getFullYear() + durationYears)
      const endDateStr = endDateObj.toISOString().split("T")[0]

      const price = mapped.price ? parseFloat(mapped.price) : null

      validRows.push({
        customer_id: customerId,
        contract_name: mapped.contract_name,
        frequency_days: frequencyDays,
        start_date: startDateStr,
        duration_years: durationYears,
        next_service_date: nextServiceDateStr,
        end_date: endDateStr,
        contracts_price: !isNaN(price as number) && price !== null ? price : null,
        location: mapped.location || null,
        notes: mapped.notes || null,
        status: "active",
        contract_type: "new",
        org_id: currentOrgId,
        user_id: user?.id,
      })
    }

    if (validRows.length === 0) {
      const parts: string[] = []
      if (skippedMissing > 0) parts.push(`${skippedMissing} missing required fields`)
      if (skippedNoCustomer > 0) parts.push(`${skippedNoCustomer} customer phone not found`)
      if (skippedBadData > 0) parts.push(`${skippedBadData} invalid date or frequency`)
      toast.error(`No valid rows found. ${parts.join(", ")}.`)
      return
    }

    // Plan limit check
    const maxContracts = plan?.max_contracts ?? 99999
    if (contractCount + validRows.length > maxContracts) {
      const remaining = Math.max(0, maxContracts - contractCount)
      setLimitModalType("contracts-limit")
      setLimitModalCustom({
        title: "Contract limit reached",
        description: `Your plan allows ${maxContracts} contracts. You have ${contractCount} and are trying to add ${validRows.length}. Only ${remaining} slot${remaining === 1 ? "" : "s"} remaining. Upgrade to add more.`,
      })
      setLimitValue(maxContracts)
      setShowLimitModal(true)
      return
    }

    setImporting(true)
    try {
      const { error } = await supabase.from("contracts").insert(validRows)
      if (error) throw error

      setLoading(true)
      await Promise.all([loadContracts(), fetchContractCount()])
      setLoading(false)

      const skippedTotal = skippedMissing + skippedNoCustomer + skippedBadData
      const skippedParts: string[] = []
      if (skippedMissing > 0) skippedParts.push(`${skippedMissing} missing fields`)
      if (skippedNoCustomer > 0) skippedParts.push(`${skippedNoCustomer} customer not found`)
      if (skippedBadData > 0) skippedParts.push(`${skippedBadData} invalid data`)

      const msg = skippedTotal > 0
        ? `${validRows.length} imported, ${skippedTotal} skipped (${skippedParts.join(", ")})`
        : `${validRows.length} contract${validRows.length > 1 ? "s" : ""} imported successfully`
      toast.success(msg)
    } catch (error: any) {
      console.error("Import error:", error)
      toast.error(error?.message ?? "Import failed. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  const handleSendWhatsApp = (contract: ContractDisplay) => {
    const rawPhone = contract.customerPhone?.trim()
    if (!rawPhone) {
      toast.error("No phone number found for this customer")
      return
    }

    let phone = rawPhone.replace(/[\s\-().]/g, '')
    if (phone.startsWith('0')) phone = '91' + phone.slice(1)
    if (!phone.startsWith('+')) phone = phone.startsWith('91') ? phone : '91' + phone
    phone = phone.replace(/^\+/, '')

    const days = getDaysUntilService(contract.next_service_date)
    const lastService = formatTableDate(contract.start_date)
    const nextService = formatTableDate(contract.next_service_date)
    const contractEnd = contract.endDate ? formatTableDate(contract.endDate) : '—'
    const from = senderName || 'your service provider'
    const contractName = contract.contract_name
    const customerName = contract.customerName

    let message = ""

    if (days < 0) {
      const overdueDays = Math.abs(days)
      message =
        `Dear ${customerName},\n\n` +
        `*Contract Expired - Action Required*\n\n` +
        `Your AMC contract *${contractName}* with *${from}* has expired ${overdueDays} day${overdueDays > 1 ? 's' : ''} ago.\n\n` +
        `*Service Details:*\n` +
        `- Last Service: ${lastService}\n` +
        `- Service Expired On: ${nextService}\n\n` +
        `To avoid any service disruption, please renew your contract at the earliest.\n\n` +
        `Contact us now to get your contract renewed and next service scheduled.\n\n` +
        `Thank you for choosing *${from}*.`

    } else if (days === 0) {
      message =
        `Dear ${customerName},\n\n` +
        `*Service Due Today*\n\n` +
        `This is a reminder that your AMC service for *${contractName}* is scheduled for today.\n\n` +
        `*Service Details:*\n` +
        `- Last Service: ${lastService}\n` +
        `- Scheduled Service Date: ${nextService}\n\n` +
        `Our technician will be visiting you today. Please ensure someone is available at the premises.\n\n` +
        `For any queries, feel free to reach out to us.\n\n` +
        `Thank you for choosing *${from}*.`

    } else if (days <= 3) {
      message =
        `Dear ${customerName},\n\n` +
        `*Upcoming Service Reminder - ${days} Day${days > 1 ? 's' : ''} Left*\n\n` +
        `Your next AMC service for *${contractName}* is due in ${days} day${days > 1 ? 's' : ''}.\n\n` +
        `*Service Details:*\n` +
        `- Last Service: ${lastService}\n` +
        `- Upcoming Service Date: ${nextService}\n\n` +
        `Please confirm your availability so we can schedule the technician visit accordingly.\n\n` +
        `Contact us to confirm your appointment.\n\n` +
        `Thank you for choosing *${from}*.`

    } else {
      message =
        `Dear ${customerName},\n\n` +
        `*Service Reminder - ${contractName}*\n\n` +
        `This is a friendly reminder from *${from}* regarding your AMC contract.\n\n` +
        `*Service Details:*\n` +
        `- Last Service: ${lastService}\n` +
        `- Next Service Due: ${nextService}\n\n` +
        `We will reach out closer to your service date. For any queries or to reschedule, feel free to contact us.\n\n` +
        `Thank you for choosing *${from}*.`
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const isTechnician = userRole === 'technician'

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 min-w-0 overflow-x-hidden">

        {/* ── MOBILE Header ── */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Contracts</h1>
            <p className="text-xs text-muted-foreground mt-0.5">AMC contracts & service agreements</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Secondary actions in overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-9 shrink-0">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={exportContractsExcel}
                  disabled={filteredContracts.length === 0}
                >
                  <Download className="mr-2 size-4" />
                  Export Excel
                </DropdownMenuItem>
                {!isTechnician && (
                  <DropdownMenuItem
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing || subscriptionLoading}
                  >
                    {importing
                      ? <Loader2 className="mr-2 size-4 animate-spin" />
                      : <Upload className="mr-2 size-4" />}
                    {importing ? "Importing..." : "Import Excel"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── DESKTOP Header ── */}
        <div className="hidden md:flex flex-col gap-2 md:flex-row md:items-center md:justify-between flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
            <p className="text-muted-foreground">Manage your AMC contracts and service agreements</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportContractsExcel}
              disabled={filteredContracts.length === 0}
            >
              <Download className="mr-2 size-4" />
              Export Excel
            </Button>
            {!isTechnician && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                disabled={importing || subscriptionLoading}
              >
                {importing
                  ? <Loader2 className="mr-2 size-4 animate-spin" />
                  : <Upload className="mr-2 size-4" />}
                {importing ? "Importing..." : "Import Excel"}
              </Button>
            )}
            {!isTechnician && (
              <Button onClick={handleAddClick} disabled={subscriptionLoading}>
                <Plus className="mr-2 size-4" />
                Add Contract
              </Button>
            )}
          </div>
        </div>

        {/* Hidden file input (shared) */}
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportContracts}
        />

        {/* ── MOBILE Filter Bar ── */}
        <div className="flex flex-col gap-2 md:hidden">
          {/* Search — full width */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search contracts..."
              className="pl-10 h-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Horizontal scrollable filter pills */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className={cn(
                  "shrink-0 h-8 rounded-full border px-3 text-xs gap-1",
                  filterStatus !== "all" && "border-primary text-primary bg-primary/5 font-medium"
                )}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="today-servicing">Today Servicing</SelectItem>
                <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger
                className={cn(
                  "shrink-0 h-8 rounded-full border px-3 text-xs gap-1",
                  filterMonth !== "all" && "border-primary text-primary bg-primary/5 font-medium"
                )}
              >
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationPopoverOpen}
                  className={cn(
                    "shrink-0 h-8 rounded-full border px-3 text-xs gap-1 font-normal justify-between",
                    filterLocation !== "all" && "border-primary text-primary bg-primary/5 font-medium"
                  )}
                >
                  <span className="truncate max-w-[80px]">
                    {filterLocation === "all" ? "Location" : filterLocation}
                  </span>
                  <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search location..." />
                  <CommandList>
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setFilterLocation("all")
                          setLocationPopoverOpen(false)
                        }}
                      >
                        <Check className={cn("mr-2 size-4", filterLocation === "all" ? "opacity-100" : "opacity-0")} />
                        All Locations
                      </CommandItem>
                      {availableLocations.map((loc) => (
                        <CommandItem
                          key={loc}
                          value={loc}
                          onSelect={() => {
                            setFilterLocation(filterLocation === loc ? "all" : loc)
                            setLocationPopoverOpen(false)
                          }}
                        >
                          <Check className={cn("mr-2 size-4", filterLocation === loc ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{loc}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── DESKTOP Filter Bar ── */}
        <div className="hidden md:flex gap-4 md:flex-row md:items-center flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search contracts..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="today-servicing">Today Servicing</SelectItem>
                <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationPopoverOpen}
                  className="w-[140px] sm:w-[160px] justify-between font-normal"
                >
                  <span className="truncate">
                    {filterLocation === "all" ? "Location" : filterLocation}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search location..." />
                  <CommandList>
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setFilterLocation("all")
                          setLocationPopoverOpen(false)
                        }}
                      >
                        <Check className={cn("mr-2 size-4", filterLocation === "all" ? "opacity-100" : "opacity-0")} />
                        All Locations
                      </CommandItem>
                      {availableLocations.map((loc) => (
                        <CommandItem
                          key={loc}
                          value={loc}
                          onSelect={() => {
                            setFilterLocation(filterLocation === loc ? "all" : loc)
                            setLocationPopoverOpen(false)
                          }}
                        >
                          <Check className={cn("mr-2 size-4", filterLocation === loc ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{loc}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ── DESKTOP Table ── */}
        <Card className="hidden md:block min-w-0 w-full">
          <CardHeader>
            <CardTitle>All Contracts</CardTitle>
            <CardDescription>
              You have {filteredContracts.length} contracts {filterStatus !== 'all' || filterMonth !== 'all' || filterLocation !== 'all' ? 'matching filters' : 'in total'}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 w-full">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading contracts...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No contracts found</div>
            ) : (
              <div className="w-full min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Name</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Contract End</TableHead>
                      <TableHead>Last Service</TableHead>
                      <TableHead>Next Service</TableHead>
                      <TableHead>Status</TableHead>
                      {!isTechnician && <TableHead className="w-[70px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => {
                      const days = getDaysUntilService(contract.next_service_date)
                      const frequencyMonths = Math.round(contract.frequency_days / 30)
                      return (
                        <TableRow
                          key={contract.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/contracts/${contract.id}`)}
                        >
                          <TableCell className="font-medium">{contract.contract_name}</TableCell>
                          <TableCell>{contract.customerName}</TableCell>
                          <TableCell>{frequencyMonths} months</TableCell>
                          <TableCell>
                            {contract.contracts_price != null
                              ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                              : '—'}
                          </TableCell>
                          <TableCell>{formatTableDate(contract.endDate)}</TableCell>
                          <TableCell>{formatTableDate(contract.start_date)}</TableCell>
                          <TableCell>{formatTableDate(contract.next_service_date)}</TableCell>
                          <TableCell>{getStatusBadge(days, contract.status)}</TableCell>
                          {!isTechnician && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    router.push(`/contracts/${contract.id}`)
                                  }}
                                  title="View details"
                                >
                                  <ArrowUpRight className="size-4" />
                                  <span className="sr-only">View Details</span>
                                </Button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="size-4" />
                                      <span className="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        router.push(`/contracts/${contract.id}`)
                                      }}
                                    >
                                      <Eye className="mr-2 size-4" />
                                      View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditClick(contract)
                                      }}
                                    >
                                      <Edit className="mr-2 size-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSendWhatsApp(contract)
                                      }}
                                      className="text-green-600 focus:text-green-600"
                                    >
                                      <MessageSquare className="mr-2 size-4" />
                                      Send WhatsApp
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setContractToDelete(contract)
                                        setDeleteDialogOpen(true)
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── MOBILE Cards ── */}
        <div className="flex flex-col gap-3 md:hidden pb-24">
          {loading ? (
            /* Loading skeleton */
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-1">
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                        <div className="h-3.5 bg-muted rounded w-3/4" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredContracts.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <FileText className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No contracts found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterStatus !== 'all' || filterMonth !== 'all' || filterLocation !== 'all' || searchTerm
                    ? 'Try adjusting your filters'
                    : 'Add your first contract to get started'}
                </p>
              </div>
              {!isTechnician && !searchTerm && filterStatus === 'all' && filterMonth === 'all' && filterLocation === 'all' && (
                <Button size="sm" onClick={handleAddClick} disabled={subscriptionLoading} className="mt-1">
                  <Plus className="mr-1.5 size-4" />
                  Add Contract
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Result count */}
              <p className="text-xs text-muted-foreground px-0.5">
                <span className="font-medium text-foreground">{filteredContracts.length}</span>{" "}
                contract{filteredContracts.length !== 1 ? 's' : ''}{" "}
                {filterStatus !== 'all' || filterMonth !== 'all' || filterLocation !== 'all' || searchTerm
                  ? 'found'
                  : 'total'}
              </p>

              {filteredContracts.map((contract) => {
                const days = getDaysUntilService(contract.next_service_date)
                const frequencyMonths = Math.round(contract.frequency_days / 30)

                // Status-based left border color
                const statusBorderClass =
                  days < 0 ? "border-l-[3px] border-l-alert-overdue" :
                  days === 0 ? "border-l-[3px] border-l-alert-due-today" :
                  days <= 3 ? "border-l-[3px] border-l-alert-due-today" :
                  contract.status === 'active' ? "border-l-[3px] border-l-alert-success" :
                  ""

                // Countdown label for next service
                const countdownLabel =
                  days < 0 ? `${Math.abs(days)}d overdue` :
                  days === 0 ? "Due today" :
                  days <= 7 ? `in ${days}d` :
                  null

                return (
                  <Card
                    key={contract.id}
                    className={cn(
                      "relative cursor-pointer transition-all active:scale-[0.99] active:shadow-none hover:shadow-md overflow-hidden",
                      statusBorderClass
                    )}
                    onClick={() => router.push(`/contracts/${contract.id}`)}
                  >
                    {/* Card Header */}
                    <CardHeader className="pb-0 pt-4 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <FileText className="size-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight break-words text-foreground">
                              {contract.contract_name}
                            </p>
                            <p className="text-xs text-muted-foreground break-words mt-0.5">
                              {contract.customerName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {getStatusBadge(days, contract.status)}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Card Body */}
                    <CardContent className="px-4 pt-3 pb-0">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Last Service</p>
                          <p className="text-sm font-medium">{formatShortDate(contract.start_date)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Next Service</p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{formatShortDate(contract.next_service_date)}</p>
                            {countdownLabel && (
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                days < 0 ? "bg-alert-overdue/10 text-alert-overdue" :
                                days === 0 ? "bg-alert-due-today/10 text-alert-due-today" :
                                "bg-alert-due-today/10 text-alert-due-today"
                              )}>
                                {countdownLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Price</p>
                          <p className="text-sm font-medium">
                            {contract.contracts_price != null
                              ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Frequency</p>
                          <p className="text-sm font-medium">{frequencyMonths}mo</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Contract End</p>
                          <p className="text-sm font-medium">{formatShortDate(contract.endDate)}</p>
                        </div>
                      </div>
                    </CardContent>

                    {/* Card Footer — quick actions */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-3 mt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground truncate flex-1 mr-2">
                        {contract.location || <span className="opacity-40">No location</span>}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* WhatsApp — primary mobile action */}
                        {contract.customerPhone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 text-green-600 hover:text-green-600 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSendWhatsApp(contract)
                            }}
                            title="Send WhatsApp"
                          >
                            <MessageSquare className="size-4" />
                          </Button>
                        )}
                        {!isTechnician && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditClick(contract)
                              }}
                              title="Edit"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setContractToDelete(contract)
                                setDeleteDialogOpen(true)
                              }}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                        <ArrowUpRight className="size-4 text-muted-foreground ml-1" />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </>
          )}
        </div>

        {/* ── MOBILE FAB — Add Contract ── */}
        {!isTechnician && (
          <button
            className="fixed bottom-6 right-4 z-50 md:hidden flex items-center gap-2 bg-primary text-primary-foreground shadow-lg hover:shadow-xl active:scale-95 transition-all rounded-full px-5 py-3 text-sm font-medium disabled:opacity-60"
            onClick={handleAddClick}
            disabled={subscriptionLoading}
            aria-label="Add Contract"
          >
            <Plus className="size-4" />
            Add Contract
          </button>
        )}

        {/* Modals */}
        {user && currentOrgId && !isTechnician && (
          <AddContractModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={handleModalSuccess}
            editingContract={editingContract}
            userId={user.id}
            orgId={currentOrgId}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contract</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {contractToDelete?.contract_name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          type={limitModalType}
          onUpgrade={handleViewPlans}
          limitValue={limitValue}
          customTitle={limitModalCustom.title}
          customDescription={limitModalCustom.description}
        />

        <PlanSelectionModal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onSelectPlan={handleSelectPlan}
        />
      </div>
    </DashboardLayout>
  )
}
