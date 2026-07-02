"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Search, MoreHorizontal, Eye, Edit, Calendar, User, FileText, Trash2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<(Contract & { customer_name?: string })[]>([])
  const [filteredContracts, setFilteredContracts] = useState<(Contract & { customer_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  // Plan limits
  const { maxContracts, currentContractCount, status, isLoading: limitsLoading } = usePlanLimits(currentOrgId);

  // Limit modal state
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired');
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({});

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

  // Check limits on page load
  useEffect(() => {
    if (limitsLoading || !currentOrgId) return;
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired');
      setLimitModalCustom({});
      setShowLimitModal(true);
    } else if (maxContracts > 0 && currentContractCount >= maxContracts) {
      setLimitModalType('resource-limit');
      setLimitModalCustom({
        title: "You've reached your contract limit",
        description: `Your current plan allows a maximum of ${maxContracts} contracts. You have already created ${currentContractCount}. Upgrade to manage more contracts.`,
      });
      setShowLimitModal(true);
    }
  }, [limitsLoading, status, maxContracts, currentContractCount]);

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
          customerMap = customersData.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<string, string>)
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
    // Check limits before navigating to add form
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired');
      setLimitModalCustom({});
      setShowLimitModal(true);
      return;
    }
    if (maxContracts > 0 && currentContractCount >= maxContracts) {
      setLimitModalType('resource-limit');
      setLimitModalCustom({
        title: "You've reached your contract limit",
        description: `Your current plan allows a maximum of ${maxContracts} contracts. You have already created ${currentContractCount}. Upgrade to manage more contracts.`,
      });
      setShowLimitModal(true);
      return;
    }
    // Otherwise navigate to add contract page
    window.location.href = '/contracts/new';
  }

  const handleUpgrade = () => {
    window.location.href = '/billing';
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
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

        {/* Search */}
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

        {/* Contracts Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">Loading contracts...</div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">
              {searchTerm ? 'No contracts found matching your search' : 'No contracts yet'}
            </div>
          ) : (
            filteredContracts.map((contract) => (
              <Card key={contract.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{contract.contract_name}</CardTitle>
                      {contract.customer_name && (
                        <CardDescription className="text-xs flex items-center gap-1">
                          <User className="size-3" />
                          {contract.customer_name}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    <span>Every {contract.frequency_days} days</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    <span>Next service: {contract.next_service_date ? new Date(contract.next_service_date).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                      {contract.status || 'Active'}
                    </Badge>
                    {contract.contracts_price && (
                      <span className="text-sm font-medium">
                        ₹{Number(contract.contracts_price).toLocaleString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Limit Modal */}
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
