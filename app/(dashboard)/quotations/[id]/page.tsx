"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase, type Quotation, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, Download, FileText, MessageCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "bg-slate-100", text: "text-slate-700", label: "Draft" },
    sent: { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    expired: { bg: "bg-orange-100", text: "text-orange-700", label: "Expired" },
  }
  const config = statusConfig[status] || statusConfig.draft
  return <Badge className={`${config.bg} ${config.text} border-0`}>{config.label}</Badge>
}

export default function ViewQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [updating, setUpdating] = useState(false)
  const id = params.id as string

  useEffect(() => {
    loadData()
  }, [id, user?.id])

  const loadData = async () => {
    try {
      if (!user?.id || !id) return

      // Load quotation
      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()

      if (quotationError) throw quotationError
      setQuotation(quotationData as Quotation)

      // Load company profile
      const { data: profileData } = await supabase
        .from("company_profile")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (profileData) {
        setCompanyProfile(profileData as CompanyProfile)
      }
    } catch (error) {
      console.error("Error loading quotation:", error)
      toast.error("Failed to load quotation")
      router.push("/quotations")
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = async () => {
    if (!quotation || !companyProfile) {
      toast.error("Missing quotation or company data")
      return
    }

    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = 210
      const pageH = 297
      const margin = 12
      const themeColor = companyProfile.theme_color || "#3b82f6"

      // Convert hex to RGB
      const hexToRgb = (hex: string): [number, number, number] => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
          ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
          : [59, 130, 246]
      }

      const themeRgb = hexToRgb(themeColor)

      // Header with company info and theme color
      doc.setFillColor(...themeRgb)
      doc.rect(margin, margin, pageW - 2 * margin, 35, "F")

      doc.setFontSize(24)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(255, 255, 255)
      doc.text("QUOTATION", margin + 10, margin + 12)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(200, 200, 200)
      doc.text(quotation.quotation_number, margin + 10, margin + 20)

      // Company details on the right
      doc.setFontSize(8)
      doc.setTextColor(200, 200, 200)
      const rightX = pageW - margin - 50
      if (companyProfile.company_name) {
        doc.text(companyProfile.company_name, rightX, margin + 12)
      }
      if (companyProfile.company_phone) {
        doc.text(companyProfile.company_phone, rightX, margin + 17)
      }
      if (companyProfile.company_email) {
        doc.text(companyProfile.company_email, rightX, margin + 22)
      }

      let yPosition = margin + 40

      // Bill To Section
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...themeRgb)
      doc.text("BILL TO:", margin, yPosition)

      yPosition += 6
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0, 0, 0)
      doc.text(quotation.customer_name, margin, yPosition)
      yPosition += 5

      if (quotation.customer_phone) {
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(`Phone: ${quotation.customer_phone}`, margin, yPosition)
        yPosition += 4
      }

      if (quotation.customer_email) {
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        doc.text(`Email: ${quotation.customer_email}`, margin, yPosition)
        yPosition += 4
      }

      if (quotation.customer_address) {
        doc.setFontSize(8)
        doc.setTextColor(80, 80, 80)
        const lines = doc.splitTextToSize(`Address: ${quotation.customer_address}`, 80)
        doc.text(lines, margin, yPosition)
        yPosition += lines.length * 4 + 3
      }

      yPosition += 3

      // Items Table
      const itemsData = quotation.items.map((item) => [
        item.description,
        item.quantity.toString(),
        `₹${item.unit_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
        `₹${item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [["Description", "Quantity", "Unit Price", "Amount"]],
        body: itemsData,
        headStyles: {
          fillColor: themeRgb,
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 4,
          borderColor: themeRgb,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          borderColor: [200, 200, 200],
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "center", cellWidth: 25 },
          2: { halign: "right", cellWidth: 35 },
          3: { halign: "right", cellWidth: 35 },
        },
        margin: { left: margin, right: margin },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 8

      // Totals Section
      const rightCol = pageW - margin - 50

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      doc.text("Subtotal:", rightCol, yPosition)
      doc.setTextColor(0, 0, 0)
      doc.text(`₹${quotation.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, pageW - margin - 5, yPosition, { align: "right" })

      yPosition += 5

      if (quotation.include_gst) {
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.text(`GST (${quotation.gst_rate}%):`, rightCol, yPosition)
        doc.setTextColor(0, 0, 0)
        doc.text(`₹${quotation.gst_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, pageW - margin - 5, yPosition, { align: "right" })
        yPosition += 5
      }

      // Total with border
      doc.setDrawColor(...themeRgb)
      doc.setLineWidth(0.5)
      doc.line(rightCol - 5, yPosition - 2, pageW - margin - 5, yPosition - 2)

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...themeRgb)
      doc.text("TOTAL:", rightCol, yPosition + 4)
      doc.text(`₹${quotation.total_amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, pageW - margin - 5, yPosition + 4, { align: "right" })

      yPosition += 12

      // Amount in words
      if (quotation.total_amount > 0) {
        doc.setFontSize(8)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(80, 80, 80)
        const amountInWords = numberToWords(quotation.total_amount)
        const lines = doc.splitTextToSize(`Amount in words: ${amountInWords}`, pageW - 2 * margin - 10)
        doc.text(lines, margin, yPosition)
        yPosition += lines.length * 4 + 3
      }

      // Notes
      if (quotation.notes) {
        yPosition += 3
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...themeRgb)
        doc.text("Notes:", margin, yPosition)
        yPosition += 5

        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(80, 80, 80)
        const noteLines = doc.splitTextToSize(quotation.notes, pageW - 2 * margin - 10)
        doc.text(noteLines, margin, yPosition)
      }

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Generated on ${new Date().toLocaleDateString("en-IN")} | Quotation ID: ${quotation.id}`,
        pageW / 2,
        pageH - 8,
        { align: "center" }
      )

      doc.save(`${quotation.quotation_number}.pdf`)
      toast.success("PDF generated successfully")
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  const numberToWords = (num: number): string => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    const convert = (n: number): string => {
      if (n === 0) return ""
      if (n < 10) return ones[n]
      if (n < 20) return teens[n - 10]
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "")
      if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "")
      if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "")
      if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "")
      return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "")
    }

    return convert(Math.floor(num)) + " Rupees"
  }

  const handleUpdateStatus = async (newStatus: Quotation["status"]) => {
    if (!quotation) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status: newStatus })
        .eq("id", quotation.id)

      if (error) throw error
      setQuotation({ ...quotation, status: newStatus })
      toast.success(`Quotation marked as ${newStatus}`)
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  const handleSendWhatsApp = () => {
    if (!quotation || !quotation.customer_phone) {
      toast.error("Customer phone number is required")
      return
    }

    // Format phone number (remove spaces, dashes, etc.)
    let phoneNumber = quotation.customer_phone.replace(/\D/g, "")
    // Ensure it starts with country code
    if (!phoneNumber.startsWith("91")) {
      phoneNumber = "91" + phoneNumber
    }

    // Create message
    const itemsList = quotation.items
      .map((item) => `• ${item.description} x${item.quantity} = ₹${item.amount.toLocaleString("en-IN")}`)
      .join("%0A")

    const message = encodeURIComponent(
      `Hi ${quotation.customer_name},%0A%0AI wanted to share the quotation for your request.%0A%0A*Quotation #${quotation.quotation_number}*%0A%0AItems:%0A${itemsList}%0A%0A*Total: ₹${quotation.total_amount.toLocaleString("en-IN")}*%0A%0APlease reply if you have any questions or would like to proceed.%0A%0AThank you!`
    )

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`
    window.open(whatsappUrl, "_blank")

    // Mark as sent
    if (quotation.status === "draft") {
      handleUpdateStatus("sent")
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading quotation...</p>
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/quotations">
              <Button variant="outline" size="icon">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{quotation.quotation_number}</h1>
              <p className="text-muted-foreground">
                {new Date(quotation.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(quotation.status)}
          </div>
        </div>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg font-medium">{quotation.customer_name}</p>
            </div>
            {quotation.customer_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="text-lg font-medium">{quotation.customer_phone}</p>
              </div>
            )}
            {quotation.customer_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-medium">{quotation.customer_email}</p>
              </div>
            )}
            {quotation.customer_address && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="text-lg font-medium">{quotation.customer_address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold">Description</th>
                    <th className="text-center py-2 px-2 font-semibold w-20">Qty</th>
                    <th className="text-right py-2 px-2 font-semibold w-32">Unit Price</th>
                    <th className="text-right py-2 px-2 font-semibold w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? "bg-secondary/30" : ""}>
                      <td className="py-2 px-2">{item.description}</td>
                      <td className="text-center py-2 px-2">{item.quantity}</td>
                      <td className="text-right py-2 px-2">₹{item.unit_price.toLocaleString("en-IN")}</td>
                      <td className="text-right py-2 px-2 font-medium">₹{item.amount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">₹{quotation.subtotal.toLocaleString("en-IN")}</span>
            </div>
            {quotation.include_gst && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST ({quotation.gst_rate}%):</span>
                <span className="font-medium">₹{quotation.gst_amount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">₹{quotation.total_amount.toLocaleString("en-IN")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {quotation.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={generatePDF} disabled={generatingPdf} variant="outline">
              {generatingPdf ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Download PDF
                </>
              )}
            </Button>
            <Button
              onClick={() => handleSendWhatsApp()}
              disabled={!quotation.customer_phone}
              variant="outline"
            >
              <MessageCircle className="mr-2 size-4" />
              Send via WhatsApp
            </Button>
          </div>

          {quotation.status === "draft" && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleUpdateStatus("sent")}
                disabled={updating}
                className="flex-1"
              >
                {updating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}
                Mark as Sent
              </Button>
              <Button
                onClick={() => handleUpdateStatus("accepted")}
                disabled={updating}
                variant="outline"
                className="flex-1"
              >
                {updating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle className="mr-2 size-4" />}
                Mark as Accepted
              </Button>
              <Button
                onClick={() => handleUpdateStatus("rejected")}
                disabled={updating}
                variant="outline"
                className="flex-1"
              >
                {updating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}
                Mark as Rejected
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
