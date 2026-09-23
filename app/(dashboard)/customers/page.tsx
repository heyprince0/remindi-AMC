"use client"

import { useEffect, useRef, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { supabase, type Customer, type Contract } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Phone,
  MapPin,
  FileText,
  Trash2,
  Check,
  ChevronsUpDown,
  ArrowUpRight,
  Upload,
  Download,
  Loader2,
  Users,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { AddCustomerModal } from "@/components/add-customer-modal"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"

// ── Column alias map ─────────────────────────────────────────────────────────
const COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  "customer name": "name",
  customer_name: "name",
  "full name": "name",
  fullname: "name",
  "client name": "name",
  client: "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  phonenumber: "phone",
  "mobile number": "phone",
  contact: "phone",
  "contact number": "phone",
  address: "address",
  addr: "address",
  "full address": "address",
  location: "address",
  area: "address",
}

const REQUIRED_FIELDS = ["name", "phone", "address"]

function normalizeHeader(raw: string): string | null {
  const cleaned = raw.toString().toLowerCase().trim()
  return COLUMN_ALIASES[cleaned] ?? null
}

export default function CustomersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [customers, setCustomers] = useState<(Customer & { contractCount: number })[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<(Customer & { contractCount: number })[]>([])
  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterLocation, setFilterLocation] = useState("all")
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<(Customer & { contractCount: number }) | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [senderName, setSenderName] = useState<string>("")

  const { maxCustomers, currentCustomerCount, status, planName, isLoading: limitsLoading } = usePlanLimits(currentOrgId)

  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

  const importInputRef = useRef<HTMLInputElement>(null)

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
        if (data) setSenderName(data.company_name || data.full_name || "")
      } catch {
        // optional — silently fail
      }
    }
    loadSenderName()
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId) {
      loadCustomers()
    }
  }, [currentOrgId])

  const loadCustomers = async () => {
    try {
      if (!currentOrgId) return

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', currentOrgId)

      if (customersError) throw customersError

      const { data: contractsData } = await supabase
        .from('contracts')
        .select('*')
        .eq('org_id', currentOrgId)

      const customersWithContracts = (customersData as Customer[]).map(customer => {
        const contractCount = (contractsData as Contract[])?.filter(c => c.customer_id === customer.id).length || 0
        return { ...customer, contractCount }
      })

      setAllContracts((contractsData as Contract[]) || [])
      setCustomers(customersWithContracts)
      setFilteredCustomers(customersWithContracts)
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const availableLocations = Array.from(
    new Set(
      allContracts
        .map(c => c.location?.trim())
        .filter((loc): loc is string => !!loc)
    )
  ).sort()

  const handleFilter = (term: string, location: string) => {
    let filtered = customers

    if (term) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term.toLowerCase()) ||
        c.phone.includes(term)
      )
    }

    if (location !== 'all') {
      filtered = filtered.filter(c =>
        allContracts.some(contract => contract.customer_id === c.id && contract.location === location)
      )
    }

    setFilteredCustomers(filtered)
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    handleFilter(term, filterLocation)
  }

  useEffect(() => {
    handleFilter(searchTerm, filterLocation)
  }, [filterLocation, customers, allContracts])

  const handleDelete = async () => {
    if (!customerToDelete || !currentOrgId) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      setCustomers(customers.filter(c => c.id !== customerToDelete.id))
      toast.success('Customer deleted successfully')
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  const checkAndShowLimitModal = (extraCount = 1) => {
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({
        title: `Your ${planName || 'current'} plan has expired`,
        description: `Renew your ${planName || 'current'} plan to continue adding customers.`,
      })
      setShowLimitModal(true)
      return true
    }
    if (maxCustomers > 0 && currentCustomerCount + extraCount > maxCustomers) {
      const remaining = Math.max(0, maxCustomers - currentCustomerCount)
      setLimitModalType('resource-limit')
      setLimitModalCustom({
        title: "Customer limit reached",
        description: `Your plan allows ${maxCustomers} customers. You have ${currentCustomerCount} and are trying to add ${extraCount}. Only ${remaining} slot${remaining === 1 ? '' : 's'} remaining. Upgrade to add more.`,
      })
      setShowLimitModal(true)
      return true
    }
    return false
  }

  const handleAddClick = () => {
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal(1)) return
    setEditingCustomer(null)
    setModalOpen(true)
  }

  const handleEditClick = (customer: Customer & { contractCount: number }) => {
    setEditingCustomer(customer)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    loadCustomers()
  }

  const handleUpgrade = () => {
    window.location.href = '/billing'
  }

  const handleCallCustomer = (customer: Customer) => {
    if (!customer.phone) {
      toast.error("No phone number available")
      return
    }
    window.location.href = `tel:${customer.phone.replace(/[\s\-().]/g, '')}`
  }

  const handleSendWhatsApp = (customer: Customer & { contractCount: number }) => {
    const rawPhone = customer.phone?.trim()
    if (!rawPhone) {
      toast.error("No phone number found for this customer")
      return
    }

    let phone = rawPhone.replace(/[\s\-().]/g, '')
    if (phone.startsWith('0')) phone = '91' + phone.slice(1)
    if (!phone.startsWith('+')) phone = phone.startsWith('91') ? phone : '91' + phone
    phone = phone.replace(/^\+/, '')

    const from = senderName || 'your service provider'
    const contractLine = customer.contractCount > 0
      ? `You currently have ${customer.contractCount} active AMC contract${customer.contractCount > 1 ? 's' : ''} with us.`
      : `We'd love to help you set up an AMC contract for your equipment.`

    const message =
      `Dear ${customer.name},\n\n` +
      `Greetings from *${from}*!\n\n` +
      `${contractLine}\n\n` +
      `If you need any service, maintenance, or have any questions, feel free to reply to this message or call us directly.\n\n` +
      `Thank you for choosing *${from}*.`

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const exportCustomersExcel = () => {
    if (filteredCustomers.length === 0) {
      toast.error("No customers to export")
      return
    }
    try {
      const rows = filteredCustomers.map(c => ({
        "Name": c.name || "",
        "Phone": c.phone || "",
        "Address": c.address || "",
        "Contracts": c.contractCount,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      ws["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 42 }, { wch: 12 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Customers")

      XLSX.writeFile(wb, `Customers_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Excel exported successfully")
    } catch (error) {
      console.error("Error exporting Excel:", error)
      toast.error("Failed to export Excel")
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (importInputRef.current) importInputRef.current.value = ""
    if (!file || !currentOrgId) return

    if (limitsLoading) {
      toast.error("Checking your plan status, please try again...")
      return
    }

    let rows: Record<string, unknown>[] = []
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" })
    } catch {
      toast.error("Could not read file. Make sure it's a valid .xlsx or .xls file.")
      return
    }

    if (rows.length === 0) {
      toast.error("The Excel file is empty.")
      return
    }

    const firstRow = rows[0]
    const headerMap: Record<string, string> = {}
    for (const key of Object.keys(firstRow)) {
      const normalized = normalizeHeader(key)
      if (normalized) headerMap[key] = normalized
    }

    const foundFields = new Set(Object.values(headerMap))
    const missingFields = REQUIRED_FIELDS.filter(f => !foundFields.has(f))
    if (missingFields.length > 0) {
      toast.error(
        `Missing required column${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(", ")}.`
      )
      return
    }

    type ParsedCustomer = { name: string; phone: string; address: string }
    const validRows: ParsedCustomer[] = []
    let skippedMissing = 0
    const seenPhonesInFile = new Set<string>()
    let skippedDupeInFile = 0

    for (const row of rows) {
      const mapped: Record<string, string> = {}
      for (const [origKey, fieldName] of Object.entries(headerMap)) {
        mapped[fieldName] = String(row[origKey] ?? "").trim()
      }

      const missingValues = REQUIRED_FIELDS.filter(f => !mapped[f])
      if (missingValues.length > 0) {
        skippedMissing++
        continue
      }

      const normalizedPhone = mapped.phone.replace(/\s+/g, "")
      if (seenPhonesInFile.has(normalizedPhone)) {
        skippedDupeInFile++
        continue
      }
      seenPhonesInFile.add(normalizedPhone)

      validRows.push({
        name: mapped.name,
        phone: mapped.phone,
        address: mapped.address,
      })
    }

    if (validRows.length === 0) {
      toast.error(`No valid rows found. ${skippedMissing} row${skippedMissing > 1 ? 's' : ''} missing required fields.`)
      return
    }

    setImporting(true)
    let skippedDupeInDB = 0
    try {
      const existingPhones = new Set(customers.map(c => c.phone.replace(/\s+/g, "")))

      const uniqueRows = validRows.filter(r => {
        const normalized = r.phone.replace(/\s+/g, "")
        if (existingPhones.has(normalized)) {
          skippedDupeInDB++
          return false
        }
        return true
      })

      if (uniqueRows.length === 0) {
        toast.warning("All customers in the file already exist (duplicate phone numbers). Nothing imported.")
        setImporting(false)
        return
      }

      if (checkAndShowLimitModal(uniqueRows.length)) {
        setImporting(false)
        return
      }

      const payload = uniqueRows.map(r => ({
        org_id: currentOrgId,
        user_id: user?.id,
        name: r.name,
        phone: r.phone,
        address: r.address,
      }))

      const { error } = await supabase.from("customers").insert(payload)
      if (error) throw error

      await loadCustomers()

      const skippedTotal = skippedMissing + skippedDupeInFile + skippedDupeInDB
      const skippedParts: string[] = []
      if (skippedMissing > 0) skippedParts.push(`${skippedMissing} missing fields`)
      if (skippedDupeInFile > 0) skippedParts.push(`${skippedDupeInFile} duplicate in file`)
      if (skippedDupeInDB > 0) skippedParts.push(`${skippedDupeInDB} already exist`)

      const msg = skippedTotal > 0
        ? `${uniqueRows.length} imported, ${skippedTotal} skipped (${skippedParts.join(", ")})`
        : `${uniqueRows.length} customer${uniqueRows.length > 1 ? 's' : ''} imported successfully`
      toast.success(msg)
    } catch (error: any) {
      console.error("Import error:", error)
      toast.error(error?.message ?? "Import failed. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  const hasActiveFilters = searchTerm !== "" || filterLocation !== "all"

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 min-w-0 overflow-x-hidden">

        {/* ── MOBILE Header ── */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Customers</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your customer directory
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-9 shrink-0">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={exportCustomersExcel}
                  disabled={filteredCustomers.length === 0}
                >
                  <Download className="mr-2 size-4" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing || limitsLoading}
                >
                  {importing
                    ? <Loader2 className="mr-2 size-4 animate-spin" />
                    : <Upload className="mr-2 size-4" />}
                  {importing ? "Importing..." : "Import Excel"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── DESKTOP Header ── */}
        <div className="hidden md:flex md:flex-row md:items-center md:justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their contact information</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCustomersExcel}
              disabled={filteredCustomers.length === 0}
              title="Export customers to Excel"
            >
              <Download className="mr-2 size-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing || limitsLoading}
              title="Import customers from Excel"
            >
              {importing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {importing ? "Importing..." : "Import Excel"}
            </Button>
            <Button onClick={handleAddClick} disabled={limitsLoading}>
              <Plus className="mr-2 size-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportExcel}
        />

        {/* ── MOBILE Filter Bar ── */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by name or phone..."
              className="pl-10 h-10 w-full"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {/* Location — Select on mobile (Popover doesn't work inside horizontal scroll) */}
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger
                className={cn(
                  "shrink-0 h-8 rounded-full border px-3 text-xs gap-1",
                  filterLocation !== "all" && "border-primary text-primary bg-primary/5 font-medium"
                )}
              >
                <span className="truncate max-w-[110px]">
                  {filterLocation === "all" ? "Location" : filterLocation}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {availableLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── DESKTOP Filter Bar ── */}
        <div className="hidden md:flex gap-4 md:flex-row md:items-center flex-wrap min-w-0">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers by name or phone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={locationPopoverOpen}
                className="w-[160px] justify-between font-normal"
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

        {/* ── DESKTOP Grid ── */}
        <div className="hidden md:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">
              {hasActiveFilters ? 'No customers found matching your filters' : 'No customers yet'}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="relative cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
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
                      </div>
                    </div>
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(customer) }}>
                          <MessageSquare className="mr-2 size-4 text-green-600" />
                          Send WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(customer) }}>
                          <Edit className="mr-2 size-4" />
                          Edit Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); setCustomerToDelete(customer); setDeleteDialogOpen(true) }}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{customer.contractCount}</span>
                      <span className="text-muted-foreground">contracts</span>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── MOBILE Cards ── */}
        <div className="flex flex-col gap-3 md:hidden pb-44">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-10 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No customers found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? 'Try adjusting your filters'
                    : 'Add your first customer to get started'}
                </p>
              </div>
              {!hasActiveFilters && (
                <Button size="sm" onClick={handleAddClick} disabled={limitsLoading} className="mt-1">
                  <Plus className="mr-1.5 size-4" />
                  Add Customer
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-0.5">
                <span className="font-medium text-foreground">{filteredCustomers.length}</span>{" "}
                customer{filteredCustomers.length !== 1 ? 's' : ''}{" "}
                {hasActiveFilters ? 'found' : 'total'}
              </p>

              {filteredCustomers.map((customer) => {
                const hasContracts = customer.contractCount > 0

                const statusBorderClass = hasContracts
                  ? "border-l-[3px] border-l-alert-success"
                  : "border-l-[3px] border-l-muted-foreground/30"

                return (
                  <Card
                    key={customer.id}
                    className={cn(
                      "relative cursor-pointer transition-all active:scale-[0.99] active:shadow-none hover:shadow-md overflow-hidden",
                      statusBorderClass
                    )}
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    <CardHeader className="pb-0 pt-4 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <span className="text-sm font-semibold text-primary">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight break-words text-foreground">
                              {customer.name}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <FileText className="size-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {customer.contractCount} contract{customer.contractCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 pt-3 pb-0">
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Phone</p>
                          <p className="text-sm font-medium">{customer.phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Address</p>
                          <p className="text-sm font-medium line-clamp-2">{customer.address}</p>
                        </div>
                      </div>
                    </CardContent>

                    <div className="flex items-center justify-between px-4 pt-3 pb-3 mt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground truncate flex-1 mr-2 opacity-60">
                        Tap for details
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCallCustomer(customer)
                          }}
                          title="Call"
                        >
                          <Phone className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-green-600 hover:text-green-600 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSendWhatsApp(customer)
                          }}
                          title="Send WhatsApp"
                        >
                          <MessageSquare className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditClick(customer)
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
                            setCustomerToDelete(customer)
                            setDeleteDialogOpen(true)
                          }}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <ArrowUpRight className="size-4 text-muted-foreground ml-1" />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </>
          )}
        </div>

        {/* ── MOBILE FAB — Add Customer ── */}
        <button
          className="fixed bottom-[80px] right-4 z-50 md:hidden flex items-center gap-2 bg-primary text-primary-foreground shadow-lg hover:shadow-xl active:scale-95 transition-all rounded-full px-5 py-3 text-sm font-medium disabled:opacity-60"
          onClick={handleAddClick}
          disabled={limitsLoading}
          aria-label="Add Customer"
        >
          <Plus className="size-4" />
          Add Customer
        </button>

        {/* Modals */}
        {user && currentOrgId && (
          <AddCustomerModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={handleModalSuccess}
            editingCustomer={editingCustomer}
            userId={user.id}
            orgId={currentOrgId}
          />
        )}

        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          type={limitModalType}
          onUpgrade={handleUpgrade}
          customTitle={limitModalCustom.title}
          customDescription={limitModalCustom.description}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Customer</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {customerToDelete?.name}? This action cannot be undone.
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
      </div>
    </DashboardLayout>
  )
}
