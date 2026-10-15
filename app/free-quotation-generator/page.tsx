"use client"

import { useState, useEffect } from "react"
import { Download, FileText, CheckCircle2, Stamp, Menu, X, ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Accordion, AccordionContent,
  AccordionItem, AccordionTrigger
} from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ─── Supabase (landing page lead capture) ────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Utilities (mirror of original quotation page) ───────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

function shortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

const safeStr = (val: any) => String(val ?? "-")

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

// ─── Types (mirror Quotation + CompanyProfile + QuotationItem) ──────────────
interface BusinessInfo {
  company_name: string
  tagline: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string
  email: string
  gstin: string
  pan_number: string
  bank_name: string
  account_no: string
  ifsc_code: string
  upi_id: string
  theme_color: string
  logoBase64: string
}

interface LineItem {
  id: string
  particulars: string
  qty: number
  rate: number
}

interface FormState {
  businessInfo: BusinessInfo
  quoteNumber: string
  quoteDate: string
  validTill: string
  orderNo: string
  orderDate: string
  paymentTerms: string
  clientName: string
  clientAddress: string
  clientDistrict: string
  clientState: string
  clientPinCode: string
  subject: string
  bodyText: string
  items: LineItem[]
  includeDiscount: boolean
  discountType: "percentage" | "flat"
  discountValue: number
  includeGst: boolean
  notes: string
}

const LS_KEY = "remindi_free_quote_business_info"

const defaultFormState: FormState = {
  businessInfo: {
    company_name: "", tagline: "", address: "", city: "", state: "", zip_code: "",
    phone: "", email: "", gstin: "", pan_number: "",
    bank_name: "", account_no: "", ifsc_code: "", upi_id: "",
    theme_color: "#185FA5", logoBase64: "",
  },
  quoteNumber: "QT-001",
  quoteDate: new Date().toISOString().split("T")[0],
  validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  orderNo: "",
  orderDate: "",
  paymentTerms: "Net 14 days",
  clientName: "",
  clientAddress: "",
  clientDistrict: "",
  clientState: "",
  clientPinCode: "",
  subject: "",
  bodyText: "",
  items: [{ id: "1", particulars: "", qty: 1, rate: 0 }],
  includeDiscount: false,
  discountType: "percentage",
  discountValue: 0,
  includeGst: false,
  notes: "",
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function PublicNavbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-blue-600">Remindi</span>
        <div className="hidden sm:flex gap-3">
          <Button variant="ghost" onClick={() => window.open("https://remindi.online/login", "_blank")}>Sign In</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open("https://remindi.online/signup", "_blank")}>Sign Up Free</Button>
        </div>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>
      {open && (
        <div className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => window.open("https://remindi.online/login", "_blank")}>Sign In</Button>
          <Button className="w-full bg-blue-600 text-white" onClick={() => window.open("https://remindi.online/signup", "_blank")}>Sign Up Free</Button>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function HeroBanner() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white dark:from-slate-950 dark:to-background py-12">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Free Quotation Generator for Contractors
        </h1>
        <p className="text-base text-muted-foreground mb-2">
          Create a professional quotation PDF in minutes. No signup needed.
        </p>
        <p className="text-sm text-blue-600 font-medium">Used by 500+ Indian contractors</p>
      </div>
    </section>
  )
}

