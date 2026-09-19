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
} from "lucide-react"
import { toast } from "sonner"
import { AddCustomerModal } from "@/components/add-customer-modal"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"

// ── Column alias map ─────────────────────────────────────────────────────────
// Maps flexible user-typed headers → our internal field names
const COLUMN_ALIASES: Record<string, string> = {
  // name
  name: "name",
  "customer name": "name",
  customer_name: "name",
  "full name": "name",
  fullname: "name",
  "client name": "name",
  client: "name",
  // phone
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  phonenumber: "phone",
  "mobile number": "phone",
  contact: "phone",
  "contact number": "phone",
  // address
  address: "address",
  addr: "address",
  "full address": "address",
  location: "address",
  area: "address",
}

const REQUIRED_FIELDS = ["name", "phone", "address"]

// ── Normalize a header string ─────────────────────────────────────────────────
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

  const { maxCustomers, currentCustomerCount, status, planName, isLoading: limitsLoading } = usePlanLimits(currentOrgId)

  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

  // Hidden file input ref for Excel import
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
        return {
          ...customer,
          contractCount
        }
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

  // ── Download sample template ──────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "phone", "address"],
      ["Ramesh Sharma", "9876543210", "123 MG Road, Pune"],
      ["Priya Mehta", "9123456789", "45 Park Street, Mumbai"],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Customers")
    XLSX.writeFile(wb, "customers_template.xlsx")
    toast.success("Template downloaded")
  }

  // ── Excel import handler ──────────────────────────────────────────────────
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset input so same file can be re-selected
    if (importInputRef.current) importInputRef.current.value = ""
    if (!file || !currentOrgId) return

    if (limitsLoading) {
      toast.error("Checking your plan status, please try again...")
      return
    }

    // ── Read the file ───────────────────────────────────────────────────────
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

    // ── Normalize column headers ────────────────────────────────────────────
    // Build a map: original column key → our internal field name
    const firstRow = rows[0]
    const headerMap: Record<string, string> = {}
    for (const key of Object.keys(firstRow)) {
      const normalized = normalizeHeader(key)
      if (normalized) headerMap[key] = normalized
    }

    // Check all required fields are present
    const foundFields = new Set(Object.values(headerMap))
    const missingFields = REQUIRED_FIELDS.filter(f => !foundFields.has(f))
    if (missingFields.length > 0) {
      toast.error(
        `Missing required column${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(", ")}. ` +
        `Download the template to see the correct format.`
      )
      return
    }

    // Parse rows into valid customers
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

      // Skip rows missing required fields
      const missingValues = REQUIRED_FIELDS.filter(f => !mapped[f])
      if (missingValues.length > 0) {
        skippedMissing++
        continue
      }

      // Skip duplicate phones within the file
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

    // Check duplicates against existing customers in DB (by phone)
    setImporting(true)
    let skippedDupeInDB = 0
    try {
      const existingPhones = new Set(
        customers.map(c => c.phone.replace(/\s+/g, ""))
      )

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

      // Plan limit check
      if (checkAndShowLimitModal(uniqueRows.length)) {
        setImporting(false)
        return
      }

      // Insert to Supabase
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

      // Build summary toast
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their contact information</p>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-2">
            {/* Download template */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              title="Download Excel template"
            >
              <Download className="mr-2 size-4" />
              Template
            </Button>

            {/* Import Excel */}
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

            {/* Hidden file input */}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
            />

            {/* Add single customer */}
            <Button onClick={handleAddClick} disabled={limitsLoading}>
              <Plus className="mr-2 size-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* ── Standalone Filter Bar ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center flex-wrap">
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
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          filterLocation === "all" ? "opacity-100" : "opacity-0"
                        )}
                      />
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
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            filterLocation === loc ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{loc}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Customers Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">
              {searchTerm ? 'No customers found matching your search' : 'No customers yet'}
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

        {/* Add/Edit Customer Modal */}
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
