"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  FileCheck,
  FileText,
  LayoutDashboard,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface NavigationItem {
  href: string
  label: string
  icon: LucideIcon
}

const navigationItems: readonly NavigationItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/stocks", label: "Inventory", icon: Package },
  { href: "/quotations", label: "Quotations", icon: FileCheck },
]

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href)
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex min-h-14 w-full">
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const isActive = isActiveRoute(pathname, href)

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 w-1/6 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] font-medium leading-tight transition-colors duration-200 ease-out focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isActive
                  ? "scale-[1.03] text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-0.5 size-1 rounded-full bg-primary transition-all duration-200 ease-out",
                  isActive ? "scale-100 opacity-100" : "scale-0 opacity-0",
                )}
              />
              <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
