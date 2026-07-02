"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { supabase, type Contract, getDaysUntilService } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import PlanSelectionModal from "@/components/billing/PlanSelectionModal"

interface NotificationItem {
  id: string
  title: string
  description: string
  type: "expired" | "today-servicing" | "expiring-soon"
}

export function AppHeader() {
  const { user, role, orgId, orgName } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [expiredCount, setExpiredCount] = useState(0)
  const [todayServicingCount, setTodayServicingCount] = useState(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState(0)

  // Plan limits for trial detection
  const { status, planName, isLoading: limitsLoading, refetch: refetchLimits } = usePlanLimits(orgId)

  // --- Ref to persist trial data across re‑mounts / background refetches ---
  const trialCache = useRef<{
    isTrial: boolean
    daysRemaining: number | null
    planName: string | null
    hasEverLoaded: boolean // marks if we've ever received data
  }>({
    isTrial: false,
    daysRemaining: null,
    planName: null,
    hasEverLoaded: false,
  })

  // Update the cache whenever status or planName changes
  useEffect(() => {
    if (status) {
      trialCache.current.isTrial = status === 'trial'
      trialCache.current.planName = planName || null
      trialCache.current.hasEverLoaded = true
    }
  }, [status, planName])

  // Modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Load notifications (unchanged)
  const loadAlerts = async () => {
    if (!user?.id || !orgId) return
    try {
      const { data: contractsData } = await supabase
        .from("contracts")
        .select("id, contract_name, next_service_date, status, customer_id")
        .eq("org_id", orgId)

      if (!contractsData) return

      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("org_id", orgId)

      let expired = 0
      let todayServicing = 0
      let expiringSoon = 0
      const items: NotificationItem[] = []

      for (const contract of contractsData as Contract[]) {
        const days = getDaysUntilService(contract.next_service_date)
        const customer = customersData?.find((c) => c.id === contract.customer_id)
        const customerName = customer?.name || "Unknown"

        if (days < 0) {
          expired++
          items.push({
            id: contract.id,
            title: `Expired: ${contract.contract_name}`,
            description: `${customerName} — ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} expired`,
            type: "expired",
          })
        } else if (days === 0) {
          todayServicing++
          items.push({
            id: contract.id,
            title: `Today Servicing: ${contract.contract_name}`,
            description: `${customerName} — service due today`,
            type: "today-servicing",
          })
        } else if (days <= 3) {
          expiringSoon++
          items.push({
            id: contract.id,
            title: `Expiring Soon: ${contract.contract_name}`,
            description: `${customerName} — in ${days} day${days !== 1 ? "s" : ""}`,
            type: "expiring-soon",
          })
        }
      }

      setExpiredCount(expired)
      setTodayServicingCount(todayServicing)
      setExpiringSoonCount(expiringSoon)
      setNotifications(items.slice(0, 10))
    } catch (error) {
      console.error("Error loading notifications:", error)
    }
  }

  // Load real trial_end_date and update cache
  const loadTrialDate = async () => {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("trial_end_date")
        .eq("org_id", orgId)
        .maybeSingle()

      if (error) throw error

      if (data?.trial_end_date) {
        const end = new Date(data.trial_end_date)
        const today = new Date()
        end.setHours(0, 0, 0, 0)
        today.setHours(0, 0, 0, 0)
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        trialCache.current.daysRemaining = Math.max(diffDays, 0)
      } else {
        trialCache.current.daysRemaining = null
      }
      trialCache.current.hasEverLoaded = true
    } catch (error) {
      console.error("Error loading trial date:", error)
      trialCache.current.daysRemaining = null
    }
  }

  // Load alerts and trial date whenever orgId is available
  useEffect(() => {
    if (orgId) {
      loadAlerts()
      loadTrialDate()
    }
  }, [orgId])

  // Subscribe to contract changes
  useEffect(() => {
    if (!orgId) return
    const subscription = supabase
      .channel("header_contracts")
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts", filter: `org_id=eq.${orgId}` }, () => {
        loadAlerts()
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [orgId])

  const totalCount = expiredCount + todayServicingCount + expiringSoonCount

  const handleUpgrade = () => {
    setShowUpgradeModal(true)
  }

  const handleUpgradeSuccess = () => {
    refetchLimits()
    loadTrialDate()
  }

  // ---- Banner visibility ----
  // Show banner if we have ever loaded trial data and the cached status is 'trial'
  const showBanner = trialCache.current.hasEverLoaded && trialCache.current.isTrial

  // ---- Skeleton visibility ----
  // Only show skeleton on the very first load (before any data has been cached)
  const showSkeleton = !trialCache.current.hasEverLoaded && limitsLoading && orgId

  // ---- Urgency styles (using cached days) ----
  const getUrgencyStyles = () => {
    const days = trialCache.current.daysRemaining
    if (days === null) {
      return {
        wrapper: "from-blue-50 to-indigo-50 border-blue-200/60",
        iconBg: "bg-blue-100 text-blue-600",
        text: "text-blue-900",
        subtext: "text-blue-700/70",
        button: "bg-blue-600 hover:bg-blue-700",
      }
    }
    if (days <= 3) {
      return {
        wrapper: "from-red-50 to-orange-50 border-red-200/60",
        iconBg: "bg-red-100 text-red-600",
        text: "text-red-900",
        subtext: "text-red-700/70",
        button: "bg-red-600 hover:bg-red-700",
      }
    }
    if (days <= 7) {
      return {
        wrapper: "from-orange-50 to-amber-50 border-orange-200/60",
        iconBg: "bg-orange-100 text-orange-600",
        text: "text-orange-900",
        subtext: "text-orange-700/70",
        button: "bg-orange-600 hover:bg-orange-700",
      }
    }
    return {
      wrapper: "from-blue-50 to-indigo-50 border-blue-200/60",
      iconBg: "bg-blue-100 text-blue-600",
      text: "text-blue-900",
      subtext: "text-blue-700/70",
      button: "bg-blue-600 hover:bg-blue-700",
    }
  }

  const urgency = getUrgencyStyles()

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />

        {/* Trial Banner – now persistent after first load */}
        {showBanner && (
          <div
            className={`flex flex-1 items-center justify-between gap-3 rounded-xl border bg-gradient-to-r ${urgency.wrapper} px-4 py-2`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${urgency.iconBg}`}>
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className={`font-semibold text-sm ${urgency.text} truncate`}>
                  {trialCache.current.daysRemaining !== null ? (
                    <>
                      {trialCache.current.daysRemaining}{" "}
                      {trialCache.current.daysRemaining === 1 ? "day" : "days"} left in your trial
                    </>
                  ) : (
                    "You're on a free trial"
                  )}
                </span>
                <span className={`text-xs ${urgency.subtext} truncate`}>
                  {trialCache.current.planName || "Free Trial"} plan
                </span>
              </div>
            </div>
            <Button
              size="sm"
              className={`${urgency.button} text-white text-xs px-3 py-1 h-8 gap-1 shrink-0`}
              onClick={handleUpgrade}
            >
              Upgrade
              <ArrowRight className="size-3" />
            </Button>
          </div>
        )}

        {/* Skeleton – only on the very first load */}
        {showSkeleton && (
          <div className="flex flex-1 items-center">
            <div className="h-9 w-64 rounded-xl bg-muted animate-pulse" />
          </div>
        )}

        {/* Show organization name for members only */}
        {role === "member" && orgName && (
          <div className="hidden md:block ml-2 text-sm font-medium text-muted-foreground">
            {orgName}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-5" />
                {totalCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px]">
                    {totalCount > 9 ? "9+" : totalCount}
                  </Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                  <span className="text-sm text-muted-foreground">No alerts — all services are on track</span>
                </DropdownMenuItem>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-3">
                    <span
                      className={`font-medium text-sm ${
                        n.type === "expired"
                          ? "text-red-600"
                          : n.type === "today-servicing"
                          ? "text-amber-600"
                          : "text-orange-600"
                      }`}
                    >
                      {n.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{n.description}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Upgrade Modal */}
      <PlanSelectionModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        orgId={orgId || undefined}
        onSuccess={handleUpgradeSuccess}
      />
    </>
  )
}
