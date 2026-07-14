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
import { useAuth } from '@/lib/auth-context'
import { supabase, type Profile } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ServiceRecord {
  id: string
  customerName: string
  contractName: string
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

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [22, 45, 60]
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
      const headers = ['Customer Name', 'Contract Name', 'Technician', 'Service Date', 'Price (Rs.)', 'Status', 'Notes']
      const csvContent = [
        headers.join(','),
        ...records.map(record =>
          [
            `"${record.customerName}"`,
            `"${record.contractName}"`,
            `"${record.technicianName}"`,
            `"=""${record.service_date}"""`,
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
      const margin = 15
      const themeColor = '#162d3c'
      const [r, g, b] = hexToRgb(themeColor)

      // Header
      doc.setFillColor(r, g, b)
      doc.rect(0, 0, pageW, 14, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(companyName || 'Service History Report', margin, 9)
      doc.setTextColor(200, 200, 200)
      doc.setFontSize(8)
      doc.text('SERVICE HISTORY', pageW - margin, 9, { align: 'right' })

      // Subtitle / export info
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(8)
      doc.text(
        `Exported: ${dateStr}  |  Total Records: ${records.length}`,
        margin,
        22
      )

      // Table
      const tableData = records.map(record => [
        record.customerName || '—',
        record.contractName || '—',
        record.technicianName || '—',
        record.service_date || '—',
        record.contractPrice != null ? `Rs. ${Number(record.contractPrice).toLocaleString('en-IN')}` : '—',
        record.status || '—',
        (record.notes || '—').replace(/"/g, '""'),
      ])

      autoTable(doc, {
        startY: 28,
        head: [['Customer Name', 'Contract', 'Technician', 'Date', 'Price (Rs.)', 'Status', 'Notes']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [r, g, b],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 28 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 'auto' },
        },
        margin: { left: margin, right: margin },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('Generated by Remindi · remindi.online', pageW / 2, finalY, { align: 'center' })

      // Save
      doc.save(`Service-History-${new Date().toISOString().split('T')[0]}.pdf`)
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
