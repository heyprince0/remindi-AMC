"use client"

import { useEffect, useState, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Line
} from "recharts"
import {
  TrendingUp, TrendingDown, FileText, CheckCircle2, IndianRupee,
  Activity, Minus, Download
} from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type DateRange = "week" | "month" | "last_month" | "year"

interface Stats {
  totalServices: number
  completedServices: number
  activeContracts: number
  totalContracts: number
  totalEarnings: number
  prevTotalServices: number
  prevCompletedServices: number
  prevTotalEarnings: number
}

interface MonthlyData {
  month: string
  completed: number
  scheduled: number
  earnings: number
}

interface HistoryRow {
  id: string
  contract_id: string
  status: string
  service_date: string
}

interface ContractRow {
  id: string
  status: string
  contracts_price: number | null
  customer_id: string
  next_service_date: string 
}

const RANGE_LABELS: Record<DateRange, string> = {
  week: "This Week",
  month: "This Month",
  last_month: "Last Month",
  year: "This Year"
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]
}

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date()
  switch (range) {
    case "week": {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

function getPrevDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date()
  switch (range) {
    case "week": {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay() - 7)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - 1, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case "year": {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

function calcTrend(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null
  return Math.round(((current - prev) / prev) * 100)
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const trend = calcTrend(current, prev)
  if (trend === null) return <span className="text-xs text-muted-foreground">No prev data</span>
  if (trend > 0) return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <TrendingUp className="size-3" />+{trend}% vs prev
    </span>
  )
  if (trend < 0) return (
    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
      <TrendingDown className="size-3" />{trend}% vs prev
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
      <Minus className="size-3" />0% vs prev
    </span>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="size-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

function getTotalServices(history: HistoryRow[]): number {
  return history.length
}

function getCompletedServices(history: HistoryRow[]): number {
  return history.filter(h => h.status === "completed").length
}

function getTotalEarnings(history: HistoryRow[], contractMap: Map<string, ContractRow>): number {
  const earnedIds = new Set(
    history.filter(h => h.status === "completed").map(h => h.contract_id)
  )
  return [...earnedIds].reduce((sum, id) => {
    return sum + (contractMap.get(id)?.contracts_price || 0)
  }, 0)
}

function getMonthlyData(allHistory: HistoryRow[], contractMap: Map<string, ContractRow>): MonthlyData[] {
  const now = new Date()
  const months: MonthlyData[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const monthStart = `${year}-${month}-01`
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate()
    const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`
    const label = d.toLocaleString("default", { month: "short" })

    const records = allHistory.filter(
      h => h.service_date >= monthStart && h.service_date <= monthEnd
    )
    const completed = records.filter(h => h.status === "completed").length
    const scheduled = records.filter(h => h.status !== "completed" && h.status !== "cancelled").length
    const earnings = getTotalEarnings(records, contractMap)

    months.push({ month: label, completed, scheduled, earnings })
  }
  return months
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [22, 45, 60] // default dark blue
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>("month")
  const [stats, setStats] = useState<Stats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentHistory, setCurrentHistory] = useState<HistoryRow[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to fetch organization:", error)
            toast.error("Could not determine your organization")
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  const fetchData = useCallback(async () => {
    if (!user?.id || !currentOrgId) return
    setLoading(true)
    try {
      const { start, end } = getDateRange(range)
      const { start: prevStart, end: prevEnd } = getPrevDateRange(range)

      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)
      sixMonthsAgo.setHours(0, 0, 0, 0)

      const [contractsRes, currentHistoryRes, prevHistoryRes, allHistoryRes] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, status, contracts_price, customer_id, next_service_date")
          .eq("org_id", currentOrgId),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
          .eq("org_id", currentOrgId)
          .gte("service_date", toDateStr(start))
          .lte("service_date", toDateStr(end)),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
          .eq("org_id", currentOrgId)
          .gte("service_date", toDateStr(prevStart))
          .lte("service_date", toDateStr(prevEnd)),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
          .eq("org_id", currentOrgId)
          .gte("service_date", toDateStr(sixMonthsAgo))
      ])

      const contracts = (contractsRes.data || []) as ContractRow[]
      const cHistory = (currentHistoryRes.data || []) as HistoryRow[]
      const pHistory = (prevHistoryRes.data || []) as HistoryRow[]
      const aHistory = (allHistoryRes.data || []) as HistoryRow[]

      const contractMap = new Map(contracts.map(c => [c.id, c]))

      setCurrentHistory(cHistory)

      setStats({
        totalServices: getTotalServices(cHistory),
        completedServices: getCompletedServices(cHistory),
        activeContracts: contracts.filter(c => {
          const days = getDaysUntilService(c.next_service_date)
          return c.status === "active" && days > 7
        }).length,
        totalContracts: contracts.length,
        totalEarnings: getTotalEarnings(cHistory, contractMap),
        prevTotalServices: getTotalServices(pHistory),
        prevCompletedServices: getCompletedServices(pHistory),
        prevTotalEarnings: getTotalEarnings(pHistory, contractMap),
      })

      setMonthlyData(getMonthlyData(aHistory, contractMap))
    } catch (err) {
      console.error("Error loading reports:", err)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [user?.id, range, currentOrgId])

  useEffect(() => {
    if (currentOrgId) {
      fetchData()
    }
  }, [fetchData, currentOrgId])

  // ===== NEW PDF EXPORT using jsPDF + autoTable =====
  const exportReportPDF = () => {
    if (!stats || monthlyData.length === 0) {
      toast.error("No data to export")
      return
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageW = 297
      const margin = 15
      const themeColor = "#162d3c"
      const [r, g, b] = hexToRgb(themeColor)

      // Header
      doc.setFillColor(r, g, b)
      doc.rect(0, 0, pageW, 14, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Reports Summary", margin, 9)
      doc.setTextColor(200, 200, 200)
      doc.setFontSize(8)
      doc.text("AMC REPORTS", pageW - margin, 9, { align: "right" })

      // Meta info
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const rangeLabel = RANGE_LABELS[range] || range
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(8)
      doc.text(`Exported: ${dateStr}  |  Period: ${rangeLabel}`, margin, 22)

      // Stats summary
      const statsData = [
        ["Total Contracts", stats.totalContracts],
        ["Completed Services", stats.completedServices],
        ["Active Contracts", stats.activeContracts],
        ["Total Earnings", `Rs. ${stats.totalEarnings.toLocaleString('en-IN')}`],
      ]

      autoTable(doc, {
        startY: 28,
        head: [["Metric", "Value"]],
        body: statsData.map(row => [row[0], String(row[1])]),
        theme: "striped",
        headStyles: {
          fillColor: [r, g, b],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
      })

      // Monthly data table
      const yAfterStats = (doc as any).lastAutoTable.finalY + 8

      const tableData = monthlyData.map(m => [
        m.month,
        m.completed,
        m.scheduled,
        `Rs. ${m.earnings.toLocaleString('en-IN')}`,
      ])

      autoTable(doc, {
        startY: yAfterStats,
        head: [["Month", "Completed", "Scheduled", "Earnings"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [r, g, b],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
        },
        margin: { left: margin, right: margin },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text("Generated by Remindi · remindi.online", pageW / 2, finalY, { align: "center" })

      doc.save(`Reports_${range}_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success("Report exported successfully")
    } catch (error) {
      console.error("Error exporting report:", error)
      toast.error("Failed to export report")
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground">Analytics dashboard powered by live data</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={exportReportPDF}
              disabled={loading || !stats}
            >
              <Download className="mr-2 size-4" />
              Export PDF
            </Button>
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading || !stats ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">Total Contracts</span>
                      <span className="text-3xl font-bold">{stats.totalContracts}</span>
                      <span className="text-xs text-muted-foreground">All time</span>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="size-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">Completed Services</span>
                      <span className="text-3xl font-bold">{stats.completedServices}</span>
                      <TrendBadge current={stats.completedServices} prev={stats.prevCompletedServices} />
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-green-500/10">
                      <CheckCircle2 className="size-6 text-green-500" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{RANGE_LABELS[range]}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">Active Contracts</span>
                      <span className="text-3xl font-bold">{stats.activeContracts}</span>
                      <span className="text-xs text-muted-foreground">Currently active</span>
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <FileText className="size-6 text-blue-500" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">Total Earnings</span>
                      <span className="text-3xl font-bold">{formatINR(stats.totalEarnings)}</span>
                      <TrendBadge current={stats.totalEarnings} prev={stats.prevTotalEarnings} />
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-amber-500/10">
                      <IndianRupee className="size-6 text-amber-500" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{RANGE_LABELS[range]}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Services Overview</CardTitle>
              <CardDescription>Completed services and earnings over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : monthlyData.every(m => m.completed === 0) ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No service history data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "earnings") return [formatINR(Number(value)), "Earnings"]
                        if (name === "completed") return [value, "Completed"]
                        return [value, name]
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="completed" name="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="earnings"
                      name="earnings"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Earnings Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Earnings (₹)</CardTitle>
            <CardDescription>Revenue from completed services over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : monthlyData.every(m => m.earnings === 0) ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                No earnings data yet — complete services and add contract prices to see data here
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [formatINR(Number(value)), "Earnings"]} />
                  <Bar dataKey="earnings" name="Earnings" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
