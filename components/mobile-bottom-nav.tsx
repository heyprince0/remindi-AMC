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
  { href: "/",           label: "Dashboard", icon: LayoutDashboard },
  { href: "/contracts",  label: "Contracts",  icon: FileText        },
  { href: "/customers",  label: "Customers",  icon: Users           },
  { href: "/alerts",     label: "Alerts",     icon: Bell            },
  { href: "/stocks",     label: "Inventory",  icon: Package         },
  { href: "/quotations", label: "Quotations", icon: FileCheck       },
]

function isActiveRoute(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href)
}

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        // positioning & visibility
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        // frosted glass background
        "bg-background/80 backdrop-blur-xl",
        // top border
        "border-t border-border/60",
        // iOS home indicator space
        "pb-[env(safe-area-inset-bottom)]",
        // subtle top shadow
        "shadow-[0_-1px_20px_rgba(0,0,0,0.06)]",
      )}
    >
      {/* Scrollable row — hides scrollbar, allows 6 items to breathe */}
      <div
        className={cn(
          "flex overflow-x-auto",
          // hide scrollbar across browsers
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          // snap behavior for smooth swipe
          "snap-x snap-mandatory",
          "px-1",
        )}
      >
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const isActive = isActiveRoute(pathname, href)

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                // sizing — min-w keeps items from squishing, flex-shrink-0 prevents compression
                "flex-shrink-0 min-w-[72px] snap-start",
                // layout
                "flex flex-col items-center justify-center gap-1",
                // height & padding
                "py-2 px-1 min-h-[60px]",
                // tap highlight off on mobile
                "tap-highlight-transparent",
                // focus ring
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-xl",
                // transition
                "transition-all duration-200 ease-out",
                // active text
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {/* Icon wrapped in pill — pill only visible when active */}
              <span
                className={cn(
                  "flex items-center justify-center rounded-2xl transition-all duration-200 ease-out",
                  isActive
                    ? "bg-primary/10 px-4 py-1.5 scale-100"
                    : "bg-transparent px-4 py-1.5 scale-95",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-[18px] shrink-0"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
              </span>

              {/* Label */}
              <span
                className={cn(
                  "block leading-none transition-all duration-200",
                  isActive
                    ? "text-[10.5px] font-semibold tracking-tight"
                    : "text-[10px] font-medium",
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
