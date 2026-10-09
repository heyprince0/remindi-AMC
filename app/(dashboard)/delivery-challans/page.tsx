"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase, type CompanyProfile, type DeliveryChallan } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { renderSingleLogoHeader } from "@/lib/pdf-header-utils"
import { toast } from "sonner"
import { FileDown, FileText, Loader2, Minus, MoreHorizontal, Pencil, Plus, Search, Stamp, Trash2 } from "lucide-react"

// ─── helpers ────────────────────────────────────────────────────────────────
const safeStr = (val: unknown) => String(val ?? "")

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [24, 95, 165]
}

// ─── blank PDF generator ────────────────────────────────────────────────────
async function downloadBlankDc(
  profile: CompanyProfile | null,
  rowCount: number,
  includeStamp: boolean
) {
  const pageW = 210
  const margin = 15
  const themeColor = profile?.theme_color ?? "#185FA5"
  const [tr, tg, tb] = hexToRgb(themeColor)
  const headerStyle = profile?.header_style ?? "single_logo"

  // ── load logo ──
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

  // ── load banner ──
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

  // ── load stamp ──
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
        console.warn(`[Blank DC stamp] Attempt ${attempt} failed:`, e)
        if (attempt === 3) toast.warning("Stamp image could not be loaded – skipping stamp")
        else await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
  }

  const blankBody = Array.from({ length: rowCount }, (_, i) => [String(i + 1), "", "", "", ""])

  const renderBlank = (doc: jsPDF): number => {
    let y = margin

    // ── HEADER ──
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

    // ── TITLE ──
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(tr, tg, tb)
    doc.text("DELIVERY CHALLAN", pageW - margin, y, { align: "right" })
    y += 10

    // ── DC No (left) + DATE (right) ──
    const rightColX = pageW - margin - 55
    const rightColEnd = pageW - margin - 5

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("DC NO.", margin, y)

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin, y + 6, margin + 45, y + 6)

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("DATE", rightColX, y)

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(rightColX, y + 6, rightColEnd, y + 6)

    y += 12

    // ── SLIP NO (right) ──
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("SLIP NO.", rightColX, y)

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(rightColX, y + 6, rightColEnd, y + 6)

    y += 12

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 8

    // ── TO block — SHORT LINES ONLY HERE ──
    const toLineW1 = 105
    const toLineW2 = 85

    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("TO,", margin, y)
    y += 8

    // Name line (broken length)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin, y + 3, margin + toLineW1, y + 3)
    y += 14

    // Address line (broken, shorter)
    doc.line(margin, y + 3, margin + toLineW2, y + 3)
    y += 14

    // ── Subject — FULL WIDTH ──
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("Sub:", margin, y)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin + 12, y + 3, pageW - margin, y + 3)
    y += 12

    // ── Body text blank lines (FULL WIDTH) ──
    doc.line(margin, y, pageW - margin, y)
    y += 8
    doc.line(margin, y, pageW - margin, y)
    y += 12

    // ── ITEMS TABLE ──
    autoTable(doc, {
      startY: y,
      head: [["SR.NO", "PARTICULARS", "HSN/SAC", "QTY.", "UNIT"]],
      body: blankBody,
      theme: "grid",
      headStyles: {
        fillColor: [tr, tg, tb],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        minCellHeight: 9,
      },
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

    // ── TRANSPORT section ──
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(60, 60, 60)

    doc.text("Vehicle No:", margin, y)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin + 22, y + 3, margin + 85, y + 3)

    doc.text("Transport Mode:", pageW / 2 + 5, y)
    doc.line(pageW / 2 + 35, y + 3, pageW - margin, y + 3)
    y += 10

    doc.text("E-way Bill No:", margin, y)
    doc.line(margin + 25, y + 3, margin + 85, y + 3)

    doc.text("Driver Name:", pageW / 2 + 5, y)
    doc.line(pageW / 2 + 28, y + 3, pageW - margin, y + 3)
    y += 8

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(140, 140, 140)
    doc.text("(E-way bill mandatory if goods value exceeds applicable threshold)", margin, y)
    y += 12

    // ── NOTES — FULL WIDTH ──
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(120, 120, 120)
    doc.text("NOTES", margin, y)
    y += 6
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageW - margin, y)
    y += 8
    doc.line(margin, y, pageW - margin, y)
    y += 14

    // ── SIGNATURE section ──
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(80, 80, 80)
    doc.text("Receiver's Signature & Stamp", margin, y)
    doc.text(`For ${safeStr(profile?.company_name) || "Company"}`, pageW - margin, y, { align: "right" })
    y += 5
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(140, 140, 140)
    doc.text("(Name, Date & Company Seal)", margin, y)
    y += 20

    // ── STAMP ──
    if (shouldStamp && stampBase64) {
      const stampW = 30
      const stampH = 30
      const stampX = pageW - margin - stampW

      doc.addImage(stampBase64, stampFormat, stampX, y, stampW, stampH)

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(stampX - 5, y + stampH + 3, pageW - margin, y + stampH + 3)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text("Authorized Signatory", pageW - margin, y + stampH + 8, { align: "right" })

      y = y + stampH + 14
    } else {
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      doc.text("Authorized Signatory", pageW - margin, y, { align: "right" })
      y += 8
    }

    // ── FOOTER ──
    y += 6
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
  doc.save(`DC-Blank-${rowCount}-rows.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────

export default function DeliveryChallansPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [rows, setRows] = useState<DeliveryChallan[]>([])
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [profileDialog, setProfileDialog] = useState(false)
  const [deleteRow, setDeleteRow] = useState<DeliveryChallan | null>(null)

  const [blankDialog, setBlankDialog] = useState(false)
  const [rowCount, setRowCount] = useState(5)
  const [includeStamp, setIncludeStamp] = useState(true)
  const [generatingBlank, setGeneratingBlank] = useState(false)

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setOrgId(data?.org_id ?? null))
    }
  }, [user?.id])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      supabase
        .from("delivery_challans")
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
      if (r.error) toast.error("Failed to load delivery challans")
      setRows((r.data as DeliveryChallan[]) || [])
      if (!p.error && p.data) setProfile(p.data as CompanyProfile)
      setLoading(false)
    })
  }, [orgId])

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        [row.challan_no, row.customer_name, row.subject].some((value) =>
          (value || "").toLowerCase().includes(search.toLowerCase())
        )
      ),
    [rows, search]
  )

  const newChallan = async () => {
    if (!orgId) return
    const { data, error } = await supabase
      .from("company_profile")
      .select("company_name,address,phone")
      .eq("org_id", orgId)
      .maybeSingle()
    if (error || !data?.company_name?.trim() || !data.address?.trim() || !data.phone?.trim()) {
      setProfileDialog(true)
    } else {
      router.push("/delivery-challans/new")
    }
  }

  const remove = async () => {
    if (!deleteRow || !orgId) return
    const { error } = await supabase
      .from("delivery_challans")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteRow.id)
      .eq("org_id", orgId)
    if (error) toast.error("Failed to delete challan")
    else {
      setRows(rows.filter((row) => row.id !== deleteRow.id))
      toast.success("Delivery challan deleted")
    }
    setDeleteRow(null)
  }

  const handleOpenBlankDialog = () => {
    if (!profile?.company_name) {
      toast.error("Please complete your company profile first")
      router.push("/settings")
      return
    }
    setBlankDialog(true)
  }

  const handleDownloadBlank = async () => {
    setGeneratingBlank(true)
    try {
      await downloadBlankDc(profile, rowCount, includeStamp)
      toast.success("Blank PDF downloaded")
      setBlankDialog(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate blank PDF")
    } finally {
      setGeneratingBlank(false)
    }
  }

  const hasStamp = !!profile?.stamp_url

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Delivery Challans</h1>
            <p className="text-muted-foreground">Create and manage delivery challans</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenBlankDialog}>
              <FileDown className="mr-2 size-4" />
              Blank PDF
            </Button>
            <Button onClick={newChallan}>
              <Plus className="mr-2 size-4" />
              New Challan
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search challan, customer, or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Challans</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading delivery challans...</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No delivery challans found.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Challan No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/delivery-challans/${row.id}`)}
                        >
                          <TableCell className="font-medium">{row.challan_no}</TableCell>
                          <TableCell>{row.customer_name}</TableCell>
                          <TableCell>{new Date(row.challan_date).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell>{row.subject || "-"}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Actions">
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/delivery-challans/${row.id}`)}>
                                  <FileText className="mr-2 size-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/delivery-challans/${row.id}/edit`)}>
                                  <Pencil className="mr-2 size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteRow(row)}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                  {filtered.map((row) => (
                    <Card
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/delivery-challans/${row.id}`)}
                    >
                      <CardContent className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <p className="font-semibold">{row.challan_no}</p>
                          <p>{row.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{row.subject || "No subject"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(row.challan_date).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <Badge variant="secondary">{row.status || "draft"}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Blank PDF Dialog ── */}
      <Dialog open={blankDialog} onOpenChange={(open) => { if (!generatingBlank) setBlankDialog(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Download Blank Challan PDF</DialogTitle>
            <DialogDescription>
              Choose how many item rows to include in the blank template. Fill them in by hand after printing.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Number of item rows</Label>
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
            </div>

            {hasStamp ? (
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
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-muted-foreground">
                <Stamp className="size-4 shrink-0" />
                <p className="text-xs">
                  No stamp uploaded yet. Go to{" "}
                  <button
                    className="underline text-foreground font-medium"
                    onClick={() => {
                      setBlankDialog(false)
                      router.push("/settings")
                    }}
                  >
                    Settings
                  </button>{" "}
                  to add one.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Maximum 20 rows. The PDF includes your company header, blank fields for DC No, Date, Slip No,
              customer details, transport info, and item rows ready to fill in by hand.
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

      {/* ── Delete dialog ── */}
      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery challan?</AlertDialogTitle>
            <AlertDialogDescription>This will hide the challan from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Profile setup dialog ── */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete your company profile</DialogTitle>
            <DialogDescription>
              Add company name, address, and phone in Settings before creating a delivery challan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialog(false)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
