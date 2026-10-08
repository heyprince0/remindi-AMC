"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  ArrowUpRight,
  Edit,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Settings,
  FileDown,
  Loader2,
  Minus,
  Stamp,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { supabase, type CompanyProfile, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
const safeStr = (val: unknown) => String(val ?? "")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

// ─── blank PDF generator ────────────────────────────────────────────────────
async function downloadBlankDwr(
  profile: CompanyProfile | null,
  rowCount: number,
  includeStamp: boolean
) {
  const pageW = 210
  const margin = 15
  const themeColor = profile?.theme_color ?? "#185FA5"
  const [tr, tg, tb] = hexToRgb(themeColor)
  const headerStyle = profile?.header_style ?? "single_logo"

  let logoBase64: string | null = null
  let logoFormat: "JPEG" | "PNG" = "PNG"
  if (headerStyle !== "thumbnail" && profile?.logo_url) {
    try {
      const blob = await (await fetch(profile.logo_url)).blob()
      logoFormat = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
      logoBase64 = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onloadend = () => res(r.result as string)
        r.readAsDataURL(blob)
      })
    } catch { /* skip */ }
  }

  let bannerBase64: string | null = null
  let bannerFormat: "JPEG" | "PNG" = "PNG"
  let bannerH = 0
  if (headerStyle === "thumbnail" && profile?.header_thumbnail_url) {
    try {
      const blob = await (await fetch(profile.header_thumbnail_url)).blob()
      bannerFormat = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "JPEG" : "PNG"
      bannerBase64 = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onloadend = () => res(r.result as string)
        r.readAsDataURL(blob)
      })
      const natural = await new Promise<{ w: number; h: number }>((res, rej) => {
        const img = new Image()
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = rej
        img.src = bannerBase64 as string
      })
      bannerH = Math.min(60, Math.round((pageW - margin * 2) / (natural.w / natural.h)))
    } catch { /* skip */ }
  }

  let stampBase64: string | null = null
  let stampFormat: "JPEG" | "PNG" = "PNG"
  const shouldStamp = includeStamp && !!profile?.stamp_url
  if (shouldStamp && profile?.stamp_url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(profile.stamp_url, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        stampBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        stampFormat = blob.type.includes("jpeg") ? "JPEG" : "PNG"
        break
      } catch (e) {
        console.warn(`[Stamp] Attempt ${attempt} failed:`, e)
        if (attempt === 3) toast.warning("Stamp image could not be loaded – skipping stamp")
        else await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
  }

  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const blankBody = Array.from({ length: rowCount }, (_, i) => [String(i + 1), "", ""])

  const renderBlank = (doc: jsPDF): number => {
    let y = margin

    if (headerStyle === "thumbnail" && bannerBase64) {
      doc.addImage(bannerBase64, bannerFormat, margin, y, pageW - margin * 2, bannerH)
      y += bannerH + 6
    } else if (headerStyle === "single_logo") {
      y = renderSingleLogoHeader(doc, profile, y, logoBase64, pageW, margin, [tr, tg, tb])
    } else {
      let logoAdded = false
      if (logoBase64) {
        doc.addImage(logoBase64, logoFormat, margin, y, 22, 22)
        logoAdded = true
      }
      const infoX = logoAdded ? margin + 24 : margin
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text(safeStr(profile?.company_name), infoX, y + 2)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(120, 120, 120)
      let iy = y + 8
      if (profile?.tagline)  { doc.text(safeStr(profile.tagline),  infoX, iy); iy += 4 }
      if (profile?.address)  { doc.text(safeStr(profile.address),  infoX, iy); iy += 4 }
      const loc = [profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")
      if (loc)               { doc.text(loc,                       infoX, iy); iy += 4 }
      if (profile?.phone)    { doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, iy); iy += 4 }
      if (profile?.email)    { doc.text(`Email: ${safeStr(profile.email)}`, infoX, iy); iy += 4 }
      if (profile?.gstin)    { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, infoX, iy) }
      y += 31
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageW - margin, y)
      y += 6
    }

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("CUSTOMER NAME", margin, y)

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin, y + 6, margin + 60, y + 6)

    // Title centered
    doc.setFontSize(15)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(tr, tg, tb)
    doc.text("WORK REPORT", pageW / 2, y + 2, { align: "center" })

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text(`DATE: ${todayFormatted}`, pageW - margin, y + 8, { align: "right" })

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("WORK ORDER NO.", pageW - margin, y + 14, { align: "right" })

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(pageW - margin - 50, y + 19, pageW - margin, y + 19)

    y += 24
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 8

    const label = (text: string, x: number, yy: number) => {
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(120, 120, 120)
      doc.text(text, x, yy)
    }
    const blankLine = (x: number, yy: number, w = 70) => {
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      doc.line(x, yy, x + w, yy)
    }

    // Only Equipment field remains
    label("EQUIPMENT", margin, y)
    blankLine(margin, y + 5, 100)

    y += 12
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageW - margin, y)
    y += 6

    autoTable(doc, {
      startY: y,
      head: [["SR.", "Description of Work / Service", "Status"]],
      body: blankBody,
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
        minCellHeight: 10,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 30, halign: "center" },
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 6

    const boxY = y
    const boxH = 28
    doc.setFillColor(240, 248, 255)
    doc.rect(margin, boxY, pageW - 2 * margin, boxH, "F")

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(tr, tg, tb)
    doc.text("INSPECTION / TESTING", margin + 5, boxY + 6)

    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text("Operational test:", margin + 5, boxY + 13)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin + 33, boxY + 13, margin + 80, boxY + 13)

    doc.text("Safety observations:", pageW / 2, boxY + 13)
    doc.line(pageW / 2 + 35, boxY + 13, pageW - margin - 5, boxY + 13)

    doc.text("Pending recommendations:", margin + 5, boxY + 22)
    doc.line(margin + 46, boxY + 22, pageW - margin - 5, boxY + 22)

    y = boxY + boxH + 10

    const sigLineW = 75
    const leftColX  = margin
    const rightColX = pageW - margin - sigLineW

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("CUSTOMER / SITE REPRESENTATIVE", leftColX, y)
    doc.text("TECHNICIAN / ENGINEER", rightColX, y)

    y += 5

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(leftColX, y + 12, leftColX + sigLineW, y + 12)
    doc.line(rightColX, y + 12, rightColX + sigLineW, y + 12)

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(150, 150, 150)
    doc.text("Signature", leftColX, y + 15)
    doc.text("Signature", rightColX, y + 15)

    y += 20

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("NAME", leftColX, y)
    doc.text("NAME", rightColX, y)

    y += 3
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(leftColX, y + 5, leftColX + sigLineW, y + 5)
    doc.line(rightColX, y + 5, rightColX + sigLineW, y + 5)

    y += 11

    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("DATE & TIME", leftColX, y)
    doc.text("DATE & TIME", rightColX, y)

    y += 3
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(leftColX, y + 5, leftColX + sigLineW, y + 5)
    doc.line(rightColX, y + 5, rightColX + sigLineW, y + 5)

    y += 14

    if (shouldStamp && stampBase64) {
      const stampW = 30
      const stampH = 30
      const stampX = pageW - margin - stampW

      doc.addImage(stampBase64, stampFormat, stampX, y, stampW, stampH)

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(stampX - 10, y + stampH + 3, pageW - margin, y + stampH + 3)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text("Authorized Signatory", pageW - margin, y + stampH + 8, { align: "right" })

      y = y + stampH + 14
    }

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(180, 180, 180)
    doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })

    return y + 6
  }

  const scratch = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, 2000] })
  const measuredH = renderBlank(scratch)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, Math.max(measuredH, 100)] })
  renderBlank(doc)
  doc.save(`DWR-Blank-${rowCount}-rows.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────

export default function DailyWorkReportsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [reports, setReports] = useState<DailyWorkReport[]>([])
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteReport, setDeleteReport] = useState<DailyWorkReport | null>(null)
  const [profileDialog, setProfileDialog] = useState(false)
  const [checking, setChecking] = useState(false)

  const [blankDialog, setBlankDialog] = useState(false)
  const [rowCount, setRowCount] = useState(4)
  const [includeStamp, setIncludeStamp] = useState(true)
  const [generatingBlank, setGeneratingBlank] = useState(false)

  const { status, planName, isLoading: limitsLoading } = usePlanLimits(orgId)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})
  const [autoShown, setAutoShown] = useState(false)

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) toast.error("Could not determine your organization")
          else setOrgId(data.org_id)
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase
        .from("daily_work_reports")
        .select("*")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("company_profile")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle(),
    ]).then(([r, p]) => {
      if (r.error) toast.error("Failed to load daily work reports")
      else setReports((r.data || []) as DailyWorkReport[])
      if (!p.error && p.data) setProfile(p.data as CompanyProfile)
      setLoading(false)
    })
  }, [orgId])

  useEffect(() => {
    if (!limitsLoading && orgId && !autoShown) {
      const blocked = checkAndShowLimitModal()
      if (blocked) setAutoShown(true)
    }
  }, [limitsLoading, orgId, status, autoShown])

  const filtered = useMemo(
    () =>
      reports.filter((r) =>
        [r.report_no, r.customer_name, r.site_name].some((v) =>
          (v || "").toLowerCase().includes(search.toLowerCase())
        )
      ),
    [reports, search]
  )

  const checkAndShowLimitModal = () => {
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({
        title: `Your ${planName || 'current'} plan has expired`,
        description: `Renew your ${planName || 'current'} plan to continue creating daily work reports.`,
      })
      setShowLimitModal(true)
      return true
    }
    return false
  }

  const handleUpgrade = () => {
    window.location.href = '/billing'
  }

  const checkProfile = async () => {
    if (!orgId) return

    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) return

    setChecking(true)
    const { data, error } = await supabase
      .from("company_profile")
      .select("company_name, address, phone")
      .eq("org_id", orgId)
      .maybeSingle()
    setChecking(false)
    if (error || !data?.company_name?.trim() || !data?.address?.trim() || !data?.phone?.trim()) {
      setProfileDialog(true)
    } else {
      router.push("/daily-work-reports/new")
    }
  }

  // ⭐ Edit click with subscription check — used by the 3-dot Actions menu
  const handleEditClick = (report: DailyWorkReport) => {
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) return
    router.push(`/daily-work-reports/${report.id}/edit`)
  }

  const softDelete = async () => {
    if (!deleteReport || !orgId) return
    const { error } = await supabase
      .from("daily_work_reports")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteReport.id)
      .eq("org_id", orgId)
    if (error) {
      toast.error("Failed to delete report")
    } else {
      setReports((prev) => prev.filter((r) => r.id !== deleteReport.id))
      toast.success("Report deleted successfully")
    }
    setDeleteReport(null)
  }

  const handleDownloadBlank = async () => {
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) {
      setBlankDialog(false)
      return
    }

    setGeneratingBlank(true)
    try {
      await downloadBlankDwr(profile, rowCount, includeStamp)
      toast.success("Blank PDF downloaded")
      setBlankDialog(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate blank PDF")
    } finally {
      setGeneratingBlank(false)
    }
  }

  const handleOpenBlankDialog = () => {
    if (limitsLoading) {
      toast.error("Checking your plan status, please try again in a moment...")
      return
    }
    if (checkAndShowLimitModal()) return
    setBlankDialog(true)
  }

  const hasStamp = !!profile?.stamp_url

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Work Reports</h1>
            <p className="text-muted-foreground">Create and manage daily work completion reports</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenBlankDialog}>
              <FileDown className="mr-2 size-4" />
              Blank PDF
            </Button>
            <Button onClick={checkProfile} disabled={checking || limitsLoading}>
              <Plus className="mr-2 size-4" />
              New Report
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by report no, customer, or site..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Desktop Table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>All Reports</CardTitle>
            <CardDescription>
              You have {filtered.length} report{filtered.length === 1 ? "" : "s"} in total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {reports.length === 0
                  ? "No daily work reports yet. Create your first report!"
                  : "No reports matching your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report No</TableHead>
                      <TableHead>Customer / Site</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/daily-work-reports/${r.id}`)}
                      >
                        <TableCell className="font-medium">{r.report_no}</TableCell>
                        <TableCell>
                          <div>{r.customer_name || "-"}</div>
                          <div className="text-muted-foreground text-xs">{r.site_name || "-"}</div>
                        </TableCell>
                        <TableCell>
                          {new Date(r.report_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>{r.technician_name || "-"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/daily-work-reports/${r.id}`)
                              }}
                              title="View details"
                            >
                              <ArrowUpRight className="size-4" />
                              <span className="sr-only">View Details</span>
                            </Button>
                            {/* ⭐ onEdit passed so the 3-dot Edit triggers the subscription check */}
                            <Actions
                              report={r}
                              onDelete={setDeleteReport}
                              onEdit={handleEditClick}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-4 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {reports.length === 0
                ? "No daily work reports yet. Create your first report!"
                : "No reports matching your filters"}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                You have{" "}
                <span className="font-medium text-foreground">{filtered.length}</span>{" "}
                report{filtered.length === 1 ? "" : "s"}{" "}
                {search ? "matching filters" : "in total"}
              </p>
              {filtered.map((r) => (
                <Card
                  key={r.id}
                  className="relative cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/daily-work-reports/${r.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold leading-tight truncate">
                            {r.report_no}
                          </CardTitle>
                          <CardDescription className="text-xs truncate mt-0.5">
                            {r.customer_name || "No customer"}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Actions
                          report={r}
                          onDelete={setDeleteReport}
                          onEdit={handleEditClick}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Date</p>
                        <p className="text-sm font-medium">
                          {new Date(r.report_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Technician</p>
                        <p className="text-sm font-medium truncate">{r.technician_name || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Site</p>
                        <p className="text-sm font-medium truncate">{r.site_name || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="text-xs text-muted-foreground">&nbsp;</div>
                      <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Blank PDF Dialog ── */}
      <Dialog open={blankDialog} onOpenChange={(open) => { if (!generatingBlank) setBlankDialog(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Download Blank Report PDF</DialogTitle>
            <DialogDescription>
              Choose how many work item rows to include in the blank template. You can fill them in by hand after printing.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Number of work item rows</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setRowCount((n) => Math.max(1, n - 1))}
                  disabled={rowCount <= 1 || generatingBlank}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={rowCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v)) setRowCount(Math.min(20, Math.max(1, v)))
                  }}
                  className="text-center text-lg font-semibold w-20"
                  disabled={generatingBlank}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => setRowCount((n) => Math.min(20, n + 1))}
                  disabled={rowCount >= 20 || generatingBlank}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {[3, 4, 5, 8, 10, 15].map((n) => (
                  <Button
                    key={n}
                    variant={rowCount === n ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setRowCount(n)}
                    disabled={generatingBlank}
                  >
                    {n} rows
                  </Button>
                ))}
              </div>
            </div>

            {hasStamp && (
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Stamp className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Include company stamp</p>
                    <p className="text-xs text-muted-foreground">Appears on the bottom-right of the PDF</p>
                  </div>
                </div>
                <Switch
                  checked={includeStamp}
                  onCheckedChange={setIncludeStamp}
                  disabled={generatingBlank}
                />
              </div>
            )}

            {!hasStamp && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-muted-foreground">
                <Stamp className="size-4 shrink-0" />
                <p className="text-xs">
                  No stamp uploaded yet. Go to{" "}
                  <button
                    className="underline text-foreground font-medium"
                    onClick={() => { setBlankDialog(false); router.push("/settings") }}
                  >
                    Settings
                  </button>{" "}
                  to add one.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Maximum 20 rows. The PDF includes your company header, all section labels, and blank lines ready to fill in by hand.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlankDialog(false)}
              disabled={generatingBlank}
            >
              Cancel
            </Button>
            <Button onClick={handleDownloadBlank} disabled={generatingBlank}>
              {generatingBlank ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 size-4" />
                  Download PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteReport} onOpenChange={(open) => !open && setDeleteReport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              The report will be removed from the list. This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={softDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Setup Dialog */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Company Profile</DialogTitle>
            <DialogDescription>
              Before creating a daily work report, please add your company name, address, and contact
              details in Settings. This information appears on your report PDF header.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => router.push("/settings")}>
              <Settings className="mr-2 size-4" />
              Go to Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// ⭐ Actions — now takes onEdit and calls it instead of using <Link>
function Actions({
  report,
  onDelete,
  onEdit,
}: {
  report: DailyWorkReport
  onDelete: (r: DailyWorkReport) => void
  onEdit: (r: DailyWorkReport) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for ${report.report_no}`}
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/daily-work-reports/${report.id}`} className="flex items-center">
            <ArrowUpRight className="mr-2 size-4" />
            View
          </Link>
        </DropdownMenuItem>
        {/* ⭐ Edit now runs the subscription check before navigating */}
        <DropdownMenuItem
          onClick={() => onEdit(report)}
          className="flex items-center cursor-pointer"
        >
          <Edit className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={() => onDelete(report)}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
