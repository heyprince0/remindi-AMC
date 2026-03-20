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
      const headers = ['Customer Name', 'Contract Name', 'Service Type', 'Technician', 'Service Date', 'Status', 'Notes']
      const csvContent = [
        headers.join(','),
        ...records.map(record =>
          [
            `"${record.customerName}"`,
            `"${record.contractName}"`,
            `"${record.serviceType}"`,
            `"${record.technicianName}"`,
            `"${record.service_date}"`,
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
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      // Colors
      const headerBg = [51, 65, 85] // slate-700
      const headerText = [255, 255, 255]
      const rowBg = [248, 250, 252] // slate-50
      const alternateRowBg = [255, 255, 255]
      const textColor = [15, 23, 42] // slate-900

      // Add title
      doc.setFontSize(16)
      doc.setTextColor(...headerText)
      doc.setFillColor(...headerBg)
      doc.rect(0, 0, 297, 15, 'F')
      doc.text(companyName || 'Service History Report', 15, 12)

      // Add export date
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 15, 22)

      const startY = 28
      const columns = [
        { header: 'Customer Name', dataKey: 'customerName', width: 35 },
        { header: 'Contract Name', dataKey: 'contractName', width: 35 },
        { header: 'Service Type', dataKey: 'serviceType', width: 25 },
        { header: 'Technician', dataKey: 'technicianName', width: 30 },
        { header: 'Service Date', dataKey: 'service_date', width: 28 },
        { header: 'Status', dataKey: 'status', width: 20 },
        { header: 'Notes', dataKey: 'notes', width: 40 },
      ]

      let currentY = startY

      // Draw header row
      doc.setFillColor(...headerBg)
      doc.setTextColor(...headerText)
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')

      let xPos = 15
      for (const col of columns) {
        doc.rect(xPos, currentY - 5, col.width, 8, 'F')
        doc.text(col.header, xPos + 2, currentY, { maxWidth: col.width - 4 })
        xPos += col.width
      }

      currentY += 8

      // Draw rows
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      let rowIndex = 0

      for (const record of records) {
        const rowHeight = 10
        doc.setTextColor(...textColor)
        doc.setFillColor(...(rowIndex % 2 === 0 ? rowBg : alternateRowBg))
        doc.rect(15, currentY - 4, 267, rowHeight, 'F')

        xPos = 15
        for (const col of columns) {
          const cellValue = String(record[col.dataKey as keyof typeof record] || '')
          doc.text(cellValue, xPos + 2, currentY + 2, { maxWidth: col.width - 4 })
          xPos += col.width
        }

        currentY += rowHeight
        rowIndex++

        // Add new page if needed
        if (currentY > 270) {
          doc.addPage()
          currentY = 15
        }
      }

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
