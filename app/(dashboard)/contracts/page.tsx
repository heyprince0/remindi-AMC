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
import { Plus, Search, Edit, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import { AddContractModal } from "@/components/add-contract-modal"

interface ContractDisplay extends Contract {
  customerName: string
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

// Helper to get status label for PDF and filtering
function getStatusLabel(days: number, status: string): string {
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today Servicing'
  if (days <= 3) return 'Expiring Soon'
  if (status === 'active') return 'Active'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// Helper to get status color for PDF
function getStatusPdfColor(label: string): [number, number, number] {
  switch (label) {
    case 'Active':          return [22, 163, 74]  // green
    case 'Expired':         return [220, 38, 38] // red
    case 'Today Servicing': return [202, 138, 4] // yellow
    case 'Expiring Soon':   return [234, 88, 12] // orange
    default:                return [71, 85, 105] // slate
  }
}

// Helper to get filter status values
function getFilterStatusValue(days: number, status: string): string {
  if (days < 0) return 'expired'
  if (days === 0) return 'today-servicing'
  if (days <= 3) return 'expiring-soon'
  if (status === 'active') return 'active'
  return status
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<ContractDisplay[]>([])
  const [filteredContracts, setFilteredContracts] = useState<ContractDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contractToDelete, setContractToDelete] = useState<ContractDisplay | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadContracts()
  }, [user?.id])

  const handleFilter = () => {
    let filtered = contracts

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.contract_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => {
        const days = getDaysUntilService(c.next_service_date)
        const statusLabel = getFilterStatusValue(days, c.status)
        return statusLabel === filterStatus
      })
    }

    setFilteredContracts(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, filterStatus, contracts])

  const handleDelete = async () => {
    if (!contractToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractToDelete.id)
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

  const handleAddClick = () => {
    setEditingContract(null)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    loadContracts()
  }

  const loadContracts = async () => {
    try {
      if (!user?.id) return

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)

      if (contractsError) throw contractsError

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)

      const displayed = (contractsData as Contract[]).map(contract => {
        const customer = (customersData as Customer[])?.find(c => c.id === contract.customer_id)
        return {
          ...contract,
          customerName: customer?.name || 'Unknown'
        }
      })

      setContracts(displayed)
      setFilteredContracts(displayed)
    } catch (error) {
      console.error('Error loading contracts:', error)
      toast.error('Failed to load contracts')
    } finally {
      setLoading(false)
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

  const exportContractsPDF = () => {
    try {
      const data = filteredContracts
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const counts = getStatusCounts(data)

      const rows = data.map((c, i) => {
        const days = getDaysUntilService(c.next_service_date)
        const statusLabel = getStatusLabel(days, c.status)
        const statusColor = getStatusPdfColor(statusLabel)
        const colorHex = `rgb(${statusColor[0]},${statusColor[1]},${statusColor[2]})`
        const price = c.contracts_price != null ? `Rs.${Number(c.contracts_price).toLocaleString('en-IN')}` : '—'
        return `<tr style="background:${i % 2 === 0 ? '#f0f9ff' : '#fff'}">
          <td>${c.contract_name || '—'}</td>
          <td>${c.customerName || '—'}</td>
          <td>${c.frequency_days} days</td>
          <td>${price}</td>
          <td>${c.start_date || '—'}</td>
          <td>${c.next_service_date || '—'}</td>
          <td style="color:${colorHex};font-weight:bold">${statusLabel}</td>
        </tr>`
      }).join('')

      const printWindow = window.open('', '_blank')
      if (!printWindow) { toast.error('Please allow popups to export PDF'); return }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Contracts Report</title>
        <style>body{font-family:helvetica,sans-serif;margin:20px;color:#0f172a}
        .banner{background:#162d3c;color:#fff;padding:8px 14px;margin:-20px -20px 12px}
        .banner h2{font-size:15px;margin:0;display:inline}
        .meta{font-size:8px;color:#475569;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;font-size:9px}
        th{background:#162d3c;color:#fff;padding:5px 4px;text-align:left}
        td{padding:4px;border-bottom:1px solid #cbd5e1}
        footer{font-size:8px;color:#94a3b8;text-align:center;margin-top:20px;border-top:2px solid #29abe2;padding-top:6px}
        @media print{@page{size:landscape;margin:10mm}footer{position:fixed;bottom:0;width:100%}}</style></head>
        <body>
        <div class="banner"><h2>Contracts Report</h2><span style="float:right;font-size:9px;color:#b4d2e6">AMC CONTRACTS</span></div>
        <div class="meta">Exported: ${dateStr} &nbsp;|&nbsp; Total: ${data.length} &nbsp;|&nbsp; Active: ${counts.active} &nbsp;|&nbsp; Expired: ${counts.expired} &nbsp;|&nbsp; Today Servicing: ${counts.todayServicing} &nbsp;|&nbsp; Expiring Soon: ${counts.expiringSoon}</div>
        <table><thead><tr><th>Contract Name</th><th>Customer</th><th>Frequency</th><th>Price (Rs.)</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <footer><strong>remindi</strong> — Smart AMC Management for Indian Contractors · www.remindi.online</footer>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script>
        </body></html>`)
      printWindow.document.close()
      toast.success('PDF export opened — use Print > Save as PDF')
    } catch (error) {
      console.error('Error generating contracts PDF:', error)
      toast.error('Failed to export PDF')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
            <p className="text-muted-foreground">Manage your AMC contracts and service agreements</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportContractsPDF} disabled={filteredContracts.length === 0}>
              <Download className="mr-2 size-4" />
              Export PDF
            </Button>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 size-4" />
              Add Contract
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search contracts..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Contracts</CardTitle>
            <CardDescription>
              You have {filteredContracts.length} contracts {filterStatus !== 'all' ? 'matching filters' : 'in total'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading contracts...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No contracts found</div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => {
                    const days = getDaysUntilService(contract.next_service_date)
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.contract_name}</TableCell>
                        <TableCell>{contract.customerName}</TableCell>
                        <TableCell>{contract.frequency_days} days</TableCell>
                        <TableCell>
                          {contract.contracts_price != null
                            ? `₹${contract.contracts_price.toLocaleString('en-IN')}`
                            : '—'}
                        </TableCell>
                        <TableCell>{contract.start_date}</TableCell>
                        <TableCell>{contract.next_service_date}</TableCell>
                        <TableCell>{getStatusBadge(days, contract.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(contract)}
                              title="Edit Contract"
                            >
                              <Edit className="size-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setContractToDelete(contract); setDeleteDialogOpen(true) }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Contract"
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Contract Modal */}
        {user && (
          <AddContractModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={handleModalSuccess}
            editingContract={editingContract}
            userId={user.id}
          />
        )}

        {/* Delete Confirmation Dialog */}
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

      </div>
    </DashboardLayout>
  )
}
