"use client"

import { useState, useEffect } from "react"
import {
  Download, FileText, CheckCircle2, Stamp,
  Menu, X, ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select"
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

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  })
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

function toWords(n: number): string {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"]
  const b = ["","","Twenty","Thirty","Forty","Fifty",
    "Sixty","Seventy","Eighty","Ninety"]
  if (n === 0) return "Zero"
  if (n < 20) return a[n]
  if (n < 100) return b[Math.floor(n/10)]+(n%10?" "+a[n%10]:"")
  if (n < 1000) return a[Math.floor(n/100)]+" Hundred"+(n%100?" "+toWords(n%100):"")
  if (n < 100000) return toWords(Math.floor(n/1000))+" Thousand"+(n%1000?" "+toWords(n%1000):"")
  if (n < 10000000) return toWords(Math.floor(n/100000))+" Lakh"+(n%100000?" "+toWords(n%100000):"")
  return toWords(Math.floor(n/10000000))+" Crore"+(n%10000000?" "+toWords(n%10000000):"")
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface BusinessInfo {
  company_name: string
  phone: string
  email: string
  city: string
  gstin: string
  logoBase64: string
  bank_name: string
  account_no: string
  ifsc_code: string
  upi_id: string
}

interface LineItem {
  id: string
  description: string
  qty: number
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

const LS_KEY = "remindi_business_info_v2"

const defaultState: FormState = {
  businessInfo: {
    company_name:"", phone:"", email:"", city:"", gstin:"", logoBase64:"",
    bank_name:"", account_no:"", ifsc_code:"", upi_id:"",
  },
  quoteNumber: "QT-001",
  quoteDate: new Date().toISOString().split("T")[0],
  validTill: new Date(Date.now()+30*24*60*60*1000).toISOString().split("T")[0],
  subject: "",
  clientName:"", clientAddress:"", clientCity:"", clientState:"",
  clientPinCode:"", clientGstin:"",
  items:[
    { id:"1", description:"", qty:1, rate:0 },
    { id:"2", description:"", qty:1, rate:0 },
  ],
  includeDiscount:false,
  discountType:"percentage",
  discountValue:0,
  includeGst:false,
  gstRate:18,
  notes:"",
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function PublicNavbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-blue-600">Remindi</span>
        <div className="hidden sm:flex gap-2">
          <Button variant="ghost" size="sm" onClick={()=>window.open("https://remindi.online/login","_blank")}>Sign In</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>window.open("https://remindi.online/signup","_blank")}>Sign Up Free</Button>
        </div>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={()=>setOpen(!open)}>
          {open?<X size={20}/>:<Menu size={20}/>}
        </Button>
      </div>
      {open&&(
        <div className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-2 bg-background">
          <Button variant="ghost" className="w-full justify-start" onClick={()=>window.open("https://remindi.online/login","_blank")}>Sign In</Button>
          <Button className="w-full bg-blue-600 text-white" onClick={()=>window.open("https://remindi.online/signup","_blank")}>Sign Up Free</Button>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroBanner() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white dark:from-slate-950 dark:to-background py-10 sm:py-14">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Free Quotation Generator for Contractors
        </h1>
        <p className="text-base text-muted-foreground mb-2">
          Create a professional quotation PDF in minutes. No signup needed.
        </p>
        <p className="text-sm font-medium text-blue-600">Used by 500+ Indian contractors</p>
      </div>
    </section>
  )
}

// ─── Main Generator ───────────────────────────────────────────────────────────
function GeneratorTool() {
  const [form, setForm] = useState<FormState>(defaultState)
  const [showLead, setShowLead] = useState(false)
  const [lead, setLead] = useState({fullName:"",phone:"",companyName:"",serviceType:""})
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load from localStorage
  useEffect(()=>{
    try {
      const s = localStorage.getItem(LS_KEY)
      if (s) {
        const p = JSON.parse(s) as Partial<BusinessInfo>
        setForm(prev=>({...prev, businessInfo:{...prev.businessInfo,...p}}))
      }
    } catch {}
  },[])

  // Save to localStorage on change
  useEffect(()=>{
    try { localStorage.setItem(LS_KEY, JSON.stringify(form.businessInfo)) } catch {}
  },[form.businessInfo])

  // Helpers
  const updateBiz = (f: keyof BusinessInfo, v: string) =>
    setForm(p=>({...p, businessInfo:{...p.businessInfo,[f]:v}}))
  const updateField = (f: keyof FormState, v: any) =>
    setForm(p=>({...p,[f]:v}))
  const updateItem = (id:string, f:keyof LineItem, v:any) =>
    setForm(p=>({...p, items:p.items.map(it=>it.id===id?{...it,[f]:v}:it)}))
  const addItem = () =>
    setForm(p=>({...p, items:[...p.items,{id:String(Date.now()),description:"",qty:1,rate:0}]}))
  const deleteItem = (id:string) => {
    if(form.items.length<=1) return
    setForm(p=>({...p, items:p.items.filter(it=>it.id!==id)}))
  }

  // Logo upload
  const handleLogo = (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if(!file) return
    if(file.size>2*1024*1024){toast.error("Logo must be under 2 MB");return}
    const reader = new FileReader()
    reader.onload = ev => updateBiz("logoBase64", ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // Calculations
  const subtotal = form.items.reduce((s,it)=>s+it.qty*it.rate,0)
  const discount = form.includeDiscount
    ? form.discountType==="percentage" ? (subtotal*form.discountValue)/100 : form.discountValue
    : 0
  const taxable = subtotal - discount
  const sgst = form.includeGst ? (taxable*form.gstRate/2)/100 : 0
  const cgst = form.includeGst ? (taxable*form.gstRate/2)/100 : 0
  const grandTotal = taxable + sgst + cgst
  const hasBankDetails = form.businessInfo.bank_name || form.businessInfo.account_no
    || form.businessInfo.ifsc_code || form.businessInfo.upi_id

  // ─── PDF — matches original Remindi quotation PDF exactly ─────────────────
  const generatePdf = async () => {
    setGenerating(true)
    try {
      const pageW = 210
      const margin = 15
      const blue: [number,number,number] = [37, 99, 235]
      const gray: [number,number,number] = [120, 120, 120]

      // Measure height first on scratch doc, then render on final doc
      const renderQuotation = (doc: jsPDF): number => {
        let y = margin

        // ── Header: logo left + company info ──────────────────────────────
        const biz = form.businessInfo
        const logoB64 = biz.logoBase64

        if (logoB64) {
          const fmt: "PNG"|"JPEG" = logoB64.includes("data:image/jpeg") || logoB64.includes("data:image/jpg") ? "JPEG" : "PNG"
          try { doc.addImage(logoB64, fmt, margin, y, 22, 22) } catch {}
          const tx = margin + 25
          doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(0,0,0)
          doc.text(biz.company_name||"Company Name", tx, y+5)
          doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...gray)
          let iy = y+10
          if(biz.phone){doc.text(biz.phone,tx,iy);iy+=4}
          if(biz.email){doc.text(biz.email,tx,iy);iy+=4}
          if(biz.city){doc.text(biz.city,tx,iy);iy+=4}
          if(biz.gstin){doc.text("GSTIN: "+biz.gstin,tx,iy)}
          y += 28
        } else {
          doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(0,0,0)
          doc.text(biz.company_name||"Company Name", margin, y+5)
          doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...gray)
          let iy = y+11
          if(biz.phone){doc.text(biz.phone,margin,iy);iy+=4}
          if(biz.email){doc.text(biz.email,margin,iy);iy+=4}
          if(biz.city){doc.text(biz.city,margin,iy);iy+=4}
          if(biz.gstin){doc.text("GSTIN: "+biz.gstin,margin,iy)}
          y += 28
        }

        // Blue divider line (matches renderSingleLogoHeader style)
        doc.setDrawColor(...blue); doc.setLineWidth(0.6)
        doc.line(margin, y, pageW-margin, y)
        y += 7

        // ── "QUOTATION" heading right ──────────────────────────────────────
        doc.setFont("helvetica","bold"); doc.setFontSize(16)
        doc.setTextColor(...blue)
        doc.text("QUOTATION", pageW-margin, y, {align:"right"})

        // Quote No left, DATE right — same row
        y += 6
        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(0,0,0)
        doc.text(form.quoteNumber||"QT-001", margin, y)
        doc.text("DATE: "+formatDateShort(form.quoteDate), pageW-margin, y, {align:"right"})

        // Valid till in red
        y += 5
        if (form.validTill) {
          doc.setFont("helvetica","normal"); doc.setFontSize(9)
          doc.setTextColor(220,38,38)
          doc.text("Valid till: "+formatDateShort(form.validTill), pageW-margin, y, {align:"right"})
        }
        doc.setTextColor(0,0,0)

        // ── TO, + client details ───────────────────────────────────────────
        y += 2
        doc.setFont("helvetica","bold"); doc.setFontSize(9)
        doc.setTextColor(...gray)
        doc.text("TO,", margin, y)
        y += 5
        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(0,0,0)
        doc.text((form.clientName||"Client Name").toUpperCase(), margin, y)
        y += 5
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(40,40,40)
        if(form.clientAddress){doc.text(form.clientAddress,margin,y);y+=5}
        const cityLine = [form.clientCity,form.clientState,form.clientPinCode].filter(Boolean).join(", ")
        if(cityLine){doc.text(cityLine,margin,y);y+=5}
        if(form.clientGstin){doc.text("GSTIN: "+form.clientGstin,margin,y);y+=5}
        y += 3

        // ── Subject ───────────────────────────────────────────────────────
        if(form.subject){
          doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(0,0,0)
          doc.text("Sub: "+form.subject, margin, y)
          y += 6
        }

        // ── Items table: SR.NO | PARTICULARS | QTY. | RATE | AMOUNT ───────
        const tableRows = form.items.map((it,i)=>[
          String(i+1),
          it.description||"-",
          String(it.qty),
          "Rs. "+Number(it.rate).toLocaleString("en-IN"),
          "Rs. "+Number(it.qty*it.rate).toLocaleString("en-IN"),
        ])

        autoTable(doc, {
          startY: y,
          head: [["SR.NO","PARTICULARS","QTY.","RATE","AMOUNT"]],
          body: tableRows,
          theme: "grid",
          headStyles: {
            fillColor: blue,
            textColor: [255,255,255],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
          },
          bodyStyles: { fontSize:9, textColor:[0,0,0] },
          columnStyles: {
            0: {cellWidth:15, halign:"center"},
            1: {cellWidth:"auto"},
            2: {cellWidth:20, halign:"center"},
            3: {cellWidth:35, halign:"right"},
            4: {cellWidth:35, halign:"right"},
          },
          margin: {left:margin, right:margin},
          pageBreak:"avoid",
          rowPageBreak:"avoid",
        })

        y = (doc as any).lastAutoTable.finalY + 8

        // ── Totals ────────────────────────────────────────────────────────
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(0,0,0)
        doc.text("Subtotal:", 160, y, {align:"right"})
        doc.text("Rs. "+subtotal.toLocaleString("en-IN"), 195, y, {align:"right"})
        y += 4

        if(discount>0){
          const dlabel = form.discountType==="percentage"
            ? `Discount (${form.discountValue}%):`
            : "Discount:"
          doc.text(dlabel, 160, y, {align:"right"})
          doc.setTextColor(200,0,0)
          doc.text("- Rs. "+discount.toLocaleString("en-IN"), 195, y, {align:"right"})
          doc.setTextColor(0,0,0)
          y += 4
        }

        if(form.includeGst){
          doc.text(`SGST (${form.gstRate/2}%):`, 160, y, {align:"right"})
          doc.text("Rs. "+sgst.toLocaleString("en-IN"), 195, y, {align:"right"})
          y += 4
          doc.text(`CGST (${form.gstRate/2}%):`, 160, y, {align:"right"})
          doc.text("Rs. "+cgst.toLocaleString("en-IN"), 195, y, {align:"right"})
          y += 3
        }

        doc.setDrawColor(0,0,0); doc.setLineWidth(0.3)
        doc.line(140, y, 195, y)
        y += 4

        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(0,0,0)
        doc.text("Total:", 160, y, {align:"right"})
        doc.text("Rs. "+grandTotal.toLocaleString("en-IN"), 195, y, {align:"right"})
        y += 2

        // Amount in words — UPPERCASE as original
        doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(0,0,0)
        doc.text(("RUPEES "+toWords(Math.round(grandTotal))+" ONLY").toUpperCase(), margin, y)
        y += 20

        // ── Payment Details ────────────────────────────────────────────────
        if(hasBankDetails){
          y += 4
          doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0)
          doc.text("Payment Details:", margin, y); y += 5
          doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40)
          if(form.businessInfo.bank_name){doc.text("Bank: "+form.businessInfo.bank_name,margin,y);y+=4}
          if(form.businessInfo.account_no){doc.text("Account No: "+form.businessInfo.account_no,margin,y);y+=4}
          if(form.businessInfo.ifsc_code){doc.text("IFSC: "+form.businessInfo.ifsc_code,margin,y);y+=4}
          if(form.businessInfo.upi_id){doc.text("UPI: "+form.businessInfo.upi_id,margin,y);y+=4}
        }

        // ── Terms & Conditions ─────────────────────────────────────────────
        if(form.notes){
          y += 3
          doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0)
          doc.text("Terms & Conditions:", margin, y); y += 4
          doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80)
          const noteLines = doc.splitTextToSize(form.notes, pageW-2*margin) as string[]
          doc.text(noteLines, margin, y); y += noteLines.length*4
        }

        // ── Closing ───────────────────────────────────────────────────────
        y += 10
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(0,0,0)
        doc.text("Thanking you,", 195, y, {align:"right"})
        doc.text("Yours faithfully,", 195, y+6, {align:"right"})
        doc.setFont("helvetica","bold")
        doc.text("For "+(form.businessInfo.company_name||""), 195, y+12, {align:"right"})

        // ── Footer ────────────────────────────────────────────────────────
        const footerY = y + 28
        doc.setFontSize(8); doc.setTextColor(150,150,150); doc.setFont("helvetica","normal")
        doc.text("Generated by Remindi · remindi.online", pageW/2, footerY, {align:"center"})

        return footerY + 8
      }

      // Measure on scratch, render on final doc sized to content
      const scratch = new jsPDF({orientation:"portrait",unit:"mm",format:[pageW,2000]})
      const measuredH = renderQuotation(scratch)
      const finalH = Math.max(measuredH, 100)
      const doc = new jsPDF({orientation:"portrait",unit:"mm",format:[pageW,finalH]})
      renderQuotation(doc)

      const safeName = (form.clientName||"Client").replace(/\s+/g,"_")
      doc.save(`Quotation-${form.quoteNumber}-${safeName}.pdf`)

      toast.success("Quotation downloaded!", {
        description:"Want to manage all your quotations automatically? Try Remindi free.",
        action:{label:"Try Remindi →", onClick:()=>window.open("https://remindi.online/signup","_blank")}
      })
    } catch(err){
      console.error(err)
      toast.error("PDF generation failed. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // Lead submit
  const handleLeadSubmit = async () => {
    if(!lead.fullName||!lead.phone||!lead.companyName||!lead.serviceType){
      toast.error("Please fill all required fields."); return
    }
    setSubmitting(true)
    try {
      await supabase.from("demo_bookings").insert({
        full_name:lead.fullName, phone:lead.phone,
        company_name:lead.companyName, service_type:lead.serviceType,
        source:"free-quotation-generator",
        created_at:new Date().toISOString(),
      })
    } catch { /* never block */ }
    finally {
      setSubmitting(false)
      setShowLead(false)
      await generatePdf()
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="lg:hidden mb-4">
        <Button variant="outline" className="w-full" onClick={()=>setShowPreview(!showPreview)}>
          {showPreview ? "Hide Preview" : "Show Live Preview"}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── LEFT: Form ────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4">

          {/* Business Info */}
          <div className="border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm">Your Business Info</h3>

            {/* Logo upload */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Company Logo (optional)</Label>
              <div className="mt-1.5">
                {form.businessInfo.logoBase64 ? (
                  <div className="flex items-center gap-3">
                    <img src={form.businessInfo.logoBase64} alt="logo"
                      className="h-14 w-auto object-contain border border-border rounded-lg p-1 bg-white" />
                    <Button variant="outline" size="sm" className="text-red-500 text-xs"
                      onClick={()=>updateBiz("logoBase64","")}>Remove</Button>
                  </div>
                ) : (
                  <label htmlFor="logo-upload"
                    className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-blue-400 transition-colors bg-muted/20">
                    <ImageIcon className="size-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Click to upload logo</p>
                      <p className="text-xs text-muted-foreground">PNG or JPG · Max 2 MB · Appears on PDF</p>
                    </div>
                    <input id="logo-upload" type="file" accept="image/png,image/jpeg"
                      className="hidden" onChange={handleLogo} />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {id:"co",label:"Company Name *",field:"company_name" as const,placeholder:"ABC Elevators Pvt Ltd"},
                {id:"ph",label:"Phone",field:"phone" as const,placeholder:"+91 98765 43210"},
                {id:"em",label:"Email",field:"email" as const,placeholder:"info@abcelevators.com"},
                {id:"ct",label:"City",field:"city" as const,placeholder:"Pune"},
                {id:"gs",label:"GSTIN (optional)",field:"gstin" as const,placeholder:"27AABCU9603R1ZX"},
              ]).map(f=>(
                <div key={f.id}>
                  <Label htmlFor={f.id} className="text-xs font-semibold text-muted-foreground">{f.label}</Label>
                  <Input id={f.id} className="mt-1" value={form.businessInfo[f.field]}
                    onChange={e=>updateBiz(f.field,e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Your info is saved on this device for next time.</p>
          </div>

          {/* Bank Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Payment / Bank Details <span className="text-xs font-normal text-muted-foreground">(optional — shown on PDF)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {id:"bn",label:"Bank Name",field:"bank_name" as const,placeholder:"State Bank of India"},
                {id:"ac",label:"Account No",field:"account_no" as const,placeholder:"1234567890"},
                {id:"if",label:"IFSC Code",field:"ifsc_code" as const,placeholder:"SBIN0001234"},
                {id:"up",label:"UPI ID",field:"upi_id" as const,placeholder:"yourname@upi"},
              ]).map(f=>(
                <div key={f.id}>
                  <Label htmlFor={f.id} className="text-xs font-semibold text-muted-foreground">{f.label}</Label>
                  <Input id={f.id} className="mt-1" value={form.businessInfo[f.field]}
                    onChange={e=>updateBiz(f.field,e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
          </div>

          {/* Quotation Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Quotation Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quote Number</Label>
                <Input className="mt-1" value={form.quoteNumber} onChange={e=>updateField("quoteNumber",e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Quote Date</Label>
                <Input className="mt-1" type="date" value={form.quoteDate} onChange={e=>updateField("quoteDate",e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Valid Till</Label>
                <Input className="mt-1" type="date" value={form.validTill} onChange={e=>updateField("validTill",e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
              <Input className="mt-1" value={form.subject} onChange={e=>updateField("subject",e.target.value)}
                placeholder="e.g. AMC for Elevator at ABC Towers" />
            </div>
          </div>

          {/* Client Details */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Client Details</h3>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client Name *</Label>
              <Input className="mt-1" value={form.clientName} onChange={e=>updateField("clientName",e.target.value)} placeholder="XYZ Builders Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client Address</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.clientAddress}
                onChange={e=>updateField("clientAddress",e.target.value)} placeholder="123, Industrial Area, Phase 2" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">City</Label>
                <Input className="mt-1" value={form.clientCity} onChange={e=>updateField("clientCity",e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">State</Label>
                <Input className="mt-1" value={form.clientState} onChange={e=>updateField("clientState",e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">PIN</Label>
                <Input className="mt-1" value={form.clientPinCode} onChange={e=>updateField("clientPinCode",e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Client GSTIN (optional)</Label>
              <Input className="mt-1" value={form.clientGstin} onChange={e=>updateField("clientGstin",e.target.value)} />
            </div>
          </div>

          {/* Line Items — matching screen: # | Description | Qty | Rate | Amount */}
          <div className="border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground w-10">#</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground w-20">Qty</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground w-32">Rate (₹)</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground w-32">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {form.items.map((item,idx)=>(
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="text-center py-2.5 px-3 text-xs text-muted-foreground">{idx+1}</td>
                      <td className="py-2 px-3">
                        <Input value={item.description}
                          onChange={e=>updateItem(item.id,"description",e.target.value)}
                          placeholder="e.g. Elevator AMC" className="h-8 text-sm" />
                      </td>
                      <td className="py-2 px-3">
                        <Input type="number" min="1" value={item.qty}
                          onChange={e=>updateItem(item.id,"qty",Number(e.target.value)||1)}
                          className="h-8 text-sm text-center" />
                      </td>
                      <td className="py-2 px-3">
                        <Input type="number" min="0" value={item.rate}
                          onChange={e=>updateItem(item.id,"rate",Number(e.target.value)||0)}
                          className="h-8 text-sm text-right" />
                      </td>
                      <td className="text-right py-2.5 px-3 text-sm font-semibold">
                        ₹{Number(item.qty*item.rate).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={()=>deleteItem(item.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors text-lg leading-none">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>+ Add Item</Button>
          </div>

          {/* Discount */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Discount</h3>
              <Switch checked={form.includeDiscount} onCheckedChange={v=>updateField("includeDiscount",v)} />
            </div>
            {form.includeDiscount&&(
              <div className="space-y-3">
                <div className="flex gap-4">
                  {(["percentage","flat"] as const).map(t=>(
                    <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={form.discountType===t}
                        onChange={()=>updateField("discountType",t)} className="accent-blue-600" />
                      {t==="percentage"?"Percentage (%)":"Flat Amount (₹)"}
                    </label>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {form.discountType==="percentage"?"Discount %":"Discount Amount (₹)"}
                  </Label>
                  <Input type="number" min="0" className="mt-1"
                    value={form.discountValue} onChange={e=>updateField("discountValue",Number(e.target.value)||0)} />
                </div>
                {discount>0&&<p className="text-sm text-red-500 font-medium">
                  Discount: −₹{Number(discount).toLocaleString("en-IN")}
                </p>}
              </div>
            )}
          </div>

          {/* GST */}
          <div className="border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">GST</h3>
              <Switch checked={form.includeGst} onCheckedChange={v=>updateField("includeGst",v)} />
            </div>
            {form.includeGst&&(
              <div className="space-y-2">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">GST Rate</Label>
                  <Select value={String(form.gstRate)} onValueChange={v=>updateField("gstRate",Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5,12,18,28].map(r=><SelectItem key={r} value={String(r)}>{r}% GST</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>SGST ({form.gstRate/2}%): ₹{Number(sgst).toLocaleString("en-IN")}</span>
                  <span>CGST ({form.gstRate/2}%): ₹{Number(cgst).toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Totals box */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{Number(subtotal).toLocaleString("en-IN")}</span>
            </div>
            {discount>0&&<div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Discount{form.discountType==="percentage"?` (${form.discountValue}%)`:""}
              </span>
              <span className="text-red-500">−₹{Number(discount).toLocaleString("en-IN")}</span>
            </div>}
            {form.includeGst&&<>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SGST ({form.gstRate/2}%)</span>
                <span>₹{Number(sgst).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CGST ({form.gstRate/2}%)</span>
                <span>₹{Number(cgst).toLocaleString("en-IN")}</span>
              </div>
            </>}
            <div className="border-t border-border pt-2.5 flex justify-between items-baseline gap-2">
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
            <Textarea className="mt-1.5 resize-none min-h-[72px] text-sm"
              placeholder="Payment terms, special conditions..."
              value={form.notes} onChange={e=>updateField("notes",e.target.value)} />
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
            onClick={()=>setShowLead(true)} disabled={generating}>
            <Download className="mr-2 size-5"/>
            Download Quotation PDF — Free
          </Button>
        </div>

        {/* ── RIGHT: Live Preview — matches original quotation screen exactly ── */}
        <div className={`w-full lg:w-[500px] lg:sticky lg:top-20 lg:self-start ${showPreview?"block":"hidden lg:block"}`}>
          <p className="text-xs text-muted-foreground text-center mb-2">Live Preview</p>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

            {/* Blue accent line — exactly as original */}
            <div className="h-1 bg-blue-600" />

            {/* FROM / TO — two column grid with divide-x, matches original exactly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">

              {/* FROM */}
              <div className="flex gap-3 p-5">
                {form.businessInfo.logoBase64&&(
                  <img src={form.businessInfo.logoBase64} alt="Logo"
                    className="h-11 w-11 object-contain rounded shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">FROM</p>
                  <p className="font-semibold text-sm leading-snug">
                    {form.businessInfo.company_name||<span className="text-muted-foreground">Company Name</span>}
                  </p>
                  {form.businessInfo.phone&&<p className="text-xs text-muted-foreground">{form.businessInfo.phone}</p>}
                  {form.businessInfo.email&&<p className="text-xs text-muted-foreground">{form.businessInfo.email}</p>}
                  {form.businessInfo.city&&<p className="text-xs text-muted-foreground">{form.businessInfo.city}</p>}
                  {form.businessInfo.gstin&&<p className="text-xs text-muted-foreground">GSTIN: {form.businessInfo.gstin}</p>}
                </div>
              </div>

              {/* TO */}
              <div className="p-5 space-y-0.5">
                <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">TO</p>
                <p className="font-semibold text-sm leading-snug">
                  {form.clientName||<span className="text-muted-foreground">Client Name</span>}
                </p>
                {form.clientAddress&&<p className="text-xs text-muted-foreground">{form.clientAddress}</p>}
                {(form.clientCity||form.clientState||form.clientPinCode)&&(
                  <p className="text-xs text-muted-foreground">
                    {[form.clientCity,form.clientState,form.clientPinCode].filter(Boolean).join(", ")}
                  </p>
                )}
                {form.clientGstin&&<p className="text-xs text-muted-foreground">GSTIN: {form.clientGstin}</p>}
              </div>
            </div>

            {/* Meta strip — bg-muted/30, matches original exactly */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-3 bg-muted/30 border-b border-border">
              <div>
                <p className="text-[10px] text-muted-foreground">Quote No</p>
                <p className="text-sm font-semibold">{form.quoteNumber||"QT-001"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Date</p>
                <p className="text-sm font-semibold">{formatDate(form.quoteDate)}</p>
              </div>
              {form.validTill&&(
                <div>
                  <p className="text-[10px] text-muted-foreground">Valid Till</p>
                  <p className="text-sm font-semibold text-amber-600">{formatDate(form.validTill)}</p>
                </div>
              )}
            </div>

            {/* Subject — matches original "Sub:" style */}
            {form.subject&&(
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-semibold">Sub: {form.subject}</p>
              </div>
            )}

            {/* Items table — #, Description, Qty, Rate, Amount (no Unit) matching original */}
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
                  {form.items.map((item,i)=>(
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="text-center py-3 px-4 text-xs text-muted-foreground">{i+1}</td>
                      <td className="py-3 px-4 font-medium text-sm">{item.description||"-"}</td>
                      <td className="text-center py-3 px-4 text-sm text-muted-foreground">{item.qty}</td>
                      <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                        ₹{Number(item.rate).toLocaleString("en-IN")}
                      </td>
                      <td className="text-right py-3 px-4 text-sm font-semibold">
                        ₹{Number(item.qty*item.rate).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals + Notes — matches original layout exactly */}
            <div className="border-t border-border">
              <div className="flex flex-col sm:flex-row">
                {form.notes?(
                  <div className="flex-1 p-5 border-b sm:border-b-0 sm:border-r border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Terms & Conditions</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{form.notes}</p>
                  </div>
                ):<div className="flex-1"/>}

                <div className="p-5 sm:w-64 shrink-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>₹{subtotal.toLocaleString("en-IN")}</span>
                    </div>
                    {discount>0&&<div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount{form.discountType==="percentage"?` (${form.discountValue}%)`:""}
                      </span>
                      <span className="text-red-500">−₹{discount.toLocaleString("en-IN")}</span>
                    </div>}
                    {form.includeGst&&<>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SGST ({form.gstRate/2}%)</span>
                        <span>₹{sgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CGST ({form.gstRate/2}%)</span>
                        <span>₹{cgst.toLocaleString("en-IN")}</span>
                      </div>
                    </>}
                    <div className="border-t border-border pt-2.5 flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm">Total</span>
                      <span className="font-bold text-xl text-blue-600">₹{grandTotal.toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Rupees {toWords(Math.round(grandTotal))} Only
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank details strip — matches original bg-muted/30 strip */}
              {hasBankDetails&&(
                <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 bg-muted/30 border-t border-border">
                  {form.businessInfo.bank_name&&(
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Bank:</span> {form.businessInfo.bank_name}
                    </span>
                  )}
                  {form.businessInfo.account_no&&(
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">A/C:</span> {form.businessInfo.account_no}
                    </span>
                  )}
                  {form.businessInfo.ifsc_code&&(
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">IFSC:</span> {form.businessInfo.ifsc_code}
                    </span>
                  )}
                  {form.businessInfo.upi_id&&(
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">UPI:</span> {form.businessInfo.upi_id}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Modal */}
      <Dialog open={showLead} onOpenChange={setShowLead}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>One last step</DialogTitle>
            <DialogDescription>Enter your details to download. We will not spam you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {([
              {label:"Full Name *",key:"fullName" as const,placeholder:"Rahul Sharma"},
              {label:"Phone Number *",key:"phone" as const,placeholder:"+91 98765 43210"},
              {label:"Company Name *",key:"companyName" as const,placeholder:"ABC Elevators Pvt Ltd"},
            ]).map(f=>(
              <div key={f.key}>
                <Label className="text-xs font-semibold text-muted-foreground">{f.label}</Label>
                <Input className="mt-1" value={lead[f.key]}
                  onChange={e=>setLead(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} />
              </div>
            ))}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Service Type *</Label>
              <Select value={lead.serviceType} onValueChange={v=>setLead(p=>({...p,serviceType:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select your service" /></SelectTrigger>
                <SelectContent>
                  {["Elevator / Lift","HVAC / AC","Fire Safety","Plumbing","Electrical","CCTV / Security","Pest Control","Other"]
                    .map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=>setShowLead(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleLeadSubmit} disabled={submitting||generating}>
              {submitting||generating?"Generating...":"Download My Free Quotation PDF"}
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
            {icon:<FileText className="size-8 text-blue-600 mb-3"/>,title:"Professional Quotations in Minutes",desc:"Fill the form, preview live, download as PDF. No design skills needed."},
            {icon:<CheckCircle2 className="size-8 text-blue-600 mb-3"/>,title:"GST-Ready for Indian Contractors",desc:"Auto-calculates SGST, CGST, and totals. Supports all GST rates."},
            {icon:<Stamp className="size-8 text-blue-600 mb-3"/>,title:"Full AMC Management on Remindi",desc:"Track contracts, technicians, send reminders, manage invoices — all in one place."},
          ].map(c=>(
            <Card key={c.title} className="border border-border p-5">
              {c.icon}
              <h3 className="font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </Card>
          ))}
        </div>

        <div className="text-center mb-14 rounded-xl border border-border bg-muted/30 p-8">
          <h3 className="text-xl font-semibold mb-3">Ready to manage all your AMC contracts automatically?</h3>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={()=>window.open("https://remindi.online/signup","_blank")}>
            Start Free on Remindi →
          </Button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            {q:"Is this free?",a:"Yes. 100% free. No signup or credit card needed."},
            {q:"Can I add GST?",a:"Yes. Toggle GST on, pick your rate, and SGST + CGST are auto-calculated."},
            {q:"Can I add my logo?",a:"Yes. Upload your company logo in the Business Info section. It appears on both the preview and the downloaded PDF."},
            {q:"Can I add bank details?",a:"Yes. Add your bank name, account number, IFSC, and UPI ID. They appear in the PDF so clients can pay you directly."},
            {q:"Is my data saved?",a:"Your business info is saved on your device only. We do not store your quotation data."},
            {q:"What is Remindi?",a:"Remindi is an AMC management platform for Indian contractors. Manage service contracts, technicians, reminders, and invoices — free to try."},
            {q:"Can I create invoices too?",a:"Yes. Visit remindi.online/free-invoice-generator for our free invoice generator."},
          ].map((faq,i)=>(
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
