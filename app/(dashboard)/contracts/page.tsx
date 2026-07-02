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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase, type Contract, type Customer } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

// Color-coded status badges — matches the convention used across the rest
// of the app (e.g. payment status badges) instead of the generic
// default/secondary variant the table was using before.
const getStatusBadgeClass = (status: string | null | undefined) => {
  const normalized = (status || "active").toLowerCase()
  switch (normalized) {
    case "active":
      return "bg-green-100 text-green-800 hover:bg-green-100"
    case "expiring soon":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100"
    case "expired":
      return "bg-red-100 text-red-800 hover:bg-red-100"
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100"
  }
}

const getStatusLabel = (status: string | null | undefined) => {
  if (!status) return "Active"
  return status
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<(Contract & { customer_name?: string })[]>([])
  const [filteredContracts, setFilteredContracts] = useState<(Contract & { customer_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  // Plan limits — unchanged from the working version
  const { maxContracts, currentContractCount, status, isLoading: limitsLoading } = usePlanLimits(currentOrgId)

  // Limit modal state — unchanged from the working version
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

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
      loadContracts()
    }
  }, [currentOrgId])

  // Check limits on page load — unchanged from the working version
  useEffect(() => {
    if (limitsLoading || !currentOrgId) return
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({})
      setShowLimitModal(true)
    } else if (maxContracts > 0 && currentContractCount >= maxContracts) {
      setLimitModalType('resource-limit')
      setLimitModalCustom({
        title: "You've reached your contract limit",
        description: `Your current plan allows a maximum of ${maxContracts} contracts. You have already created ${currentContractCount}. Upgrade to manage more contracts.`,
      })
      setShowLimitModal(true)
    }
  }, [limitsLoading, status, maxContracts, currentContractCount])

  const loadContracts = async () => {
    try {
      if (!currentOrgId) return

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('org_id', currentOrgId)

      if (contractsError) throw contractsError

      // Fetch customer names
      const customerIds = [...new Set(contractsData.map(c => c.customer_id).filter(Boolean))]
      let customerMap: Record<string, string> = {}
      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        if (customersData) {
          customerMap = customersData.reduce((acc, c) => { acc[c.id] = c.name; return acc }, {} as Record<string, string>)
        }
      }

      const contractsWithNames = contractsData.map(c => ({
        ...c,
        customer_name: c.customer_id ? customerMap[c.customer_id] || 'Unknown' : '—'
      }))

      setContracts(contractsWithNames)
      setFilteredContracts(contractsWithNames)
    } catch (error) {
      console.error('Error loading contracts:', error)
      toast.error('Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    const filtered = contracts.filter(c =>
      c.contract_name.toLowerCase().includes(term.toLowerCase()) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(term.toLowerCase())) ||
      c.frequency_days?.toString().includes(term)
    )
    setFilteredContracts(filtered)
  }

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return
    if (confirm('Are you sure you want to delete this contract?')) {
      try {
        const { error } = await supabase
          .from('contracts')
          .delete()
          .eq('id', id)
          .eq('org_id', currentOrgId)
        if (error) throw error
        setContracts(contracts.filter(c => c.id !== id))
        toast.success('Contract deleted successfully')
      } catch (error) {
        console.error('Error deleting contract:', error)
        toast.error('Failed to delete contract')
      }
    }
  }

  const handleAddClick = () => {
    // Check limits before navigating to add form — unchanged
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({})
      setShowLimitModal(true)
      return
    }
    if (maxContracts > 0 && currentContractCount >= maxContracts) {
      setLimitModalType('resource-limit')
      setLimitModalCustom({
        title: "You've reached your contract limit",
        description: `Your current plan allows a maximum of ${maxContracts} contracts. You have already created ${currentContractCount}. Upgrade to manage more contracts.`,
      })
      setShowLimitModal(true)
      return
    }
    window.location.href = '/contracts/new'
  }

  const handleUpgrade = () => {
    window.location.href = '/billing'
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header — same pattern as Customers page */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
            <p className="text-muted-foreground">Manage your service contracts and renewal schedules</p>
          </div>
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 size-4" />
            Add Contract
          </Button>
        </div>

        {/* Search — identical Card/Input pattern as Customers page */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search contracts by name, customer, or frequency..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Contracts</CardTitle>
            <CardDescription>
              You have {filteredContracts.length} contracts {searchTerm ? 'matching your search' : 'in total'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading contracts...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {contracts.length === 0
                    ? 'No contracts yet. Create your first contract!'
                    : 'No contracts matching your filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="font-medium text-foreground">Contract Name</TableHead>
                      <TableHead className="font-medium text-foreground">Customer</TableHead>
                      <TableHead className="font-medium text-foreground">Frequency</TableHead>
                      <TableHead className="font-medium text-foreground">Next Service</TableHead>
                      <TableHead className="font-medium text-foreground">Price</TableHead>
                      <TableHead className="font-medium text-foreground">Status</TableHead>
                      <TableHead className="w-[80px] font-medium text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow
                        key={contract.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium text-foreground">{contract.contract_name}</TableCell>
                        <TableCell className="text-muted-foreground">{contract.customer_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">Every {contract.frequency_days} days</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(contract.next_service_date)}</TableCell>
                        <TableCell className="text-foreground">
                          {contract.contracts_price ? `₹${Number(contract.contracts_price).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeClass(contract.status)}>
                            {getStatusLabel(contract.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/contracts/${contract.id}`}>
                                    <Eye className="mr-2 size-4" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(contract.id)} className="text-red-600">
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Limit Modal — unchanged from the working version */}
        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          type={limitModalType}
          onUpgrade={handleUpgrade}
          customTitle={limitModalCustom.title}
          customDescription={limitModalCustom.description}
        />
      </div>
    </DashboardLayout>
  )
}
