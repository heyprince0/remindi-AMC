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

interface NotificationItem {
  id: string
  title: string
  description: string
  type: "overdue" | "due-today" | "upcoming"
}

export function AppHeader() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [dueTodayCount, setDueTodayCount] = useState(0)

  useEffect(() => {
    const loadAlerts = async () => {
      if (!user?.id) return
      try {
        const { data: contractsData } = await supabase
          .from("contracts")
          .select("id, contract_name, next_service_date, status, customer_id")
          .eq("user_id", user.id)

        if (!contractsData) return

        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name")
          .eq("user_id", user.id)

        let overdue = 0
        let dueToday = 0
        const items: NotificationItem[] = []

        for (const contract of contractsData as Contract[]) {
          const days = getDaysUntilService(contract.next_service_date)
          const customer = customersData?.find((c) => c.id === contract.customer_id)
          const customerName = customer?.name || "Unknown"

          if (days < 0) {
            overdue++
            items.push({
              id: contract.id,
              title: `Overdue: ${contract.contract_name}`,
              description: `${customerName} — ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`,
              type: "overdue",
            })
          } else if (days === 0) {
            dueToday++
            items.push({
              id: contract.id,
              title: `Due Today: ${contract.contract_name}`,
              description: `${customerName} — service due today`,
              type: "due-today",
            })
          }
        }

        setOverdueCount(overdue)
        setDueTodayCount(dueToday)
        setNotifications(items.slice(0, 10))
      } catch (error) {
        console.error("Error loading notifications:", error)
      }
    }

    loadAlerts()

    const subscription = supabase
      .channel("header_contracts")
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, () => {
        loadAlerts()
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [user?.id])

  const totalCount = overdueCount + dueTodayCount

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />

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
                      n.type === "overdue"
                        ? "text-red-600"
                        : n.type === "due-today"
                        ? "text-amber-600"
                        : ""
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
