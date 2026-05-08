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
import { supabase, type Contract, type Customer, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Search, Eye, Edit, Trash2, Download } from "lucide-react"
import { toast } from "sonner"
import { AddContractModal } from "@/components/add-contract-modal"
import jsPDF from "jspdf"
import Link from "next/link"

interface ContractDisplay extends Contract {
  customerName: string
}


function getStatusBadge(days: number, status: string) {
  if (days < 0) {
    return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Overdue</Badge>
  } else if (days === 0) {
    return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Due Today</Badge>
  } else if (days <= 3) {
    return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Due Soon</Badge>
  } else if (status === "active") {
    return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Active</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}

function getServiceTypeBadge(type: string) {
  return (
    <Badge variant="outline" className="font-normal">
      {type}
    </Badge>
  )
}

export default function ContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<ContractDisplay[]>([])
  const [filteredContracts, setFilteredContracts] = useState<ContractDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)

  useEffect(() => {
    loadContracts()
  }, [user?.id])

  const handleFilter = () => {
    let filtered = contracts

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.contract_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(c => c.service_type.toLowerCase() === filterType.toLowerCase())
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => {
        const days = getDaysUntilService(c.next_service_date)
        if (filterStatus === 'overdue') return days < 0
        if (filterStatus === 'due-today') return days === 0
        if (filterStatus === 'due-soon') return days > 0 && days <= 7
        return c.status === filterStatus
      })
    }

    setFilteredContracts(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, filterType, filterStatus, contracts])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contract?')) {
      try {
        const { error } = await supabase
          .from('contracts')
          .delete()
          .eq('id', id)

        if (error) throw error
        setContracts(contracts.filter(c => c.id !== id))
        toast.success('Contract deleted successfully')
      } catch (error) {
        console.error('Error deleting contract:', error)
        toast.error('Failed to delete contract')
      }
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

  const getStatusLabel = (days: number, status: string): string => {
    if (days < 0) return 'Overdue'
    if (days === 0) return 'Due Today'
    if (days <= 3) return 'Due Soon'
    if (status === 'active') return 'Active'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getStatusPdfColor = (label: string): [number, number, number] => {
    switch (label) {
      case 'Active':   return [22, 163, 74]   // green
      case 'Overdue':  return [220, 38, 38]    // red
      case 'Due Today':return [202, 138, 4]    // amber
      case 'Due Soon': return [234, 88, 12]    // orange
      default:         return [71, 85, 105]    // slate
    }
  }

  const exportContractsPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210
      const margin = 14

      // ── Palette ───────────────────────────────────────────
      const skyBlue: [number, number, number]    = [41, 171, 226]
      const darkHeader: [number, number, number] = [22, 45, 60]
      const white: [number, number, number]      = [255, 255, 255]
      const rowAlt: [number, number, number]     = [240, 249, 255]
      const rowWhite: [number, number, number]   = [255, 255, 255]
      const textDark: [number, number, number]   = [15, 23, 42]
      const textMid: [number, number, number]    = [71, 85, 105]
      const borderCol: [number, number, number]  = [203, 213, 225]

      const data = filteredContracts
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

      const columns = [
        { header: 'Contract Name', dataKey: 'contract_name',     width: 38 },
        { header: 'Customer',      dataKey: 'customerName',      width: 32 },
        { header: 'Service Type',  dataKey: 'service_type',      width: 26 },
        { header: 'Frequency',     dataKey: 'frequency_days',    width: 24 },
        { header: 'Price (₹)',     dataKey: 'contracts_price',   width: 24 },
        { header: 'Start Date',    dataKey: 'start_date',        width: 28 },
        { header: 'Next Service',  dataKey: 'next_service_date', width: 28 },
        { header: 'Status',        dataKey: '__status',          width: 22 },
        { header: 'Notes',         dataKey: 'notes',             width: 47 },
      ]
      const tableWidth = columns.reduce((s, c) => s + c.width, 0)
      const rowH = 9
      const colHeaderH = 9
      const tableStartY = 33
      const maxY = pageH - 12

      // Pre-count pages
      let tempY = tableStartY + colHeaderH
      let totalPages = 1
      for (let i = 0; i < data.length; i++) {
        if (tempY + rowH > maxY) { totalPages++; tempY = tableStartY + colHeaderH }
        tempY += rowH
      }

      const addPageChrome = (pageNum: number) => {
        // Header bar
        doc.setFillColor(...darkHeader)
        doc.rect(0, 0, pageW, 18, 'F')
        doc.setFillColor(...skyBlue)
        doc.rect(0, 18, pageW, 2, 'F')
        // Title
        doc.setFontSize(15)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...white)
        doc.text('Contracts Report', margin, 12)
        // Right label
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(180, 210, 230)
        doc.text('AMC CONTRACTS', pageW - margin, 12, { align: 'right' })
        // Meta row
        doc.setFontSize(8.5)
        doc.setTextColor(...textMid)
        doc.text(`Exported: ${dateStr}`, margin, 27)
        // Summary counts
        const active   = data.filter(c => getDaysUntilService(c.next_service_date) >= 4 && c.status === 'active').length
        const overdue  = data.filter(c => getDaysUntilService(c.next_service_date) < 0).length
        const dueToday = data.filter(c => getDaysUntilService(c.next_service_date) === 0).length
        const dueSoon  = data.filter(c => { const d = getDaysUntilService(c.next_service_date); return d > 0 && d <= 3 }).length
        doc.text(
          `Total: ${data.length}  •  Active: ${active}  •  Overdue: ${overdue}  •  Due Today: ${dueToday}  •  Due Soon: ${dueSoon}`,
          margin + 48, 27
        )
        doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, 27, { align: 'right' })
        // Footer
        doc.setFillColor(...skyBlue)
        doc.rect(0, pageH - 8, pageW, 8, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...white)
        doc.text('remindi', margin, pageH - 3)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(180, 230, 248)
        doc.text('— Smart AMC Management for Indian Contractors  •  www.remindi.online', margin + 14, pageH - 3)
        doc.setTextColor(...white)
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 3, { align: 'right' })
      }

      const drawColHeaders = (y: number) => {
        doc.setFillColor(...darkHeader)
        doc.rect(margin, y, tableWidth, colHeaderH, 'F')
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...white)
        let x = margin
        for (const col of columns) {
          doc.text(col.header, x + 2, y + 6, { maxWidth: col.width - 4 })
          x += col.width
        }
      }

      let currentPage = 1
      addPageChrome(currentPage)
      let currentY = tableStartY
      drawColHeaders(currentY)
      currentY += colHeaderH

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')

      for (let i = 0; i < data.length; i++) {
        if (currentY + rowH > maxY) {
          doc.addPage()
          currentPage++
          addPageChrome(currentPage)
          currentY = tableStartY
          drawColHeaders(currentY)
          currentY += colHeaderH
        }

        const c = data[i]
        const days = getDaysUntilService(c.next_service_date)
        const statusLabel = getStatusLabel(days, c.status)
        const statusColor = getStatusPdfColor(statusLabel)

        doc.setFillColor(...(i % 2 === 0 ? rowAlt : rowWhite))
        doc.rect(margin, currentY, tableWidth, rowH, 'F')
        doc.setDrawColor(...borderCol)
        doc.setLineWidth(0.2)
        doc.line(margin, currentY + rowH, margin + tableWidth, currentY + rowH)

        let x = margin
        for (const col of columns) {
          let cellValue = ''
          if (col.dataKey === '__status') {
            cellValue = statusLabel
            doc.setTextColor(...statusColor)
            doc.setFont('helvetica', 'bold')
          } else if (col.dataKey === 'contracts_price') {
            const price = c.contracts_price
            cellValue = price != null ? `Rs.${Number(price).toLocaleString('en-IN')}` : '—'
            doc.setTextColor(...textDark)
            doc.setFont('helvetica', 'normal')
          } else if (col.dataKey === 'frequency_days') {
            cellValue = `${c.frequency_days} days`
            doc.setTextColor(...textDark)
            doc.setFont('helvetica', 'normal')
          } else {
            cellValue = String(c[col.dataKey as keyof typeof c] ?? '') || '—'
            doc.setTextColor(...textDark)
            doc.setFont('helvetica', 'normal')
          }
          doc.text(cellValue, x + 2, currentY + 6, { maxWidth: col.width - 4 })
          x += col.width
        }

        currentY += rowH
      }

      // Outer border
      doc.setDrawColor(...borderCol)
      doc.setLineWidth(0.4)
      doc.rect(margin, tableStartY, tableWidth, currentY - tableStartY)

      doc.save(`contracts-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('Contracts PDF exported successfully')
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="due-today">Due Today</SelectItem>
                    <SelectItem value="due-soon">Due Soon</SelectItem>
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
              You have {filteredContracts.length} contracts {filterType !== 'all' || filterStatus !== 'all' ? 'matching filters' : 'in total'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading contracts...</div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No contracts found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Next Service</TableHead>
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
                        <TableCell>{getServiceTypeBadge(contract.service_type)}</TableCell>
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
                              onClick={() => handleDelete(contract.id)}
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
      </div>
    </DashboardLayout>
  )
}
