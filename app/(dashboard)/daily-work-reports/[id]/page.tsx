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
import { Badge } from "@/components/ui/badge"
import { supabase, type CompanyProfile, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { toast } from "sonner"

const safeStr = (val: unknown) => String(val ?? "-")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
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

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        doc.text(`DATE: ${formattedDate}   WORK ORDER: ${safeStr(report.work_order_no || "-")}`, pageW - margin, y + 5, { align: "right" })

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
                data.cell.styles.textColor = [22, 163, 74]; // Green
                data.cell.styles.fontStyle = 'bold';
              } else if (val === 'Pending') {
                data.cell.styles.textColor = [234, 88, 12]; // Orange
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
        doc.setFillColor(240, 248, 255) // Light blue aliceblue
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
        
        // Technician line
        doc.line(margin, y, margin + 65, y)
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        doc.text("Technician / Engineer Signature", margin, y - 2)

        // Customer line
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

      // Two-pass measurement so we get a single tall page
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

  if (loading)
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    )
  if (!report) return null

  const row = (label: string, value: unknown) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span>{String(value || "-")}</span>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/daily-work-reports">
              <Button variant="outline" size="icon" aria-label="Back">
                <ArrowLeft />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{report.report_no}</h1>
              <p className="text-muted-foreground">Daily Work Completion Report</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/daily-work-reports/${report.id}/edit`}>
                <Edit data-icon="inline-start" />
                Edit
              </Link>
            </Button>
            <Button onClick={downloadPdf} disabled={pdf}>
              <Download data-icon="inline-start" />
              {pdf ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 bg-background p-1">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {profile?.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt="Company logo"
                      className="mb-2 max-h-14 max-w-40 object-contain"
                    />
                  )}
                  <CardTitle>{profile?.company_name || "Company"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {[
                      profile?.tagline,
                      profile?.address,
                      profile?.city,
                      profile?.state,
                      profile?.zip_code,
                      profile?.phone,
                      profile?.email,
                      profile?.gstin,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge variant="secondary">{report.status || "Draft"}</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report Header</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {row("Report No", report.report_no)}
              {row("Date", new Date(report.report_date).toLocaleDateString("en-IN"))}
              {row("Work Order No", report.work_order_no)}
              {row("Lift No", report.lift_no)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technician & Site</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {row("Technician", report.technician_name)}
              {row("Contact No", report.contact_no)}
              {row("Customer", report.customer_name)}
              {row("Site", report.site_name)}
              <div className="sm:col-span-2">{row("Site Address", report.site_address)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Sr. No</th>
                      <th className="p-2">Description of Work</th>
                      <th className="p-2">Material Used</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.work_items?.map((item) => (
                      <tr className="border-b" key={item.sr_no}>
                        <td className="p-2">{item.sr_no}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="p-2">{item.material_used || "-"}</td>
                        <td className="p-2">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inspection / Testing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {row("Operational Test", report.operational_test_status)}
              {row("Safety Observations", report.safety_observations)}
              {row("Pending Recommendations", report.pending_recommendations)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acknowledgement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {row("Technician Signature", report.tech_sign_name)}
              {row("Technician Date", report.tech_sign_datetime)}
              {row("Customer Signature", report.customer_sign_name)}
              {row("Customer Date", report.customer_sign_datetime)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Office Use</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {row("Office Status", report.office_status)}
              {row("Checked By", report.checked_by)}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
