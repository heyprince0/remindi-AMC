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
import { supabase, type ServiceHistory, type Contract, type Technician, type Customer, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Search, Download, Calendar, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"
import { ExportModal } from "@/components/export-modal"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface ServiceRecord extends ServiceHistory {
  customerName: string
  contractName: string
  technicianName: string
  contractPrice: number | null
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">
          <CheckCircle2 className="mr-1 size-3" />
          Completed
        </Badge>
      )
    case "partial":
      return (
        <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">
          <Clock className="mr-1 size-3" />
          Partial
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">
          <XCircle className="mr-1 size-3" />
          Cancelled
        </Badge>
      )
    default:
      return null
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

export default function ServiceHistoryPage() {
  const { user } = useAuth()
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // --- Org state ---
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)

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
            // Also fetch company profile for PDF
            supabase
              .from("company_profile")
              .select("*")
              .eq("org_id", data.org_id)
              .single()
              .then(({ data: profileData }) => {
                if (profileData) setProfile(profileData as CompanyProfile)
              })
          }
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId) {
      loadServiceHistory()
    }
  }, [currentOrgId])

  const loadServiceHistory = async () => {
    try {
      if (!currentOrgId) return

      const { data: historyData } = await supabase
        .from('service_history')
        .select('*')
        .eq('org_id', currentOrgId)

      const { data: contractsData } = await supabase
        .from('contracts')
        .select('*')
        .eq('org_id', currentOrgId)

      const { data: techniciansData } = await supabase
        .from('technicians')
        .select('*')
        .eq('org_id', currentOrgId)

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', currentOrgId)

      const records = (historyData as ServiceHistory[]).map(record => {
        const contract = (contractsData as Contract[])?.find(c => c.id === record.contract_id)
        const technician = (techniciansData as Technician[])?.find(t => t.id === record.technician_id)
        const customer = (customersData as Customer[])?.find(c => c.id === contract?.customer_id)

        return {
          ...record,
          customerName: customer?.name || 'Unknown',
          contractName: contract?.contract_name || 'Unknown',
          technicianName: technician?.name || 'Unknown',
          contractPrice: contract?.contracts_price ?? null
        }
      })

      setServiceRecords(records)
      setFilteredRecords(records)
    } catch (error) {
      console.error('Error loading service history:', error)
      toast.error('Failed to load service history')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    let filtered = serviceRecords
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.contractName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.technicianName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    setFilteredRecords(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, serviceRecords])

  // =============================================
  // PDF GENERATION (same synchronous pattern as Reports page — instant download, no blocking image fetch)
  // =============================================
  const handleDownloadPdf = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export")
      return
    }

    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageW = 297
      const margin = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)

      // Header banner (same style as Reports page — no async logo fetch)
      doc.setFillColor(tr, tg, tb)
      doc.rect(0, 0, pageW, 14, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Service History Report", margin, 9)
      doc.setTextColor(200, 200, 200)
      doc.setFontSize(8)
      doc.text("AMC SERVICE HISTORY", pageW - margin, 9, { align: "right" })

      // Meta info
      const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(8)
      const metaText = profile?.company_name
        ? `Exported: ${dateStr}  |  ${profile.company_name}`
        : `Exported: ${dateStr}`
      doc.text(metaText, margin, 22)

      const y = 28

      // Table
      const tableBody = filteredRecords.map((r) => [
        r.customerName,
        r.contractName,
        r.technicianName,
        r.service_date ? new Date(r.service_date).toLocaleDateString("en-IN") : "-",
        r.contractPrice != null ? `₹${r.contractPrice.toLocaleString("en-IN")}` : "—",
        r.status || "—",
        r.notes || "—",
      ])

      autoTable(doc, {
        startY: y,
        head: [["Customer", "Contract", "Technician", "Date", "Price", "Status", "Notes"]],
        body: tableBody,
        theme: "grid",
        headStyles: {
          fillColor: [tr, tg, tb],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25, halign: "center" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 25, halign: "center" },
          6: { cellWidth: "auto" },
        },
        margin: { left: margin, right: margin },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont("helvetica", "italic")
      doc.text("Generated by Remindi · remindi.online", 148, finalY, { align: "center" })

      doc.save("service-history-report.pdf")
      toast.success("PDF downloaded successfully")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Service History</h1>
            <p className="text-muted-foreground">View completed services and maintenance records</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setExportModalOpen(true)}
            >
              <Download className="mr-2 size-4" />
              Export Report
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={generatingPdf || filteredRecords.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {generatingPdf ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Download PDF
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
                  placeholder="Search by customer, technician, or contract..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Service Records</CardTitle>
            <CardDescription>
              Showing {filteredRecords.length} records {searchTerm ? 'matching your search' : 'in total'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading service history...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No service records found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="max-w-[200px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.customerName}</TableCell>
                      <TableCell>{record.contractName}</TableCell>
                      <TableCell>{record.technicianName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{record.service_date}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.contractPrice != null
                          ? `₹${record.contractPrice.toLocaleString('en-IN')}`
                          : '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {record.notes}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Export Modal (keeping for backward compatibility – you can remove if not needed) */}
        <ExportModal
          open={exportModalOpen}
          onOpenChange={setExportModalOpen}
          records={filteredRecords}
          orgId={currentOrgId}
        />
      </div>
    </DashboardLayout>
  )
}
