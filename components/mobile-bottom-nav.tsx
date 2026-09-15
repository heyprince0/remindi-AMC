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
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "bg-background/90 backdrop-blur-xl",
        "border-t border-border/50",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-1px_24px_rgba(0,0,0,0.07)]",
      )}
    >
      <div className="flex h-16 w-full items-center">
        {navigationItems.map(({ href, label, icon: Icon }) => {
          const isActive = isActiveRoute(pathname, href)

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center h-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                "transition-colors duration-150",
              )}
            >
              {/* Pill wraps icon — expands softly on active */}
              <span
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-200 ease-out",
                  isActive
                    ? "bg-primary/10 px-3 py-1.5"
                    : "px-3 py-1.5",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 transition-all duration-200",
                    isActive
                      ? "size-[19px] text-primary"
                      : "size-[19px] text-muted-foreground",
                  )}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />

                {/* Label only renders for active item */}
                <span
                  className={cn(
                    "overflow-hidden transition-all duration-200 ease-out leading-none text-primary font-semibold tracking-tight",
                    isActive
                      ? "max-h-4 opacity-100 text-[9.5px]"
                      : "max-h-0 opacity-0 text-[9.5px]",
                  )}
                >
                  {label}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
