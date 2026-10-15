"use client"

import { useState, useEffect } from "react"
import { Download, FileText, CheckCircle2, Stamp, Menu, X, Upload, ImageIcon } from "lucide-react"
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

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Utilities ───────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

function toWords(n: number): string {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
  if (n === 0) return "Zero"
  if (n < 20) return a[n]
  if (n < 100) return b[Math.floor(n/10)]+(n%10?" "+a[n%10]:"")
  if (n < 1000) return a[Math.floor(n/100)]+" Hundred"+(n%100?" "+toWords(n%100):"")
  if (n < 100000) return toWords(Math.floor(n/1000))+" Thousand"+(n%1000?" "+toWords(n%1000):"")
  if (n < 10000000) return toWords(Math.floor(n/100000))+" Lakh"+(n%100000?" "+toWords(n%100000):"")
  return toWords(Math.floor(n/10000000))+" Crore"+(n%10000000?" "+toWords(n%10000000):"")
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface BusinessInfo {
  company_name: string
  your_name: string
  phone: string
  email: string
  city: string
  gstin: string
  logoBase64: string
}

interface LineItem {
  id: string
  description: string
  qty: number
  unit: string
  rate: number
}

interface FormState {
  businessInfo: BusinessInfo
  quoteNumber: string
  quoteDate: string
  validTill: string
  subject: string
  clientName: string
  clientAddress: string
  clientCity: string
  clientState: string
  clientPinCode: string
  clientGstin: string
  items: LineItem[]
  includeDiscount: boolean
  discountType: "percentage" | "flat"
  discountValue: number
  includeGst: boolean
  gstRate: number
  notes: string
}

const LS_KEY = "remindi_business_info"

const defaultFormState: FormState = {
  businessInfo: { company_name:"", your_name:"", phone:"", email:"", city:"", gstin:"", logoBase64:"" },
  quoteNumber: "QT-001",
  quoteDate: new Date().toISOString().split("T")[0],
  validTill: new Date(Date.now()+30*24*60*60*1000).toISOString().split("T")[0],
  subject: "",
  clientName: "", clientAddress: "", clientCity: "", clientState: "", clientPinCode: "", clientGstin: "",
  items: [
    { id:"1", description:"", qty:1, unit:"Nos", rate:0 },
    { id:"2", description:"", qty:1, unit:"Nos", rate:0 },
  ],
  includeDiscount: false,
  discountType: "percentage",
  discountValue: 0,
  includeGst: false,
  gstRate: 18,
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
          <Button variant="ghost" onClick={() => window.open("https://remindi.online/login","_blank")}>Sign In</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open("https://remindi.online/signup","_blank")}>Sign Up Free</Button>
        </div>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={20}/> : <Menu size={20}/>}
        </Button>
      </div>
      {open && (
        <div className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => window.open("https://remindi.online/login","_blank")}>Sign In</Button>
          <Button className="w-full bg-blue-600 text-white" onClick={() => window.open("https://remindi.online/signup","_blank")}>Sign Up Free</Button>
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
  const [leadData, setLeadData] = useState({ fullName:"", phone:"", companyName:"", serviceType:"" })
  const [showPreview, setShowPreview] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Load from localStorage on mount ──────────────────────────────────────
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

  // ── Save businessInfo to localStorage on change ───────────────────────────
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
      items: [...prev.items, { id: newId, description:"", qty:1, unit:"Nos", rate:0 }]
    }))
  }

  const deleteItem = (id: string) => {
    if (formState.items.length <= 1) return
    setFormState(prev => ({ ...prev, items: prev.items.filter(it => it.id !== id) }))
  }

  // ── Logo upload handler ───────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      updateBiz("logoBase64", base64)
    }
    reader.readAsDataURL(file)
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = formState.items.reduce((s, it) => s + it.qty * it.rate, 0)
  const discount = formState.includeDiscount
    ? formState.discountType === "percentage"
      ? (subtotal * formState.discountValue) / 100
      : formState.discountValue
    : 0
  const taxable = subtotal - discount
  const sgst = formState.includeGst ? (taxable * formState.gstRate / 2) / 100 : 0
  const cgst = formState.includeGst ? (taxable * formState.gstRate / 2) / 100 : 0
  const grandTotal = taxable + sgst + cgst

  // ── PDF generation — matches internal Remindi quotation PDF exactly ────────
  const generatePdf = async () => {
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation:"portrait", format:"a4" })
      const pw = doc.internal.pageSize.getWidth()   // 210
      const ph = doc.internal.pageSize.getHeight()  // 297
      const blue: [number,number,number] = [37, 99, 235]
      const gray: [number,number,number] = [100, 100, 100]
      const lightGray: [number,number,number] = [200, 200, 200]
      const red: [number,number,number] = [220, 38, 38]

      let y = 15

      // ── LOGO (left) ──────────────────────────────────────────────────────
      const logoBase64 = formState.businessInfo.logoBase64
      if (logoBase64) {
        // Detect image type from base64 prefix
        let imgType: "PNG"|"JPEG" = "PNG"
        if (logoBase64.includes("data:image/jpeg") || logoBase64.includes("data:image/jpg")) imgType = "JPEG"
        try {
          doc.addImage(logoBase64, imgType, 15, y, 28, 28)
        } catch {}
        // Company info to the right of the logo
        const textX = 47
        doc.setFont("helvetica","bold")
        doc.setFontSize(14)
        doc.setTextColor(0,0,0)
        doc.text(formState.businessInfo.company_name || "Company Name", textX, y + 7)
        doc.setFont("helvetica","normal")
        doc.setFontSize(8.5)
        doc.setTextColor(...gray)
        let infoY = y + 13
        if (formState.businessInfo.phone) { doc.text(formState.businessInfo.phone, textX, infoY); infoY += 4.5 }
        if (formState.businessInfo.email) { doc.text(formState.businessInfo.email, textX, infoY); infoY += 4.5 }
        if (formState.businessInfo.city) { doc.text(formState.businessInfo.city, textX, infoY); infoY += 4.5 }
        if (formState.businessInfo.gstin) { doc.text(`GSTIN: ${formState.businessInfo.gstin}`, textX, infoY) }
        y = Math.max(y + 32, infoY + 4)
      } else {
        // No logo — company info at left
        doc.setFont("helvetica","bold")
        doc.setFontSize(16)
        doc.setTextColor(0,0,0)
        doc.text(formState.businessInfo.company_name || "Company Name", 15, y + 5)
        doc.setFont("helvetica","normal")
        doc.setFontSize(8.5)
        doc.setTextColor(...gray)
        let infoY = y + 12
        if (formState.businessInfo.phone) { doc.text(formState.businessInfo.phone, 15, infoY); infoY += 4.5 }
        if (formState.businessInfo.email) { doc.text(formState.businessInfo.email, 15, infoY); infoY += 4.5 }
        if (formState.businessInfo.city) { doc.text(formState.businessInfo.city, 15, infoY); infoY += 4.5 }
        if (formState.businessInfo.gstin) { doc.text(`GSTIN: ${formState.businessInfo.gstin}`, 15, infoY) }
        y = Math.max(y + 28, infoY + 4)
      }

      // ── QUOTATION title + details (right) ────────────────────────────────
      doc.setFont("helvetica","bold")
      doc.setFontSize(20)
      doc.setTextColor(...blue)
      doc.text("QUOTATION", pw - 15, 22, { align:"right" })

      doc.setFont("helvetica","normal")
      doc.setFontSize(8.5)
      doc.setTextColor(0,0,0)
      doc.text(`Quote No: ${formState.quoteNumber}`, pw - 15, 31, { align:"right" })
      doc.text(`Date: ${formatDate(formState.quoteDate)}`, pw - 15, 36, { align:"right" })
      doc.text(`Valid Till: ${formatDate(formState.validTill)}`, pw - 15, 41, { align:"right" })

      // ── Divider ──────────────────────────────────────────────────────────
      doc.setDrawColor(...lightGray)
      doc.setLineWidth(0.4)
      doc.line(15, y, pw - 15, y)
      y += 7

      // ── Bill To + Subject (two columns) ──────────────────────────────────
      const billToY = y
      doc.setFont("helvetica","bold")
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.text("BILL TO", 15, y)
      y += 5

      doc.setFont("helvetica","bold")
      doc.setFontSize(10)
      doc.setTextColor(0,0,0)
      doc.text(formState.clientName || "Client Name", 15, y)
      y += 5

      doc.setFont("helvetica","normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...gray)

      if (formState.clientAddress) {
        const lines = doc.splitTextToSize(formState.clientAddress, 80) as string[]
        doc.text(lines, 15, y)
        y += lines.length * 4.5
      }
      const cityLine = [formState.clientCity, formState.clientState, formState.clientPinCode].filter(Boolean).join(", ")
      if (cityLine) { doc.text(cityLine, 15, y); y += 4.5 }
      if (formState.clientGstin) { doc.text(`GSTIN: ${formState.clientGstin}`, 15, y); y += 4.5 }

      // Subject on the right
      if (formState.subject) {
        doc.setFont("helvetica","bold")
        doc.setFontSize(8)
        doc.setTextColor(...gray)
        doc.text("SUBJECT", pw - 15, billToY, { align:"right" })
        doc.setFont("helvetica","normal")
        doc.setFontSize(8.5)
        doc.setTextColor(0,0,0)
        const subLines = doc.splitTextToSize(formState.subject, 70) as string[]
        doc.text(subLines, pw - 15, billToY + 5, { align:"right" })
      }

      y = Math.max(y, billToY + 25) + 4

      // ── Line items table ──────────────────────────────────────────────────
      const tableRows = formState.items.map((it, i) => [
        String(i + 1),
        it.description || "-",
        String(it.qty),
        it.unit,
        `₹${Number(it.rate).toLocaleString("en-IN")}`,
        `₹${Number(it.qty * it.rate).toLocaleString("en-IN")}`,
      ])

      autoTable(doc, {
        head: [["#", "Description", "Qty", "Unit", "Rate", "Amount"]],
        body: tableRows,
        startY: y,
        margin: { left: 15, right: 15 },
        styles: { fontSize: 9, cellPadding: { top:3, bottom:3, left:4, right:4 } },
        headStyles: { fillColor: blue, textColor: 255, fontStyle:"bold", fontSize:9 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { halign:"center", cellWidth:12 },
          1: { halign:"left" },
          2: { halign:"center", cellWidth:14 },
          3: { halign:"center", cellWidth:16 },
          4: { halign:"right", cellWidth:26 },
          5: { halign:"right", cellWidth:28 },
        },
        tableLineColor: lightGray,
        tableLineWidth: 0.3,
      })

      y = (doc as any).lastAutoTable.finalY + 8

      // ── Totals (right-aligned block) ──────────────────────────────────────
      const labelX = pw - 80
      const valueX = pw - 15
      doc.setFontSize(9)

      const rows: { label:string; value:string; bold?:boolean; color?: [number,number,number] }[] = [
        { label:"Subtotal", value:`₹${Number(subtotal).toLocaleString("en-IN")}` },
      ]
      if (discount > 0) rows.push({
        label: formState.discountType==="percentage" ? `Discount (${formState.discountValue}%)` : "Discount",
        value: `-₹${Number(discount).toLocaleString("en-IN")}`,
        color: red,
      })
      if (formState.includeGst) {
        rows.push({ label:`SGST (${formState.gstRate/2}%)`, value:`₹${Number(sgst).toLocaleString("en-IN")}` })
        rows.push({ label:`CGST (${formState.gstRate/2}%)`, value:`₹${Number(cgst).toLocaleString("en-IN")}` })
      }

      for (const row of rows) {
        doc.setFont("helvetica","normal")
        doc.setTextColor(row.color ? row.color[0] : 80, row.color ? row.color[1] : 80, row.color ? row.color[2] : 80)
        doc.text(row.label, labelX, y)
        doc.text(row.value, valueX, y, { align:"right" })
        y += 5.5
      }

      // Total divider
      doc.setDrawColor(...lightGray)
      doc.line(labelX, y, valueX, y)
      y += 5

      // Grand Total
      doc.setFont("helvetica","bold")
      doc.setFontSize(11)
      doc.setTextColor(...blue)
      doc.text("Total", labelX, y)
      doc.text(`₹${Number(grandTotal).toLocaleString("en-IN")}`, valueX, y, { align:"right" })
      y += 5

      // Amount in words
      doc.setFont("helvetica","normal")
      doc.setFontSize(8)
      doc.setTextColor(...gray)
      doc.text(`Rupees ${toWords(Math.floor(grandTotal))} Only`, labelX, y)
      y += 10

      // ── Notes/Terms ───────────────────────────────────────────────────────
      if (formState.notes) {
        doc.setDrawColor(...lightGray)
        doc.line(15, y, pw - 15, y)
        y += 6
        doc.setFont("helvetica","bold")
        doc.setFontSize(8.5)
        doc.setTextColor(0,0,0)
        doc.text("Terms & Conditions", 15, y)
        y += 5
        doc.setFont("helvetica","normal")
        doc.setFontSize(8)
        doc.setTextColor(...gray)
        const noteLines = doc.splitTextToSize(formState.notes, pw - 30) as string[]
        doc.text(noteLines, 15, y)
        y += noteLines.length * 4.5 + 6
      }

      // ── Footer ────────────────────────────────────────────────────────────
      doc.setFont("helvetica","normal")
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      doc.text("This is a computer-generated quotation.", pw / 2, ph - 12, { align:"center" })
      doc.text("Generated free at remindi.online", pw / 2, ph - 8, { align:"center" })

      // ── Save ──────────────────────────────────────────────────────────────
      const safeName = (formState.clientName || "Client").replace(/\s+/g,"_")
      doc.save(`Quotation_${formState.quoteNumber}_${safeName}.pdf`)

      toast.success("Quotation downloaded!", {
        description: "Want to manage all your quotations automatically? Try Remindi free.",
        action: { label:"Try Remindi →", onClick:() => window.open("https://remindi.online/signup","_blank") }
      })
    } catch (err) {
      console.error(err)
      toast.error("PDF generation failed. Please try again.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── Lead submit ───────────────────────────────────────────────────────────
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

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {/* Mobile preview toggle */}
      <div className="lg:hidden mb-4">
        <Button variant="outline" className="w-full" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? "Hide Preview" : "Show Live Preview"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4">

          {/* Part A: Business Info */}
          <div className="border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm">Your Business Info</h3>

            {/* Logo Upload */}
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
                      variant="outline"
                      size="sm"
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
                      <p className="text-xs text-muted-foreground">PNG or JPG · Max 2 MB · Shown on PDF</p>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id:"co", label:"Company Name *", field:"company_name" as const, placeholder:"ABC Elevators Pvt Ltd" },
                { id:"yn", label:"Your Name",      field:"your_name"    as const, placeholder:"Rahul Sharma" },
                { id:"ph", label:"Phone",           field:"phone"        as const, placeholder:"+91 98765 43210" },
                { id:"em", label:"Email",            field:"email"        as const, placeholder:"info@abcelevators.com" },
                { id:"ct", label:"City",             field:"city"         as const, placeholder:"Pune" },
                { id:"gs", label:"GSTIN (optional)", field:"gstin"        as const, placeholder:"27AABCU9603R1ZX" },
              ].map(f => (
                <div key={f.id}>
                  <Label htmlFor={f.id} className="text-xs font-semibold text-muted-foreground">{f.label}</Label>
                  <Input
                    id={f.id}
                    className="mt-1"
                    value={formState.businessInfo[f.field]}
                    onChange={e => updateBiz(f.field, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Your info is saved on this device for next time.</p>
          </div>

          {/* Part B: Quotation Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Quotation Details</h3>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Quote Number</Label>
              <Input className="mt-1" value={formState.quoteNumber} onChange={e => updateField("quoteNumber", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quote Date</Label>
                <Input className="mt-1" type="date" value={formState.quoteDate} onChange={e => updateField("quoteDate", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Valid Till</Label>
                <Input className="mt-1" type="date" value={formState.validTill} onChange={e => updateField("validTill", e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
              <Input className="mt-1" value={formState.subject} onChange={e => updateField("subject", e.target.value)} placeholder="e.g. AMC for Elevator at ABC Towers" />
            </div>
          </div>

          {/* Part C: Client Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Client Details</h3>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client Name *</Label>
              <Input className="mt-1" value={formState.clientName} onChange={e => updateField("clientName", e.target.value)} placeholder="XYZ Builders Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client Address</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={formState.clientAddress} onChange={e => updateField("clientAddress", e.target.value)} placeholder="123, Industrial Area, Phase 2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">City</Label>
                <Input className="mt-1" value={formState.clientCity} onChange={e => updateField("clientCity", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">State</Label>
                <Input className="mt-1" value={formState.clientState} onChange={e => updateField("clientState", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">PIN Code</Label>
                <Input className="mt-1" value={formState.clientPinCode} onChange={e => updateField("clientPinCode", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Client GSTIN (optional)</Label>
                <Input className="mt-1" value={formState.clientGstin} onChange={e => updateField("clientGstin", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Part D: Line Items */}
          <div className="border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {["#","Description","Qty","Unit","Rate (₹)","Amount",""].map(h => (
                      <th key={h} className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground first:text-center last:w-8">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formState.items.map((item, idx) => {
                    const amt = item.qty * item.rate
                    return (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                        <td className="text-center py-2 px-2 text-xs text-muted-foreground w-8">{idx+1}</td>
                        <td className="py-2 px-2">
                          <Input value={item.description} onChange={e => updateItem(item.id,"description",e.target.value)} placeholder="e.g. Elevator AMC" className="h-8 text-sm" />
                        </td>
                        <td className="py-2 px-2 w-16">
                          <Input type="number" min="1" value={item.qty} onChange={e => updateItem(item.id,"qty",Number(e.target.value)||1)} className="h-8 text-sm text-center" />
                        </td>
                        <td className="py-2 px-2 w-24">
                          <Select value={item.unit} onValueChange={v => updateItem(item.id,"unit",v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Nos","Visit","Month","Year","Lot","Set","Hours"].map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2 w-28">
                          <Input type="number" min="0" value={item.rate} onChange={e => updateItem(item.id,"rate",Number(e.target.value)||0)} className="h-8 text-sm text-right" />
                        </td>
                        <td className="py-2 px-2 text-right text-sm font-semibold w-28">
                          ₹{Number(amt).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-2 w-8">
                          <button onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors text-base leading-none">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>+ Add Item</Button>
          </div>

          {/* Part E: Discount */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Discount</h3>
              <Switch checked={formState.includeDiscount} onCheckedChange={v => updateField("includeDiscount",v)} />
            </div>
            {formState.includeDiscount && (
              <div className="space-y-3">
                <div className="flex gap-4">
                  {(["percentage","flat"] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={formState.discountType===t} onChange={() => updateField("discountType",t)} className="accent-blue-600" />
                      {t==="percentage" ? "Percentage (%)" : "Flat Amount (₹)"}
                    </label>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {formState.discountType==="percentage" ? "Discount %" : "Discount Amount (₹)"}
                  </Label>
                  <Input
                    type="number" min="0" className="mt-1"
                    value={formState.discountValue}
                    onChange={e => updateField("discountValue", Number(e.target.value)||0)}
                  />
                </div>
                {discount > 0 && (
                  <p className="text-sm text-red-500 font-medium">
                    Discount: −₹{Number(discount).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Part F: GST */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">GST</h3>
              <Switch checked={formState.includeGst} onCheckedChange={v => updateField("includeGst",v)} />
            </div>
            {formState.includeGst && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">GST Rate</Label>
                  <Select value={String(formState.gstRate)} onValueChange={v => updateField("gstRate", Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5,12,18,28].map(r => <SelectItem key={r} value={String(r)}>{r}% GST</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>SGST ({formState.gstRate/2}%): ₹{Number(sgst).toLocaleString("en-IN")}</span>
                  <span>CGST ({formState.gstRate/2}%): ₹{Number(cgst).toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Part G: Totals box */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            {[
              { label:"Subtotal", value:`₹${Number(subtotal).toLocaleString("en-IN")}` },
              ...(discount>0 ? [{ label: formState.discountType==="percentage" ? `Discount (${formState.discountValue}%)` : "Discount", value:`-₹${Number(discount).toLocaleString("en-IN")}`, red:true }] : []),
              ...(formState.includeGst ? [
                { label:`SGST (${formState.gstRate/2}%)`, value:`₹${Number(sgst).toLocaleString("en-IN")}` },
                { label:`CGST (${formState.gstRate/2}%)`, value:`₹${Number(cgst).toLocaleString("en-IN")}` },
              ] : []),
            ].map((row:any) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.red ? "text-red-500" : ""}>{row.value}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2.5 flex justify-between items-baseline">
              <span className="font-semibold text-sm">Total</span>
              <span className="font-bold text-xl text-blue-600">₹{Number(grandTotal).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Rupees {toWords(Math.floor(grandTotal))} Only
            </p>
          </div>

          {/* Part H: Notes */}
          <div className="border border-border rounded-xl p-5">
            <Label className="text-xs font-semibold text-muted-foreground">Terms & Conditions</Label>
            <Textarea
              className="mt-1.5 resize-none min-h-[72px] text-sm"
              placeholder="Payment terms, bank details, special conditions..."
              value={formState.notes}
              onChange={e => updateField("notes", e.target.value)}
            />
          </div>

          {/* Download Button */}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
            onClick={() => setShowLeadModal(true)}
            disabled={generatingPdf}
          >
            <Download className="mr-2 size-5" />
            Download Quotation PDF — Free
          </Button>
        </div>

        {/* ── RIGHT: Live Preview ─────────────────────────────────────────── */}
        <div className={`w-full lg:w-[520px] lg:sticky lg:top-20 lg:self-start ${showPreview ? "block" : "hidden lg:block"}`}>
          <p className="text-xs text-muted-foreground text-center mb-2">Live Preview</p>
          <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden text-sm">

            {/* Preview Header */}
            <div className="p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {formState.businessInfo.logoBase64 && (
                  <img
                    src={formState.businessInfo.logoBase64}
                    alt="Logo"
                    className="h-12 w-auto object-contain flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-bold text-base text-foreground">
                    {formState.businessInfo.company_name || <span className="text-muted-foreground">Company Name</span>}
                  </p>
                  {formState.businessInfo.phone && <p className="text-xs text-muted-foreground">{formState.businessInfo.phone}</p>}
                  {formState.businessInfo.email && <p className="text-xs text-muted-foreground">{formState.businessInfo.email}</p>}
                  {formState.businessInfo.city  && <p className="text-xs text-muted-foreground">{formState.businessInfo.city}</p>}
                  {formState.businessInfo.gstin && <p className="text-xs text-muted-foreground">GSTIN: {formState.businessInfo.gstin}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-blue-600 tracking-wide">QUOTATION</p>
                <p className="text-xs font-semibold">{formState.quoteNumber}</p>
                <p className="text-xs text-muted-foreground">Date: {formatDate(formState.quoteDate)}</p>
                <p className="text-xs text-muted-foreground">Valid: {formatDate(formState.validTill)}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="border-t border-border p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Bill To</p>
                  <p className="text-sm font-semibold">{formState.clientName || <span className="text-muted-foreground">Client Name</span>}</p>
                  {formState.clientAddress && <p className="text-xs text-muted-foreground">{formState.clientAddress}</p>}
                  {(formState.clientCity||formState.clientState||formState.clientPinCode) && (
                    <p className="text-xs text-muted-foreground">
                      {[formState.clientCity,formState.clientState,formState.clientPinCode].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {formState.clientGstin && <p className="text-xs text-muted-foreground">GSTIN: {formState.clientGstin}</p>}
                </div>
                {formState.subject && (
                  <div className="text-right">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Subject</p>
                    <p className="text-xs font-medium">{formState.subject}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {["#","Description","Qty","Unit","Rate","Amount"].map(h => (
                      <th key={h} className="py-2.5 px-3 font-semibold text-muted-foreground text-left first:text-center last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formState.items.map((it, i) => (
                    <tr key={it.id} className="hover:bg-muted/20 border-b border-border/50">
                      <td className="text-center py-2 px-3 text-muted-foreground">{i+1}</td>
                      <td className="py-2 px-3 font-medium">{it.description||"-"}</td>
                      <td className="text-center py-2 px-3 text-muted-foreground">{it.qty}</td>
                      <td className="text-center py-2 px-3 text-muted-foreground">{it.unit}</td>
                      <td className="text-right py-2 px-3">₹{Number(it.rate).toLocaleString("en-IN")}</td>
                      <td className="text-right py-2 px-3 font-semibold">₹{Number(it.qty*it.rate).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
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
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(subtotal).toLocaleString("en-IN")}</span></div>
                {discount>0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">{formState.discountType==="percentage"?`Discount (${formState.discountValue}%)`:"Discount"}</span><span className="text-red-500">−₹{Number(discount).toLocaleString("en-IN")}</span></div>}
                {formState.includeGst && <>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">SGST ({formState.gstRate/2}%)</span><span>₹{Number(sgst).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">CGST ({formState.gstRate/2}%)</span><span>₹{Number(cgst).toLocaleString("en-IN")}</span></div>
                </>}
                <div className="border-t border-border pt-2.5 flex justify-between items-baseline">
                  <span className="font-semibold text-xs">Total</span>
                  <span className="font-bold text-base text-blue-600">₹{Number(grandTotal).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">Rupees {toWords(Math.floor(grandTotal))} Only</p>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="border-t border-border py-3 px-5">
              <p className="text-[10px] text-muted-foreground text-center">Generated free at remindi.online</p>
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
              <Input className="mt-1" value={leadData.fullName} onChange={e => setLeadData(p=>({...p,fullName:e.target.value}))} placeholder="Rahul Sharma" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Phone Number *</Label>
              <Input className="mt-1" value={leadData.phone} onChange={e => setLeadData(p=>({...p,phone:e.target.value}))} placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Company Name *</Label>
              <Input className="mt-1" value={leadData.companyName} onChange={e => setLeadData(p=>({...p,companyName:e.target.value}))} placeholder="ABC Elevators Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Service Type *</Label>
              <Select value={leadData.serviceType} onValueChange={v => setLeadData(p=>({...p,serviceType:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select your service" /></SelectTrigger>
                <SelectContent>
                  {["Elevator / Lift","HVAC / AC","Fire Safety","Plumbing","Electrical","CCTV / Security","Pest Control","Other"].map(s => (
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
            { icon:<FileText className="size-8 text-blue-600 mb-3"/>, title:"Professional Quotations in Minutes", desc:"Fill the form, preview live, download as PDF. No design skills needed." },
            { icon:<CheckCircle2 className="size-8 text-blue-600 mb-3"/>, title:"GST-Ready for Indian Contractors", desc:"Auto-calculates SGST, CGST, and totals. Supports all GST rates." },
            { icon:<Stamp className="size-8 text-blue-600 mb-3"/>, title:"Full AMC Management on Remindi", desc:"Track contracts, technicians, send reminders, manage invoices — all in one place." },
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
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => window.open("https://remindi.online/signup","_blank")}>
            Start Free on Remindi →
          </Button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q:"Is this free?", a:"Yes. 100% free. No signup or credit card needed." },
            { q:"Can I add GST?", a:"Yes. Toggle GST on, pick your rate, and SGST + CGST are auto-calculated." },
            { q:"Is my data saved?", a:"Your business info is saved on your device only. We do not store your quotation data on our servers." },
            { q:"Can I add my logo?", a:"Yes. Upload your company logo in the Business Info section. It appears on both the preview and the downloaded PDF." },
            { q:"What is Remindi?", a:"Remindi is an AMC management platform for Indian contractors. Manage service contracts, technicians, reminders, and invoices — free to try." },
            { q:"Can I create invoices too?", a:"Yes. Visit remindi.online/free-invoice-generator for our free invoice generator." },
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
