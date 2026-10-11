"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  ArrowLeft,
  Download,
  Edit,
  Loader2,
  Save,
  Share2,
  Stamp,
  Upload,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase, type CompanyProfile, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
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
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "-"
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function statusColor(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "completed") return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800"
  if (s === "pending") return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800"
  if (s === "in progress") return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
  return "bg-muted text-muted-foreground border-border"
}
// ────────────────────────────────────────────────────────────────────────────

export default function DailyWorkReportDetailPage() {
  const { user } = useAuth()
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [orgId, setOrgId]     = useState<string | null>(null)
  const [report, setReport]   = useState<DailyWorkReport | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdf, setPdf]         = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)

  // ── stamp state ──
  const [includeStamp, setIncludeStamp]         = useState(false)
  const [showStampDialog, setShowStampDialog]   = useState(false)
  const [stampFile, setStampFile]               = useState<File | null>(null)
  const [stampPreview, setStampPreview]         = useState<string | null>(null)
  const [uploadingStamp, setUploadingStamp]     = useState(false)

  // ── plan / subscription ──
  const { status, planName, isLoading: limitsLoading } = usePlanLimits(orgId)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

  useEffect(() => {
    if (user?.id)
      supabase.from("memberships").select("org_id").eq("user_id", user.id).single()
        .then(({ data }) => setOrgId(data?.org_id ?? null))
  }, [user?.id])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase.from("daily_work_reports").select("*").eq("id", params.id).eq("org_id", orgId).is("deleted_at", null).single(),
      supabase.from("company_profile").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([r, p]) => {
      if (r.error || !r.data) {
        toast.error("Failed to load report")
        router.push("/daily-work-reports")
      } else {
        setReport(r.data as DailyWorkReport)
      }
      setProfile(p.data as CompanyProfile | null)
      setLoading(false)
    })
  }, [orgId, params.id, router])

  useEffect(() => {
    const saved = localStorage.getItem(`stamp_toggle_dwr_${params.id}`)
    if (saved === "true") setIncludeStamp(true)
  }, [params.id])

  // ── stamp toggle ──
  const handleStampToggle = () => {
    if (!profile?.stamp_url) { setShowStampDialog(true); return }
    const next = !includeStamp
    setIncludeStamp(next)
    localStorage.setItem(`stamp_toggle_dwr_${params.id}`, String(next))
  }

  const handleUploadStamp = async () => {
    if (!stampFile || !orgId) return
    setUploadingStamp(true)
    try {
      const fileName = `stamp-${orgId}-${Date.now()}.png`
      const { error: upErr } = await supabase.storage
        .from("company-assets").upload(fileName, stampFile, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(fileName)
      const { error: dbErr } = await supabase.from("company_profile")
        .update({ stamp_url: urlData.publicUrl }).eq("org_id", orgId)
      if (dbErr) throw dbErr

      setProfile(prev => prev ? { ...prev, stamp_url: urlData.publicUrl } : null)
      setIncludeStamp(true)
      localStorage.setItem(`stamp_toggle_dwr_${params.id}`, "true")
      toast.success("Stamp uploaded successfully")
      setShowStampDialog(false); setStampFile(null); setStampPreview(null)
    } catch (err) {
      console.error(err); toast.error("Failed to upload stamp")
    } finally {
      setUploadingStamp(false)
    }
  }

  // ── subscription check ──
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

  const handleUpgrade = () => { window.location.href = '/billing' }

  const handleEditClick = () => {
    if (!report) return
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) return
    router.push(`/daily-work-reports/${report.id}/edit`)
  }

  // ── Shared PDF builder ─────────────────────────────────────────────────────
  const buildPdfDoc = async (): Promise<{ doc: jsPDF; filename: string } | null> => {
    if (!report) return null

    try {
      const pageW        = 210
      const margin       = 15
      const themeColor   = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)
      const headerStyle  = profile?.header_style ?? "single_logo"
      const shouldStamp  = includeStamp && !!profile?.stamp_url

      // load logo
      let logoBase64: string | null = null
      let logoFormat: "JPEG" | "PNG" = "PNG"
      if (headerStyle !== "thumbnail" && profile?.logo_url) {
        try {
          const blob = await (await fetch(profile.logo_url)).blob()
          logoFormat = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
          logoBase64 = await new Promise<string>(res => {
            const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(blob)
          })
        } catch (e) { console.warn("[DWR PDF] logo:", e) }
      }

      // load banner
      let bannerBase64: string | null = null
      let bannerFormat: "JPEG" | "PNG" = "PNG"
      let bannerH = 0
      if (headerStyle === "thumbnail" && profile?.header_thumbnail_url) {
        try {
          const blob = await (await fetch(profile.header_thumbnail_url)).blob()
          bannerFormat = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
          bannerBase64 = await new Promise<string>(res => {
            const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(blob)
          })
          const nat = await new Promise<{ w: number; h: number }>((res, rej) => {
            const img = new Image()
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
            img.onerror = rej
            img.src = bannerBase64 as string
          })
          const bW = pageW - margin * 2
          bannerH = Math.min(60, Math.round(bW / (nat.w / nat.h)))
        } catch (e) { console.warn("[DWR PDF] banner:", e) }
      }

      // load stamp
      let stampBase64: string | null = null
      let stampFormat: "JPEG" | "PNG" = "PNG"
      if (shouldStamp && profile?.stamp_url) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch(profile.stamp_url, { cache: "no-store" })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const blob = await res.blob()
            stampBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror   = reject
              reader.readAsDataURL(blob)
            })
            stampFormat = blob.type.includes("jpeg") ? "JPEG" : "PNG"
            break
          } catch (e) {
            console.warn(`[DWR Stamp] attempt ${attempt}:`, e)
            if (attempt === 3) toast.warning("Stamp could not be loaded — skipping")
            else await new Promise(r => setTimeout(r, 400 * attempt))
          }
        }
      }

      const formattedDate = report.report_date
        ? new Date(report.report_date).toLocaleDateString("en-IN", {
            day: "2-digit", month: "2-digit", year: "numeric",
          })
        : new Date().toLocaleDateString("en-IN", {
            day: "2-digit", month: "2-digit", year: "numeric",
          })

      const renderReport = (doc: jsPDF): number => {
        let y = margin

        // ── HEADER ──
        if (headerStyle === "thumbnail" && bannerBase64) {
          doc.addImage(bannerBase64, bannerFormat, margin, y, pageW - margin * 2, bannerH)
          y += bannerH + 6
        } else if (headerStyle === "single_logo") {
          y = renderSingleLogoHeader(doc, profile, y, logoBase64, pageW, margin, [tr, tg, tb])
        } else {
          if (logoBase64) doc.addImage(logoBase64, logoFormat, margin, y, 22, 22)
          const infoX = logoBase64 ? margin + 24 : margin
          doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
          doc.text(safeStr(profile?.company_name), infoX, y + 2)
          doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 120)
          let iy = y + 8
          if (profile?.tagline)  { doc.text(safeStr(profile.tagline), infoX, iy); iy += 4 }
          if (profile?.address)  { doc.text(safeStr(profile.address), infoX, iy); iy += 4 }
          const loc = [profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")
          if (loc)               { doc.text(loc, infoX, iy); iy += 4 }
          if (profile?.phone)    { doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, iy); iy += 4 }
          if (profile?.email)    { doc.text(`Email: ${safeStr(profile.email)}`, infoX, iy); iy += 4 }
          if (profile?.gstin)    { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, infoX, iy) }
          y += 31
          doc.setDrawColor(tr, tg, tb); doc.setLineWidth(0.5)
          doc.line(margin, y, pageW - margin, y)
          y += 6
        }

        // ── TITLE ──
        doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.setTextColor(tr, tg, tb)
        doc.text("WORK REPORT", pageW / 2, y + 2, { align: "center" })
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(`DATE: ${formattedDate}`, pageW - margin, y + 8, { align: "right" })

        // customer (left)
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(120, 120, 120)
        doc.text("CUSTOMER NAME", margin, y + 14)
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(safeStr(report.customer_name), margin, y + 23)
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3)
        doc.line(margin, y + 24, margin + 60, y + 24)

        // work order (right)
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(120, 120, 120)
        doc.text("WORK ORDER NO.", pageW - margin, y + 14, { align: "right" })
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(safeStr(report.work_order_no || "-"), pageW - margin, y + 23, { align: "right" })
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3)
        doc.line(pageW - margin - 50, y + 24, pageW - margin, y + 24)

        y += 38

        // ── EQUIPMENT ──
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(120, 120, 120)
        doc.text("EQUIPMENT", margin, y)
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(safeStr(report.lift_no || "-"), margin, y + 11)
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3)
        doc.line(margin, y + 12, margin + 100, y + 12)
        y += 18

        // ── WORK ITEMS TABLE ──
        const workItems = report.work_items ?? []
        autoTable(doc, {
          startY: y,
          head: [["SR.", "Description of Work / Service", "Material Used", "Status"]],
          body: workItems.map(item => [
            String(item.sr_no ?? ""),
            safeStr(item.description),
            safeStr(item.material_used),
            safeStr(item.status),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [tr, tg, tb],
            textColor: [255, 255, 255],
            fontStyle: "bold", fontSize: 9, halign: "left",
          },
          bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 45, textColor: [120, 120, 120] },
            3: { cellWidth: 25, halign: "center" },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 3) {
              const val = data.cell.raw
              if (val === "Completed") { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = "bold" }
              else if (val === "Pending") { data.cell.styles.textColor = [234, 88, 12]; data.cell.styles.fontStyle = "bold" }
            }
          },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 6

        // ── INSPECTION / TESTING ──
        const boxY = y; const boxH = 22
        doc.setFillColor(240, 248, 255)
        doc.rect(margin, boxY, pageW - 2 * margin, boxH, "F")

        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(tr, tg, tb)
        doc.text("INSPECTION / TESTING", margin + 5, boxY + 6)

        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0)
        doc.text("Operational test: ", margin + 5, boxY + 12)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.operational_test_status), margin + 32, boxY + 12)

        doc.setFont("helvetica", "normal")
        doc.text("Safety observations: ", pageW / 2, boxY + 12)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.safety_observations), pageW / 2 + 35, boxY + 12)

        doc.setFont("helvetica", "normal")
        doc.text("Pending recommendations: ", margin + 5, boxY + 18)
        doc.setFont("helvetica", "bold")
        doc.text(safeStr(report.pending_recommendations), margin + 45, boxY + 18)

        y = boxY + boxH + 10

        // ── SIGNATURES ──
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
        doc.line(margin, y, margin + 65, y)
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 120, 120)
        doc.text("Technician / Engineer Signature", margin, y - 2)

        doc.line(pageW - margin - 65, y, pageW - margin, y)
        doc.text("Customer / Site Representative Signature", pageW - margin, y - 2, { align: "right" })

        y += 8
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(`Name: ${safeStr(report.tech_sign_name)}`, margin, y)
        doc.text(`Name: ${safeStr(report.customer_sign_name)}`, pageW - margin, y, { align: "right" })

        y += 5
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
        doc.text(formatDateTime(report.tech_sign_datetime), margin, y)
        doc.text(formatDateTime(report.customer_sign_datetime), pageW - margin, y, { align: "right" })
        y += 12

        // ── STAMP ──
        if (shouldStamp && stampBase64) {
          const stampW = 30; const stampH = 30
          const stampX = pageW - margin - stampW
          doc.addImage(stampBase64, stampFormat, stampX, y, stampW, stampH)
          doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
          doc.line(stampX - 10, y + stampH + 3, pageW - margin, y + stampH + 3)
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
          doc.text("Authorized Signatory", pageW - margin, y + stampH + 8, { align: "right" })
          y = y + stampH + 14
        }

        // ── FOOTER ──
        y += 6
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180)
        doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })
        return y + 6
      }

      const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
      const measuredH = renderReport(scratch)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, Math.max(measuredH, 100)] })
      renderReport(doc)

      const filename = `DWR-${safeStr(report.report_no)}.pdf`
      return { doc, filename }
    } catch (err) {
      console.error("[DWR PDF]", err)
      throw err
    }
  }

  const downloadPdf = async () => {
    setPdf(true)
    try {
      const result = await buildPdfDoc()
      if (!result) return
      result.doc.save(result.filename)
      toast.success("PDF downloaded")
    } catch (err) {
      toast.error("Failed to generate PDF: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setPdf(false)
    }
  }

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const handleWhatsAppShare = async () => {
    setSharingPdf(true)
    try {
      const result = await buildPdfDoc()
      if (!result) return
      const { doc, filename } = result

      const pdfBlob = doc.output("blob")
      const file = new File([pdfBlob], filename, { type: "application/pdf" })

      // Mobile: native share sheet
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Work Report ${report?.report_no ?? ""}`,
          text: `Hi, please find the work report from ${profile?.company_name ?? "us"}.`,
        })
      } else {
        // Desktop fallback: download + open WhatsApp Web with pre-filled text
        doc.save(filename)
        const waText = encodeURIComponent(
          `Hi, please find the work report *${report?.report_no ?? ""}* from *${profile?.company_name ?? ""}*.\n\nKindly acknowledge receipt.`
        )
        window.open(`https://wa.me/?text=${waText}`, "_blank")
        toast.info("PDF saved. Open WhatsApp and attach it there.")
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return
      console.error("Share error:", err)
      toast.error("Could not share: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setSharingPdf(false)
    }
  }

  // ─── Loading & not-found ────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <p className="text-muted-foreground">Report not found</p>
          <Link href="/daily-work-reports">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back to Reports
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const workItems = report.work_items ?? []

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 max-w-4xl mx-auto">

        {/* ── Action bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/daily-work-reports">
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold leading-tight">{report.report_no}</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {report.customer_name} · {formatDateLong(report.report_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Stamp toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStampToggle}
              disabled={pdf || sharingPdf}
              className={
                includeStamp
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700"
                  : "text-muted-foreground"
              }
            >
              <Stamp className="size-3.5 mr-1.5" />
              {includeStamp ? "Stamp on" : "Stamp off"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEditClick}
            >
              <Edit className="size-3.5 mr-1.5" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadPdf}
              disabled={pdf || sharingPdf}
            >
              {pdf
                ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                : <Download className="size-3.5 mr-1.5" />
              }
              Download PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsAppShare}
              disabled={sharingPdf || pdf}
              className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/40"
            >
              {sharingPdf
                ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                : <Share2 className="size-3.5 mr-1.5" />
              }
              Share via WhatsApp
            </Button>
          </div>
        </div>

        {/* ── Work Report document card ──────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Accent line */}
          <div className="h-1 bg-blue-600" />

          {/* From / To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">

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
                {profile?.tagline && <p className="text-xs text-muted-foreground">{profile.tagline}</p>}
                {profile?.address && <p className="text-xs text-muted-foreground">{profile.address}</p>}
                {(profile?.city || profile?.state || profile?.zip_code) && (
                  <p className="text-xs text-muted-foreground">
                    {[profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")}
                  </p>
                )}
                {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                {profile?.gstin && <p className="text-xs text-muted-foreground">GSTIN: {profile.gstin}</p>}
              </div>
            </div>

            {/* To — customer */}
            <div className="p-5 space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">CUSTOMER</p>
              <p className="font-semibold text-sm leading-snug">{report.customer_name ?? "-"}</p>
              {report.work_order_no && (
                <p className="text-xs text-muted-foreground">Work Order: {report.work_order_no}</p>
              )}
              {report.lift_no && (
                <p className="text-xs text-muted-foreground">Equipment: {report.lift_no}</p>
              )}
            </div>
          </div>

          {/* Report meta strip */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-3 bg-muted/30 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">Report No</p>
              <p className="text-sm font-semibold">{report.report_no}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Date</p>
              <p className="text-sm font-semibold">{formatDateLong(report.report_date)}</p>
            </div>
            {report.work_order_no && (
              <div>
                <p className="text-[10px] text-muted-foreground">Work Order</p>
                <p className="text-sm font-semibold">{report.work_order_no}</p>
              </div>
            )}
            {report.lift_no && (
              <div>
                <p className="text-[10px] text-muted-foreground">Equipment</p>
                <p className="text-sm font-semibold">{report.lift_no}</p>
              </div>
            )}
          </div>

          {/* Work items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-12">SR</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Description of Work</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs w-40">Material Used</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {workItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-sm text-muted-foreground">
                      No work items
                    </td>
                  </tr>
                ) : (
                  workItems.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="text-center py-3 px-4 text-xs text-muted-foreground">{item.sr_no}</td>
                      <td className="py-3 px-4 font-medium">{item.description || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.material_used || "—"}</td>
                      <td className="text-center py-3 px-4">
                        <span
                          className={
                            "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize " +
                            statusColor(item.status || "")
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

          {/* Inspection / Testing */}
          <div className="border-t border-border">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground">INSPECTION / TESTING</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 px-5 py-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Operational Test</p>
                <p className="text-sm font-medium">{report.operational_test_status ?? "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Safety Observations</p>
                <p className="text-sm font-medium">{report.safety_observations ?? "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Pending Recommendations</p>
                <p className="text-sm font-medium">{report.pending_recommendations ?? "-"}</p>
              </div>
            </div>
          </div>

          {/* Acknowledgement */}
          <div className="border-t border-border">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground">ACKNOWLEDGEMENT</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Technician Signature</p>
                <p className="text-sm font-medium">{report.tech_sign_name ?? "-"}</p>
                {report.tech_sign_datetime && (
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(report.tech_sign_datetime)}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Customer Signature</p>
                <p className="text-sm font-medium">{report.customer_sign_name ?? "-"}</p>
                {report.customer_sign_datetime && (
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(report.customer_sign_datetime)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Limit Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        type={limitModalType}
        onUpgrade={handleUpgrade}
        customTitle={limitModalCustom.title}
        customDescription={limitModalCustom.description}
      />

      {/* Stamp Upload Dialog */}
      <Dialog open={showStampDialog} onOpenChange={setShowStampDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Stamp / Signature</DialogTitle>
            <DialogDescription>
              Upload a stamp or signature to include it on downloaded PDFs.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/20">
              {stampPreview || profile?.stamp_url ? (
                <div className="relative">
                  <img
                    src={stampPreview || profile?.stamp_url || ""}
                    alt="Stamp preview"
                    className="max-h-28 object-contain"
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
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 MB"); return }
                      setStampFile(file)
                      const reader = new FileReader()
                      reader.onload = ev => setStampPreview(ev.target?.result as string)
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
              onClick={() => { setShowStampDialog(false); setStampFile(null); setStampPreview(null) }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadStamp}
              disabled={!stampFile || uploadingStamp}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadingStamp
                ? <Loader2 className="mr-1.5 size-4 animate-spin" />
                : <Save className="mr-1.5 size-4" />
              }
              Save Stamp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
