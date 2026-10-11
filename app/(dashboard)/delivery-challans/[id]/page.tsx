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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase, type CompanyProfile, type DeliveryChallan } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
const safeStr = (val: unknown) => String(val ?? "-")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "-"
  const d = new Date(val)
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

function fmtDateShort(val: string | null | undefined) {
  if (!val) return "-"
  const d = new Date(val)
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function statusColor(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "delivered") return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800"
  if (s === "in transit") return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
  if (s === "cancelled") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
  return "bg-muted text-muted-foreground border-border"
}
// ────────────────────────────────────────────────────────────────────────────

export default function DeliveryChallanDetailPage() {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [orgId, setOrgId]         = useState<string | null>(null)
  const [challan, setChallan]     = useState<DeliveryChallan | null>(null)
  const [profile, setProfile]     = useState<CompanyProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [pdf, setPdf]             = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)

  // stamp
  const [includeStamp, setIncludeStamp]       = useState(false)
  const [showStampDialog, setShowStampDialog] = useState(false)
  const [stampFile, setStampFile]             = useState<File | null>(null)
  const [stampPreview, setStampPreview]       = useState<string | null>(null)
  const [uploadingStamp, setUploadingStamp]   = useState(false)

  useEffect(() => {
    if (user?.id)
      supabase.from("memberships").select("org_id").eq("user_id", user.id).single()
        .then(({ data }) => setOrgId(data?.org_id ?? null))
  }, [user?.id])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase.from("delivery_challans").select("*").eq("id", id).eq("org_id", orgId).single(),
      supabase.from("company_profile").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([c, p]) => {
      if (c.error || !c.data) {
        toast.error("Failed to load delivery challan")
        router.push("/delivery-challans")
      } else {
        setChallan(c.data as DeliveryChallan)
      }
      setProfile(p.data as CompanyProfile | null)
      setLoading(false)
    })
  }, [orgId, id, router])

  useEffect(() => {
    const saved = localStorage.getItem(`stamp_toggle_dc_${id}`)
    if (saved === "true") setIncludeStamp(true)
  }, [id])

  const handleStampToggle = () => {
    if (!profile?.stamp_url) { setShowStampDialog(true); return }
    const next = !includeStamp
    setIncludeStamp(next)
    localStorage.setItem(`stamp_toggle_dc_${id}`, String(next))
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
      localStorage.setItem(`stamp_toggle_dc_${id}`, "true")
      toast.success("Stamp uploaded")
      setShowStampDialog(false); setStampFile(null); setStampPreview(null)
    } catch (err) {
      console.error(err); toast.error("Failed to upload stamp")
    } finally {
      setUploadingStamp(false)
    }
  }

  // ── Shared PDF builder ─────────────────────────────────────────────────────
  const buildPdfDoc = async (): Promise<{ doc: jsPDF; filename: string } | null> => {
    if (!challan) return null

    try {
      const pageW      = 210
      const margin     = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
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
        } catch (e) { console.warn("[DC PDF] logo:", e) }
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
        } catch (e) { console.warn("[DC PDF] banner:", e) }
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
            console.warn(`[DC Stamp] attempt ${attempt}:`, e)
            if (attempt === 3) toast.warning("Stamp could not be loaded — skipping")
            else await new Promise(r => setTimeout(r, 400 * attempt))
          }
        }
      }

      const renderChallan = (doc: jsPDF): number => {
        let y = margin

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

        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(tr, tg, tb)
        doc.text("DELIVERY CHALLAN", pageW - margin, y, { align: "right" })
        y += 8

        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30)
        doc.text(`DC NO.: ${safeStr(challan.challan_no)}`, margin, y)
        doc.setFontSize(10)
        doc.text(`DATE: ${fmtDateShort(challan.challan_date)}`, pageW - margin, y, { align: "right" })
        y += 6
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80)
        doc.text(`SLIP NO.: ${safeStr(challan.slip_no)}`, pageW - margin, y, { align: "right" })
        y += 10

        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
        doc.line(margin, y, pageW - margin, y)
        y += 8

        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80)
        doc.text("TO,", margin, y)
        y += 5
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(safeStr(challan.customer_name), margin, y)
        y += 5
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
        const addrLines = doc.splitTextToSize(safeStr(challan.customer_address), pageW - margin * 2)
        doc.text(addrLines, margin, y)
        y += (addrLines.length * 5) + 6

        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(`Sub: ${safeStr(challan.subject)}`, margin, y)
        y += 7

        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
        const bodyLines = doc.splitTextToSize(safeStr(challan.body_text), pageW - margin * 2)
        doc.text(bodyLines, margin, y)
        y += (bodyLines.length * 5) + 8

        const items = (challan.items || [])
        autoTable(doc, {
          startY: y,
          head: [["SR.NO", "PARTICULARS", "HSN/SAC", "QTY.", "UNIT"]],
          body: items.map(item => [
            safeStr(item.sr_no),
            safeStr(item.particulars),
            safeStr(item.hsn_sac),
            safeStr(item.qty),
            safeStr(item.unit),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [tr, tg, tb],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 18, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 18, halign: "center" },
            4: { cellWidth: 20, halign: "center" },
          },
          margin: { left: margin, right: margin },
        })
        y = (doc as any).lastAutoTable.finalY + 10

        const rightLabelX    = pageW / 2 + 5
        const rightValueOffset = 35
        doc.setFontSize(9)

        doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60)
        doc.text("Vehicle No:", margin, y)
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)
        doc.text(challan.vehicle_no || "___________________", margin + 22, y)

        doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60)
        doc.text("Transport Mode:", rightLabelX, y)
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)
        doc.text(challan.transport_mode || "By Hand / Courier / Vehicle", rightLabelX + rightValueOffset, y)
        y += 8

        doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60)
        doc.text("E-way Bill No:", margin, y)
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)
        doc.text(challan.eway_bill_no || "___________________", margin + 25, y)

        doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60)
        doc.text("Driver Name:", rightLabelX, y)
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)
        doc.text(challan.driver_name || "___________________", rightLabelX + rightValueOffset, y)
        y += 6

        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100)
        doc.text("(E-way bill mandatory if goods value exceeds applicable threshold)", margin, y)
        y += 12

        if (challan.notes) {
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60)
          doc.text("NOTES:", margin, y)
          const noteLabelW = doc.getTextWidth("NOTES: ")
          doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
          const noteLines = doc.splitTextToSize(safeStr(challan.notes), pageW - margin - margin - noteLabelW)
          doc.text(noteLines[0] || "", margin + noteLabelW, y)
          for (let i = 1; i < noteLines.length; i++) {
            y += 4.5
            doc.text(noteLines[i], margin, y)
          }
          y += (noteLines.length * 4.5) + 10
        } else {
          y += 10
        }

        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(50, 50, 50)
        doc.text("Receiver's Signature & Stamp", margin, y)
        doc.text(`For ${safeStr(profile?.company_name)}`, pageW - margin, y, { align: "right" })
        y += 5
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100)
        doc.text("(Name, Date & Company Seal)", margin, y)
        y += 20

        if (shouldStamp && stampBase64) {
          const stampW = 30; const stampH = 30
          const stampX = pageW - margin - stampW
          doc.addImage(stampBase64, stampFormat, stampX, y, stampW, stampH)
          doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
          doc.line(stampX - 5, y + stampH + 3, pageW - margin, y + stampH + 3)
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
          doc.text("Authorized Signatory", pageW - margin, y + stampH + 8, { align: "right" })
          y = y + stampH + 14
        } else {
          doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50)
          doc.text("Authorized Signatory", pageW - margin, y, { align: "right" })
          y += 8
        }

        y += 6
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180)
        doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })
        return y + 6
      }

      const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
      const measuredH = renderChallan(scratch)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, Math.max(measuredH, 100)] })
      renderChallan(doc)

      const filename = `DC-${safeStr(challan.challan_no)}.pdf`
      return { doc, filename }
    } catch (err) {
      console.error("[DC PDF]", err)
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

  const handleWhatsAppShare = async () => {
    setSharingPdf(true)
    try {
      const result = await buildPdfDoc()
      if (!result) return
      const { doc, filename } = result

      const pdfBlob = doc.output("blob")
      const file = new File([pdfBlob], filename, { type: "application/pdf" })

      // Mobile: native OS share sheet
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Delivery Challan ${challan?.challan_no ?? ""}`,
          text: `Hi, please find the delivery challan from ${profile?.company_name ?? "us"}.`,
        })
      } else {
        // Desktop fallback: download + open WhatsApp Web with pre-filled text
        doc.save(filename)
        const waText = encodeURIComponent(
          `Hi, please find the delivery challan *${challan?.challan_no ?? ""}* from *${profile?.company_name ?? ""}*.\n\nKindly acknowledge receipt.`
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

  // ─── Loading & not-found ─────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!challan) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <p className="text-muted-foreground">Delivery challan not found</p>
          <Link href="/delivery-challans">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back to Challans
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const hasBankDetails = profile?.bank_name || profile?.account_no || profile?.ifsc_code || profile?.upi_id
  const hasTransport   = challan.vehicle_no || challan.transport_mode || challan.eway_bill_no || challan.driver_name

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 max-w-4xl mx-auto">

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/delivery-challans">
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold leading-tight">{challan.challan_no}</h1>
                <span
                  className={
                    "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border capitalize " +
                    statusColor(challan.status || "draft")
                  }
                >
                  {challan.status || "draft"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {challan.customer_name} · {fmtDate(challan.challan_date)}
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
              onClick={() => router.push(`/delivery-challans/${challan.id}/edit`)}
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

        {/* ── Delivery Challan document card ──────────────────────────────── */}
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
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wider">TO</p>
              <p className="font-semibold text-sm leading-snug">{challan.customer_name ?? "-"}</p>
              {challan.customer_address && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {challan.customer_address}
                </p>
              )}
            </div>
          </div>

          {/* Challan meta strip */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-3 bg-muted/30 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">Challan No</p>
              <p className="text-sm font-semibold">{challan.challan_no}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Slip No</p>
              <p className="text-sm font-semibold">{challan.slip_no || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Date</p>
              <p className="text-sm font-semibold">{fmtDate(challan.challan_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Status</p>
              <p className="text-sm font-semibold capitalize">{challan.status || "draft"}</p>
            </div>
          </div>

          {/* Subject + body */}
          {(challan.subject || challan.body_text) && (
            <div className="px-5 py-4 border-b border-border space-y-1.5">
              {challan.subject && (
                <p className="text-sm font-semibold">Sub: {challan.subject}</p>
              )}
              {challan.body_text && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {challan.body_text}
                </p>
              )}
            </div>
          )}

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-12">#</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Particulars</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-24">HSN/SAC</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-20">Qty</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs w-20">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(challan.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                      No items added
                    </td>
                  </tr>
                ) : (
                  (challan.items || []).map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="text-center py-3 px-4 text-xs text-muted-foreground">{item.sr_no}</td>
                      <td className="py-3 px-4 font-medium">{item.particulars}</td>
                      <td className="text-center py-3 px-4 text-muted-foreground">{item.hsn_sac || "-"}</td>
                      <td className="text-center py-3 px-4">{item.qty}</td>
                      <td className="text-center py-3 px-4 text-muted-foreground">{item.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Transport + Notes */}
          {(hasTransport || challan.notes) && (
            <div className="border-t border-border">
              {hasTransport && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 px-5 py-4 border-b border-border">
                  {challan.vehicle_no && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vehicle No</p>
                      <p className="text-sm font-medium">{challan.vehicle_no}</p>
                    </div>
                  )}
                  {challan.transport_mode && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Transport Mode</p>
                      <p className="text-sm font-medium">{challan.transport_mode}</p>
                    </div>
                  )}
                  {challan.eway_bill_no && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">E-way Bill No</p>
                      <p className="text-sm font-medium">{challan.eway_bill_no}</p>
                    </div>
                  )}
                  {challan.driver_name && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Driver Name</p>
                      <p className="text-sm font-medium">{challan.driver_name}</p>
                    </div>
                  )}
                </div>
              )}

              {challan.notes && (
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {challan.notes}
                  </p>
                </div>
              )}
            </div>
          )}

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

      {/* ── Stamp upload dialog ──────────────────────────────────────────────── */}
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
