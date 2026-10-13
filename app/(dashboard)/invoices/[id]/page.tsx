// app/invoices/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { supabase, type Invoice, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import {
  ArrowLeft,
  Download,
  Edit,
  Loader2,
  FileText,
  CheckCircle2,
  Upload,
  Save,
  Stamp,
  Share2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"

const safeStr = (val: any) => String(val ?? "-")
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

function getPaymentStatusBadge(status: string) {
  const statusLower = (status || "").toLowerCase()
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    unpaid: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", label: "Unpaid" },
    partial: { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400", label: "Partial" },
    paid: { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", label: "Paid" },
  }
  const config = statusConfig[statusLower] || statusConfig.unpaid
  return <Badge className={`${config.bg} ${config.text} border-0`}>{config.label}</Badge>
}

// Helper — pull the company GST stored on the invoice row,
// regardless of which column name it uses.
function getInvoiceGst(invoice: any): string | null {
  if (!invoice) return null
  const v = invoice.gstin ?? invoice.company_gstin ?? invoice.company_gst ?? null
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

export default function ViewInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [includeStamp, setIncludeStamp] = useState<boolean>(false)
  const id = params.id as string

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [subscriptionAlertOpen, setSubscriptionAlertOpen] = useState(false)

  // Stamp upload states
  const [showStampUploadDialog, setShowStampUploadDialog] = useState(false)
  const [stampFile, setStampFile] = useState<File | null>(null)
  const [stampPreview, setStampPreview] = useState<string | null>(null)
  const [uploadingStamp, setUploadingStamp] = useState(false)

  const { status, planName, isLoading: limitsLoading } = usePlanLimits(currentOrgId)

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
    const saved = localStorage.getItem(`stamp_toggle_inv_${id}`)
    if (saved === "true") setIncludeStamp(true)
  }, [id])

  const handleStampToggle = () => {
    if (!profile?.stamp_url && !profile?.signature_url) {
      setShowStampUploadDialog(true)
      return
    }
    const newVal = !includeStamp
    setIncludeStamp(newVal)
    localStorage.setItem(`stamp_toggle_inv_${id}`, String(newVal))
  }

  useEffect(() => {
    if (user?.id && id && currentOrgId) {
      loadData()
    }
  }, [id, user?.id, currentOrgId])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: iData, error: iErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("org_id", currentOrgId)
        .single()

      if (iErr) throw iErr

      const { data: pData } = await supabase
        .from("company_profile")
        .select("*")
        .eq("org_id", currentOrgId)
        .single()

      setInvoice(iData as Invoice)
      if (pData) setProfile(pData as CompanyProfile)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }

  const handleUploadStamp = async () => {
    if (!stampFile || !currentOrgId) return
    setUploadingStamp(true)
    try {
      const fileName = `stamp-${currentOrgId}-${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, stampFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('company_profile')
        .update({ stamp_url: publicUrl })
        .eq('org_id', currentOrgId)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, stamp_url: publicUrl } : null)
      setIncludeStamp(true)
      localStorage.setItem(`stamp_toggle_inv_${id}`, 'true')
      toast.success('Stamp uploaded successfully')
      setShowStampUploadDialog(false)
      setStampFile(null)
      setStampPreview(null)
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload stamp')
    } finally {
      setUploadingStamp(false)
    }
  }

  const handleEditClick = () => {
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (status === 'expired' || status === 'cancelled') {
      setSubscriptionAlertOpen(true)
      return
    }
    router.push(`/invoices/${id}/edit`)
  }

  const handlePaymentStatusChange = async (newStatus: string) => {
    if (!invoice || !currentOrgId) return
    setUpdatingStatus(true)
    const prev = invoice.payment_status
    setInvoice({ ...invoice, payment_status: newStatus })
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: newStatus })
        .eq("id", invoice.id)
        .eq("org_id", currentOrgId)
      if (error) throw error
      toast.success("Payment status updated")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update payment status")
      setInvoice({ ...invoice, payment_status: prev })
    } finally {
      setUpdatingStatus(false)
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

  const getTotals = () => {
    if (!invoice) return { subtotal: 0, discountAmount: 0, discountType: null, discountValue: 0, sgst: 0, cgst: 0, grandTotal: 0 }
    const subtotal = invoice.subtotal || 0
    const discountAmount = invoice.discount_amount || 0
    const sgst = invoice.sgst || 0
    const cgst = invoice.cgst || 0
    const grandTotal = invoice.grand_total || 0
    return { subtotal, discountAmount, discountType: invoice.discount_type, discountValue: invoice.discount_value || 0, sgst, cgst, grandTotal }
  }

  // ── Shared PDF builder ─────────────────────────────────────────────────────
  // Returns { doc, filename } — used by both download and WhatsApp share.
  const buildPdfDoc = async (stampToggle: boolean = false): Promise<{ doc: jsPDF; filename: string } | null> => {
    if (!invoice) return null

    const shouldIncludeStamp = stampToggle && (!!profile?.stamp_url || !!profile?.signature_url)

    try {
      const pageW = 210
      const margin = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)

      const headerStyle = profile?.header_style ?? "single_logo"
      let bannerBase64: string | null = null
      let bannerFormat: "JPEG" | "PNG" = "PNG"
      let bannerH = 0
      if (headerStyle === "thumbnail" && profile?.header_thumbnail_url) {
        try {
          const response = await fetch(profile.header_thumbnail_url)
          const blob = await response.blob()
          bannerFormat = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG'
          bannerBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          const naturalSize = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = reject
            img.src = bannerBase64 as string
          })
          const bannerW = pageW - (margin * 2)
          bannerH = Math.round(bannerW / (naturalSize.w / naturalSize.h))
          const maxBannerH = 60
          if (bannerH > maxBannerH) bannerH = maxBannerH
        } catch (e) { /* skip banner */ }
      }

      let logoBase64: string | null = null
      let logoFormat: "JPEG" | "PNG" = "PNG"
      if (headerStyle !== "thumbnail" && profile?.logo_url) {
        try {
          const response = await fetch(profile.logo_url)
          const blob = await response.blob()
          logoFormat = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG'
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        } catch (e) { /* skip logo */ }
      }

      let stampBase64: string | null = null
      let stampFormat: "JPEG" | "PNG" = "PNG"
      if (shouldIncludeStamp && profile?.stamp_url) {
        const stampPublicUrl = profile.stamp_url
        const MAX_STAMP_ATTEMPTS = 3
        for (let attempt = 1; attempt <= MAX_STAMP_ATTEMPTS; attempt++) {
          try {
            const stampResponse = await fetch(stampPublicUrl, { cache: 'no-store' })
            if (!stampResponse.ok) throw new Error(`HTTP ${stampResponse.status}`)
            const stampBlob = await stampResponse.blob()
            stampBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(stampBlob)
            })
            stampFormat = stampBlob.type.includes('jpeg') ? 'JPEG' : 'PNG'
            break
          } catch (e) {
            console.warn(`[Stamp] Attempt ${attempt} failed:`, e)
            if (attempt === MAX_STAMP_ATTEMPTS) {
              toast.warning('Stamp image could not be loaded – skipping stamp')
            } else {
              await new Promise(res => setTimeout(res, 400 * attempt))
            }
          }
        }
      }

      const items = invoice.items ?? []
      const { subtotal, discountAmount, discountType, discountValue, sgst, cgst, grandTotal } = getTotals()
      const invoiceGstin = getInvoiceGst(invoice)

      const renderInvoice = (doc: jsPDF): number => {
        let y = margin

        if (headerStyle === "thumbnail" && bannerBase64) {
          const bannerW = pageW - (margin * 2)
          doc.addImage(bannerBase64, bannerFormat, margin, y, bannerW, bannerH)
          y += bannerH + 6
        } else if (headerStyle === "single_logo") {
          y = renderSingleLogoHeader(doc, profile, y, logoBase64, pageW, margin, [tr, tg, tb])
        } else {
          let logoX = margin
          let logoAdded = false
          if (logoBase64) {
            doc.addImage(logoBase64, logoFormat, logoX, y, 22, 22)
            logoAdded = true
          }
          const infoX = logoAdded ? logoX + 24 : logoX
          doc.setFontSize(14)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text(safeStr(profile?.company_name), infoX, y + 2)

          doc.setFontSize(9)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(120, 120, 120)
          let infoY = y + 8
          if (profile?.tagline) { doc.text(safeStr(profile.tagline), infoX, infoY); infoY += 4 }
          if (profile?.address) { doc.text(safeStr(profile.address), infoX, infoY); infoY += 4 }
          if (profile?.city || profile?.state || profile?.zip_code) {
            const locationStr = [profile.city, profile.state, profile.zip_code].filter(Boolean).join(", ")
            doc.text(locationStr, infoX, infoY); infoY += 4
          }
          if (profile?.phone) { doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, infoY); infoY += 4 }
          if (profile?.email) { doc.text(`Email: ${safeStr(profile.email)}`, infoX, infoY); infoY += 4 }
          if (profile?.gstin) { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, infoX, infoY) }
          y += 31

          doc.setDrawColor(tr, tg, tb)
          doc.setLineWidth(0.5)
          doc.line(margin, y, pageW - margin, y)
          y += 6
        }

        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(tr, tg, tb)
        doc.text('TAX INVOICE', pageW - margin, y, { align: 'right' })

        y += 6
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(invoice.invoice_no ?? ("INV-" + invoice.id)), margin, y)
        const formattedDate = invoice.invoice_date
          ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        doc.text('DATE: ' + formattedDate, pageW - margin, y, { align: 'right' })

        y += 5
        if (invoice.due_date) {
          doc.setFontSize(9)
          doc.setTextColor(220, 38, 38)
          doc.text('Due Date: ' + safeDate(invoice.due_date), pageW - margin, y, { align: 'right' })
          y += 5
        }
        if (invoice.order_no) {
          doc.setFontSize(9)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(0, 0, 0)
          doc.text('Order No: ' + safeStr(invoice.order_no), pageW - margin, y, { align: 'right' })
          y += 5
        }
        if (invoice.order_date) {
          const orderDateFormatted = new Date(invoice.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
          doc.text('Order Date: ' + orderDateFormatted, pageW - margin, y, { align: 'right' })
        }
        doc.setTextColor(0, 0, 0)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text("TO,", margin, y)
        y += 5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
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

        // ✅ GST stored on the invoice — shown under customer address, only if present
        if (invoiceGstin) {
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text('GSTIN: ' + invoiceGstin, margin, y)
          y += 5
        }
        y += 3

        if (invoice.subject) {
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text('Sub: ' + safeStr(invoice.subject), margin, y)
          y += 5
        }
        if (invoice.body_text) {
          doc.setFont("helvetica", "normal")
          doc.setTextColor(80, 80, 80)
          const bodyLines = doc.splitTextToSize(safeStr(invoice.body_text), pageW - 2 * margin)
          doc.text(bodyLines, margin, y)
          y += (bodyLines.length * 4) + 3
        }

        const tableBody = items.map((item: any, idx: number) => [
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
          pageBreak: "avoid",
          rowPageBreak: "avoid",
        })

        y = (doc as any).lastAutoTable.finalY + 8

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)

        doc.text('Subtotal:', 160, y, { align: 'right' })
        doc.text('Rs. ' + subtotal.toLocaleString('en-IN'), 195, y, { align: 'right' })
        y += 4

        if (discountAmount > 0) {
          const discountLabel = discountType === "percentage"
            ? `${discountValue}%`
            : `₹${discountValue}`
          doc.text(`Discount (${discountLabel}):`, 160, y, { align: 'right' })
          doc.setTextColor(200, 0, 0)
          doc.text('- Rs. ' + discountAmount.toLocaleString('en-IN'), 195, y, { align: 'right' })
          doc.setTextColor(0, 0, 0)
          y += 4
        }

        if (invoice.include_gst) {
          doc.text('SGST (9%):', 160, y, { align: 'right' })
          doc.text('Rs. ' + sgst.toLocaleString('en-IN'), 195, y, { align: 'right' })
          y += 4
          doc.text('CGST (9%):', 160, y, { align: 'right' })
          doc.text('Rs. ' + cgst.toLocaleString('en-IN'), 195, y, { align: 'right' })
          y += 3
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.3)
          doc.line(140, y, 195, y)
          y += 4
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Total:', 160, y, { align: 'right' })
          doc.text('Rs. ' + grandTotal.toLocaleString('en-IN'), 195, y, { align: 'right' })
        } else {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Total:', 160, y, { align: 'right' })
          doc.text('Rs. ' + grandTotal.toLocaleString('en-IN'), 195, y, { align: 'right' })
        }

        y += 2
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text(('RUPEES ' + toWords(Math.round(grandTotal)) + ' ONLY').toUpperCase(), margin, y)
        y += 20

        if (profile?.bank_name || profile?.account_no || profile?.ifsc_code || profile?.upi_id || invoice.payment_terms) {
          y += 10
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Payment Details:", margin, y)
          y += 5
          doc.setFont("helvetica", "normal")
          doc.setTextColor(40, 40, 40)
          if (profile?.bank_name) { doc.text(`Bank: ${safeStr(profile.bank_name)}`, margin, y); y += 4 }
          if (profile?.account_no) { doc.text(`Account No: ${safeStr(profile.account_no)}`, margin, y); y += 4 }
          if (profile?.ifsc_code) { doc.text(`IFSC: ${safeStr(profile.ifsc_code)}`, margin, y); y += 4 }
          if (profile?.upi_id) { doc.text(`UPI: ${safeStr(profile.upi_id)}`, margin, y); y += 4 }
          if (invoice.payment_terms) { doc.text(`Payment Terms: ${safeStr(invoice.payment_terms)}`, margin, y); y += 4 }
        }

        if (invoice.include_gst) {
          y += 6
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Tax Information:", margin, y)
          y += 5
          doc.setFont("helvetica", "normal")
          doc.setTextColor(40, 40, 40)
          if (profile?.gstin) { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, margin, y); y += 4 }
          if (profile?.pan_number) { doc.text(`PAN: ${safeStr(profile.pan_number)}`, margin, y); y += 4 }
          doc.text("GST @ 18% will be charged as per applicable rules.", margin, y)
          y += 4
          y += 6
        }

        if (invoice.notes) {
          y += 3
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Terms & Conditions:", margin, y)
          y += 4
          doc.setFont("helvetica", "normal")
          doc.setTextColor(80, 80, 80)
          const noteLines = doc.splitTextToSize(safeStr(invoice.notes), pageW - 2 * margin)
          doc.text(noteLines, margin, y)
          y += (noteLines.length * 4)
        }

        y += 10
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text('Thanking you,', 195, y, { align: 'right' })
        doc.text('Yours faithfully,', 195, y + 6, { align: 'right' })
        doc.setFont('helvetica', 'bold')
        doc.text('For ' + safeStr(profile?.company_name), 195, y + 12, { align: 'right' })

        let contentBottom = y + 12

        if (shouldIncludeStamp && stampBase64) {
          let stampY = y + 18
          const stampW = 30
          const stampH = 30
          const stampX = pageW - margin - stampW
          doc.addImage(stampBase64, stampFormat, stampX, stampY, stampW, stampH)
          stampY += stampH + 2

          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.5)
          doc.line(pageW - margin - 40, stampY, pageW - margin, stampY)
          stampY += 4

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(120, 120, 120)
          doc.text('Authorized Signatory', pageW - margin, stampY, { align: 'right' })

          contentBottom = Math.max(contentBottom, stampY)
        }

        const footerY = contentBottom + 12
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.setFont("helvetica", "normal")
        doc.text("Generated by Remindi · remindi.online", pageW / 2, footerY, { align: "center" })

        return footerY + 8
      }

      const scratchDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
      const measuredHeight = renderInvoice(scratchDoc)
      const finalPageHeight = Math.max(measuredHeight, 100)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, finalPageHeight] })
      renderInvoice(doc)

      const filename = `Invoice-${safeStr(invoice.invoice_no ?? invoice.id)}-${safeStr(invoice.client_name ?? "Client")}.pdf`
      return { doc, filename }
    } catch (err) {
      console.error("PDF build error:", err)
      throw err
    }
  }

  const handleDownloadPdf = async (stampToggle: boolean = false) => {
    setGeneratingPdf(true)
    try {
      const result = await buildPdfDoc(stampToggle)
      if (!result) return
      result.doc.save(result.filename)
      toast.success("PDF downloaded")
    } catch (err) {
      toast.error("PDF failed: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleWhatsAppShare = async () => {
    setSharingPdf(true)
    try {
      const result = await buildPdfDoc(includeStamp)
      if (!result) return
      const { doc, filename } = result

      const pdfBlob = doc.output("blob")
      const file = new File([pdfBlob], filename, { type: "application/pdf" })

      // Mobile (Android Chrome, iOS Safari 15.1+): native OS share sheet
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoice?.invoice_no ?? ""}`,
          text: `Hi, please find the invoice from ${profile?.company_name ?? "us"}. Total: ₹${(invoice?.grand_total ?? 0).toLocaleString("en-IN")}.`,
        })
      } else {
        // Desktop fallback: download PDF + open WhatsApp Web with pre-filled text
        doc.save(filename)
        const waText = encodeURIComponent(
          `Hi, please find the invoice *${invoice?.invoice_no ?? ""}* from *${profile?.company_name ?? ""}*.\nAmount: ₹${(invoice?.grand_total ?? 0).toLocaleString("en-IN")}\n\nKindly clear the payment at your earliest convenience.`
        )
        window.open(`https://wa.me/?text=${waText}`, "_blank")
        toast.info("PDF saved. Open WhatsApp and attach it there.")
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return // user dismissed the share sheet
      console.error("Share error:", err)
      toast.error("Could not share: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setSharingPdf(false)
    }
  }

  // ─── Loading & not-found states ──────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <FileText className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Invoice not found</p>
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back to Invoices
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const { subtotal, discountAmount, discountType, discountValue, sgst, cgst, grandTotal } = getTotals()
  const includeGst = invoice.include_gst ?? true
  const mappedItems = getMappedItems()
  const hasBankDetails = profile?.bank_name || profile?.account_no || profile?.ifsc_code || profile?.upi_id
  const invoiceGstin = getInvoiceGst(invoice)

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 max-w-4xl mx-auto">

        {/* ── Action bar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/invoices">
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold leading-tight">
                  {invoice.invoice_no ?? ("INV-" + invoice.id)}
                </h1>
                {getPaymentStatusBadge(invoice.payment_status)}
                {invoice.quotation_id ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                    <CheckCircle2 className="size-3" />
                    From quotation
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {invoice.client_name} · {formatDate(invoice.invoice_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment status quick-change */}
            <Select
              value={(invoice.payment_status || "Unpaid").toLowerCase()}
              onValueChange={handlePaymentStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {/* Stamp toggle */}
            <Button
              onClick={handleStampToggle}
              disabled={generatingPdf}
              variant="outline"
              size="sm"
              className={
                includeStamp
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700"
                  : "text-muted-foreground"
              }
            >
              <Stamp className="size-3.5 mr-1.5" />
              {includeStamp ? "Stamp on" : "Stamp off"}
            </Button>

            <Button variant="outline" size="sm" onClick={handleEditClick}>
              <Edit className="size-3.5 mr-1.5" />
              Edit
            </Button>

            <Button
              onClick={() => handleDownloadPdf(includeStamp)}
              disabled={generatingPdf || sharingPdf}
              variant="outline"
              size="sm"
            >
              {generatingPdf ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="size-3.5 mr-1.5" />
              )}
              Download PDF
            </Button>

            <Button
              onClick={handleWhatsAppShare}
              disabled={sharingPdf || generatingPdf}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/40"
            >
              {sharingPdf ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Share2 className="size-3.5 mr-1.5" />
              )}
              Share via WhatsApp
            </Button>

            {invoice.quotation_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/quotations/${invoice.quotation_id}`)}
              >
                <FileText className="size-3.5 mr-1.5" />
                View Quotation
              </Button>
            )}
          </div>
        </div>

        {/* ── Invoice document card ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Coloured accent line */}
          <div className="h-1 bg-blue-600" />

          {/* From / To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">
            {/* From — company */}
            <div className="flex gap-3 p-5">
              {profile?.logo_url && (
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-11 w-11 object-contain rounded shrink-0 mt-0.5"
                />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">FROM</p>
                <p className="font-semibold text-sm leading-snug">{profile?.company_name ?? "-"}</p>
                {profile?.tagline && (
                  <p className="text-xs text-muted-foreground">{profile.tagline}</p>
                )}
                {profile?.address && (
                  <p className="text-xs text-muted-foreground">{profile.address}</p>
                )}
                {(profile?.city || profile?.state || profile?.zip_code) && (
                  <p className="text-xs text-muted-foreground">
                    {[profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")}
                  </p>
                )}
                {profile?.phone && (
                  <p className="text-xs text-muted-foreground">{profile.phone}</p>
                )}
                {profile?.gstin && (
                  <p className="text-xs text-muted-foreground">GSTIN: {profile.gstin}</p>
                )}
              </div>
            </div>

            {/* To — client */}
            <div className="p-5 space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">TO</p>
              <p className="font-semibold text-sm leading-snug">{invoice.client_name ?? "-"}</p>
              {invoice.client_address && (
                <p className="text-xs text-muted-foreground">{invoice.client_address}</p>
              )}
              {(invoice.client_district || invoice.client_state || invoice.client_pin_code) && (
                <p className="text-xs text-muted-foreground">
                  {[invoice.client_district, invoice.client_state, invoice.client_pin_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {/* ✅ GST stored on this invoice — shown under customer address, only if present */}
              {invoiceGstin && (
                <p className="text-xs text-muted-foreground font-medium">
                  GSTIN: {invoiceGstin}
                </p>
              )}
            </div>
          </div>

          {/* Invoice meta strip */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-3 bg-muted/30 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">Invoice No</p>
              <p className="text-sm font-semibold">{invoice.invoice_no ?? ("INV-" + invoice.id)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Date</p>
              <p className="text-sm font-semibold">{formatDate(invoice.invoice_date)}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-[10px] text-muted-foreground">Due Date</p>
                <p className="text-sm font-semibold text-amber-600">{formatDate(invoice.due_date)}</p>
              </div>
            )}
            {invoice.order_no && (
              <div>
                <p className="text-[10px] text-muted-foreground">Order No</p>
                <p className="text-sm font-semibold">{invoice.order_no}</p>
              </div>
            )}
            {invoice.payment_terms && (
              <div>
                <p className="text-[10px] text-muted-foreground">Payment Terms</p>
                <p className="text-sm font-semibold">{invoice.payment_terms}</p>
              </div>
            )}
          </div>

          {/* Subject + body */}
          {(invoice.subject || invoice.body_text) && (
            <div className="px-5 py-4 border-b border-border space-y-1.5">
              {invoice.subject && (
                <p className="text-sm font-semibold">Sub: {invoice.subject}</p>
              )}
              {invoice.body_text && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {invoice.body_text}
                </p>
              )}
            </div>
          )}

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-10">#</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Description</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-16">Qty</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs w-28">Rate</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mappedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                      No items added
                    </td>
                  </tr>
                ) : (
                  mappedItems.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="text-center py-3 px-4 text-xs text-muted-foreground">{item.sr}</td>
                      <td className="py-3 px-4 font-medium text-sm">{item.description}</td>
                      <td className="text-center py-3 px-4 text-sm text-muted-foreground">{item.qty}</td>
                      <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                        ₹{Number(item.rate).toLocaleString("en-IN")}
                      </td>
                      <td className="text-right py-3 px-4 text-sm font-semibold">
                        ₹{Number(item.amount).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals + Notes row */}
          <div className="border-t border-border">
            <div className="flex flex-col sm:flex-row">

              {/* Notes / T&C — left */}
              {invoice.notes ? (
                <div className="flex-1 p-5 border-b sm:border-b-0 sm:border-r border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Terms & Conditions</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {invoice.notes}
                  </p>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* Totals — right */}
              <div className="p-5 sm:w-64 shrink-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount
                        {discountType === "percentage" ? ` (${discountValue}%)` : ""}
                      </span>
                      <span className="text-red-500">
                        −₹{discountAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {includeGst && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SGST (9%)</span>
                        <span>₹{sgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CGST (9%)</span>
                        <span>₹{cgst.toLocaleString("en-IN")}</span>
                      </div>
                    </>
                  )}

                  <div className="border-t border-border pt-2.5 flex justify-between items-baseline gap-2">
                    <span className="font-semibold text-sm">Total</span>
                    <span className="font-bold text-xl text-blue-600">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Rupees {toWords(Math.round(grandTotal))} Only
                  </p>
                </div>
              </div>
            </div>

            {/* Bank details strip */}
            {hasBankDetails && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 bg-muted/30 border-t border-border">
                {profile?.bank_name && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Bank:</span> {profile.bank_name}
                  </span>
                )}
                {profile?.account_no && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">A/C:</span> {profile.account_no}
                  </span>
                )}
                {profile?.ifsc_code && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">IFSC:</span> {profile.ifsc_code}
                  </span>
                )}
                {profile?.upi_id && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">UPI:</span> {profile.upi_id}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Subscription alert ───────────────────────────────────────────────── */}
      <Dialog open={subscriptionAlertOpen} onOpenChange={setSubscriptionAlertOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Plan expired</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your {planName || 'current'} plan has expired. Renew to edit this invoice.
          </p>
          <DialogFooter>
            <Button onClick={() => setSubscriptionAlertOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stamp upload ─────────────────────────────────────────────────────── */}
      <Dialog open={showStampUploadDialog} onOpenChange={setShowStampUploadDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Stamp / Signature</DialogTitle>
            <DialogDescription>
              Upload a stamp or signature to include it on downloaded PDFs.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/20">
              {(stampPreview || profile?.stamp_url) ? (
                <div className="relative">
                  <img
                    src={stampPreview || profile?.stamp_url || ''}
                    alt="Stamp preview"
                    className="max-h-28 object-contain"
                    onError={() => toast.error("Failed to load image")}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                    onClick={() => { setStampFile(null); setStampPreview(null) }}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <label htmlFor="stamp-upload" className="cursor-pointer flex flex-col items-center gap-2 text-center">
                  <Upload className="size-7 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload stamp</span>
                  <span className="text-xs text-muted-foreground">PNG or JPG · Max 2 MB</span>
                  <input
                    id="stamp-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) {
                        toast.error("File must be under 2 MB")
                        return
                      }
                      setStampFile(file)
                      const reader = new FileReader()
                      reader.onload = (ev) => setStampPreview(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowStampUploadDialog(false); setStampFile(null); setStampPreview(null) }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadStamp}
              disabled={!stampFile || uploadingStamp}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadingStamp ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-4" />
              )}
              Save Stamp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
