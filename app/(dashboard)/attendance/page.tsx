'use client'

import { useEffect, useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { TechnicianAttendanceCalendar } from '@/components/technician-attendance-calendar'
import {
  Users, CalendarDays, ChevronDown, ChevronRight,
  Trash2, Loader2, Search, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TechRow {
  id: string
  name: string
  phone: string | null
  status: string
  thisMonthCount: number
  lastSeen: string | null
}

interface AttendanceRecord {
  id: string
  attendance_date: string
  scanned_at: string
  technician_id: string
  technicianName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

// ── Component ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user, role } = useAuth()
  const router = useRouter()

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [technicians, setTechnicians] = useState<TechRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Today's log (bottom section)
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [loadingToday, setLoadingToday] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Guard: admin only
  useEffect(() => {
    if (role && role !== 'admin' && role !== 'owner') {
      toast.error("You don't have permission to view attendance")
      router.push('/')
    }
  }, [role, router])

  // Load org ID
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => { if (data?.org_id) setCurrentOrgId(data.org_id) })
    }
  }, [user?.id])

  // Load technicians + this-month attendance counts
  useEffect(() => {
    if (!currentOrgId) return
    setLoading(true)

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0]

    Promise.all([
      supabase
        .from('technicians')
        .select('id, name, phone, status')
        .eq('org_id', currentOrgId)
        .order('name'),
      supabase
        .from('technician_attendance')
        .select('technician_id, attendance_date, scanned_at')
        .eq('org_id', currentOrgId)
        .gte('attendance_date', monthStart)
        .lte('attendance_date', monthEnd),
    ]).then(([{ data: techs }, { data: att }]) => {
      if (!techs) return

      const countMap = new Map<string, number>()
      const lastSeenMap = new Map<string, string>()
      for (const a of att ?? []) {
        const tid = a.technician_id as string
        countMap.set(tid, (countMap.get(tid) ?? 0) + 1)
        const existing = lastSeenMap.get(tid)
        if (!existing || a.attendance_date > existing) {
          lastSeenMap.set(tid, a.attendance_date as string)
        }
      }

      setTechnicians(
        techs.map((t) => ({
          id: t.id,
          name: t.name,
          phone: t.phone,
          status: t.status,
          thisMonthCount: countMap.get(t.id) ?? 0,
          lastSeen: lastSeenMap.get(t.id) ?? null,
        }))
      )
      setLoading(false)
    })
  }, [currentOrgId])

  // Load today's check-ins
  useEffect(() => {
    if (!currentOrgId) return
    setLoadingToday(true)

    supabase
      .from('technician_attendance')
      .select('id, attendance_date, scanned_at, technician_id, technicians(name)')
      .eq('org_id', currentOrgId)
      .eq('attendance_date', todayIST())
      .order('scanned_at', { ascending: false })
      .then(({ data }) => {
        setTodayRecords(
          (data ?? []).map((r: any) => ({
            id: r.id,
            attendance_date: r.attendance_date,
            scanned_at: r.scanned_at,
            technician_id: r.technician_id,
            technicianName: r.technicians?.name ?? 'Unknown',
          }))
        )
        setLoadingToday(false)
      })
  }, [currentOrgId])

  // Summary stats
  const totalDaysThisMonth = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }, [])

  const presentToday = todayRecords.length
  const techsWithAttendance = technicians.filter((t) => t.thisMonthCount > 0).length

  // Search filter
  const filteredTechs = useMemo(() => {
    if (!search.trim()) return technicians
    return technicians.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [technicians, search])

  // Delete attendance record
  const handleDelete = async () => {
    if (!deleteTarget || !currentOrgId) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('technician_attendance')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('org_id', currentOrgId)

      if (error) throw error

      toast.success('Attendance record deleted')
      setTodayRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      // Update technician count
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id === deleteTarget.technician_id
            ? { ...t, thisMonthCount: Math.max(0, t.thisMonthCount - 1) }
            : t
        )
      )
      setDeleteTarget(null)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete record')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track daily check-ins for all technicians
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Users className="size-4" />
                <p className="text-xs font-medium">Total Technicians</p>
              </div>
              <p className="text-xl font-bold">{technicians.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {techsWithAttendance} attended this month
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                <CheckCircle2 className="size-4" />
                <p className="text-xs font-medium">Present Today</p>
              </div>
              <p className="text-xl font-bold text-green-800 dark:text-green-300">{presentToday}</p>
              <p className="text-xs text-green-600/70 dark:text-green-500 mt-0.5">
                of {technicians.length} technicians
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <CalendarDays className="size-4" />
                <p className="text-xs font-medium">Work Days</p>
              </div>
              <p className="text-xl font-bold">{totalDaysThisMonth}</p>
              <p className="text-xs text-muted-foreground mt-0.5">days this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-green-600" />
              Today's Check-ins
            </CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingToday ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : todayRecords.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                No check-ins yet today
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Technician</TableHead>
                        <TableHead>Check-in Time</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.technicianName}</TableCell>
                          <TableCell>
                            <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                              {TIME_FORMAT.format(new Date(r.scanned_at))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden rounded-lg border divide-y overflow-hidden">
                  {todayRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                          <CheckCircle2 className="size-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.technicianName}</p>
                          <p className="text-xs text-green-700 dark:text-green-400">
                            {TIME_FORMAT.format(new Date(r.scanned_at))}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 shrink-0"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Per-technician monthly view */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Monthly Overview</h2>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search technician..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTechs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {search ? 'No technicians match your search' : 'No technicians in this organisation'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTechs.map((tech) => {
                const isExpanded = expandedTechId === tech.id
                const attendancePct = Math.round((tech.thisMonthCount / totalDaysThisMonth) * 100)

                return (
                  <Card key={tech.id} className="overflow-hidden">
                    {/* Row header — click to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedTechId(isExpanded ? null : tech.id)}
                      className="w-full text-left"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-semibold text-primary">
                              {tech.name.charAt(0)}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold truncate">{tech.name}</p>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-normal capitalize ${
                                  tech.status === 'available'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : tech.status === 'busy'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                              >
                                {tech.status.replace('-', ' ')}
                              </Badge>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${attendancePct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {tech.thisMonthCount}/{totalDaysThisMonth} days
                              </span>
                            </div>
                          </div>

                          {/* Expand icon */}
                          <div className="shrink-0 text-muted-foreground">
                            {isExpanded
                              ? <ChevronDown className="size-4" />
                              : <ChevronRight className="size-4" />}
                          </div>
                        </div>
                      </CardContent>
                    </button>

                    {/* Expanded calendar */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 pb-4 pt-3">
                        <TechnicianAttendanceCalendar technicianId={tech.id} />
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleteTarget?.technicianName}&apos;s check-in for{' '}
              {deleteTarget?.attendance_date}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
