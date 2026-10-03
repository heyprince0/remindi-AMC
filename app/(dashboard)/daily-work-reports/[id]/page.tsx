"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { ArrowLeft, Download, Edit, Loader2 } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase, type CompanyProfile, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"
import { toast } from "sonner"

const safeStr = (val: unknown) => String(val ?? "-")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export default function DailyWorkReportDetailPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [report, setReport] = useState<DailyWorkReport | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdf, setPdf] = useState(false)

  // ── Plan / subscription state ──
  const { status, planName, isLoading: limitsLoading } = usePlanLimits(orgId)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setOrgId(data?.org_id || null))
    }
  }, [user?.id])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase
        .from("daily_work_reports")
        .select("*")
        .eq("id", params.id)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .single(),
      supabase.from("company_profile").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([r, p]) => {
      if (r.error || !r.data) {
        toast.error("Failed to load report")
        router.push("/daily-work-reports")
      } else {
        setReport(r.data as DailyWorkReport)
        setProfile(p.data as CompanyProfile | null)
      }
      setLoading(false)
    })
  }, [orgId, params.id, router])

  // ── Subscription check ──
  const checkAndShowLimitModal = () => {
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({
        title: `Your ${planName || 'current'} plan has expired`,
        description: `Renew your ${planName || 'current'} plan to continue editing daily work reports.`,
      })
      setShowLimitModal(true)
      return true
    }
    return false
  }

  const handleUpgrade = () => {
    window.location.href = '/billing'
  }

  // ⭐ Edit click with subscription check
  const handleEditClick = () => {
    if (!report) return
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) return
    router.push(`/daily-work-reports/${report.id}/edit`)
  }

  const downloadPdf = async () => {
    if (!report) return
    setPdf(true)
    try {
      const pageW = 210
      const margin = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)
      const headerStyle = profile?.header_style ?? "single_logo"

      // ── Load logo via fetch (CORS-safe, same as quotation) ──
      let logoBase64: string | null = null
      let logoFormat: "JPEG" | "PNG" = "PNG"
      if (headerStyle !== "thumbnail" && profile?.logo_url) {
        try {
          const response = await fetch(profile.logo_url)
          const blob = await response.blob()
          logoFormat =
            blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        } catch (e) {
          console.warn("[DWR PDF] Logo load failed:", e)
        }
      }

      // ── Load banner (thumbnail header style) ──
      let bannerBase64: string | null = null
      let bannerFormat: "JPEG" | "PNG" = "PNG"
      let bannerH = 0
      if (headerStyle === "thumbnail" && profile?.header_thumbnail_url) {
        try {
          const response = await fetch(profile.header_thumbnail_url)
          const blob = await response.blob()
          bannerFormat =
            blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
          bannerBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          const natural = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = reject
            img.src = bannerBase64 as string
          })
          const bannerW = pageW - margin * 2
          bannerH = Math.round(bannerW / (natural.w / natural.h))
          if (bannerH > 60) bannerH = 60
        } catch (e) {
          console.warn("[DWR PDF] Banner load failed:", e)
        }
      }

      const formattedDate = report.report_date
        ? new Date(report.report_date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })

      const renderReport = (doc: jsPDF): number => {
        let y = margin

        // ── HEADER (KEPT EXACTLY AS IS) ──
        if (headerStyle === "thumbnail" && bannerBase64) {
          const bannerW = pageW - margin * 2
          doc.addImage(bannerBase64, bannerFormat, margin, y, bannerW, bannerH)
          y += bannerH + 6
        } else if (headerStyle === "single_logo") {
          y = renderSingleLogoHeader(
            doc,
            profile,
            y,
            logoBase64,
            pageW,
            margin,
            [tr, tg, tb]
          )
        } else {
          // Fallback default header
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
          const loc = [profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")
          if (loc) { doc.text(loc, infoX, infoY); infoY += 4 }
          if (profile?.phone) { doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, infoY); infoY += 4 }
          if (profile?.email) { doc.text(`Email: ${safeStr(profile.email)}`, infoX, infoY); infoY += 4 }
          if (profile?.gstin) { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, infoX, infoY) }
          y += 31
          doc.setDrawColor(tr, tg, tb)
          doc.setLineWidth(0.5)
          doc.line(margin, y, pageW - margin, y)
          y += 6
        }

        // ── TITLE SECTION ──
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(120, 120, 120)
        doc.text("REPORT NO.", margin, y)

        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text(safeStr(report.report_no), margin, y + 5)

        doc.setFontSize(16)
        doc.setTextColor(tr, tg, tb)
        doc.text("DAILY WORK COMPLETION REPORT", pageW - margin, y, { align: "right" })

        // ── DATE / WORK ORDER LINE — now solid black & bold ──
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(
          `DATE: ${formattedDate}   WORK ORDER: ${safeStr(report.work_order_no || "-")}`,
          pageW - margin,
          y + 5,
          { align: "right" }
        )

        y += 12
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.line(margin, y, pageW - margin, y)
        y += 8

        // ── DETAILS SECTION ──
        const detailLabel = (text: string, x: number, yPos: number) => {
          doc.setFontSize(8)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(120, 120, 120)
          doc.text(text, x, yPos)
        }
        const detailValue = (text: string, x: number, yPos: number, bold = true) => {
          doc.setFontSize(10)
          doc.setFont("helvetica", bold ? "bold" : "normal")
          doc.setTextColor(0, 0, 0)
          doc.text(text, x, yPos)
        }

        // Left column
        detailLabel("TECHNICIAN / ENGINEER", margin, y)
        detailValue(safeStr(report.technician_name), margin, y + 4)

        detailLabel("CUSTOMER / SITE", margin, y + 10)
        detailValue(`${safeStr(report.customer_name)} – ${safeStr(report.site_name)}`, margin, y + 14)

        detailLabel("SITE ADDRESS", margin, y + 20)
        detailValue(safeStr(report.site_address), margin, y + 24, false)

        // Right column
        const col2X = pageW / 2 + 10
        detailLabel("CONTACT NO.", col2X, y)
        detailValue(safeStr(report.contact_no), col2X, y + 4)

        detailLabel("LIFT NO. / EQUIPMENT ID", col2X, y + 10)
        detailValue(safeStr(report.lift_no), col2X, y + 14)

        y += 32
        doc.setDrawColor(220, 220, 220)
        doc.line(margin, y, pageW - margin, y)
        y += 6

        // ── WORK ITEMS TABLE ──
        const workItems = report.work_items ?? []
        autoTable(doc, {
          startY: y,
          head: [["SR.", "Description of Work / Service", "Material Used", "Status"]],
          body: workItems.map((item) => [
            String(item.sr_no ?? ""),
            safeStr(item.description),
            safeStr(item.material_used),
            safeStr(item.status),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [tr, tg, tb],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
            halign: "left",
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [0, 0, 0],
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 45, textColor: [120, 120, 120] },
            3: { cellWidth: 25, halign: "center" },
          },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 3) {
              const val = data.cell.raw;
              if (val === 'Completed') {
                data.cell.styles.textColor = [22, 163, 74];
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Pending') {
                data.cell.styles.textColor = [234, 88, 12];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 6

        // ── INSPECTION / TESTING BLOCK ──
        const boxY = y
        const boxH = 22
        doc.setFillColor(240, 248, 255)
        doc.rect(margin, boxY, pageW - 2 * margin, boxH, 'F')

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(tr, tg, tb)
        doc.text("INSPECTION / TESTING", margin + 5, boxY + 6)

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(0, 0, 0)

        doc.text(`Operational test: `, margin + 5, boxY + 12)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.operational_test_status), margin + 32, boxY + 12)

        doc.setFont("helvetica", "normal")
        doc.text(`Safety observations: `, pageW / 2, boxY + 12)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.safety_observations), pageW / 2 + 35, boxY + 12)

        doc.setFont("helvetica", "normal")
        doc.text(`Pending recommendations: `, margin + 5, boxY + 18)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.pending_recommendations), margin + 45, boxY + 18)

        y = boxY + boxH + 10

        // ── SIGNATURE SECTION ──
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.3)

        doc.line(margin, y, margin + 65, y)
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        doc.text("Technician / Engineer Signature", margin, y - 2)

        doc.line(pageW - margin - 65, y, pageW - margin, y)
        doc.text("Customer / Site Representative Signature", pageW - margin, y - 2, { align: "right" })

        y += 8
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(`Name: ${safeStr(report.tech_sign_name)}`, margin, y)
        doc.text(`Name: ${safeStr(report.customer_sign_name)}`, pageW - margin, y, { align: "right" })

        y += 5
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text(safeStr(report.tech_sign_datetime), margin, y)
        doc.text(safeStr(report.customer_sign_datetime), pageW - margin, y, { align: "right" })

        y += 12

        // ── OFFICE USE SECTION ──
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.3)
        doc.rect(margin, y, pageW - 2 * margin, 12)

        doc.setFontSize(8)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(150, 150, 150)
        doc.text("For office use only", margin + 4, y + 7)

        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text(`Status: ${safeStr(report.office_status || "Approved")}  |  Checked By: ${safeStr(report.checked_by || "Admin")}`, pageW - margin - 4, y + 7, { align: "right" })

        y += 16

        // ── FOOTER ──
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(180, 180, 180)
        doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })

        return y + 6
      }

      const scratchDoc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, 2000],
      })
      const measuredHeight = renderReport(scratchDoc)
      const finalPageHeight = Math.max(measuredHeight, 100)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, finalPageHeight],
      })
      renderReport(doc)

      doc.save(`DWR-${safeStr(report.report_no)}.pdf`)
      toast.success("PDF downloaded")
    } catch (err) {
      console.error("[DWR PDF] error:", err)
      toast.error(
        "Failed to generate PDF: " + (err instanceof Error ? err.message : "Unknown error")
      )
    } finally {
      setPdf(false)
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

  if (!report) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Report not found</p>
          <Link href="/daily-work-reports">
            <Button>Back to Reports</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const workItems = report.work_items ?? []

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Header — same style as quotation detail */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/daily-work-reports">
              <Button variant="outline" size="icon" className="shrink-0 mt-1">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{report.report_no}</h1>
              {report.work_order_no && (
                <p className="text-sm text-muted-foreground">
                  Work Order:{" "}
                  <span className="font-medium text-foreground">{report.work_order_no}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDateLong(report.report_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              onClick={downloadPdf}
              disabled={pdf}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              {pdf ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-4" />
              )}
              Download PDF
            </Button>
            {/* ⭐ Edit now checks subscription before navigating */}
            <Button variant="outline" size="sm" onClick={handleEditClick}>
              <Edit className="mr-1.5 size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Company Information */}
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

        {/* Report Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Report No</p>
              <p className="font-medium">{report.report_no ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Date</p>
              <p className="font-medium">{formatDateLong(report.report_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Work Order No</p>
              <p className="font-medium">{report.work_order_no ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Lift No</p>
              <p className="font-medium">{report.lift_no ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Technician & Site */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technician & Site</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Technician</p>
              <p className="font-medium">{report.technician_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Contact No</p>
              <p className="font-medium">{report.contact_no ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Customer</p>
              <p className="font-medium">{report.customer_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Site</p>
              <p className="font-medium">{report.site_name ?? "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Site Address</p>
              <p className="font-medium">{report.site_address ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Work Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-12">SR</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description of Work</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-40">Material Used</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">No work items</td>
                    </tr>
                  ) : (
                    workItems.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="text-center py-3 px-4 text-muted-foreground">{item.sr_no}</td>
                        <td className="py-3 px-4">{item.description || "-"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{item.material_used || "—"}</td>
                        <td className="text-center py-3 px-4">
                          <span
                            className={
                              item.status === "Completed"
                                ? "font-semibold text-green-600"
                                : item.status === "Pending"
                                ? "font-semibold text-orange-600"
                                : "text-muted-foreground"
                            }
                          >
                            {item.status || "-"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Inspection / Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspection / Testing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Operational Test</p>
              <p className="font-medium">{report.operational_test_status ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Safety Observations</p>
              <p className="font-medium">{report.safety_observations ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Pending Recommendations</p>
              <p className="font-medium">{report.pending_recommendations ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Acknowledgement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acknowledgement</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Technician Signature</p>
              <p className="font-medium">{report.tech_sign_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Technician Date</p>
              <p className="font-medium">{report.tech_sign_datetime ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Customer Signature</p>
              <p className="font-medium">{report.customer_sign_name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Customer Date</p>
              <p className="font-medium">{report.customer_sign_datetime ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Office Use */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Office Use</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Office Status</p>
              <p className="font-medium">{report.office_status ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Checked By</p>
              <p className="font-medium">{report.checked_by ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ⭐ Unified Limit/Subscription Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        type={limitModalType}
        onUpgrade={handleUpgrade}
        customTitle={limitModalCustom.title}
        customDescription={limitModalCustom.description}
      />
    </DashboardLayout>
  )
}
