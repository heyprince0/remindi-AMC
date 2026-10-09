"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit,
  Loader2,
  Save,
  Upload,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

// ────────────────────────────────────────────────────────────────────────────

export default function DeliveryChallanDetailPage() {
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [orgId, setOrgId]       = useState<string | null>(null)
  const [challan, setChallan]   = useState<DeliveryChallan | null>(null)
  const [profile, setProfile]   = useState<CompanyProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [pdf, setPdf]           = useState(false)

  // ── stamp toggle ──
  const [includeStamp, setIncludeStamp]               = useState(false)
  const [showStampDialog, setShowStampDialog]         = useState(false)
  const [stampFile, setStampFile]                     = useState<File | null>(null)
  const [stampPreview, setStampPreview]               = useState<string | null>(null)
  const [uploadingStamp, setUploadingStamp]           = useState(false)

  // ── load org ──
  useEffect(() => {
    if (user?.id)
      supabase.from("memberships").select("org_id").eq("user_id", user.id).single()
        .then(({ data }) => setOrgId(data?.org_id ?? null))
  }, [user?.id])

  // ── load challan + profile ──
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

  // ── persist stamp preference per challan ──
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

  // ────────────────────────────────────────────────────────────────────────
  // PDF generation — same logo/stamp loading pattern as DWR detail page
  // ────────────────────────────────────────────────────────────────────────
  const downloadPdf = async () => {
    if (!challan) return
    setPdf(true)
    try {
      const pageW      = 210
      const margin     = 15
      const themeColor = profile?.theme_color ?? "#185FA5"
      const [tr, tg, tb] = hexToRgb(themeColor)
      const headerStyle  = profile?.header_style ?? "single_logo"
      const shouldStamp  = includeStamp && !!profile?.stamp_url

      // ── load logo ──
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

      // ── load banner (thumbnail style) ──
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

      // ── load stamp — 3-attempt retry ──
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

      // ── render function (called twice: measure then final) ──
      const renderChallan = (doc: jsPDF): number => {
        let y = margin

        // HEADER
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

        // TITLE — right-aligned, large, theme color
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(tr, tg, tb)
        doc.text("DELIVERY CHALLAN", pageW - margin, y, { align: "right" })
        y += 8

        // DC No (left) + DATE + Slip No (right)
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30)
        doc.text(safeStr(challan.challan_no), margin, y)
        doc.setFontSize(10)
        doc.text(`DATE: ${fmtDateShort(challan.challan_date)}`, pageW - margin, y, { align: "right" })
        y += 6
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
        doc.text(`Slip No: ${safeStr(challan.slip_no)}`, pageW - margin, y, { align: "right" })
        y += 10

        // Divider
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
        doc.line(margin, y, pageW - margin, y)
        y += 8

        // TO block
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
        doc.text("TO,", margin, y)
        y += 5
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(safeStr(challan.customer_name), margin, y)
        y += 5
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
        const addrLines = doc.splitTextToSize(safeStr(challan.customer_address), pageW - margin * 2)
        doc.text(addrLines, margin, y)
        y += (addrLines.length * 5) + 6

        // Sub line
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0)
        doc.text(`Sub: ${safeStr(challan.subject)}`, margin, y)
        y += 7

        // Body text
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
        const bodyLines = doc.splitTextToSize(safeStr(challan.body_text), pageW - margin * 2)
        doc.text(bodyLines, margin, y)
        y += (bodyLines.length * 5) + 8

        // Items table
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
          alternateRowStyles: { fillColor: [248, 250, 252] },
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

        // Transport section
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30)

        const vNo = challan.vehicle_no || "___________________"
        const tMode = challan.transport_mode || "By Hand / Courier / Vehicle"
        doc.text(`Vehicle No: ${vNo}`, margin, y)
        doc.text(`Transport Mode: ${tMode}`, pageW - margin, y, { align: "right" })
        y += 7

        const ewayNo = challan.eway_bill_no || "___________________"
        const driverName = challan.driver_name || "___________________"
        doc.text(`E-way Bill No: ${ewayNo}`, margin, y)
        doc.text(`Driver Name: ${driverName}`, pageW - margin, y, { align: "right" })
        y += 5

        doc.setFontSize(8); doc.setTextColor(100, 100, 100)
        doc.text("(E-way bill mandatory if goods value exceeds applicable threshold)", margin, y)
        y += 10

        // Notes
        if (challan.notes) {
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
          const noteLines = doc.splitTextToSize(`Note: ${challan.notes}`, pageW - margin * 2)
          doc.text(noteLines, margin, y)
          y += (noteLines.length * 4.5) + 14
        } else {
          y += 10
        }

        // Signature section
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50)
        doc.text("Receiver's Signature & Stamp", margin, y)
        doc.text(`For ${safeStr(profile?.company_name)}`, pageW - margin, y, { align: "right" })
        y += 5
        doc.setFontSize(8); doc.setTextColor(100, 100, 100)
        doc.text("(Name, Date & Company Seal)", margin, y)
        y += 20

        // Stamp — bottom right (3-attempt loaded above)
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

        // Footer
        y += 6
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180)
        doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })
        return y + 6
      }

      // Measure then render at exact height
      const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
      const measuredH = renderChallan(scratch)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, Math.max(measuredH, 100)] })
      renderChallan(doc)
      doc.save(`DC-${safeStr(challan.challan_no)}.pdf`)
      toast.success("PDF downloaded")
    } catch (err) {
      console.error("[DC PDF]", err)
      toast.error("Failed to generate PDF: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setPdf(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!challan) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Delivery challan not found</p>
          <Link href="/delivery-challans"><Button>Back to Challans</Button></Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/delivery-challans">
              <Button variant="outline" size="icon" className="shrink-0 mt-1">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{challan.challan_no}</h1>
              <p className="text-sm text-muted-foreground">Slip No: {challan.slip_no}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(challan.challan_date)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant="secondary" className="capitalize">{challan.status || "draft"}</Badge>

            {/* Stamp toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStampToggle}
              disabled={pdf}
              className={includeStamp ? "border-green-600 bg-green-50 text-green-700 hover:bg-green-100" : ""}
            >
              <CheckCircle2 className={"mr-1.5 size-4 " + (includeStamp ? "" : "opacity-40")} />
              Stamp: {includeStamp ? "ON" : "OFF"}
            </Button>

            <Button onClick={downloadPdf} disabled={pdf} size="sm">
              {pdf ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
              Download PDF
            </Button>

            <Button variant="outline" size="sm" onClick={() => router.push(`/delivery-challans/${challan.id}/edit`)}>
              <Edit className="mr-1.5 size-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* ── Company info card ── */}
        {profile && (
          <Card>
            <CardHeader><CardTitle className="text-base">Company</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {profile.logo_url && (
                  <img src={profile.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded border" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold text-lg">{profile.company_name ?? "-"}</p>
                  {profile.tagline  && <p className="text-xs text-muted-foreground">{profile.tagline}</p>}
                  {profile.address  && <p className="text-xs text-muted-foreground">{profile.address}</p>}
                  {(profile.city || profile.state || profile.zip_code) && (
                    <p className="text-xs text-muted-foreground">
                      {[profile.city, profile.state, profile.zip_code].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {profile.phone && <p className="text-xs text-muted-foreground">Phone: {profile.phone}</p>}
                  {profile.email && <p className="text-xs text-muted-foreground">Email: {profile.email}</p>}
                  {profile.gstin && <p className="text-xs text-muted-foreground">GSTIN: {profile.gstin}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Challan details ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Challan Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Challan No</p>
              <p className="font-semibold">{challan.challan_no}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Slip No</p>
              <p className="font-semibold">{challan.slip_no}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Date</p>
              <p className="font-medium">{fmtDate(challan.challan_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Subject</p>
              <p className="font-medium">{challan.subject || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Customer</p>
              <p className="font-semibold">{challan.customer_name}</p>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{challan.customer_address || "-"}</p>
            </div>
            {challan.body_text && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Description</p>
                <p className="text-sm whitespace-pre-wrap">{challan.body_text}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Items table ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Sr. No</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="w-24 text-center">HSN/SAC</TableHead>
                    <TableHead className="w-20 text-center">Qty.</TableHead>
                    <TableHead className="w-20 text-center">Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(challan.items || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No items</TableCell>
                    </TableRow>
                  ) : (
                    (challan.items || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center">{item.sr_no}</TableCell>
                        <TableCell>{item.particulars}</TableCell>
                        <TableCell className="text-center">{item.hsn_sac || "-"}</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-center">{item.unit}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Transport ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Transport & Notes</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Vehicle No</p>
              <p>{challan.vehicle_no || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Transport Mode</p>
              <p>{challan.transport_mode || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">E-way Bill No</p>
              <p>{challan.eway_bill_no || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Driver Name</p>
              <p>{challan.driver_name || "-"}</p>
            </div>
            {challan.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{challan.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Stamp upload dialog ── */}
      <Dialog open={showStampDialog} onOpenChange={setShowStampDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stamp / Signature</DialogTitle>
            <DialogDescription>
              No stamp uploaded yet. Upload one now to enable it on your PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-secondary/30">
              {stampPreview || profile?.stamp_url ? (
                <div className="relative">
                  <img
                    src={stampPreview || profile?.stamp_url || ""}
                    alt="Stamp preview"
                    className="max-h-32 object-contain"
                  />
                  <Button
                    variant="ghost" size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                    onClick={() => { setStampFile(null); setStampPreview(null) }}
                  >×</Button>
                </div>
              ) : (
                <label htmlFor="stamp-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="size-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload stamp</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG (Max 2MB)</span>
                  <input
                    id="stamp-upload" type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return }
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowStampDialog(false); setStampFile(null); setStampPreview(null) }}>
              Cancel
            </Button>
            <Button onClick={handleUploadStamp} disabled={!stampFile || uploadingStamp}>
              {uploadingStamp ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save Stamp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
