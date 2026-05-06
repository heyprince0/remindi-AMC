"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase, type Quotation, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Edit,
  ChevronDown,
  Loader2,
  FileText,
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

function getStatusBadge(status: string) {
  const s = (status ?? "draft").toLowerCase()
  if (s === "draft") return <Badge className="bg-slate-100 text-slate-700 border-0">Draft</Badge>
  if (s === "sent") return <Badge className="bg-blue-100 text-blue-700 border-0">Sent</Badge>
  if (s === "accepted") return <Badge className="bg-green-100 text-green-700 border-0">Accepted</Badge>
  if (s === "rejected") return <Badge className="bg-red-100 text-red-700 border-0">Rejected</Badge>
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

export default function ViewQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
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
      const [{ data: qData, error: qErr }, { data: pData }] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", id).eq("user_id", user!.id).single(),
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

  const handleUpdateStatus = async (newStatus: string) => {
    if (!quotation) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: newStatus })
        .eq("id", quotation.id)
      if (error) throw error
      setQuotation({ ...quotation, status: newStatus as Quotation["status"] })
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update status")
    } finally {
      setUpdating(false)
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

  const getGrandTotal = () => {
    if (!quotation) return 0
    const subtotal = Number(quotation.subtotal ?? 0)
    const sgst = Number(quotation.sgst ?? 0)
    const cgst = Number(quotation.cgst ?? 0)
    return (subtotal + sgst + cgst) > 0 ? (subtotal + sgst + cgst) : subtotal
  }

  const handleWhatsApp = () => {
    if (!quotation) return
    const grandTotal = getGrandTotal()
    const items = quotation.items ?? []
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
      `*Subtotal:* Rs.${safeNum(quotation.subtotal)}\n` +
      `*GST (18%):* Rs.${safeNum(Number(quotation.sgst ?? 0) + Number(quotation.cgst ?? 0))}\n` +
      `*Total:* Rs.${safeNum(grandTotal)}\n` +
      `─────────────────────\n\n` +
      `To confirm reply YES or call ${safeStr(profile?.company_phone)}\n\n` +
      `_Powered by Remindi_`
    window.open("https://wa.me/?text=" + encodeURIComponent(msg))
  }

  const handleDownloadPdf = async () => {
    if (!quotation) return
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
      // Left side: Logo + Company info
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

      // Right side: Phone number
      if (profile?.phone) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(profile.phone), pageW - margin, y + 4, { align: "right" })
      }

      // Header bottom line
      y += 28
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(3)
      doc.line(margin, y, pageW - margin, y)
      y += 6

      // ===== QUOTE NUMBER + DATE ROW =====
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(safeStr(quotation.quote_no ?? ("QT-" + quotation.id)), margin, y)

      const formattedDate = quotation.created_at 
        ? new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      doc.text(`DATE: ${formattedDate}`, pageW - margin, y, { align: "right" })
      y += 8

      // ===== CLIENT BLOCK =====
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0, 0, 0)
      doc.text("TO,", margin, y)
      y += 5
      doc.text("THE OWNER,", margin, y)
      y += 5

      doc.setFont("helvetica", "bold")
      doc.text(safeStr(quotation.client_name).toUpperCase(), margin, y)
      y += 5

      doc.setFont("helvetica", "normal")
      doc.setTextColor(40, 40, 40)
      if (quotation.client_address) {
        doc.text(safeStr(quotation.client_address), margin, y)
        y += 5
      }

      const cityStateZip = [
        quotation.client_district,
        quotation.client_state,
        quotation.client_pin_code
      ].filter(Boolean).join(', ')
      if (cityStateZip) {
        doc.text(cityStateZip, margin, y)
        y += 5
      }
      y += 3

      // ===== SUBJECT LINE =====
      if (quotation.subject) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(tr, tg, tb)
        doc.setFontSize(10)
        doc.text(`Sub: ${safeStr(quotation.subject)}`, margin, y)
        y += 7
      }

      // ===== BODY TEXT =====
      if (quotation.body_text) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(40, 40, 40)
        const bodyLines = doc.splitTextToSize(safeStr(quotation.body_text), pageW - 2 * margin)
        doc.text(bodyLines, margin, y)
        y += (bodyLines.length * 4) + 3
      }
      y += 2

      // ===== ITEMS TABLE =====
      const items = quotation.items ?? []
      const subtotal = items.reduce((sum, item) => {
        return sum + (Number(item.quantity ?? 1) * Number(item.rate ?? item.unit_price ?? 0))
      }, 0)
      const sgst = quotation.include_gst ? Math.round(subtotal * 0.09) : 0
      const cgst = quotation.include_gst ? Math.round(subtotal * 0.09) : 0
      const grandTotal = subtotal + sgst + cgst

      const tableBody = items.map((item, idx) => [
        String(idx + 1),
        safeStr(item.particulars ?? item.description ?? item.name ?? "-"),
        String(item.qty ?? item.quantity ?? 1),
        `Rs. ${Number(item.rate ?? item.unit_price ?? 0).toLocaleString("en-IN")}`,
        `Rs. ${Number(item.amount ?? ((Number(item.qty ?? item.quantity ?? 0)) * (Number(item.rate ?? item.unit_price ?? 0)))).toLocaleString("en-IN")}`,
      ])

      // Add total row
      const amountInWords = toWords(Math.round(grandTotal)).toUpperCase() + " ONLY"
      tableBody.push([
        "",
        `RUPEES ${amountInWords}`,
        "",
        `Total:\nRs. ${subtotal.toLocaleString("en-IN")}/-`,
        `Gr. Total:\nRs. ${grandTotal.toLocaleString("en-IN")}/-`,
      ])

      autoTable(doc, {
        startY: y,
        head: [["SR.NO.", "PARTICULARS", "QTY.", "RATE", "AMOUNT"]],
        body: tableBody,
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontSize: 9,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          lineColor: [153, 153, 153],
          lineWidth: 0.5,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { halign: "left", cellWidth: 80 },
          2: { halign: "center", cellWidth: 16 },
          3: { halign: "right", cellWidth: 25 },
          4: { halign: "right", cellWidth: 35 },
        },
        margin: { left: margin, right: margin },
        didDrawPage: () => { /* prevent default */ },
      })

      y = (doc as any).lastAutoTable.finalY + 6

      // ===== TERMS & CONDITIONS =====
      if (quotation.notes) {
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text("Terms & Conditions:", margin, y)
        y += 5
        doc.setFont("helvetica", "normal")
        doc.setTextColor(80, 80, 80)
        const noteLines = doc.splitTextToSize(safeStr(quotation.notes), pageW - 2 * margin)
        doc.text(noteLines, margin, y)
        y += (noteLines.length * 4) + 3
      }
      y += 4

      // ===== FOOTER =====
      // Left side: Signature block
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(40, 40, 40)
      doc.text("Thanking you,", margin, y)
      y += 5
      doc.text("Yours faithfully,", margin, y)
      y += 5
      doc.setFont("helvetica", "bold")
      doc.text(`For ${safeStr(profile?.company_name)}`, margin, y)

      // Right side: Stamp circle
      const circleX = pageW - margin - 18
      const circleY = y - 6
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(1)
      doc.circle(circleX, circleY, 18)
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(tr, tg, tb)
      doc.text("STAMP", circleX, circleY - 4, { align: "center" })
      doc.text("SIGN", circleX, circleY + 3, { align: "center" })

      // Bottom: Generated by Remindi
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont("helvetica", "normal")
      doc.text("Generated by Remindi · remindi.online", pageW / 2, pageH - 8, { align: "center" })

      const filename = `Quotation-${safeStr(quotation.quote_no ?? quotation.id)}-${safeStr(quotation.client_name ?? "Client")}.pdf`
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
  const grandTotal = getGrandTotal()
  const subtotal = Number(quotation.subtotal ?? 0)
  const gstTotal = Number(quotation.sgst ?? 0) + Number(quotation.cgst ?? 0)
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
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(quotation.created_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {getStatusBadge(quotation.status)}

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

            <Link href={`/quotations/${id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-1.5 size-4" />
                Edit
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={updating}>
                  {updating ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <ChevronDown className="mr-1.5 size-4" />
                  )}
                  Change Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleUpdateStatus("Draft")}>
                  <span className="size-2 rounded-full bg-slate-400 mr-2 inline-block" />
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdateStatus("Sent")}>
                  <span className="size-2 rounded-full bg-blue-500 mr-2 inline-block" />
                  Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdateStatus("Accepted")}>
                  <span className="size-2 rounded-full bg-green-500 mr-2 inline-block" />
                  Accepted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdateStatus("Rejected")}>
                  <span className="size-2 rounded-full bg-red-500 mr-2 inline-block" />
                  Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {statusLower === "accepted" && (
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
                onClick={() => toast.info("Convert to Invoice coming soon")}
              >
                <FileText className="mr-1.5 size-4" />
                Convert to Invoice
              </Button>
            )}
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
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Valid Till</p>
              <p className="font-medium">{quotation.valid_till ? formatDate(quotation.valid_till) : "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Address</p>
              <p className="font-medium">{quotation.client_address ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client District</p>
              <p className="font-medium">{quotation.client_district ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client State</p>
              <p className="font-medium">{quotation.client_state ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Client Pin Code</p>
              <p className="font-medium">{quotation.client_pin_code ?? "-"}</p>
            </div>
            {quotation.subject && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Subject</p>
                <p className="font-medium">{quotation.subject}</p>
              </div>
            )}
            {quotation.body_text && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Body Text</p>
                <p className="font-medium text-sm whitespace-pre-wrap">{quotation.body_text}</p>
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
            <div className="flex flex-col items-end gap-2 max-w-xs ml-auto">
              <div className="flex justify-between w-full text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {gstTotal > 0 && (
                <div className="flex justify-between w-full text-sm">
                  <span className="text-muted-foreground">GST (18%):</span>
                  <span className="font-medium">₹{gstTotal.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 mt-1 flex justify-between w-full">
                <span className="text-base font-bold">Grand Total:</span>
                <span className="text-base font-bold text-blue-600">
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
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
    </DashboardLayout>
  )
}
