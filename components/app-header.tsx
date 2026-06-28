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
import { toast } from "sonner"

interface NotificationItem {
  id: string
  title: string
  description: string
  type: "expired" | "today-servicing" | "expiring-soon"
}

export function AppHeader() {
  const { user, role } = useAuth() // <-- get role from context
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [expiredCount, setExpiredCount] = useState(0)
  const [todayServicingCount, setTodayServicingCount] = useState(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState(0)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  // Fetch org_id and (if member) org name
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
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
            // If the user is a member, fetch the organization name
            if (role === "member") {
              supabase
                .from("organizations")
                .select("name")
                .eq("id", data.org_id)
                .single()
                .then(({ data: orgData, error: orgError }) => {
                  if (orgError) {
                    console.error("Failed to fetch org name:", orgError)
                  } else if (orgData?.name) {
                    setOrgName(orgData.name)
                  }
                })
            } else {
              setOrgName(null)
            }
          }
        })
    }
  }, [user?.id, role])

  const loadAlerts = async () => {
    if (!user?.id || !currentOrgId) return
    try {
      const { data: contractsData } = await supabase
        .from("contracts")
        .select("id, contract_name, next_service_date, status, customer_id")
        .eq("org_id", currentOrgId)

      if (!contractsData) return

      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("org_id", currentOrgId)

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

  useEffect(() => {
    if (currentOrgId) {
      loadAlerts()
    }
  }, [currentOrgId])

  // Subscribe to changes on contracts
  useEffect(() => {
    if (!currentOrgId) return
    const subscription = supabase
      .channel("header_contracts")
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts", filter: `org_id=eq.${currentOrgId}` }, () => {
        loadAlerts()
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [currentOrgId])

  const totalCount = expiredCount + todayServicingCount + expiringSoonCount

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />

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
                        : "text-orange-600"  // expiring-soon
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
  )
}
