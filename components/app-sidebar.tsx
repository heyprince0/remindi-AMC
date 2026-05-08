"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Users,
  Wrench,
  Bell,
  History,
  BarChart3,
  Settings,
  FileCheck,
  Receipt,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { supabase, type Profile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Contracts", icon: FileText, href: "/contracts" },
  { title: "Quotations & Invoice", icon: FileCheck, href: "/quotations" },
  { title: "Invoices", icon: Receipt, href: "/invoices" },
  { title: "Customers", icon: Users, href: "/customers" },
  { title: "Technicians", icon: Wrench, href: "/technicians" },
  { title: "Service Alerts", icon: Bell, href: "/alerts" },
  { title: "Service History", icon: History, href: "/history" },
  { title: "Reports", icon: BarChart3, href: "/reports" },
  { title: "Settings", icon: Settings, href: "/settings" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [companyName, setCompanyName] = useState("Remindi")
  const [companySubtitle, setCompanySubtitle] = useState("")
  const [fullName, setFullName] = useState("")

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!user?.id) return

        const { data } = await supabase
          .from('profiles')
          .select('company_name, full_name')
          .eq('id', user.id)
          .single()

        if (data?.company_name) {
          const names = data.company_name.split(' ')
          setCompanyName(names[0] || "Remindi")
          setCompanySubtitle(names.slice(1).join(' ') || "")
        }
        if (data?.full_name) {
          setFullName(data.full_name)
        }
      } catch (error) {
        console.error('Error loading company name:', error)
      }
    }

    loadProfile()

    const subscription = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        const profile = payload.new as Profile
        if (profile?.company_name) {
          const names = profile.company_name.split(' ')
          setCompanyName(names[0] || "Remindi")
          setCompanySubtitle(names.slice(1).join(' ') || "")
        }
        if (profile?.full_name) {
          setFullName(profile.full_name)
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user?.id])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-sm font-bold">{companyName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">{companyName}</span>
            {companySubtitle && <span className="text-xs text-sidebar-foreground/70">{companySubtitle}</span>}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
        
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
            <span className="text-xs font-medium">
              {fullName
                ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                : user?.email?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium text-sidebar-foreground">
              {fullName || user?.email || 'User'}
            </span>
            <span className="text-xs text-sidebar-foreground/70">Administrator</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
