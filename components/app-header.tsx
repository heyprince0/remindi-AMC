"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
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

  // Modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

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

  // Load alerts whenever orgId is available
  useEffect(() => {
    if (orgId) loadAlerts()
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
    // Refetch limits to update the header (hide trial banner if upgraded)
    refetchLimits()
  }

  // Show trial banner only if status is 'trial' and we have an org
  const showTrialBanner = status === 'trial' && !limitsLoading

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />

        {/* Trial Banner - shown between sidebar trigger and other content */}
        {showTrialBanner && (
          <div className="flex flex-1 items-center justify-between gap-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <span className="flex items-center gap-2">
              <span className="font-medium">🚀 You're on a free trial</span>
              <span className="text-xs opacity-75">
                {planName} plan — {14} days remaining
              </span>
            </span>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-8"
              onClick={handleUpgrade}
            >
              Upgrade Now
            </Button>
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