// ─── Main Generator ───────────────────────────────────────────────────────────
function GeneratorTool() {
  const [formState, setFormState] = useState<FormState>(defaultFormState)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadData, setLeadData] = useState({ fullName: "", phone: "", companyName: "", serviceType: "" })
  const [showPreview, setShowPreview] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Load business info from localStorage ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BusinessInfo>
        setFormState(prev => ({
          ...prev,
          businessInfo: { ...prev.businessInfo, ...parsed }
        }))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(formState.businessInfo))
    } catch {}
  }, [formState.businessInfo])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateBiz = (field: keyof BusinessInfo, value: string) =>
    setFormState(prev => ({ ...prev, businessInfo: { ...prev.businessInfo, [field]: value } }))

  const updateField = (field: keyof FormState, value: any) =>
    setFormState(prev => ({ ...prev, [field]: value }))

  const updateItem = (id: string, field: keyof LineItem, value: any) =>
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, [field]: value } : it)
    }))

  const addItem = () => {
    const newId = String(Date.now())
    setFormState(prev => ({
      ...prev,
      items: [...prev.items, { id: newId, particulars: "", qty: 1, rate: 0 }]
    }))
  }

  const deleteItem = (id: string) => {
    if (formState.items.length <= 1) return
    setFormState(prev => ({ ...prev, items: prev.items.filter(it => it.id !== id) }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return }
    const reader = new FileReader()
    reader.onload = (ev) => updateBiz("logoBase64", ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Calculations (match original: 9% SGST + 9% CGST) ─────────────────────
  const subtotal = formState.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0)
  const discountAmount = formState.includeDiscount
    ? Math.min(
        subtotal,
        Math.max(0, formState.discountType === "percentage"
          ? subtotal * (Number(formState.discountValue) || 0) / 100
          : Number(formState.discountValue) || 0)
      )
    : 0
  const discountedSubtotal = subtotal - discountAmount
  const sgst = formState.includeGst ? Math.round(discountedSubtotal * 0.09) : 0
  const cgst = formState.includeGst ? Math.round(discountedSubtotal * 0.09) : 0
  const grandTotal = discountedSubtotal + sgst + cgst

  // ───────────────────────────────────────────────────────────────────────────
  //  PDF generation — mirrors the internal Remindi quotation PDF exactly
  // ───────────────────────────────────────────────────────────────────────────
  const generatePdf = async () => {
    setGeneratingPdf(true)
    try {
      const pageW = 210
      const margin = 15
      const themeColor = formState.businessInfo.theme_color || "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)
      const bio = formState.businessInfo

      // Prepare logo
      let logoBase64: string | null = null
      let logoFormat: "JPEG" | "PNG" = "PNG"
      if (bio.logoBase64) {
        logoBase64 = bio.logoBase64
        if (bio.logoBase64.startsWith("data:image/jpeg") || bio.logoBase64.startsWith("data:image/jpg")) {
          logoFormat = "JPEG"
        }
      }

      const renderQuotation = (doc: jsPDF): number => {
        let y = margin

        // ── HEADER: logo + company info (single_logo style) ────────────────
        let logoAdded = false
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, logoFormat, margin, y, 22, 22)
            logoAdded = true
          } catch {}
        }
        const infoX = logoAdded ? margin + 24 : margin

        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(bio.company_name || "Company Name"), infoX, y + 2)

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        let infoY = y + 8
        if (bio.tagline) { doc.text(safeStr(bio.tagline), infoX, infoY); infoY += 4 }
        if (bio.address) { doc.text(safeStr(bio.address), infoX, infoY); infoY += 4 }
        const cityLine = [bio.city, bio.state, bio.zip_code].filter(Boolean).join(", ")
        if (cityLine) { doc.text(cityLine, infoX, infoY); infoY += 4 }
        if (bio.phone) { doc.text(`Phone: ${safeStr(bio.phone)}`, infoX, infoY); infoY += 4 }
        if (bio.email) { doc.text(`Email: ${safeStr(bio.email)}`, infoX, infoY); infoY += 4 }
        if (bio.gstin) { doc.text(`GSTIN: ${safeStr(bio.gstin)}`, infoX, infoY) }
        y += 31

        // Accent line
        doc.setDrawColor(tr, tg, tb)
        doc.setLineWidth(0.5)
        doc.line(margin, y, pageW - margin, y)
        y += 6

        // ── QUOTATION title ────────────────────────────────────────────────
        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(tr, tg, tb)
        doc.text("QUOTATION", pageW - margin, y, { align: "right" })

        y += 6
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(formState.quoteNumber || "QT-001"), margin, y)
        doc.text("DATE: " + shortDate(formState.quoteDate), pageW - margin, y, { align: "right" })

        y += 5
        if (formState.validTill) {
          doc.setFontSize(9)
          doc.setTextColor(220, 38, 38)
          doc.text("Valid till: " + formatDate(formState.validTill), pageW - margin, y, { align: "right" })
          y += 5
        }
        if (formState.orderNo) {
          doc.setFontSize(9)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(0, 0, 0)
          doc.text("Order No: " + safeStr(formState.orderNo), pageW - margin, y, { align: "right" })
          y += 5
        }
        if (formState.orderDate) {
          doc.setFontSize(9)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(0, 0, 0)
          doc.text("Order Date: " + shortDate(formState.orderDate), pageW - margin, y, { align: "right" })
        }
        doc.setTextColor(0, 0, 0)

        // ── TO block ───────────────────────────────────────────────────────
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text("TO,", margin, y)
        y += 5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(formState.clientName || "Client").toUpperCase(), margin, y)
        y += 5

        doc.setFont("helvetica", "normal")
        doc.setTextColor(40, 40, 40)
        if (formState.clientAddress) {
          doc.text(safeStr(formState.clientAddress), margin, y)
          y += 5
        }
        const clientCityLine = [
          formState.clientDistrict,
          formState.clientState,
          formState.clientPinCode,
        ].filter(Boolean).join(", ")
        if (clientCityLine) {
          doc.text(clientCityLine, margin, y)
          y += 5
        }
        y += 3

        // ── SUBJECT + BODY ─────────────────────────────────────────────────
        if (formState.subject) {
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Sub: " + safeStr(formState.subject), margin, y)
          y += 5
        }
        if (formState.bodyText) {
          doc.setFont("helvetica", "normal")
          doc.setTextColor(80, 80, 80)
          const bodyLines = doc.splitTextToSize(safeStr(formState.bodyText), pageW - 2 * margin)
          doc.text(bodyLines, margin, y)
          y += bodyLines.length * 4 + 3
        }

        // ── ITEMS TABLE (SR.NO / PARTICULARS / QTY. / RATE / AMOUNT) ──────
        const tableBody = formState.items.map((item, idx) => [
          String(idx + 1),
          safeStr(item.particulars || "-"),
          String(item.qty ?? 1),
          `Rs. ${Number(item.rate ?? 0).toLocaleString("en-IN")}`,
          `Rs. ${(Number(item.qty ?? 0) * Number(item.rate ?? 0)).toLocaleString("en-IN")}`,
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
          bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
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

        // ── TOTALS ─────────────────────────────────────────────────────────
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)

        doc.text("Subtotal:", 160, y, { align: "right" })
        doc.text("Rs. " + subtotal.toLocaleString("en-IN"), 195, y, { align: "right" })
        y += 4

        if (discountAmount > 0) {
          const discountLabel = formState.discountType === "percentage"
            ? `${formState.discountValue}%`
            : `₹${formState.discountValue}`
          doc.text(`Discount (${discountLabel}):`, 160, y, { align: "right" })
          doc.setTextColor(200, 0, 0)
          doc.text("- Rs. " + discountAmount.toLocaleString("en-IN"), 195, y, { align: "right" })
          doc.setTextColor(0, 0, 0)
          y += 4
        }

        if (formState.includeGst) {
          doc.text("SGST (9%):", 160, y, { align: "right" })
          doc.text("Rs. " + sgst.toLocaleString("en-IN"), 195, y, { align: "right" })
          y += 4
          doc.text("CGST (9%):", 160, y, { align: "right" })
          doc.text("Rs. " + cgst.toLocaleString("en-IN"), 195, y, { align: "right" })
          y += 3
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.3)
          doc.line(140, y, 195, y)
          y += 4
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text("Total:", 160, y, { align: "right" })
          doc.text("Rs. " + grandTotal.toLocaleString("en-IN"), 195, y, { align: "right" })
        } else {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.text("Total:", 160, y, { align: "right" })
          doc.text("Rs. " + grandTotal.toLocaleString("en-IN"), 195, y, { align: "right" })
        }

        y += 2
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text(
          ("RUPEES " + toWords(Math.round(grandTotal)) + " ONLY").toUpperCase(),
          margin, y
        )
        y += 20

        // ── PAYMENT DETAILS ────────────────────────────────────────────────
        const hasBank =
          bio.bank_name || bio.account_no || bio.ifsc_code || bio.upi_id || formState.paymentTerms
        if (hasBank) {
          y += 10
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Payment Details:", margin, y)
          y += 5
          doc.setFont("helvetica", "normal")
          doc.setTextColor(40, 40, 40)
          if (bio.bank_name) { doc.text(`Bank: ${safeStr(bio.bank_name)}`, margin, y); y += 4 }
          if (bio.account_no) { doc.text(`Account No: ${safeStr(bio.account_no)}`, margin, y); y += 4 }
          if (bio.ifsc_code) { doc.text(`IFSC: ${safeStr(bio.ifsc_code)}`, margin, y); y += 4 }
          if (bio.upi_id) { doc.text(`UPI: ${safeStr(bio.upi_id)}`, margin, y); y += 4 }
          if (formState.paymentTerms) { doc.text(`Payment Terms: ${safeStr(formState.paymentTerms)}`, margin, y); y += 4 }
        }

        // ── TAX INFORMATION ────────────────────────────────────────────────
        if (formState.includeGst) {
          y += 6
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Tax Information:", margin, y)
          y += 5
          doc.setFont("helvetica", "normal")
          doc.setTextColor(40, 40, 40)
          if (bio.gstin) { doc.text(`GSTIN: ${safeStr(bio.gstin)}`, margin, y); y += 4 }
          if (bio.pan_number) { doc.text(`PAN: ${safeStr(bio.pan_number)}`, margin, y); y += 4 }
          doc.text("GST @ 18% will be charged as per applicable rules.", margin, y)
          y += 4
          y += 6
        }

        // ── TERMS & CONDITIONS ─────────────────────────────────────────────
        if (formState.notes) {
          y += 3
          doc.setFontSize(9)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(0, 0, 0)
          doc.text("Terms & Conditions:", margin, y)
          y += 4
          doc.setFont("helvetica", "normal")
          doc.setTextColor(80, 80, 80)
          const noteLines = doc.splitTextToSize(safeStr(formState.notes), pageW - 2 * margin)
          doc.text(noteLines, margin, y)
          y += noteLines.length * 4
        }

        // ── SIGNATURE ──────────────────────────────────────────────────────
        y += 10
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text("Thanking you,", 195, y, { align: "right" })
        doc.text("Yours faithfully,", 195, y + 6, { align: "right" })
        doc.setFont("helvetica", "bold")
        doc.text("For " + safeStr(bio.company_name || "Company"), 195, y + 12, { align: "right" })

        const contentBottom = y + 12

        // ── FOOTER ─────────────────────────────────────────────────────────
        const footerY = contentBottom + 12
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.setFont("helvetica", "normal")
        doc.text("Generated by Remindi · remindi.online", pageW / 2, footerY, { align: "center" })

        return footerY + 8
      }

      // Two-pass: measure then render on correctly-sized page
      const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
      const measuredHeight = renderQuotation(scratch)
      const finalHeight = Math.max(measuredHeight, 100)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, finalHeight] })
      renderQuotation(doc)

      const safeName = (formState.clientName || "Client").replace(/\s+/g, "_")
      doc.save(`Quotation_${formState.quoteNumber}_${safeName}.pdf`)

      toast.success("Quotation downloaded!", {
        description: "Want to manage all your quotations automatically? Try Remindi free.",
        action: {
          label: "Try Remindi →",
          onClick: () => window.open("https://remindi.online/signup", "_blank"),
        },
      })
    } catch (err) {
      console.error(err)
      toast.error("PDF generation failed. Please try again.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── Lead capture ─────────────────────────────────────────────────────────
  const handleLeadSubmit = async () => {
    if (!leadData.fullName || !leadData.phone || !leadData.companyName || !leadData.serviceType) {
      toast.error("Please fill all required fields.")
      return
    }
    setSubmitting(true)
    try {
      await supabase.from("demo_bookings").insert({
        full_name: leadData.fullName,
        phone: leadData.phone,
        company_name: leadData.companyName,
        service_type: leadData.serviceType,
        source: "free-quotation-generator",
        created_at: new Date().toISOString(),
      })
    } catch {
      // silently fail — never block user
    } finally {
      setSubmitting(false)
      setShowLeadModal(false)
      await generatePdf()
    }
  }

  const [tr, tg, tb] = hexToRgb(formState.businessInfo.theme_color || "#185FA5")

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="lg:hidden mb-4">
        <Button variant="outline" className="w-full" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? "Hide Preview" : "Show Live Preview"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4">

          {/* Your Company (header fields) */}
          <div className="border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm">Your Company</h3>

            {/* Logo */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">
                Company Logo (optional)
              </Label>
              <div className="mt-1.5">
                {formState.businessInfo.logoBase64 ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={formState.businessInfo.logoBase64}
                      alt="Company logo"
                      className="h-14 w-auto object-contain border border-border rounded-lg p-1 bg-white"
                    />
                    <Button
                      variant="outline" size="sm"
                      onClick={() => updateBiz("logoBase64", "")}
                      className="text-red-500 hover:text-red-600 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="logo-upload"
                    className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors bg-muted/20"
                  >
                    <ImageIcon className="size-6 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Click to upload logo</p>
                      <p className="text-xs text-muted-foreground">PNG or JPG · Max 2 MB · Shown on PDF header</p>
                    </div>
                    <input
                      id="logo-upload" type="file" accept="image/png,image/jpeg"
                      className="hidden" onChange={handleLogoUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Company Name *</Label>
                <Input className="mt-1" value={formState.businessInfo.company_name}
                  onChange={e => updateBiz("company_name", e.target.value)} placeholder="ABC Elevators Pvt Ltd" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Tagline</Label>
                <Input className="mt-1" value={formState.businessInfo.tagline}
                  onChange={e => updateBiz("tagline", e.target.value)} placeholder="Sales · Service · AMC" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Address</Label>
              <Input className="mt-1" value={formState.businessInfo.address}
                onChange={e => updateBiz("address", e.target.value)} placeholder="Shop 5, MG Road" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">City</Label>
                <Input className="mt-1" value={formState.businessInfo.city}
                  onChange={e => updateBiz("city", e.target.value)} placeholder="Pune" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">State</Label>
                <Input className="mt-1" value={formState.businessInfo.state}
                  onChange={e => updateBiz("state", e.target.value)} placeholder="Maharashtra" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">PIN Code</Label>
                <Input className="mt-1" value={formState.businessInfo.zip_code}
                  onChange={e => updateBiz("zip_code", e.target.value)} placeholder="411001" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Phone</Label>
                <Input className="mt-1" value={formState.businessInfo.phone}
                  onChange={e => updateBiz("phone", e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
                <Input className="mt-1" value={formState.businessInfo.email}
                  onChange={e => updateBiz("email", e.target.value)} placeholder="info@abcelevators.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">GSTIN</Label>
                <Input className="mt-1" value={formState.businessInfo.gstin}
                  onChange={e => updateBiz("gstin", e.target.value)} placeholder="27AABCU9603R1ZX" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">PAN</Label>
                <Input className="mt-1" value={formState.businessInfo.pan_number}
                  onChange={e => updateBiz("pan_number", e.target.value)} placeholder="AABCU9603R" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Theme Colour (used on PDF)</Label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="color"
                  value={formState.businessInfo.theme_color}
                  onChange={e => updateBiz("theme_color", e.target.value)}
                  className="h-9 w-16 rounded border border-border cursor-pointer"
                />
                <Input value={formState.businessInfo.theme_color}
                  onChange={e => updateBiz("theme_color", e.target.value)}
                  className="max-w-[140px]" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Your info is saved on this device for next time.</p>
          </div>

          {/* Bank / Payment Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Bank / Payment Details</h3>
            <p className="text-xs text-muted-foreground -mt-1">Shown in the "Payment Details" block on the PDF.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Bank Name</Label>
                <Input className="mt-1" value={formState.businessInfo.bank_name}
                  onChange={e => updateBiz("bank_name", e.target.value)} placeholder="HDFC Bank" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Account No.</Label>
                <Input className="mt-1" value={formState.businessInfo.account_no}
                  onChange={e => updateBiz("account_no", e.target.value)} placeholder="50100XXXXXXX" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">IFSC Code</Label>
                <Input className="mt-1" value={formState.businessInfo.ifsc_code}
                  onChange={e => updateBiz("ifsc_code", e.target.value)} placeholder="HDFC0001234" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">UPI ID</Label>
                <Input className="mt-1" value={formState.businessInfo.upi_id}
                  onChange={e => updateBiz("upi_id", e.target.value)} placeholder="abc@upi" />
              </div>
            </div>
          </div>

          {/* Quotation Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Quotation Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quote No.</Label>
                <Input className="mt-1" value={formState.quoteNumber}
                  onChange={e => updateField("quoteNumber", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quote Date</Label>
                <Input className="mt-1" type="date" value={formState.quoteDate}
                  onChange={e => updateField("quoteDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Valid Till</Label>
                <Input className="mt-1" type="date" value={formState.validTill}
                  onChange={e => updateField("validTill", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Payment Terms</Label>
                <Select value={formState.paymentTerms} onValueChange={v => updateField("paymentTerms", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Order No. (Optional)</Label>
                <Input className="mt-1" value={formState.orderNo}
                  onChange={e => updateField("orderNo", e.target.value)} placeholder="PO-2026-001" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Order Date (Optional)</Label>
                <Input className="mt-1" type="date" value={formState.orderDate}
                  onChange={e => updateField("orderDate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Client Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Client Details</h3>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client Name *</Label>
              <Input className="mt-1" value={formState.clientName}
                onChange={e => updateField("clientName", e.target.value)} placeholder="XYZ Builders Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Address</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={formState.clientAddress}
                onChange={e => updateField("clientAddress", e.target.value)}
                placeholder="123, Industrial Area, Phase 2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">District</Label>
                <Input className="mt-1" value={formState.clientDistrict}
                  onChange={e => updateField("clientDistrict", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">State</Label>
                <Input className="mt-1" value={formState.clientState}
                  onChange={e => updateField("clientState", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">PIN Code</Label>
                <Input className="mt-1" value={formState.clientPinCode}
                  onChange={e => updateField("clientPinCode", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Subject + Body */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Subject & Body</h3>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
              <Input className="mt-1" value={formState.subject}
                onChange={e => updateField("subject", e.target.value)}
                placeholder="e.g. Regarding AC AMC works at above mention place" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Letter Body</Label>
              <Textarea className="mt-1" rows={4} value={formState.bodyText}
                onChange={e => updateField("bodyText", e.target.value)}
                placeholder="Respected Sir/Madam, As per discussion held with you, regarding following works..." />
              <div className="flex gap-2 flex-wrap mt-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => updateField("bodyText", (formState.bodyText ? formState.bodyText + "\n" : "") + "Respected Sir/Madam,")}>
                  "Respected Sir/Madam,"
                </Button>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => updateField("bodyText", (formState.bodyText ? formState.bodyText + "\n" : "") + "As per discussion held with you, regarding following works at above mention place. Details are given as below;")}>
                  "As per discussion..."
                </Button>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {["SR.NO", "Particulars", "Qty.", "Rate (₹)", "Amount", ""].map(h => (
                      <th key={h} className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground last:w-8">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formState.items.map((item, idx) => {
                    const amt = (Number(item.qty) || 0) * (Number(item.rate) || 0)
                    return (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                        <td className="text-center py-2 px-2 text-xs text-muted-foreground w-10">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <Input value={item.particulars}
                            onChange={e => updateItem(item.id, "particulars", e.target.value)}
                            placeholder="e.g. Elevator AMC – Quarterly" className="h-8 text-sm" />
                        </td>
                        <td className="py-2 px-2 w-20">
                          <Input type="number" min="1" value={item.qty}
                            onFocus={(e) => e.target.value = ""}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value)
                              updateItem(item.id, "qty", isNaN(v) || v <= 0 ? 1 : v)
                            }}
                            onChange={e => updateItem(item.id, "qty", Number(e.target.value) || 0)}
                            className="h-8 text-sm text-center" />
                        </td>
                        <td className="py-2 px-2 w-28">
                          <Input type="number" min="0" value={item.rate}
                            onFocus={(e) => e.target.value = ""}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value)
                              updateItem(item.id, "rate", isNaN(v) ? 0 : v)
                            }}
                            onChange={e => updateItem(item.id, "rate", Number(e.target.value) || 0)}
                            className="h-8 text-sm text-right" />
                        </td>
                        <td className="py-2 px-2 text-right text-sm font-semibold w-28">
                          ₹{Number(amt).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-2 w-8">
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors text-base leading-none"
                          >×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>+ Add Item</Button>
          </div>

          {/* Discount */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Discount</h3>
              <Switch checked={formState.includeDiscount}
                onCheckedChange={v => updateField("includeDiscount", v)} />
            </div>
            {formState.includeDiscount && (
              <div className="space-y-3">
                <div className="flex gap-4">
                  {(["percentage", "flat"] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={formState.discountType === t}
                        onChange={() => updateField("discountType", t)} className="accent-blue-600" />
                      {t === "percentage" ? "Percentage (%)" : "Flat Amount (₹)"}
                    </label>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {formState.discountType === "percentage" ? "Discount %" : "Discount Amount (₹)"}
                  </Label>
                  <Input type="number" min="0" className="mt-1"
                    value={formState.discountValue}
                    onFocus={(e) => e.target.value = ""}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value)
                      updateField("discountValue", isNaN(v) || v < 0 ? 0 : v)
                    }}
                    onChange={e => updateField("discountValue", Number(e.target.value) || 0)} />
                </div>
                {discountAmount > 0 && (
                  <p className="text-sm text-red-500 font-medium">
                    Discount: −₹{Number(discountAmount).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* GST */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Include GST (9% SGST + 9% CGST)</h3>
              <Switch checked={formState.includeGst}
                onCheckedChange={v => updateField("includeGst", v)} />
            </div>
            {formState.includeGst && (
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>SGST (9%): ₹{Number(sgst).toLocaleString("en-IN")}</span>
                <span>CGST (9%): ₹{Number(cgst).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {/* Totals summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{Number(subtotal).toLocaleString("en-IN")}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formState.discountType === "percentage" ? `Discount (${formState.discountValue}%)` : "Discount"}
                </span>
                <span className="text-red-500">−₹{Number(discountAmount).toLocaleString("en-IN")}</span>
              </div>
            )}
            {formState.includeGst && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST (9%)</span>
                  <span>₹{Number(sgst).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST (9%)</span>
                  <span>₹{Number(cgst).toLocaleString("en-IN")}</span>
                </div>
              </>
            )}
            <div className="border-t border-border pt-2.5 flex justify-between items-baseline">
              <span className="font-semibold text-sm">Total</span>
              <span className="font-bold text-xl text-blue-600">₹{Number(grandTotal).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Rupees {toWords(Math.round(grandTotal))} Only
            </p>
          </div>

          {/* Notes */}
          <div className="border border-border rounded-xl p-5">
            <Label className="text-xs font-semibold text-muted-foreground">Terms & Conditions</Label>
            <Textarea
              className="mt-1.5 resize-none min-h-[72px] text-sm"
              placeholder="Payment terms, delivery, warranty, jurisdiction..."
              value={formState.notes}
              onChange={e => updateField("notes", e.target.value)}
            />
          </div>

          {/* Download */}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
            onClick={() => setShowLeadModal(true)}
            disabled={generatingPdf}
          >
            {generatingPdf ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Download className="mr-2 size-5" />}
            Download Quotation PDF — Free
          </Button>
        </div>

        {/* ── RIGHT: Live Preview ─────────────────────────────────────────── */}
        <div className={`w-full lg:w-[520px] lg:sticky lg:top-20 lg:self-start ${showPreview ? "block" : "hidden lg:block"}`}>
          <p className="text-xs text-muted-foreground text-center mb-2">Live Preview</p>
          <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden text-sm">

            {/* Header */}
            <div className="p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {formState.businessInfo.logoBase64 && (
                  <img src={formState.businessInfo.logoBase64} alt="Logo"
                    className="h-12 w-auto object-contain flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-base text-foreground truncate">
                    {formState.businessInfo.company_name || <span className="text-muted-foreground">Company Name</span>}
                  </p>
                  {formState.businessInfo.tagline && <p className="text-xs text-muted-foreground">{formState.businessInfo.tagline}</p>}
                  {formState.businessInfo.address && <p className="text-xs text-muted-foreground">{formState.businessInfo.address}</p>}
                  {(formState.businessInfo.city || formState.businessInfo.state || formState.businessInfo.zip_code) && (
                    <p className="text-xs text-muted-foreground">
                      {[formState.businessInfo.city, formState.businessInfo.state, formState.businessInfo.zip_code].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {formState.businessInfo.phone && <p className="text-xs text-muted-foreground">Phone: {formState.businessInfo.phone}</p>}
                  {formState.businessInfo.email && <p className="text-xs text-muted-foreground">Email: {formState.businessInfo.email}</p>}
                  {formState.businessInfo.gstin && <p className="text-xs text-muted-foreground">GSTIN: {formState.businessInfo.gstin}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold tracking-wide" style={{ color: `rgb(${tr}, ${tg}, ${tb})` }}>QUOTATION</p>
              </div>
            </div>

            {/* Accent line */}
            <div className="h-0.5" style={{ background: `rgb(${tr}, ${tg}, ${tb})` }} />

            {/* Quote meta */}
            <div className="p-5 space-y-1">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-bold">{formState.quoteNumber || "QT-001"}</p>
                <p className="text-sm font-bold">DATE: {shortDate(formState.quoteDate)}</p>
              </div>
              {formState.validTill && (
                <p className="text-right text-xs text-red-500 font-medium">Valid till: {formatDate(formState.validTill)}</p>
              )}
              {formState.orderNo && (
                <p className="text-right text-xs">Order No: {formState.orderNo}</p>
              )}
              {formState.orderDate && (
                <p className="text-right text-xs">Order Date: {shortDate(formState.orderDate)}</p>
              )}
            </div>

            {/* TO + Subject */}
            <div className="px-5 pb-4 space-y-1.5">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">TO,</p>
              <p className="text-sm font-bold uppercase">{formState.clientName || <span className="text-muted-foreground normal-case font-normal">Client Name</span>}</p>
              {formState.clientAddress && <p className="text-xs text-muted-foreground">{formState.clientAddress}</p>}
              {(formState.clientDistrict || formState.clientState || formState.clientPinCode) && (
                <p className="text-xs text-muted-foreground">
                  {[formState.clientDistrict, formState.clientState, formState.clientPinCode].filter(Boolean).join(", ")}
                </p>
              )}
              {formState.subject && (
                <p className="text-sm font-semibold pt-1">Sub: {formState.subject}</p>
              )}
              {formState.bodyText && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{formState.bodyText}</p>
              )}
            </div>

            {/* Items table */}
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: `rgb(${tr}, ${tg}, ${tb})` }}>
                    {["SR.NO", "PARTICULARS", "QTY.", "RATE", "AMOUNT"].map(h => (
                      <th key={h} className="py-2.5 px-3 font-semibold text-white text-left first:text-center last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formState.items.map((it, i) => {
                    const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0)
                    return (
                      <tr key={it.id} className="hover:bg-muted/20 border-b border-border/50">
                        <td className="text-center py-2 px-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{it.particulars || "-"}</td>
                        <td className="text-center py-2 px-3 text-muted-foreground">{it.qty}</td>
                        <td className="text-right py-2 px-3">Rs. {Number(it.rate).toLocaleString("en-IN")}</td>
                        <td className="text-right py-2 px-3 font-semibold">Rs. {Number(amt).toLocaleString("en-IN")}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals + Notes */}
            <div className="border-t border-border flex flex-col sm:flex-row">
              {formState.notes ? (
                <div className="flex-1 p-5 border-b sm:border-b-0 sm:border-r border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Terms & Conditions</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{formState.notes}</p>
                </div>
              ) : <div className="flex-1" />}
              <div className="p-5 sm:w-56 shrink-0 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {Number(subtotal).toLocaleString("en-IN")}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formState.discountType === "percentage" ? `Discount (${formState.discountValue}%)` : "Discount"}
                    </span>
                    <span className="text-red-500">- Rs. {Number(discountAmount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {formState.includeGst && <>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">SGST (9%)</span><span>Rs. {Number(sgst).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">CGST (9%)</span><span>Rs. {Number(cgst).toLocaleString("en-IN")}</span></div>
                </>}
                <div className="border-t border-border pt-2.5 flex justify-between items-baseline">
                  <span className="font-semibold text-xs">Total</span>
                  <span className="font-bold text-base" style={{ color: `rgb(${tr}, ${tg}, ${tb})` }}>
                    Rs. {Number(grandTotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug uppercase">
                  Rupees {toWords(Math.round(grandTotal))} Only
                </p>
              </div>
            </div>

            {/* Payment details */}
            {(formState.businessInfo.bank_name || formState.businessInfo.account_no || formState.businessInfo.ifsc_code || formState.businessInfo.upi_id || formState.paymentTerms) && (
              <div className="border-t border-border p-5 space-y-1">
                <p className="text-xs font-bold">Payment Details:</p>
                {formState.businessInfo.bank_name && <p className="text-xs text-muted-foreground">Bank: {formState.businessInfo.bank_name}</p>}
                {formState.businessInfo.account_no && <p className="text-xs text-muted-foreground">Account No: {formState.businessInfo.account_no}</p>}
                {formState.businessInfo.ifsc_code && <p className="text-xs text-muted-foreground">IFSC: {formState.businessInfo.ifsc_code}</p>}
                {formState.businessInfo.upi_id && <p className="text-xs text-muted-foreground">UPI: {formState.businessInfo.upi_id}</p>}
                {formState.paymentTerms && <p className="text-xs text-muted-foreground">Payment Terms: {formState.paymentTerms}</p>}
              </div>
            )}

            {/* Tax info */}
            {formState.includeGst && (
              <div className="border-t border-border p-5 space-y-1">
                <p className="text-xs font-bold">Tax Information:</p>
                {formState.businessInfo.gstin && <p className="text-xs text-muted-foreground">GSTIN: {formState.businessInfo.gstin}</p>}
                {formState.businessInfo.pan_number && <p className="text-xs text-muted-foreground">PAN: {formState.businessInfo.pan_number}</p>}
                <p className="text-xs text-muted-foreground">GST @ 18% will be charged as per applicable rules.</p>
              </div>
            )}

            {/* Signature + Footer */}
            <div className="border-t border-border p-5 text-right">
              <p className="text-xs">Thanking you,</p>
              <p className="text-xs mt-1">Yours faithfully,</p>
              <p className="text-xs font-bold mt-1">For {formState.businessInfo.company_name || "Company"}</p>
            </div>
            <div className="border-t border-border py-3 px-5">
              <p className="text-[10px] text-muted-foreground text-center">Generated by Remindi · remindi.online</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lead Capture Modal ─────────────────────────────────────────────── */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>One last step</DialogTitle>
            <DialogDescription>
              Enter your details to download your quotation PDF. We will not spam you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Full Name *</Label>
              <Input className="mt-1" value={leadData.fullName}
                onChange={e => setLeadData(p => ({ ...p, fullName: e.target.value }))} placeholder="Rahul Sharma" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Phone Number *</Label>
              <Input className="mt-1" value={leadData.phone}
                onChange={e => setLeadData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Company Name *</Label>
              <Input className="mt-1" value={leadData.companyName}
                onChange={e => setLeadData(p => ({ ...p, companyName: e.target.value }))} placeholder="ABC Elevators Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Service Type *</Label>
              <Select value={leadData.serviceType} onValueChange={v => setLeadData(p => ({ ...p, serviceType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select your service" /></SelectTrigger>
                <SelectContent>
                  {["Elevator / Lift", "HVAC / AC", "Fire Safety", "Plumbing", "Electrical", "CCTV / Security", "Pest Control", "Other"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLeadModal(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleLeadSubmit}
              disabled={submitting || generatingPdf}
            >
              {submitting || generatingPdf ? "Generating..." : "Download My Free Quotation PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ─── SEO Section ──────────────────────────────────────────────────────────────
function SeoSection() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Why Indian Contractors Trust Remindi</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: <FileText className="size-8 text-blue-600 mb-3" />, title: "Professional Quotations in Minutes", desc: "Fill the form, preview live, download as PDF. No design skills needed." },
            { icon: <CheckCircle2 className="size-8 text-blue-600 mb-3" />, title: "GST-Ready for Indian Contractors", desc: "Auto-calculates SGST, CGST, and totals. Supports all GST rates." },
            { icon: <Stamp className="size-8 text-blue-600 mb-3" />, title: "Full AMC Management on Remindi", desc: "Track contracts, technicians, send reminders, manage invoices — all in one place." },
          ].map(c => (
            <Card key={c.title} className="border border-border p-5">
              {c.icon}
              <h3 className="font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </Card>
          ))}
        </div>

        <div className="text-center mb-14 rounded-xl border border-border bg-muted/30 p-8">
          <h3 className="text-xl font-semibold mb-3">Ready to manage all your AMC contracts automatically?</h3>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open("https://remindi.online/signup", "_blank")}>
            Start Free on Remindi →
          </Button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: "Is this free?", a: "Yes. 100% free. No signup or credit card needed." },
            { q: "Can I add GST?", a: "Yes. Toggle GST on, and 9% SGST + 9% CGST are auto-calculated just like the paid app." },
            { q: "Is my data saved?", a: "Your business info is saved on your device only. We do not store your quotation data on our servers." },
            { q: "Can I add my logo?", a: "Yes. Upload your company logo in the Company section. It appears on both the preview and the downloaded PDF." },
            { q: "What is Remindi?", a: "Remindi is an AMC management platform for Indian contractors. Manage service contracts, technicians, reminders, and invoices — free to try." },
            { q: "Can I create invoices too?", a: "Yes. Visit remindi.online/free-invoice-generator for our free invoice generator." },
          ].map((faq, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger>{faq.q}</AccordionTrigger>
              <AccordionContent>{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 text-center text-sm text-muted-foreground">
          Also need an invoice?{" "}
          <a href="/free-invoice-generator" className="text-blue-600 hover:underline font-medium">
            Use our Free Invoice Generator →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function FreeQuotationGeneratorPage() {
  return (
    <main>
      <PublicNavbar />
      <HeroBanner />
      <GeneratorTool />
      <SeoSection />
    </main>
  )
}
