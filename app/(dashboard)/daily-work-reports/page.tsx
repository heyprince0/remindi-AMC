"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Edit, FileText, MoreHorizontal, Plus, Search, Trash2, Settings } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase, type DailyWorkReport } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

export default function DailyWorkReportsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [reports, setReports] = useState<DailyWorkReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteReport, setDeleteReport] = useState<DailyWorkReport | null>(null)
  const [profileDialog, setProfileDialog] = useState(false)
  const [checking, setChecking] = useState(false)

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
    supabase
      .from("daily_work_reports")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load daily work reports")
        else setReports((data || []) as DailyWorkReport[])
        setLoading(false)
      })
  }, [orgId])

  const filtered = useMemo(() => {
    return reports.filter(r =>
      [r.report_no, r.customer_name, r.site_name].some(v =>
        (v || "").toLowerCase().includes(search.toLowerCase())
      )
    )
  }, [reports, search])

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
      setReports(prev => prev.filter(r => r.id !== deleteReport.id))
      toast.success("Report deleted successfully")
    }
    setDeleteReport(null)
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
          <Button onClick={checkProfile} disabled={checking}>
            <Plus className="mr-2 size-4" />
            New Report
          </Button>
        </div>

        {/* ── Standalone Search ── */}
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

        {/* Desktop: All Reports Table */}
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
                            {/* View Details Arrow */}
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

                            {/* Actions Dropdown */}
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

        {/* Mobile: Report Cards */}
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
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Site</p>
                        <p className="text-sm font-medium truncate">{r.site_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                        <Badge variant="secondary">{r.status || "Draft"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="text-xs text-muted-foreground truncate">
                        &nbsp;
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

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

function Actions({ report, onDelete }: { report: DailyWorkReport; onDelete: (r: DailyWorkReport) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${report.report_no}`}>
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
