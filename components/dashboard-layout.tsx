"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MembershipListener } from "@/components/membership-listener"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { SubscriptionLockScreen } from "@/components/billing/subscription-lock-screen"
import { useAuth } from "@/lib/auth-context"
import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"

function SubscriptionNotice({ readOnly }: { readOnly: boolean }) {
  if (!readOnly) return null
  return (
    <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" role="status">
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
      <span>Your subscription is overdue. Your data is available in read-only mode until you renew.</span>
    </div>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { subscriptionAccess } = useAuth()
  const pathname = usePathname()
  const isBillingPage = pathname === '/billing' || pathname.startsWith('/billing/')
  const isLocked = subscriptionAccess === 'locked' && !isBillingPage
  const isReadOnly = subscriptionAccess === 'read-only' && !isBillingPage

  if (isLocked) return <SubscriptionLockScreen />

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="flex-1 min-w-0 w-full overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          <SubscriptionNotice readOnly={isReadOnly} />
          <div className={isReadOnly ? 'pointer-events-none select-none' : undefined} aria-disabled={isReadOnly}>
            {children}
          </div>
        </main>
        <MembershipListener />
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
