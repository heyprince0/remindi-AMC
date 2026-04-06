'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, File, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import { useAuth } from '@/lib/auth-context'
import { supabase, type Profile } from '@/lib/supabase'

interface ServiceRecord {
  id: string
  customerName: string
  contractName: string
  serviceType: string
  technicianName: string
  service_date: string
  status: string
  notes: string
  contractPrice: number | null
}

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: ServiceRecord[]
}

export function ExportModal({ open, onOpenChange, records }: ExportModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', user.id)
          .single()

        if (data) {
          setCompanyName((data as Profile).company_name || 'Service History Report')
        }
      } catch (error) {
        console.error('[v0] Error loading profile:', error)
      }
    }

    loadProfile()
  }, [user?.id])

  const generateCSV = () => {
    setLoading(true)
    try {
      const headers = ['Customer Name', 'Contract Name', 'Service Type', 'Technician', 'Service Date', 'Price (₹)', 'Status', 'Notes']
      const csvContent = [
        headers.join(','),
        ...records.map(record =>
          [
            `"${record.customerName}"`,
            `"${record.contractName}"`,
            `"${record.serviceType}"`,
            `"${record.technicianName}"`,
            `"${record.service_date}"`,
            `"${record.contractPrice != null ? record.contractPrice : ''}"`,
            `"${record.status}"`,
            `"${(record.notes || '').replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      const fileName = `service-history-${new Date().toISOString().split('T')[0]}.csv`

      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('CSV exported successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('[v0] Error generating CSV:', error)
      toast.error('Failed to export CSV')
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = () => {
    setLoading(true)
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210
      const margin = 14

      // ── Palette ──────────────────────────────────────────
      const skyBlue: [number, number, number]   = [41, 171, 226]
      const darkHeader: [number, number, number] = [22, 45, 60]
      const white: [number, number, number]      = [255, 255, 255]
      const rowAlt: [number, number, number]     = [240, 249, 255]
      const rowWhite: [number, number, number]   = [255, 255, 255]
      const textDark: [number, number, number]   = [15, 23, 42]
      const textMid: [number, number, number]    = [71, 85, 105]
      const borderCol: [number, number, number]  = [203, 213, 225]

      const addPageContent = (pageNum: number, totalPages: number) => {
        // ── Top header bar ────────────────────────────────
        doc.setFillColor(...darkHeader)
        doc.rect(0, 0, pageW, 18, 'F')

        // Sky-blue accent strip
        doc.setFillColor(...skyBlue)
        doc.rect(0, 18, pageW, 2, 'F')

        // Company name
        doc.setFontSize(15)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...white)
        doc.text(companyName || 'Service History Report', margin, 12)

        // Right-align: "Service History Report" label
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(180, 210, 230)
        doc.text('SERVICE HISTORY REPORT', pageW - margin, 12, { align: 'right' })

        // ── Sub-header meta row ───────────────────────────
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...textMid)
        const exportDate = `Exported: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
        const totalRecords = `Total Records: ${records.length}`
        doc.text(exportDate, margin, 27)
        doc.text(totalRecords, margin + 60, 27)
        doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, 27, { align: 'right' })

        // ── Footer ────────────────────────────────────────
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

      const columns = [
        { header: 'Customer Name',  dataKey: 'customerName',   width: 36 },
        { header: 'Contract',       dataKey: 'contractName',   width: 34 },
        { header: 'Service Type',   dataKey: 'serviceType',    width: 24 },
        { header: 'Technician',     dataKey: 'technicianName', width: 28 },
        { header: 'Date',           dataKey: 'service_date',   width: 24 },
        { header: 'Price (₹)',      dataKey: 'contractPrice',  width: 22 },
        { header: 'Status',         dataKey: 'status',         width: 20 },
        { header: 'Notes',          dataKey: 'notes',          width: 81 },
      ]
      const tableWidth = columns.reduce((s, c) => s + c.width, 0)
      const rowH = 9
      const colHeaderH = 9
      const tableStartY = 33
      const maxY = pageH - 12

      // Count pages
      let tempY = tableStartY + colHeaderH
      let totalPages = 1
      for (let i = 0; i < records.length; i++) {
        if (tempY + rowH > maxY) { totalPages++; tempY = tableStartY + colHeaderH }
        tempY += rowH
      }

      // ── Page 1 header ─────────────────────────────────
      let currentPage = 1
      addPageContent(currentPage, totalPages)

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

      let currentY = tableStartY
      drawColHeaders(currentY)
      currentY += colHeaderH

      // ── Rows ──────────────────────────────────────────
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')

      for (let i = 0; i < records.length; i++) {
        if (currentY + rowH > maxY) {
          // New page
          doc.addPage()
          currentPage++
          addPageContent(currentPage, totalPages)
          currentY = tableStartY
          drawColHeaders(currentY)
          currentY += colHeaderH
        }

        const record = records[i]
        const isAlt = i % 2 === 0

        // Row background
        doc.setFillColor(...(isAlt ? rowAlt : rowWhite))
        doc.rect(margin, currentY, tableWidth, rowH, 'F')

        // Row border bottom
        doc.setDrawColor(...borderCol)
        doc.setLineWidth(0.2)
        doc.line(margin, currentY + rowH, margin + tableWidth, currentY + rowH)

        // Status badge colour
        const status = String(record.status || '').toLowerCase()
        const statusColor: [number, number, number] =
          status === 'completed' ? [22, 163, 74] :
          status === 'pending'   ? [202, 138, 4]  :
          status === 'cancelled' ? [220, 38, 38]  : [71, 85, 105]

        doc.setTextColor(...textDark)
        let x = margin
        for (const col of columns) {
          let cellValue = String(record[col.dataKey as keyof typeof record] ?? '')
          if (col.dataKey === 'contractPrice') {
            cellValue = cellValue ? `Rs.${Number(cellValue).toLocaleString('en-IN')}` : '—'
          }
          if (col.dataKey === 'status') {
            doc.setTextColor(...statusColor)
            doc.setFont('helvetica', 'bold')
          } else {
            doc.setTextColor(...textDark)
            doc.setFont('helvetica', 'normal')
          }
          doc.text(cellValue || '—', x + 2, currentY + 6, { maxWidth: col.width - 4 })
          x += col.width
        }

        currentY += rowH
      }

      // Outer table border
      doc.setDrawColor(...borderCol)
      doc.setLineWidth(0.4)
      doc.rect(margin, tableStartY, tableWidth, currentY - tableStartY)

      const fileName = `service-history-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      toast.success('PDF exported successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('[v0] Error generating PDF:', error)
      toast.error('Failed to export PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Service History</DialogTitle>
          <DialogDescription>
            Choose a format to export {records.length} service records
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            onClick={generateCSV}
            disabled={loading || records.length === 0}
            className="h-12 justify-start gap-3"
            variant="outline"
          >
            <FileText className="size-5" />
            <div className="flex flex-col items-start">
              <span className="font-medium">Export as CSV</span>
              <span className="text-xs text-muted-foreground">Excel compatible format</span>
            </div>
            {loading && <Loader2 className="ml-auto size-4 animate-spin" />}
          </Button>
          <Button
            onClick={generatePDF}
            disabled={loading || records.length === 0}
            className="h-12 justify-start gap-3"
            variant="outline"
          >
            <File className="size-5" />
            <div className="flex flex-col items-start">
              <span className="font-medium">Export as PDF</span>
              <span className="text-xs text-muted-foreground">Professional format with formatting</span>
            </div>
            {loading && <Loader2 className="ml-auto size-4 animate-spin" />}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
