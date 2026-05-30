"use client"

import { useEffect, useState, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Line
} from "recharts"
import {
  TrendingUp, TrendingDown, FileText, CheckCircle2, IndianRupee,
  Activity, Minus
} from "lucide-react"
import { toast } from "sonner"

type DateRange = "week" | "month" | "last_month" | "year"

interface Stats {
  totalServices: number
  completedServices: number
  activeContracts: number
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

interface ServiceTypeData {
  name: string
  value: number
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
  service_type: string
  contracts_price: number | null
  customer_id: string
}

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"]

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ac: "AC", cctv: "CCTV", lift: "Lift",
  "fire-safety": "Fire Safety", generator: "Generator",
  ups: "UPS", other: "Other"
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

export default function ReportsPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DateRange>("month")
  const [stats, setStats] = useState<Stats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [serviceTypeData, setServiceTypeData] = useState<ServiceTypeData[]>([])
  const [loading, setLoading] = useState(true)

  const [currentHistory, setCurrentHistory] = useState<HistoryRow[]>([])

  const fetchData = useCallback(async () => {
    if (!user?.id) return
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
          .select("id, status, service_type, contracts_price, customer_id")
          .eq("user_id", user.id),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
          .gte("service_date", toDateStr(start))
          .lte("service_date", toDateStr(end)),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
          .gte("service_date", toDateStr(prevStart))
          .lte("service_date", toDateStr(prevEnd)),
        supabase
          .from("service_history")
          .select("id, contract_id, status, service_date")
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
        activeContracts: contracts.filter(c => c.status === "active").length,
        totalEarnings: getTotalEarnings(cHistory, contractMap),
        prevTotalServices: getTotalServices(pHistory),
        prevCompletedServices: getCompletedServices(pHistory),
        prevTotalEarnings: getTotalEarnings(pHistory, contractMap),
      })

      setMonthlyData(getMonthlyData(aHistory, contractMap))

      const typeCounts: Record<string, number> = {}
      for (const c of contracts) {
        const key = c.service_type || "other"
        typeCounts[key] = (typeCounts[key] || 0) + 1
      }
      setServiceTypeData(
        Object.entries(typeCounts).map(([key, value]) => ({
          name: SERVICE_TYPE_LABELS[key] || key,
          value
        }))
      )
    } catch (err) {
      console.error("Error loading reports:", err)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }, [user?.id, range])

  useEffect(() => {
    fetchData()
  }, [fetchData])


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
              {/* Total Services */}
               <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">Total Services</span>
                      <span className="text-3xl font-bold">{stats.totalServices}</span>
                      <TrendBadge current={stats.totalServices} prev={stats.prevTotalServices} />
                    </div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="size-6 text-primary" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{RANGE_LABELS[range]}</p>
                </CardContent>
              </Card>
             

              {/* Completed Services */}
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

              {/* Active Contracts */}
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

              {/* Total Earnings */}
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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monthly Services Overview */}
          <Card className="lg:col-span-2">
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

          {/* Contracts by Service Type */}
          <Card>
            <CardHeader>
              <CardTitle>Contracts by Type</CardTitle>
              <CardDescription>Distribution of all contracts by service type</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : serviceTypeData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  No contract data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={serviceTypeData}
                      cx="50%"
                      cy="45%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {serviceTypeData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
                  </PieChart>
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
