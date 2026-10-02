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
import { supabase, type CompanyProfile, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { toast } from "sonner"

// ─── helpers ────────────────────────────────────────────────────────────────
const safeStr = (val: unknown) => String(val ?? "")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

// ─── blank PDF generator (reuses exact same render logic as detail page) ────
async function downloadBlankDwr(
  profile: CompanyProfile | null,
  rowCount: number
) {
  const pageW = 210
  const margin = 15
  const themeColor = profile?.theme_color ?? "#185FA5"
  const [tr, tg, tb] = hexToRgb(themeColor)
  const headerStyle = profile?.header_style ?? "single_logo"

  // load logo
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

  // load banner
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

  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  // blank rows — each row has visible height via minCellHeight
  const blankBody = Array.from({ length: rowCount }, (_, i) => [
    String(i + 1),
    "",
    "",
    "",
  ])

  const renderBlank = (doc: jsPDF): number => {
    let y = margin

    // ── header (identical to detail page) ──
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
      if (profile?.tagline) { doc.text(safeStr(profile.tagline), infoX, iy); iy += 4 }
      if (profile?.address)  { doc.text(safeStr(profile.address),  infoX, iy); iy += 4 }
      const loc = [profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ")
      if (loc) { doc.text(loc, infoX, iy); iy += 4 }
      if (profile?.phone) { doc.text(`Phone: ${safeStr(profile.phone)}`, infoX, iy); iy += 4 }
      if (profile?.email) { doc.text(`Email: ${safeStr(profile.email)}`, infoX, iy); iy += 4 }
      if (profile?.gstin)  { doc.text(`GSTIN: ${safeStr(profile.gstin)}`, infoX, iy) }
      y += 31
      doc.setDrawColor(tr, tg, tb)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageW - margin, y)
      y += 6
    }

    // ── title row ──
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("REPORT NO.", margin, y)

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text("DWR-", margin, y + 5)           // blank report no

    doc.setFontSize(16)
    doc.setTextColor(tr, tg, tb)
    doc.text("DAILY WORK COMPLETION REPORT", pageW - margin, y, { align: "right" })

    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text(
      `DATE: ${todayFormatted}   WORK ORDER:`,
      pageW - margin,
      y + 5,
      { align: "right" }
    )

    y += 12
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 8

    // ── details grid (blank lines) ──
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

    label("TECHNICIAN / ENGINEER", margin, y)
    blankLine(margin, y + 5)

    label("CUSTOMER / SITE", margin, y + 10)
    blankLine(margin, y + 15)

    label("SITE ADDRESS", margin, y + 20)
    blankLine(margin, y + 25)

    const col2X = pageW / 2 + 10
    label("CONTACT NO.", col2X, y)
    blankLine(col2X, y + 5, 60)

    label("LIFT NO. / EQUIPMENT ID", col2X, y + 10)
    blankLine(col2X, y + 15, 60)

    y += 32
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageW - margin, y)
    y += 6

    // ── work items table (blank rows) ──
    autoTable(doc, {
      startY: y,
      head: [["SR.", "Description of Work / Service", "Material Used", "Status"]],
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
        minCellHeight: 10,       // gives visual write space in each blank row
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 15, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 45 },
        3: { cellWidth: 25, halign: "center" },
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 6

    // ── inspection / testing (blank) ──
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

    // ── signature section ──
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text("Technician / Engineer Signature", margin, y - 2)
    doc.line(margin, y, margin + 65, y)

    doc.text("Customer / Site Representative Signature", pageW - margin, y - 2, { align: "right" })
    doc.line(pageW - margin - 65, y, pageW - margin, y)

    y += 8
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 0, 0)
    doc.text("Name:", margin, y)
    doc.text("Name:", pageW - margin, y, { align: "right" })

    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text("Date & Time:", margin, y)
    doc.text("Date & Time:", pageW - margin, y, { align: "right" })

    y += 12

    // ── office use ──
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.rect(margin, y, pageW - 2 * margin, 12)

    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(150, 150, 150)
    doc.text("For office use only", margin + 4, y + 7)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text("Status:                     |  Checked By:", pageW - margin - 4, y + 7, { align: "right" })

    y += 16

    // ── footer ──
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(180, 180, 180)
    doc.text("Generated by Remindi · remindi.online", pageW / 2, y, { align: "center" })

    return y + 6
  }

  // measure then render at exact height
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

  // blank PDF dialog state
  const [blankDialog, setBlankDialog] = useState(false)
  const [rowCount, setRowCount] = useState(5)
  const [generatingBlank, setGeneratingBlank] = useState(false)

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
    // load reports + company profile in parallel
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

  const filtered = useMemo(
    () =>
      reports.filter((r) =>
        [r.report_no, r.customer_name, r.site_name].some((v) =>
          (v || "").toLowerCase().includes(search.toLowerCase())
        )
      ),
    [reports, search]
  )

  const checkProfile = async () => {
    if (!orgId) return
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
    setGeneratingBlank(true)
    try {
      await downloadBlankDwr(profile, rowCount)
      toast.success("Blank PDF downloaded")
      setBlankDialog(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate blank PDF")
    } finally {
      setGeneratingBlank(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Work Reports</h1>
            <p className="text-muted-foreground">Create and manage daily work completion reports</p>
          </div>
          <div className="flex items-center gap-2">
            {/* ── Blank PDF button ── */}
            <Button
              variant="outline"
              onClick={() => setBlankDialog(true)}
            >
              <FileDown className="mr-2 size-4" />
              Blank PDF
            </Button>

            <Button onClick={checkProfile} disabled={checking}>
              <Plus className="mr-2 size-4" />
              New Report
            </Button>
          </div>
        </div>

        {/* Search */}
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
                            <Actions report={r} onDelete={setDeleteReport} />
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
                        <Actions report={r} onDelete={setDeleteReport} />
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

          <div className="py-4 space-y-4">
            <Label className="text-sm font-medium">Number of work item rows</Label>

            {/* +/- counter */}
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

            {/* quick-pick presets */}
            <div className="flex gap-2 flex-wrap">
              {[3, 5, 8, 10, 15].map((n) => (
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

            <p className="text-xs text-muted-foreground">
              Maximum 20 rows. The PDF will include your company header, all section labels, and blank lines ready to fill in by hand.
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
    </DashboardLayout>
  )
}

function Actions({
  report,
  onDelete,
}: {
  report: DailyWorkReport
  onDelete: (r: DailyWorkReport) => void
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
        <DropdownMenuItem asChild>
          <Link href={`/daily-work-reports/${report.id}/edit`} className="flex items-center">
            <Edit className="mr-2 size-4" />
            Edit
          </Link>
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
