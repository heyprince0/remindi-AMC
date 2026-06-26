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
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

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
  const [showEditModal, setShowEditModal] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editInvoiceNo, setEditInvoiceNo] = useState("")
  const [editOrderNo, setEditOrderNo] = useState("")
  const [editOrderDate, setEditOrderDate] = useState("")
  const [editInvoiceDate, setEditInvoiceDate] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [editPaymentTerms, setEditPaymentTerms] = useState("")
  // Persist stamp toggle in localStorage — survives page refresh
  const [includeStamp, setIncludeStamp] = useState<boolean>(false)
  const [editNotes, setEditNotes] = useState("")
  const [quotationData, setQuotationData] = useState<{ quote_no: string } | null>(null)
  const id = params.id as string

  // Load stamp toggle from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`stamp_toggle_inv_${id}`)
    if (saved === 'true') setIncludeStamp(true)
  }, [id])

  // Save stamp toggle to localStorage whenever it changes
  const handleStampToggle = () => {
    const newVal = !includeStamp
    setIncludeStamp(newVal)
    localStorage.setItem(`stamp_toggle_inv_${id}`, String(newVal))
  }

  useEffect(() => {
    if (user?.id && id) loadData()
  }, [id, user?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: iData, error: iErr }, { data: pData }] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", id).single(),
        supabase.from("company_profile").select("*").eq("user_id", user!.id).single(),
      ])
      if (iErr) throw iErr
      const invoiceData = iData as Invoice
      setInvoice(invoiceData)
      if (pData) setProfile(pData as CompanyProfile)
      
      // Fetch quotation data if quotation_id exists
      if (invoiceData.quotation_id) {
        const { data: quotData } = await supabase
          .from("quotations")
          .select("quote_no")
          .eq("id", invoiceData.quotation_id)
          .single()
        if (quotData) setQuotationData(quotData)
      }
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

  const handleOpenEditModal = () => {
    if (!invoice) return
    setEditInvoiceNo(invoice.invoice_no || "")
    setEditOrderNo(invoice.order_no || "")
    setEditOrderDate(invoice.order_date || "")
    setEditInvoiceDate(invoice.invoice_date || "")
    setEditDueDate(invoice.due_date || "")
    setEditPaymentTerms(invoice.payment_terms || "")
    setEditNotes(invoice.notes || "")
    setShowEditModal(true)
  }

  const handleSaveChanges = async () => {
    if (!invoice || !user?.id) return
    setEditLoading(true)
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_no: editInvoiceNo,
          order_no: editOrderNo || null,
          order_date: editOrderDate || null,
          invoice_date: editInvoiceDate,
          due_date: editDueDate,
          payment_terms: editPaymentTerms,
          notes: editNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)
      
      if (error) throw error
      toast.success("Invoice updated successfully")
      setShowEditModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      toast.error("Failed to update invoice")
    } finally {
      setEditLoading(false)
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

  const handleDownloadPdf = async (stampToggle: boolean = false) => {
    if (!invoice) return
    setGeneratingPdf(true)
    try {
      const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
      const includeGst = invoice.include_gst ?? true
      const themeColor = profile?.theme_color ?? '#185FA5'
      const items = invoice.items ?? []

      let stampHtml = ''
      if (stampToggle && profile?.stamp_url) {
        try {
          const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(profile.stamp_url)
          stampHtml = `<img src="${urlData.publicUrl}" style="width:80px;height:80px;object-fit:contain" /><br/><small style="color:#888">Authorized Signatory</small>`
        } catch(e) { /* skip */ }
      }

      const itemRows = items.map((item: any, idx: number) => `
        <tr><td>${idx+1}</td><td>${item.particulars ?? item.description ?? item.name ?? '-'}</td>
        <td>${item.qty ?? item.quantity ?? 1}</td>
        <td>Rs. ${Number(item.rate ?? item.unit_price ?? 0).toLocaleString('en-IN')}</td>
        <td>Rs. ${Number(item.amount ?? 0).toLocaleString('en-IN')}</td></tr>`).join('')

      const isPaid = invoice.payment_status?.toLowerCase() === 'paid'

      const printWindow = window.open('', '_blank')
      if (!printWindow) { toast.error('Please allow popups to download PDF'); return }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${safeStr(invoice.invoice_no)}</title>
        <style>body{font-family:helvetica,sans-serif;margin:20px;color:#000;font-size:10px;position:relative}
        h2{font-size:14px;margin:0}
        .header{border-bottom:2px solid ${themeColor};padding-bottom:8px;margin-bottom:12px}
        .right{text-align:right}.bold{font-weight:bold}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th{background:${themeColor};color:#fff;padding:5px 4px;text-align:left;font-size:9px}
        td{padding:4px;border:1px solid #ddd;font-size:9px}
        .totals td{border:none;padding:2px 4px}
        .footer-sig{text-align:right;margin-top:20px}
        .watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:bold;color:rgba(180,230,180,0.4);pointer-events:none;z-index:-1}
        footer{font-size:8px;color:#999;text-align:center;margin-top:20px}
        @media print{@page{margin:15mm}.watermark{position:fixed}}</style></head>
        <body>
        ${isPaid ? '<div class="watermark">PAID</div>' : ''}
        <div class="header">
          ${profile?.logo_url ? `<img src="${profile.logo_url}" style="height:40px;float:left;margin-right:10px"/>` : ''}
          <h2>${safeStr(profile?.company_name)}</h2>
          <div style="color:#888;font-size:9px">${profile?.address ?? ''} ${profile?.city ?? ''} ${profile?.state ?? ''}<br/>
          ${profile?.phone ? 'Ph: ' + profile.phone : ''} ${profile?.email ? '| ' + profile.email : ''} ${profile?.gstin ? '| GSTIN: ' + profile.gstin : ''}</div>
          <div style="clear:both"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <div><div class="bold" style="color:${themeColor};font-size:14px">TAX INVOICE</div>
          <div class="bold">${safeStr(invoice.invoice_no)}</div></div>
          <div class="right">DATE: ${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN') : '-'}<br/>
          <span style="color:#dc2626">Valid Till: ${safeStr(invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : '-')}</span>
          ${invoice.order_no ? '<br/>Order No: ' + safeStr(invoice.order_no) : ''}</div>
        </div>
        <div style="margin-bottom:10px"><span style="color:#999">BILL TO:</span><br/>
        <strong>${safeStr(invoice.client_name).toUpperCase()}</strong><br/>
        ${invoice.client_address ?? ''}<br/>${[invoice.client_district, invoice.client_state, invoice.client_pin_code].filter(Boolean).join(', ')}</div>
        <table><thead><tr><th>SR.NO</th><th>PARTICULARS</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
        <tbody>${itemRows}</tbody></table>
        <table class="totals" style="width:auto;margin-left:auto">
          ${includeGst ? `<tr><td>Subtotal:</td><td class="right">Rs. ${subtotal.toLocaleString('en-IN')}</td></tr>
          <tr><td>SGST (9%):</td><td class="right">Rs. ${sgst.toLocaleString('en-IN')}</td></tr>
          <tr><td>CGST (9%):</td><td class="right">Rs. ${cgst.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr><td class="bold">Total:</td><td class="bold right">Rs. ${grandTotal.toLocaleString('en-IN')}</td></tr>
        </table>
        ${invoice.notes ? `<div style="margin-top:10px"><strong>Terms &amp; Conditions:</strong><br/><span style="color:#555">${safeStr(invoice.notes)}</span></div>` : ''}
        <div class="footer-sig"><div>Thanking you,</div><div>Yours faithfully,</div><div class="bold">For ${safeStr(profile?.company_name)}</div>${stampHtml}</div>
        <footer>Generated by Remindi · remindi.online</footer>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script>
        </body></html>`)
      printWindow.document.close()
      toast.success('PDF opened — use Print > Save as PDF')
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

            {profile?.stamp_url || profile?.signature_url ? (
              <Button
                onClick={handleStampToggle}
                disabled={generatingPdf}
                variant="outline"
                size="sm"
                className={includeStamp ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100' : ''}
              >
                {includeStamp ? (
                  <CheckCircle2 className="mr-1.5 size-4" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-4 opacity-40" />
                )}
                Stamp: {includeStamp ? 'ON' : 'OFF'}
              </Button>
            ) : null}
            <Button
              onClick={() => handleDownloadPdf(includeStamp)}
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
            <Button
              onClick={handleOpenEditModal}
              variant="outline"
              size="sm"
            >
              <Edit className="mr-1.5 size-4" />
              Edit
            </Button>
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
                  {profile.gstin && (
                    <p className="text-xs text-muted-foreground">GSTIN: {profile.gstin}</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Vaild till</p>
              <p className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "-"}</p>
            </div>
            {invoice.order_no && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Order No</p>
                <p className="font-medium">{invoice.order_no}</p>
              </div>
            )}
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
              <CardTitle className="text-base">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Invoice Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            {quotationData && (
              <p className="text-xs text-muted-foreground mt-1">From {quotationData.quote_no}</p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Number */}
            <div className="space-y-2">
              <Label htmlFor="edit-order-no">Order Number (Optional)</Label>
              <Input
                id="edit-order-no"
                value={editOrderNo}
                onChange={(e) => setEditOrderNo(e.target.value)}
                placeholder="e.g. PO-2026-001"
              />
            </div>

            {/* Order Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-order-date">Order Date (Optional)</Label>
              <Input
                id="edit-order-date"
                type="date"
                value={editOrderDate}
                onChange={(e) => setEditOrderDate(e.target.value)}
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-no">Invoice Number</Label>
              <Input
                id="edit-invoice-no"
                value={editInvoiceNo}
                onChange={(e) => setEditInvoiceNo(e.target.value)}
                placeholder="INV-001"
              />
            </div>

            {/* Invoice Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-date">Invoice Date</Label>
              <Input
                id="edit-invoice-date"
                type="date"
                value={editInvoiceDate}
                onChange={(e) => setEditInvoiceDate(e.target.value)}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Valid till</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <Label htmlFor="edit-payment-terms">Payment Terms</Label>
              <Select value={editPaymentTerms} onValueChange={setEditPaymentTerms}>
                <SelectTrigger id="edit-payment-terms">
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100% advance along with work order">100% advance along with work order</SelectItem>
                  <SelectItem value="50% advance, balance on completion">50% advance, balance on completion</SelectItem>
                  <SelectItem value="Net 7 days">Net 7 days</SelectItem>
                  <SelectItem value="Net 14 days">Net 14 days</SelectItem>
                  <SelectItem value="Net 30 days">Net 30 days</SelectItem>
                  <SelectItem value="On completion">On completion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-notes">Terms & Conditions</Label>
              <Textarea
                id="edit-invoice-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Please transfer to bank account..."
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Summary */}
            {invoice && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Client:</span> {invoice.client_name}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Subtotal:</span> ₹{invoice.subtotal.toLocaleString("en-IN")}
                </p>
                {invoice.include_gst && (
                  <>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">SGST 9%:</span> ₹{invoice.sgst.toLocaleString("en-IN")}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">CGST 9%:</span> ₹{invoice.cgst.toLocaleString("en-IN")}
                    </p>
                  </>
                )}
                <p className="text-foreground font-semibold border-t border-border pt-2">
                  Grand Total: ₹{invoice.grand_total.toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={editLoading || !editInvoiceNo}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
