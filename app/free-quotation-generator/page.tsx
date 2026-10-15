"use client"

import { useState } from "react"
import { Download, FileText, CheckCircle2, Stamp, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Utility functions
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

// Types
interface BusinessInfo {
  company_name: string
  your_name: string
  phone: string
  email: string
  city: string
  gstin: string
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

// Navbar Component
function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-blue-600">Remindi</div>
        </div>
        <div className="hidden sm:flex gap-4">
          <Button variant="ghost" onClick={() => window.open("https://remindi.online/login", "_blank")}>
            Sign In
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border p-4 flex flex-col gap-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => window.open("https://remindi.online/login", "_blank")}>
            Sign In
          </Button>
        </div>
      )}
    </nav>
  )
}

// Hero Banner
function HeroBanner() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white dark:from-slate-950 dark:to-background py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Free Quotation Generator for Contractors
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground mb-3">
          Create a professional quotation PDF in minutes. No signup needed.
        </p>
        <p className="text-sm text-muted-foreground">
          Used by 500+ Indian contractors
        </p>
      </div>
    </section>
  )
}

// Generator Tool
function GeneratorTool() {
  const [formState, setFormState] = useState<FormState>({
    businessInfo: {
      company_name: "",
      your_name: "",
      phone: "+91 ",
      email: "",
      city: "",
      gstin: "",
    },
    quoteNumber: "QT-001",
    quoteDate: new Date().toISOString().split("T")[0],
    validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    subject: "",
    clientName: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientPinCode: "",
    clientGstin: "",
    items: [
      { id: "1", description: "", qty: 1, unit: "Nos", rate: 0 },
      { id: "2", description: "", qty: 1, unit: "Nos", rate: 0 },
    ],
    includeDiscount: false,
    discountType: "percentage",
    discountValue: 0,
    includeGst: false,
    gstRate: 18,
    notes: "",
  })

  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadFormData, setLeadFormData] = useState({
    fullName: "",
    phone: "",
    companyName: "",
    serviceType: "",
  })
  const [showPreview, setShowPreview] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const updateBusinessInfo = (field: keyof BusinessInfo, value: string) => {
    setFormState(prev => ({
      ...prev,
      businessInfo: { ...prev.businessInfo, [field]: value },
    }))
  }

  // Update form state helpers
  const updateField = (field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setFormState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  const addItem = () => {
    const newId = String(Math.max(...formState.items.map(i => parseInt(i.id) || 0), 0) + 1)
    setFormState(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { id: newId, description: "", qty: 1, unit: "Nos", rate: 0 },
      ],
    }))
  }

  const deleteItem = (id: string) => {
    if (formState.items.length > 1) {
      setFormState(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== id),
      }))
    }
  }

  // Calculations
  const subtotal = formState.items.reduce((sum, item) => sum + (item.qty * item.rate), 0)
  const discount = formState.includeDiscount
    ? formState.discountType === "percentage"
      ? (subtotal * formState.discountValue) / 100
      : formState.discountValue
    : 0
  const taxableAmount = subtotal - discount
  const sgst = formState.includeGst ? (taxableAmount * (formState.gstRate / 2)) / 100 : 0
  const cgst = formState.includeGst ? (taxableAmount * (formState.gstRate / 2)) / 100 : 0
  const grandTotal = taxableAmount + sgst + cgst

  // Generate PDF
  const generatePdf = async () => {
    try {
      setGeneratingPdf(true)
      const doc = new jsPDF({ orientation: "portrait", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPos = 20

      // Header
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.text(formState.businessInfo.company_name || "Company Name", 20, yPos)
      yPos += 6

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(formState.businessInfo.phone || "", 20, yPos)
      yPos += 4
      doc.text(formState.businessInfo.city || "", 20, yPos)
      yPos += 4
      if (formState.businessInfo.gstin) {
        doc.text(`GSTIN: ${formState.businessInfo.gstin}`, 20, yPos)
        yPos += 4
      }

      // Quotation heading (right)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.setTextColor(37, 99, 235)
      doc.text("QUOTATION", pageWidth - 20, 20, { align: "right" })
      doc.setTextColor(0, 0, 0)

      // Quote details
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Quote No: ${formState.quoteNumber}`, pageWidth - 20, 30, { align: "right" })
      doc.text(`Date: ${formatDate(formState.quoteDate)}`, pageWidth - 20, 35, { align: "right" })
      doc.text(`Valid Till: ${formatDate(formState.validTill)}`, pageWidth - 20, 40, { align: "right" })

      yPos = 50

      // Divider
      doc.setDrawColor(200, 200, 200)
      doc.line(20, yPos, pageWidth - 20, yPos)
      yPos += 8

      // Bill To & Subject
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("Bill To", 20, yPos)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      yPos += 5
      doc.text(formState.clientName || "Client Name", 20, yPos)
      yPos += 4
      if (formState.clientAddress) {
        doc.setFontSize(8)
        doc.text(formState.clientAddress, 20, yPos, { maxWidth: pageWidth - 80 })
        yPos += 4
      }
      if (formState.clientCity || formState.clientState || formState.clientPinCode) {
        doc.setFontSize(8)
        const cityStatePin = [formState.clientCity, formState.clientState, formState.clientPinCode].filter(Boolean).join(", ")
        doc.text(cityStatePin, 20, yPos)
        yPos += 4
      }
      if (formState.clientGstin) {
        doc.setFontSize(8)
        doc.text(`GSTIN: ${formState.clientGstin}`, 20, yPos)
        yPos += 4
      }

      // Subject (right)
      if (formState.subject) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("Subject:", pageWidth - 20, 58, { align: "right" })
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.text(formState.subject, pageWidth - 20, 63, { align: "right", maxWidth: 60 })
      }

      yPos = 90

      // Line items table
      const tableData = formState.items.map((item, idx) => [
        String(idx + 1),
        item.description,
        String(item.qty),
        item.unit,
        Number(item.rate).toLocaleString("en-IN"),
        Number(item.qty * item.rate).toLocaleString("en-IN"),
      ])

      autoTable(doc, {
        head: [["#", "Description", "Qty", "Unit", "Rate (₹)", "Amount (₹)"]],
        body: tableData,
        startY: yPos,
        margin: { left: 20, right: 20 },
        styles: {
          fontSize: 9,
          cellPadding: 3,
          halign: "left",
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        columnStyles: {
          0: { halign: "center", width: 12 },
          1: { halign: "left" },
          2: { halign: "center", width: 15 },
          3: { halign: "center", width: 15 },
          4: { halign: "right", width: 25 },
          5: { halign: "right", width: 28 },
        },
      })

      yPos = (doc as any).lastAutoTable.finalY + 10

      // Totals section
      const rightX = pageWidth - 80
      const rightLabelX = rightX - 40

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)

      const totalsData = [
        { label: "Subtotal:", value: Number(subtotal).toLocaleString("en-IN") },
        ...(discount > 0 ? [{ label: `Discount (${formState.discountType === "percentage" ? formState.discountValue + "%" : ""})`, value: `-${Number(discount).toLocaleString("en-IN")}`, color: [220, 38, 38] as [number, number, number] }] : []),
        ...(formState.includeGst ? [{ label: `SGST (${formState.gstRate / 2}%):`, value: Number(sgst).toLocaleString("en-IN") }] : []),
        ...(formState.includeGst ? [{ label: `CGST (${formState.gstRate / 2}%):`, value: Number(cgst).toLocaleString("en-IN") }] : []),
      ]

      for (const item of totalsData) {
        if (item.color) {
          doc.setTextColor(item.color[0], item.color[1], item.color[2])
        }
        doc.text(item.label, rightLabelX, yPos, { align: "left" })
        doc.text(item.value, rightX, yPos, { align: "right" })
        if (item.color) {
          doc.setTextColor(0, 0, 0)
        }
        yPos += 5
      }

      // Total line
      doc.setDrawColor(200, 200, 200)
      doc.line(rightLabelX, yPos, rightX + 20, yPos)
      yPos += 5

      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(37, 99, 235)
      doc.text("Total:", rightLabelX, yPos, { align: "left" })
      doc.text(Number(grandTotal).toLocaleString("en-IN"), rightX, yPos, { align: "right" })
      doc.setTextColor(0, 0, 0)
      yPos += 6

      // Amount in words
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const amountInWords = `Rupees ${toWords(Math.floor(grandTotal))} Only`
      doc.text(amountInWords, rightLabelX, yPos)

      // Notes section
      if (formState.notes) {
        yPos += 15
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.setTextColor(0, 0, 0)
        doc.text("Terms & Conditions:", 20, yPos)
        yPos += 5
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        const notesLines = doc.splitTextToSize(formState.notes, pageWidth - 40)
        doc.text(notesLines, 20, yPos)
      }

      // Footer
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text("Generated free at remindi.online", pageWidth / 2, pageHeight - 10, { align: "center" })

      // Download
      doc.save(`Quotation_${formState.quoteNumber}_${formState.clientName}.pdf`)
      toast.success("Quotation downloaded!", {
        description: "Want to manage all your quotations automatically? Try Remindi free.",
        action: {
          label: "Try Remindi →",
          onClick: () => window.open("https://remindi.online/signup", "_blank"),
        },
      })
    } catch (err) {
      console.error("[v0] PDF generation error:", err)
      toast.error("Failed to generate PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // Handle download with lead capture
  const handleDownloadClick = () => {
    setShowLeadModal(true)
  }

  const handleLeadSubmit = async () => {
    if (!leadFormData.fullName || !leadFormData.phone || !leadFormData.companyName || !leadFormData.serviceType) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setGeneratingPdf(true)
      setShowLeadModal(false)
      await generatePdf()
      setLeadFormData({ fullName: "", phone: "", companyName: "", serviceType: "" })
    } catch (err) {
      console.log("[v0] Error in lead submission:", err)
      // Still generate PDF even if lead capture fails
      setShowLeadModal(false)
      await generatePdf()
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <section className="py-8 sm:py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Desktop: Two column layout */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
          {/* Left: Form */}
          <div className="space-y-6">
            {/* Part A: Business Info */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Your Business Info</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="company-name" className="text-xs font-semibold text-muted-foreground">
                    Company Name *
                  </Label>
                  <Input
                    id="company-name"
                    value={formState.businessInfo.company_name}
                    onChange={(e) => updateBusinessInfo("company_name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="your-name" className="text-xs font-semibold text-muted-foreground">
                    Your Name
                  </Label>
                  <Input
                    id="your-name"
                    value={formState.businessInfo.your_name}
                    onChange={(e) => updateBusinessInfo("your_name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formState.businessInfo.phone}
                    onChange={(e) => updateBusinessInfo("phone", e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formState.businessInfo.email}
                    onChange={(e) => updateBusinessInfo("email", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="text-xs font-semibold text-muted-foreground">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formState.businessInfo.city}
                    onChange={(e) => updateBusinessInfo("city", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="gstin" className="text-xs font-semibold text-muted-foreground">
                    GSTIN (optional)
                  </Label>
                  <Input
                    id="gstin"
                    value={formState.businessInfo.gstin}
                    onChange={(e) => updateBusinessInfo("gstin", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Your info is saved on this device for next time.
              </p>
            </div>

            {/* Part B: Quotation Details */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Quotation Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="quote-number" className="text-xs font-semibold text-muted-foreground">
                    Quote Number
                  </Label>
                  <Input
                    id="quote-number"
                    value={formState.quoteNumber}
                    onChange={(e) => updateField("quoteNumber", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quote-date" className="text-xs font-semibold text-muted-foreground">
                    Quote Date
                  </Label>
                  <Input
                    id="quote-date"
                    type="date"
                    value={formState.quoteDate}
                    onChange={(e) => updateField("quoteDate", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="valid-till" className="text-xs font-semibold text-muted-foreground">
                    Valid Till
                  </Label>
                  <Input
                    id="valid-till"
                    type="date"
                    value={formState.validTill}
                    onChange={(e) => updateField("validTill", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="subject" className="text-xs font-semibold text-muted-foreground">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    value={formState.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    placeholder="e.g. AMC for Elevator at ABC Towers"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Part C: Client Details */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Client Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="client-name" className="text-xs font-semibold text-muted-foreground">
                    Client Name *
                  </Label>
                  <Input
                    id="client-name"
                    value={formState.clientName}
                    onChange={(e) => updateField("clientName", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-address" className="text-xs font-semibold text-muted-foreground">
                    Client Address
                  </Label>
                  <Textarea
                    id="client-address"
                    value={formState.clientAddress}
                    onChange={(e) => updateField("clientAddress", e.target.value)}
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label htmlFor="client-city" className="text-xs font-semibold text-muted-foreground">
                    City
                  </Label>
                  <Input
                    id="client-city"
                    value={formState.clientCity}
                    onChange={(e) => updateField("clientCity", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-state" className="text-xs font-semibold text-muted-foreground">
                    State
                  </Label>
                  <Input
                    id="client-state"
                    value={formState.clientState}
                    onChange={(e) => updateField("clientState", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-pincode" className="text-xs font-semibold text-muted-foreground">
                    PIN Code
                  </Label>
                  <Input
                    id="client-pincode"
                    value={formState.clientPinCode}
                    onChange={(e) => updateField("clientPinCode", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-gstin" className="text-xs font-semibold text-muted-foreground">
                    GSTIN (optional)
                  </Label>
                  <Input
                    id="client-gstin"
                    value={formState.clientGstin}
                    onChange={(e) => updateField("clientGstin", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Part D: Line Items */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Line Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">#</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">Unit</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground">Rate (₹)</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formState.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                        <td className="text-center py-3 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, "description", e.target.value)}
                            placeholder="Description"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, "qty", parseInt(e.target.value) || 0)}
                            className="h-8 text-center text-sm"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Select value={item.unit} onValueChange={(val) => updateItem(item.id, "unit", val)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["Nos", "Visit", "Month", "Year", "Lot", "Set", "Hours"].map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right text-sm"
                          />
                        </td>
                        <td className="py-3 px-2 text-right text-sm font-medium">
                          {Number(item.qty * item.rate).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-2">
                          {formState.items.length > 1 && (
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
                + Add Item
              </Button>
            </div>

            {/* Part E: Discount */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-semibold text-muted-foreground">Include Discount</Label>
                <Switch checked={formState.includeDiscount} onCheckedChange={(val) => updateField("includeDiscount", val)} />
              </div>
              {formState.includeDiscount && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formState.discountType === "percentage"}
                        onChange={() => updateField("discountType", "percentage")}
                      />
                      <span className="text-sm">Percentage (%)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formState.discountType === "flat"}
                        onChange={() => updateField("discountType", "flat")}
                      />
                      <span className="text-sm">Flat Amount (₹)</span>
                    </label>
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={formState.discountValue}
                      onChange={(e) => updateField("discountValue", parseFloat(e.target.value) || 0)}
                      placeholder="Enter discount"
                    />
                  </div>
                  {discount > 0 && (
                    <div className="text-sm text-red-500">
                      −₹{Number(discount).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Part F: GST */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-semibold text-muted-foreground">Include GST</Label>
                <Switch checked={formState.includeGst} onCheckedChange={(val) => updateField("includeGst", val)} />
              </div>
              {formState.includeGst && (
                <div>
                  <Label htmlFor="gst-rate" className="text-xs font-semibold text-muted-foreground">
                    GST Rate
                  </Label>
                  <Select value={String(formState.gstRate)} onValueChange={(val) => updateField("gstRate", parseInt(val))}>
                    <SelectTrigger id="gst-rate" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 12, 18, 28].map(rate => (
                        <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Part G: Totals Box */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{Number(subtotal).toLocaleString("en-IN")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="text-red-500">−₹{Number(discount).toLocaleString("en-IN")}</span>
                </div>
              )}
              {formState.includeGst && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>SGST ({formState.gstRate / 2}%):</span>
                    <span>₹{Number(sgst).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>CGST ({formState.gstRate / 2}%):</span>
                    <span>₹{Number(cgst).toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2.5 mt-2.5 flex justify-between font-bold text-xl text-blue-600">
                <span>Total:</span>
                <span>₹{Number(grandTotal).toLocaleString("en-IN")}</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Rupees {toWords(Math.floor(grandTotal))} Only
              </div>
            </div>

            {/* Part H: Notes */}
            <div className="border border-border rounded-lg p-5">
              <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground">
                Terms & Conditions
              </Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Payment terms, bank details, special conditions..."
                className="mt-2 min-h-[72px] resize-none text-sm"
              />
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownloadClick}
              disabled={generatingPdf}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="mr-2 size-4" />
              {generatingPdf ? "Generating..." : "Download Quotation PDF — Free"}
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="sticky top-20 h-fit">
            <QuotationPreview formState={formState} subtotal={subtotal} discount={discount} sgst={sgst} cgst={cgst} grandTotal={grandTotal} />
          </div>
        </div>

        {/* Mobile: Form and toggle preview */}
        <div className="lg:hidden space-y-4">
          {/* Form - same as desktop */}
          <div className="space-y-4">
            {/* Part A: Business Info */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Your Business Info</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="company-name" className="text-xs font-semibold text-muted-foreground">
                    Company Name *
                  </Label>
                  <Input
                    id="company-name"
                    value={formState.businessInfo.company_name}
                    onChange={(e) => updateBusinessInfo("company_name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="your-name" className="text-xs font-semibold text-muted-foreground">
                    Your Name
                  </Label>
                  <Input
                    id="your-name"
                    value={formState.businessInfo.your_name}
                    onChange={(e) => updateBusinessInfo("your_name", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formState.businessInfo.phone}
                    onChange={(e) => updateBusinessInfo("phone", e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formState.businessInfo.email}
                    onChange={(e) => updateBusinessInfo("email", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="text-xs font-semibold text-muted-foreground">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formState.businessInfo.city}
                    onChange={(e) => updateBusinessInfo("city", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="gstin" className="text-xs font-semibold text-muted-foreground">
                    GSTIN (optional)
                  </Label>
                  <Input
                    id="gstin"
                    value={formState.businessInfo.gstin}
                    onChange={(e) => updateBusinessInfo("gstin", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Your info is saved on this device for next time.
              </p>
            </div>

            {/* Part B: Quotation Details */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Quotation Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="quote-number" className="text-xs font-semibold text-muted-foreground">
                    Quote Number
                  </Label>
                  <Input
                    id="quote-number"
                    value={formState.quoteNumber}
                    onChange={(e) => updateField("quoteNumber", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quote-date" className="text-xs font-semibold text-muted-foreground">
                    Quote Date
                  </Label>
                  <Input
                    id="quote-date"
                    type="date"
                    value={formState.quoteDate}
                    onChange={(e) => updateField("quoteDate", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="valid-till" className="text-xs font-semibold text-muted-foreground">
                    Valid Till
                  </Label>
                  <Input
                    id="valid-till"
                    type="date"
                    value={formState.validTill}
                    onChange={(e) => updateField("validTill", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="subject" className="text-xs font-semibold text-muted-foreground">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    value={formState.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    placeholder="e.g. AMC for Elevator at ABC Towers"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Part C: Client Details */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Client Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="client-name" className="text-xs font-semibold text-muted-foreground">
                    Client Name *
                  </Label>
                  <Input
                    id="client-name"
                    value={formState.clientName}
                    onChange={(e) => updateField("clientName", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-address" className="text-xs font-semibold text-muted-foreground">
                    Client Address
                  </Label>
                  <Textarea
                    id="client-address"
                    value={formState.clientAddress}
                    onChange={(e) => updateField("clientAddress", e.target.value)}
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label htmlFor="client-city" className="text-xs font-semibold text-muted-foreground">
                    City
                  </Label>
                  <Input
                    id="client-city"
                    value={formState.clientCity}
                    onChange={(e) => updateField("clientCity", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-state" className="text-xs font-semibold text-muted-foreground">
                    State
                  </Label>
                  <Input
                    id="client-state"
                    value={formState.clientState}
                    onChange={(e) => updateField("clientState", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-pincode" className="text-xs font-semibold text-muted-foreground">
                    PIN Code
                  </Label>
                  <Input
                    id="client-pincode"
                    value={formState.clientPinCode}
                    onChange={(e) => updateField("clientPinCode", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="client-gstin" className="text-xs font-semibold text-muted-foreground">
                    GSTIN (optional)
                  </Label>
                  <Input
                    id="client-gstin"
                    value={formState.clientGstin}
                    onChange={(e) => updateField("clientGstin", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Part D: Line Items */}
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm mb-4">Line Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">#</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-center py-2.5 px-2 text-xs font-semibold text-muted-foreground">Unit</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground">Rate (₹)</th>
                      <th className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formState.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                        <td className="text-center py-3 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 px-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, "description", e.target.value)}
                            placeholder="Description"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, "qty", parseInt(e.target.value) || 0)}
                            className="h-8 text-center text-sm"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Select value={item.unit} onValueChange={(val) => updateItem(item.id, "unit", val)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["Nos", "Visit", "Month", "Year", "Lot", "Set", "Hours"].map(u => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                            className="h-8 text-right text-sm"
                          />
                        </td>
                        <td className="py-3 px-2 text-right text-sm font-medium">
                          {Number(item.qty * item.rate).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-2">
                          {formState.items.length > 1 && (
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
                + Add Item
              </Button>
            </div>

            {/* Part E: Discount */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-semibold text-muted-foreground">Include Discount</Label>
                <Switch checked={formState.includeDiscount} onCheckedChange={(val) => updateField("includeDiscount", val)} />
              </div>
              {formState.includeDiscount && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formState.discountType === "percentage"}
                        onChange={() => updateField("discountType", "percentage")}
                      />
                      <span className="text-sm">Percentage (%)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formState.discountType === "flat"}
                        onChange={() => updateField("discountType", "flat")}
                      />
                      <span className="text-sm">Flat Amount (₹)</span>
                    </label>
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={formState.discountValue}
                      onChange={(e) => updateField("discountValue", parseFloat(e.target.value) || 0)}
                      placeholder="Enter discount"
                    />
                  </div>
                  {discount > 0 && (
                    <div className="text-sm text-red-500">
                      −₹{Number(discount).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Part F: GST */}
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-semibold text-muted-foreground">Include GST</Label>
                <Switch checked={formState.includeGst} onCheckedChange={(val) => updateField("includeGst", val)} />
              </div>
              {formState.includeGst && (
                <div>
                  <Label htmlFor="gst-rate" className="text-xs font-semibold text-muted-foreground">
                    GST Rate
                  </Label>
                  <Select value={String(formState.gstRate)} onValueChange={(val) => updateField("gstRate", parseInt(val))}>
                    <SelectTrigger id="gst-rate" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 12, 18, 28].map(rate => (
                        <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Part G: Totals Box */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{Number(subtotal).toLocaleString("en-IN")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="text-red-500">−₹{Number(discount).toLocaleString("en-IN")}</span>
                </div>
              )}
              {formState.includeGst && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>SGST ({formState.gstRate / 2}%):</span>
                    <span>₹{Number(sgst).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>CGST ({formState.gstRate / 2}%):</span>
                    <span>₹{Number(cgst).toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border pt-2.5 mt-2.5 flex justify-between font-bold text-xl text-blue-600">
                <span>Total:</span>
                <span>₹{Number(grandTotal).toLocaleString("en-IN")}</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Rupees {toWords(Math.floor(grandTotal))} Only
              </div>
            </div>

            {/* Part H: Notes */}
            <div className="border border-border rounded-lg p-5">
              <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground">
                Terms & Conditions
              </Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Payment terms, bank details, special conditions..."
                className="mt-2 min-h-[72px] resize-none text-sm"
              />
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownloadClick}
              disabled={generatingPdf}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="mr-2 size-4" />
              {generatingPdf ? "Generating..." : "Download Quotation PDF — Free"}
            </Button>

            {/* Toggle Preview on Mobile */}
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>

            {/* Mobile Preview */}
            {showPreview && (
              <div className="mt-4">
                <QuotationPreview formState={formState} subtotal={subtotal} discount={discount} sgst={sgst} cgst={cgst} grandTotal={grandTotal} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lead Capture Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>One last step</DialogTitle>
            <DialogDescription>
              Enter your details to download your quotation PDF. We will not spam you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="lead-name" className="text-sm font-medium">
                Full Name *
              </Label>
              <Input
                id="lead-name"
                value={leadFormData.fullName}
                onChange={(e) => setLeadFormData({ ...leadFormData, fullName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lead-phone" className="text-sm font-medium">
                Phone Number *
              </Label>
              <Input
                id="lead-phone"
                value={leadFormData.phone}
                onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lead-company" className="text-sm font-medium">
                Company Name *
              </Label>
              <Input
                id="lead-company"
                value={leadFormData.companyName}
                onChange={(e) => setLeadFormData({ ...leadFormData, companyName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lead-service" className="text-sm font-medium">
                Service Type *
              </Label>
              <Select value={leadFormData.serviceType} onValueChange={(val) => setLeadFormData({ ...leadFormData, serviceType: val })}>
                <SelectTrigger id="lead-service" className="mt-1">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {["Elevator / Lift", "HVAC / AC", "Fire Safety", "Plumbing", "Electrical", "CCTV / Security", "Pest Control", "Other"].map(service => (
                    <SelectItem key={service} value={service}>{service}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLeadSubmit}
              disabled={generatingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {generatingPdf ? "Processing..." : "Download My Free Quotation PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// Quotation Preview Component
function QuotationPreview({ formState, subtotal, discount, sgst, cgst, grandTotal }: any) {
  return (
    <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xl font-bold text-foreground">{formState.businessInfo.company_name || "Company Name"}</div>
            <div className="text-sm text-muted-foreground">{formState.businessInfo.phone || ""}</div>
            <div className="text-sm text-muted-foreground">{formState.businessInfo.city || ""}</div>
            {formState.businessInfo.gstin && <div className="text-xs text-muted-foreground">GSTIN: {formState.businessInfo.gstin}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600 tracking-wide">QUOTATION</div>
            <div className="text-sm font-semibold">{formState.quoteNumber}</div>
            <div className="text-sm text-muted-foreground">{formatDate(formState.quoteDate)}</div>
            <div className="text-sm text-muted-foreground">Valid Till: {formatDate(formState.validTill)}</div>
          </div>
        </div>
      </div>

      {/* Bill To & Subject */}
      <div className="p-5 border-b border-border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">Bill To</div>
            <div className="text-sm font-semibold">{formState.clientName || "Client Name"}</div>
            {formState.clientAddress && <div className="text-xs text-muted-foreground">{formState.clientAddress}</div>}
            {(formState.clientCity || formState.clientState || formState.clientPinCode) && (
              <div className="text-xs text-muted-foreground">
                {[formState.clientCity, formState.clientState, formState.clientPinCode].filter(Boolean).join(", ")}
              </div>
            )}
            {formState.clientGstin && <div className="text-xs text-muted-foreground">GSTIN: {formState.clientGstin}</div>}
          </div>
          {formState.subject && (
            <div className="text-right">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Subject</div>
              <div className="text-sm font-medium">{formState.subject}</div>
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto border-b border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground">#</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Description</th>
              <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground">Qty</th>
              <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground">Unit</th>
              <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground">Rate</th>
              <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {formState.items.map((item: LineItem, idx: number) => (
              <tr key={item.id} className="hover:bg-muted/20 transition-colors border-b border-border/50">
                <td className="text-center py-3 px-4 text-xs text-muted-foreground">{idx + 1}</td>
                <td className="py-3 px-4 font-medium text-sm">{item.description || "-"}</td>
                <td className="text-center py-3 px-4 text-sm text-muted-foreground">{item.qty}</td>
                <td className="text-center py-3 px-4 text-sm text-muted-foreground">{item.unit}</td>
                <td className="text-right py-3 px-4 text-sm">₹{Number(item.rate).toLocaleString("en-IN")}</td>
                <td className="text-right py-3 px-4 text-sm font-semibold">₹{Number(item.qty * item.rate).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & Notes */}
      <div className="border-t border-border flex flex-col sm:flex-row">
        {/* Notes */}
        {formState.notes && (
          <div className="flex-1 p-5 border-b sm:border-b-0 sm:border-r border-border">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Terms & Conditions</div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap">{formState.notes}</div>
          </div>
        )}

        {/* Totals */}
        <div className="p-5 sm:w-64 shrink-0 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>₹{Number(subtotal).toLocaleString("en-IN")}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span>Discount:</span>
              <span className="text-red-500">−₹{Number(discount).toLocaleString("en-IN")}</span>
            </div>
          )}
          {formState.includeGst && (
            <>
              <div className="flex justify-between text-sm">
                <span>SGST ({formState.gstRate / 2}%):</span>
                <span>₹{Number(sgst).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>CGST ({formState.gstRate / 2}%):</span>
                <span>₹{Number(cgst).toLocaleString("en-IN")}</span>
              </div>
            </>
          )}
          <div className="border-t border-border pt-2.5">
            <div className="flex justify-between font-bold text-xl text-blue-600">
              <span>Total:</span>
              <span>₹{Number(grandTotal).toLocaleString("en-IN")}</span>
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-1">
              Rupees {toWords(Math.floor(grandTotal))} Only
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-3 px-5 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          Generated free at remindi.online
        </div>
      </div>
    </div>
  )
}

// SEO Content Section
function SeoContentSection() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        {/* Why Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Why Indian Contractors Trust Remindi</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-border p-5">
              <FileText className="size-8 text-blue-600 mb-3" />
              <h3 className="font-semibold mb-2">Professional Quotations in Minutes</h3>
              <p className="text-sm text-muted-foreground">
                Fill the form, preview live, download as PDF. No design skills needed.
              </p>
            </Card>
            <Card className="border border-border p-5">
              <CheckCircle2 className="size-8 text-blue-600 mb-3" />
              <h3 className="font-semibold mb-2">GST-Ready for Indian Contractors</h3>
              <p className="text-sm text-muted-foreground">
                Auto-calculates SGST, CGST, and totals. Supports all GST rates.
              </p>
            </Card>
            <Card className="border border-border p-5">
              <Stamp className="size-8 text-blue-600 mb-3" />
              <h3 className="font-semibold mb-2">Full AMC Management on Remindi</h3>
              <p className="text-sm text-muted-foreground">
                Track contracts, technicians, send reminders, manage invoices — all in one place.
              </p>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-16">
          <h3 className="text-2xl font-semibold mb-4">
            Ready to manage all your AMC contracts and quotations automatically?
          </h3>
          <Button
            onClick={() => window.open("https://remindi.online/signup", "_blank")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Start Free on Remindi →
          </Button>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>Is this free?</AccordionTrigger>
              <AccordionContent>
                Yes. 100% free. No signup or credit card needed.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Can I add GST?</AccordionTrigger>
              <AccordionContent>
                Yes. Toggle GST on, pick your rate, and SGST + CGST are auto-calculated.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Is my data saved?</AccordionTrigger>
              <AccordionContent>
                Your business info is saved on your device only. We do not store your quotation data.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>What is Remindi?</AccordionTrigger>
              <AccordionContent>
                Remindi is an AMC management platform for Indian contractors. Manage service contracts, technicians, reminders, and invoices — free to try.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger>Can I create invoices too?</AccordionTrigger>
              <AccordionContent>
                Yes. Visit remindi.online/free-invoice-generator for our free invoice generator.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  )
}

// Main Page Export
export default function FreeQuotationGeneratorPage() {
  return (
    <main>
      <PublicNavbar />
      <HeroBanner />
      <GeneratorTool />
      <SeoContentSection />
    </main>
  )
}
