"use client"
 
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase, type Quotation, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Edit,
  Loader2,
  FileText,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
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
 
export default function ViewQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  // Persist stamp toggle in localStorage — survives page refresh
  const [includeStamp, setIncludeStamp] = useState<boolean>(false)
  const [convertLoading, setConvertLoading] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toISOString().split('T')[0]
  })
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState("")
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [orderNo, setOrderNo] = useState("")
  const [orderDate, setOrderDate] = useState("")
  const id = params.id as string

  // Load stamp toggle from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`stamp_toggle_q_${id}`)
    if (saved === "true") setIncludeStamp(true)
  }, [id])

  // Save stamp toggle to localStorage whenever it changes
  const handleStampToggle = () => {
    const newVal = !includeStamp
    setIncludeStamp(newVal)
    localStorage.setItem(`stamp_toggle_q_${id}`, String(newVal))
  }
 
  useEffect(() => {
    if (user?.id && id) loadData()
  }, [id, user?.id])
 
  useEffect(() => {
    if (profile?.payment_terms) {
      setSelectedPaymentTerms(profile.payment_terms)
    }
  }, [profile?.payment_terms])
 
  const loadData = async () => {
    setLoading(true)
    try {
      const [{ data: qData, error: qErr }, { data: pData }] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", id).single(),
        supabase.from("company_profile").select("*").eq("user_id", user!.id).single(),
      ])
      if (qErr) throw qErr
      setQuotation(qData as Quotation)
      if (pData) setProfile(pData as CompanyProfile)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load quotation")
    } finally {
      setLoading(false)
    }
  }
 
  const generateNextInvoiceNo = async () => {
    try {
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user!.id)
        .maybeSingle()
      const orgId = membership?.org_id
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_no")
        .eq("org_id", orgId ?? "")
      if (error) throw error
      if (!data || data.length === 0) return "INV-001"
      const numbers = data
        .map(inv => {
          const match = (inv.invoice_no || "").match(/(\d+)$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(n => n > 0)
      if (numbers.length === 0) return "INV-001"
      const maxNumber = Math.max(...numbers)
      return `INV-${String(maxNumber + 1).padStart(3, '0')}`
    } catch (err) {
      console.error(err)
      return "INV-001"
    }
  }
 
  const handleOpenConvertModal = async () => {
    const nextNo = await generateNextInvoiceNo()
    setInvoiceNo(nextNo)
    setShowConvertModal(true)
  }
 
  const handleConvertToInvoice = async () => {
    if (!quotation || !user?.id) return
    setConvertLoading(true)
    try {
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle()
      const orgId = membership?.org_id
      if (!orgId) throw new Error("No organization found")

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          org_id: orgId,
          quotation_id: quotation.id,
          invoice_no: invoiceNo,
          order_no: orderNo || null,
          order_date: orderDate || null,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: selectedPaymentTerms,
          payment_status: "Unpaid",
          notes: invoiceNotes,
          client_name: quotation.client_name,
          client_address: quotation.client_address,
          client_district: quotation.client_district,
          client_state: quotation.client_state,
          client_pin_code: quotation.client_pin_code,
          subject: quotation.subject,
          body_text: quotation.body_text,
          items: quotation.items,
          subtotal: quotation.subtotal,
          sgst: quotation.sgst,
          cgst: quotation.cgst,
          grand_total: quotation.grand_total,
          include_gst: quotation.include_gst,
        })
        .select()
        .single()
 
      if (error) throw error
      
      // Update the quotation record with the invoice_id
      const { error: updateErr } = await supabase
        .from("quotations")
        .update({ invoice_id: data.id })
        .eq("id", quotation.id)
      
      if (updateErr) throw updateErr
      
      // Update the quotation state with the invoice_id so button switches immediately
      setQuotation({ ...quotation, invoice_id: data.id })
      
      toast.success("Invoice generated successfully")
      setShowConvertModal(false)
      
      // Navigate after a brief delay to allow UI to update
      setTimeout(() => {
        router.push(`/invoices/${data.id}`)
      }, 500)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate invoice: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setConvertLoading(false)
    }
  }
 

 
  const getMappedItems = () => {
    return (quotation?.items ?? []).map((item: any, index: number) => ({
      sr: index + 1,
      description: item.particulars ?? item.description ?? item.name ?? "-",
      qty: item.qty ?? item.quantity ?? 1,
      rate: Number(item.rate ?? item.unit_price ?? 0),
      amount: Number(item.amount ?? ((item.qty ?? item.quantity ?? 0) * (item.rate ?? item.unit_price ?? 0)) ?? 0),
    }))
  }
 
  const calculateTotals = () => {
    if (!quotation) return { subtotal: 0, sgst: 0, cgst: 0, grandTotal: 0 }
    const items = quotation.items ?? []
    const subtotal = items.reduce((sum, item) => 
      sum + (Number(item.qty ?? item.quantity ?? 1) * Number(item.rate ?? item.unit_price ?? 0)), 0)
    const includeGst = quotation.include_gst ?? true
    const sgst = includeGst ? Math.round(subtotal * 0.09) : 0
    const cgst = includeGst ? Math.round(subtotal * 0.09) : 0
    const grandTotal = subtotal + sgst + cgst
    return { subtotal, sgst, cgst, grandTotal }
  }
 
  const getGrandTotal = () => {
    return calculateTotals().grandTotal
  }
 
  const handleWhatsApp = () => {
    if (!quotation) return
    const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
    const items = quotation.items ?? []
    const includeGst = quotation.include_gst ?? true
    const gstTotal = sgst + cgst
    const msg =
      `*Quotation - ${safeStr(profile?.company_name)}*\n` +
      `Quote No: ${safeStr(quotation.quote_no)}\n` +
      `Date: ${safeDate(quotation.created_at)}\n` +
      `Valid till: ${safeDate(quotation.valid_till)}\n\n` +
      `*Customer:* ${safeStr(quotation.client_name)}\n\n` +
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
      `To confirm reply YES or call ${safeStr(profile?.company_phone)}\n\n` +
      `_Powered by Remindi_`
    window.open("https://wa.me/?text=" + encodeURIComponent(msg))
  }
 
  const handleDownloadPdf = async (stampToggle: boolean = false) => {
    if (!quotation) return
    setGeneratingPdf(true)
    try {
      const items = quotation.items ?? []
      const subtotal = items.reduce((sum, item) => sum + (Number(item.qty ?? item.quantity ?? 1) * Number(item.rate ?? item.unit_price ?? 0)), 0)
      const includeGst = quotation.include_gst ?? true
      const sgst = includeGst ? Math.round(subtotal * 0.09) : 0
      const cgst = includeGst ? Math.round(subtotal * 0.09) : 0
      const grandTotal = subtotal + sgst + cgst
      const themeColor = profile?.theme_color ?? '#185FA5'

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

      const printWindow = window.open('', '_blank')
      if (!printWindow) { toast.error('Please allow popups to download PDF'); return }
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Quotation ${safeStr(quotation.quote_no)}</title>
        <style>body{font-family:helvetica,sans-serif;margin:20px;color:#000;font-size:10px}
        h2{font-size:14px;margin:0}
        .header{border-bottom:2px solid ${themeColor};padding-bottom:8px;margin-bottom:12px}
        .right{text-align:right}.bold{font-weight:bold}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th{background:${themeColor};color:#fff;padding:5px 4px;text-align:left;font-size:9px}
        td{padding:4px;border:1px solid #ddd;font-size:9px}
        .totals td{border:none;padding:2px 4px}
        .footer-sig{text-align:right;margin-top:20px}
        footer{font-size:8px;color:#999;text-align:center;margin-top:20px}
        @media print{@page{margin:15mm}}</style></head>
        <body>
        <div class="header">
          ${profile?.logo_url ? `<img src="${profile.logo_url}" style="height:40px;float:left;margin-right:10px"/>` : ''}
          <h2>${safeStr(profile?.company_name)}</h2>
          <div style="color:#888;font-size:9px">${profile?.address ?? ''} ${profile?.city ?? ''} ${profile?.state ?? ''}<br/>
          ${profile?.phone ? 'Ph: ' + profile.phone : ''} ${profile?.email ? '| ' + profile.email : ''} ${profile?.gstin ? '| GSTIN: ' + profile.gstin : ''}</div>
          <div style="clear:both"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <div><div class="bold">${safeStr(quotation.quote_no)}</div></div>
          <div class="right">DATE: ${quotation.created_at ? new Date(quotation.created_at).toLocaleDateString('en-IN') : '-'}</div>
        </div>
        <div style="margin-bottom:10px">TO,<br/>THE OWNER,<br/><strong>${safeStr(quotation.client_name).toUpperCase()}</strong><br/>
        ${quotation.client_address ?? ''}<br/>${[quotation.client_district, quotation.client_state, quotation.client_pin_code].filter(Boolean).join(', ')}</div>
        ${quotation.subject ? `<div class="bold">Sub: ${safeStr(quotation.subject)}</div>` : ''}
        ${quotation.body_text ? `<div style="margin:6px 0;color:#444">${safeStr(quotation.body_text)}</div>` : ''}
        <table><thead><tr><th>SR.NO</th><th>PARTICULARS</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead>
        <tbody>${itemRows}</tbody></table>
        <table class="totals" style="width:auto;margin-left:auto">
          <tr><td>Subtotal:</td><td class="right">Rs. ${subtotal.toLocaleString('en-IN')}</td></tr>
          ${includeGst ? `<tr><td>SGST (9%):</td><td class="right">Rs. ${sgst.toLocaleString('en-IN')}</td></tr>
          <tr><td>CGST (9%):</td><td class="right">Rs. ${cgst.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr><td class="bold">Total:</td><td class="bold right">Rs. ${grandTotal.toLocaleString('en-IN')}</td></tr>
        </table>
        ${quotation.notes ? `<div style="margin-top:10px"><strong>Terms &amp; Conditions:</strong><br/><span style="color:#555">${safeStr(quotation.notes)}</span></div>` : ''}
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
 
  if (!quotation) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Quotation not found</p>
          <Link href="/quotations">
            <Button>Back to Quotations</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }
 
  const mappedItems = getMappedItems()
  const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
  const includeGst = quotation.include_gst ?? true
  const statusLower = (quotation.status ?? "draft").toLowerCase()
 
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
 
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/quotations">
              <Button variant="outline" size="icon" className="shrink-0 mt-1">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {quotation.quote_no ?? ("QT-" + quotation.id)}
              </h1>
              {quotation.order_no && (
                <p className="text-sm text-muted-foreground">
                  Order No: <span className="font-medium text-foreground">{quotation.order_no}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(quotation.created_at)}
              </p>
            </div>
          </div>
 
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
           
 
            {quotation.invoice_id ? (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                size="sm"
                onClick={() => router.push(`/invoices/${quotation.invoice_id}`)}
              >
                <FileText className="mr-1.5 size-4" />
                View Invoice
              </Button>
            ) : (
              <Button
                onClick={handleOpenConvertModal}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <FileText className="mr-2 size-4" />
                Convert to Invoice
              </Button>
            )}
            <Link href={`/quotations/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-1.5 size-4" />
                Edit
              </Button>
            </Link>
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
                <div className="space-y-0.5">
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
            </CardContent>
          </Card>
        )}
 
        {/* CUSTOMER INFORMATION */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Name</p>
              <p className="font-medium">{quotation.client_name ?? "-"}</p>
            </div>
           
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Address</p>
              <p className="font-medium">{quotation.client_address ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">District</p>
              <p className="font-medium">{quotation.client_district ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">State</p>
              <p className="font-medium">{quotation.client_state ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Pin Code</p>
              <p className="font-medium">{quotation.client_pin_code ?? "-"}</p>
            </div>
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
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-12">SR</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-16">Qty</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-28">Rate</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No items
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
        {quotation.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
 
      {/* Convert to Invoice Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to Invoice</DialogTitle>
            {quotation && (
              <p className="text-xs text-muted-foreground mt-1">From {quotation.quote_no}</p>
            )}
          </DialogHeader>
 
          <div className="space-y-4">
            {/* Order Number */}
            <div className="space-y-2">
              <Label htmlFor="order-no">Order Number (Optional)</Label>
              <Input
                id="order-no"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="e.g. PO-2026-001"
              />
            </div>
 
            {/* Order Date */}
            <div className="space-y-2">
              <Label htmlFor="order-date">Order Date (Optional)</Label>
              <Input
                id="order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
 
            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice-no">Invoice Number</Label>
              <Input
                id="invoice-no"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="INV-001"
              />
            </div>
 
            {/* Invoice Date */}
            <div className="space-y-2">
              <Label htmlFor="invoice-date">Invoice Date</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
 
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due-date">Valid till</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
 
            {/* Payment Terms */}
            <div className="space-y-2">
              <Label htmlFor="payment-terms">Payment Terms</Label>
              <Select value={selectedPaymentTerms} onValueChange={setSelectedPaymentTerms}>
                <SelectTrigger id="payment-terms">
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
              <Label htmlFor="invoice-notes">Terms and Conditions</Label>
              <Textarea
                id="invoice-notes"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="e.g. Please transfer to bank account..."
                className="min-h-[80px] resize-none"
              />
            </div>
 
            {/* Summary */}
            {quotation && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Client:</span> {quotation.client_name}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Subtotal:</span> ₹{quotation.subtotal.toLocaleString("en-IN")}
                </p>
                {quotation.include_gst && (
                  <>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">SGST 9%:</span> ₹{quotation.sgst.toLocaleString("en-IN")}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">CGST 9%:</span> ₹{quotation.cgst.toLocaleString("en-IN")}
                    </p>
                  </>
                )}
                <p className="text-foreground font-semibold border-t border-border pt-2">
                  Grand Total: ₹{quotation.grand_total.toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>
 
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertToInvoice}
              disabled={convertLoading || !invoiceNo}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {convertLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
