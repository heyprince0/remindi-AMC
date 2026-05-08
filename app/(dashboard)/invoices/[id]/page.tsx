"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase, type Invoice, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Edit,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const safeStr = (val: any) => String(val ?? "-")
const safeNum = (val: any) => Number(val ?? 0).toLocaleString("en-IN")
const safeDate = (val: any) =>
  val ? new Date(val).toLocaleDateString("en-IN") : "-"

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function getPaymentStatusBadge(status: string) {
  const s = (status ?? "unpaid").toLowerCase()
  if (s === "unpaid") return <Badge className="bg-red-100 text-red-700 border-0">Unpaid</Badge>
  if (s === "partial") return <Badge className="bg-yellow-100 text-yellow-700 border-0">Partial</Badge>
  if (s === "paid") return <Badge className="bg-green-100 text-green-700 border-0">Paid</Badge>
  return <Badge className="bg-slate-100 text-slate-700 border-0">{status}</Badge>
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

function toWords(n: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
  if (n === 0) return "Zero"
  if (n < 20) return a[n]
  if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "")
  if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "")
  if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "")
  if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "")
  return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "")
}

export default function ViewInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [updating, setUpdating] = useState(false)
  const id = params.id as string

  useEffect(() => {
    if (user?.id && id) loadData()
  }, [id, user?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: iData, error: iErr }, { data: pData }] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", id).eq("user_id", user!.id).single(),
        supabase.from("company_profile").select("*").eq("user_id", user!.id).single(),
      ])
      if (iErr) throw iErr
      setInvoice(iData as Invoice)
      if (pData) setProfile(pData as CompanyProfile)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePaymentStatus = async (newStatus: string) => {
    if (!invoice) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: newStatus })
        .eq("id", invoice.id)
      if (error) throw error
      setInvoice({ ...invoice, payment_status: newStatus as Invoice["payment_status"] })
      toast.success(`Payment status updated to ${newStatus}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update payment status")
    } finally {
      setUpdating(false)
    }
  }

  const getMappedItems = () => {
    return (invoice?.items ?? []).map((item: any, index: number) => ({
      sr: index + 1,
      description: item.particulars ?? item.description ?? item.name ?? "-",
      qty: item.qty ?? item.quantity ?? 1,
      rate: Number(item.rate ?? item.unit_price ?? 0),
      amount: Number(item.amount ?? ((item.qty ?? item.quantity ?? 0) * (item.rate ?? item.unit_price ?? 0)) ?? 0),
    }))
  }

  const calculateTotals = () => {
    if (!invoice) return { subtotal: 0, sgst: 0, cgst: 0, grandTotal: 0 }
    return {
      subtotal: invoice.subtotal,
      sgst: invoice.sgst,
      cgst: invoice.cgst,
      grandTotal: invoice.grand_total,
    }
  }

  const handleWhatsApp = () => {
    if (!invoice) return
    const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
    const items = invoice.items ?? []
    const includeGst = invoice.include_gst ?? true
    const gstTotal = sgst + cgst
    const msg =
      `*Invoice - ${safeStr(profile?.company_name)}*\n` +
      `Invoice No: ${safeStr(invoice.invoice_no)}\n` +
      `Date: ${safeDate(invoice.invoice_date)}\n` +
      `Due Date: ${safeDate(invoice.due_date)}\n\n` +
      `*Customer:* ${safeStr(invoice.client_name)}\n\n` +
      `─────────────────────\n` +
      `*Services:*\n` +
      items.map((i: any) =>
        `• ${i.particulars ?? i.description ?? i.name ?? "-"} - Rs.${Number(i.amount ?? 0).toLocaleString("en-IN")}`
      ).join("\n") + "\n" +
      `─────────────────────\n` +
      `*Subtotal:* Rs.${subtotal.toLocaleString("en-IN")}\n` +
      (includeGst ? `*SGST (9%):* Rs.${sgst.toLocaleString("en-IN")}\n*CGST (9%):* Rs.${cgst.toLocaleString("en-IN")}\n` : ``) +
      `*Total:* Rs.${grandTotal.toLocaleString("en-IN")}\n` +
      `─────────────────────\n\n` +
      `To confirm please reply or call ${safeStr(profile?.company_phone)}\n\n` +
      `_Powered by Remindi_`
    window.open("https://wa.me/?text=" + encodeURIComponent(msg))
  }

  const handleDownloadPdf = async () => {
    if (!invoice) return
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = 210
      const pageH = 297
      const margin = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)

      let y = margin

      // ===== HEADER SECTION =====
      let logoX = margin
      let logoAdded = false
      try {
        if (profile?.logo_url) {
          const response = await fetch(profile.logo_url)
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          doc.addImage(base64, "PNG", logoX, y, 22, 22)
          logoAdded = true
        }
      } catch (e) { /* skip logo silently */ }

      const infoX = logoAdded ? logoX + 24 : logoX
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(safeStr(profile?.company_name), infoX, y + 2)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120, 120, 120)
      let infoY = y + 8

      if (profile?.tagline) {
        doc.text(safeStr(profile.tagline), infoX, infoY)
        infoY += 4
      }
      if (profile?.address) {
        doc.text(safeStr(profile.address), infoX, infoY)
        infoY += 4
      }
      if (profile?.city || profile?.state || profile?.zip_code) {
        const locationStr = [profile.city, profile.state, profile.zip_code].filter(Boolean).join(", ")
        doc.text(locationStr, infoX, infoY)
        infoY += 4
      }
      if (profile?.phone) {
        doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, infoY)
        infoY += 4
      }
      if (profile?.email) {
        doc.text(`Email: ${safeStr(profile.email)}`, infoX, infoY)
      }

      // Header bottom line
      y += 28
      const headerBottomY = y
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(0.5)
      doc.line(margin, headerBottomY, pageW - margin, headerBottomY)
      y += 6

      // ===== INVOICE HEADER =====
      // TAX INVOICE title
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(tr, tg, tb)
      doc.text("TAX INVOICE", pageW - margin, y, { align: "right" })

      // Invoice number and date
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(safeStr(invoice.invoice_no ?? ("INV-" + invoice.id)), margin, y)
      const formattedDate = invoice.invoice_date
        ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      doc.text(`DATE: ${formattedDate}`, pageW - margin, y, { align: "right" })
      y += 8

      // Due date
      if (invoice.due_date) {
        doc.setFontSize(9)
        doc.setTextColor(200, 50, 50)
        const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        doc.text(`Due: ${dueDateFormatted}`, pageW - margin, y, { align: "right" })
        y += 5
      }
      y += 2

      // ===== CLIENT BLOCK =====
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0, 0, 0)
      doc.text("TO,", margin, y)
      y += 5
      doc.text("THE OWNER,", margin, y)
      y += 5

      doc.setFont("helvetica", "bold")
      doc.text(safeStr(invoice.client_name).toUpperCase(), margin, y)
      y += 5

      doc.setFont("helvetica", "normal")
      doc.setTextColor(40, 40, 40)
      if (invoice.client_address) {
        doc.text(safeStr(invoice.client_address), margin, y)
        y += 5
      }

      const cityStateZip = [
        invoice.client_district,
        invoice.client_state,
        invoice.client_pin_code
      ].filter(Boolean).join(', ')
      if (cityStateZip) {
        doc.text(cityStateZip, margin, y)
        y += 5
      }
      y += 3

      // ===== SUBJECT LINE =====
      if (invoice.subject) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
        doc.text(`Sub: ${safeStr(invoice.subject)}`, margin, y)
        y += 7
      }

      // ===== BODY TEXT =====
      if (invoice.body_text) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(40, 40, 40)
        const bodyLines = doc.splitTextToSize(safeStr(invoice.body_text), pageW - 2 * margin)
        doc.text(bodyLines, margin, y)
        y += (bodyLines.length * 4) + 3
      }
      y += 2

      // ===== ITEMS TABLE =====
      const items = invoice.items ?? []
      const { subtotal, sgst, cgst, grandTotal } = calculateTotals()

      const tableBody = items.map((item, idx) => [
        String(idx + 1),
        safeStr(item.particulars ?? item.description ?? item.name ?? "-"),
        String(item.qty ?? item.quantity ?? 1),
        `Rs. ${Number(item.rate ?? item.unit_price ?? 0).toLocaleString("en-IN")}`,
        `Rs. ${Number(item.amount ?? ((Number(item.qty ?? item.quantity ?? 0)) * (Number(item.rate ?? item.unit_price ?? 0)))).toLocaleString("en-IN")}`,
      ])

      autoTable(doc, {
        startY: y,
        head: [["SR.NO", "PARTICULARS", "QTY.", "RATE", "AMOUNT"]],
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
          fontSize: 9,
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 35, halign: "right" },
          4: { cellWidth: 35, halign: "right" },
        },
        margin: { left: margin, right: margin },
      })

      y = (doc as any).lastAutoTable.finalY + 8

      if (invoice.include_gst) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)

        doc.text('Subtotal:', 160, y, { align: 'right' })
        doc.text('Rs. ' + subtotal.toLocaleString('en-IN'),
          195, y, { align: 'right' })

        y += 4
        doc.text('SGST (9%):', 160, y, { align: 'right' })
        doc.text('Rs. ' + sgst.toLocaleString('en-IN'),
          195, y, { align: 'right' })

        y += 4
        doc.text('CGST (9%):', 160, y, { align: 'right' })
        doc.text('Rs. ' + cgst.toLocaleString('en-IN'),
          195, y, { align: 'right' })

        y += 3
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.3)
        doc.line(140, y, 195, y)

        y += 4
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Total:', 160, y, { align: 'right' })
        doc.text('Rs. ' + grandTotal.toLocaleString('en-IN'),
          195, y, { align: 'right' })
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Total:', 160, y, { align: 'right' })
        doc.text('Rs. ' + subtotal.toLocaleString('en-IN'),
          195, y, { align: 'right' })
      }

      // ===== PAYMENT DETAILS =====
      y += 10
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text("Payment Details:", margin, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setTextColor(40, 40, 40)

      if (profile?.bank_name) {
        doc.text(`Bank: ${safeStr(profile.bank_name)}`, margin, y)
        y += 4
      }
      if (profile?.account_no) {
        doc.text(`Account No: ${safeStr(profile.account_no)}`, margin, y)
        y += 4
      }
      if (profile?.ifsc_code) {
        doc.text(`IFSC: ${safeStr(profile.ifsc_code)}`, margin, y)
        y += 4
      }
      if (profile?.upi_id) {
        doc.text(`UPI: ${safeStr(profile.upi_id)}`, margin, y)
        y += 4
      }
      if (invoice.payment_terms) {
        doc.text(`Payment Terms: ${safeStr(invoice.payment_terms)}`, margin, y)
        y += 4
      }

      // ===== NOTES =====
      if (invoice.notes) {
        y += 3
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text("Notes:", margin, y)
        y += 4
        doc.setFont("helvetica", "normal")
        doc.setTextColor(80, 80, 80)
        const noteLines = doc.splitTextToSize(safeStr(invoice.notes), pageW - 2 * margin)
        doc.text(noteLines, margin, y)
        y += (noteLines.length * 4)
      }

      // ===== PAYMENT STATUS WATERMARK =====
      if (invoice.payment_status === "Paid") {
        doc.setFontSize(60)
        doc.setTextColor(200, 240, 200)
        doc.setFont('helvetica', 'bold')
        doc.text('PAID', 105, 160, { 
          align: 'center', 
          angle: 30 
        })
      }

      // ===== FOOTER =====
      y += 10
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text('Thanking you,', 195, y, { align: 'right' })
      doc.text('Yours faithfully,', 195, y+6, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text('For ' + safeStr(profile?.company_name),
        195, y+12, { align: 'right' })

      // Bottom: Generated by Remindi (centered, small gray)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont("helvetica", "normal")
      doc.text("Generated by Remindi · remindi.online", pageW / 2, pageH - 8, { align: "center" })

      const filename = `Invoice-${safeStr(invoice.invoice_no ?? invoice.id)}-${safeStr(invoice.client_name ?? "Client")}.pdf`
      doc.save(filename)
      toast.success("PDF downloaded")
    } catch (err) {
      console.error("PDF error:", err)
      toast.error("PDF failed: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Invoice not found</p>
          <Link href="/invoices">
            <Button>Back to Invoices</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const mappedItems = getMappedItems()
  const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
  const includeGst = invoice.include_gst ?? true

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/invoices">
              <Button variant="outline" size="icon" className="shrink-0 mt-1">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {invoice.invoice_no ?? ("INV-" + invoice.id)}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(invoice.invoice_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {getPaymentStatusBadge(invoice.payment_status)}

            <Button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {generatingPdf ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-4" />
              )}
              Download PDF
            </Button>

            <Button
              onClick={handleWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <MessageCircle className="mr-1.5 size-4" />
              WhatsApp
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={updating}>
                  {updating ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <ChevronDown className="mr-1.5 size-4" />
                  )}
                  Payment Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleUpdatePaymentStatus("Unpaid")}>
                  <span className="size-2 rounded-full bg-red-500 mr-2 inline-block" />
                  Unpaid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePaymentStatus("Partial")}>
                  <span className="size-2 rounded-full bg-yellow-500 mr-2 inline-block" />
                  Partial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePaymentStatus("Paid")}>
                  <span className="size-2 rounded-full bg-green-500 mr-2 inline-block" />
                  Paid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* COMPANY INFO */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {profile.logo_url && (
                  <img
                    src={profile.logo_url}
                    alt="Company logo"
                    className="h-16 w-16 object-contain rounded border"
                  />
                )}
                <div className="space-y-0.5 flex-1">
                  <p className="font-bold text-lg">{profile.company_name ?? "-"}</p>
                  {profile.tagline && (
                    <p className="text-xs text-muted-foreground">{profile.tagline}</p>
                  )}
                  {profile.address && (
                    <p className="text-xs text-muted-foreground">{profile.address}</p>
                  )}
                  {(profile.city || profile.state || profile.zip_code) && (
                    <p className="text-xs text-muted-foreground">
                      {[profile.city, profile.state, profile.zip_code].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {profile.phone && (
                    <p className="text-xs text-muted-foreground">Phone: {profile.phone}</p>
                  )}
                  {profile.email && (
                    <p className="text-xs text-muted-foreground">Email: {profile.email}</p>
                  )}
                </div>
              </div>
              
              {/* Bank Details */}
              {(profile.bank_name || profile.account_no || profile.ifsc_code || profile.upi_id) && (
                <div className="border-t border-border mt-4 pt-4">
                  <p className="font-semibold text-sm mb-2">Bank Details</p>
                  <div className="text-xs space-y-1 text-muted-foreground">
                    {profile.bank_name && <p>Bank: {profile.bank_name}</p>}
                    {profile.account_no && <p>Account No: {profile.account_no}</p>}
                    {profile.ifsc_code && <p>IFSC: {profile.ifsc_code}</p>}
                    {profile.upi_id && <p>UPI: {profile.upi_id}</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CUSTOMER INFORMATION */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billed To</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Name</p>
              <p className="font-medium">{invoice.client_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Invoice Date</p>
              <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Due Date</p>
              <p className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</p>
            </div>
            {invoice.payment_terms && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Payment Terms</p>
                <p className="font-medium text-sm">{invoice.payment_terms}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Address</p>
              <p className="font-medium">{invoice.client_address ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client District</p>
              <p className="font-medium">{invoice.client_district ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client State</p>
              <p className="font-medium">{invoice.client_state ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Pin Code</p>
              <p className="font-medium">{invoice.client_pin_code ?? "-"}</p>
            </div>
            {invoice.subject && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Subject</p>
                <p className="font-medium">{invoice.subject}</p>
              </div>
            )}
            {invoice.quotation_id && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Linked Quotation</p>
                <Link href={`/quotations/${invoice.quotation_id}`} className="text-blue-600 hover:underline text-sm font-medium">
                  View Quotation
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ITEMS TABLE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-center py-3 px-4 font-semibold w-12">SR.</th>
                    <th className="text-left py-3 px-4 font-semibold">Description</th>
                    <th className="text-center py-3 px-4 font-semibold w-16">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold w-32">Unit Price</th>
                    <th className="text-right py-3 px-4 font-semibold w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No items found
                      </td>
                    </tr>
                  ) : (
                    mappedItems.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="text-center py-3 px-4 text-muted-foreground">{item.sr}</td>
                        <td className="py-3 px-4">{item.description}</td>
                        <td className="text-center py-3 px-4">{item.qty}</td>
                        <td className="text-right py-3 px-4">₹{Number(item.rate).toLocaleString("en-IN")}</td>
                        <td className="text-right py-3 px-4 font-medium">₹{Number(item.amount).toLocaleString("en-IN")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* TOTALS */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-end gap-3 max-w-xs ml-auto">
              {includeGst ? (
                <>
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-muted-foreground">SGST (9%):</span>
                    <span className="font-medium">₹{sgst.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-muted-foreground">CGST (9%):</span>
                    <span className="font-medium">₹{cgst.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-1 flex justify-between w-full">
                    <span className="text-lg font-bold">Grand Total:</span>
                    <span className="text-lg font-bold text-blue-600">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between w-full">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-lg font-bold text-blue-600">
                    ₹{subtotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* NOTES */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
