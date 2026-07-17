"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  UsersRound,
  LogOut,
  CreditCard,
  UserCircle,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase, type Profile, signOut } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

const memberNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Contracts", icon: FileText, href: "/contracts" },
  { title: "Quotations", icon: FileCheck, href: "/quotations" },
  { title: "Invoices", icon: Receipt, href: "/invoices" },
  { title: "Customers", icon: Users, href: "/customers" },
  { title: "Technicians", icon: Wrench, href: "/technicians" },
  { title: "Service Alerts", icon: Bell, href: "/alerts" },
  { title: "Service History", icon: History, href: "/history" },
  { title: "Reports", icon: BarChart3, href: "/reports" },
]

const adminOnlyNavItems = [
  { title: "Settings", icon: Settings, href: "/settings" },
  { title: "Team", icon: UsersRound, href: "/team" },
  { title: "Billing", icon: CreditCard, href: "/billing" },
]

const technicianNavItems = [
  { title: "Contracts", icon: FileText, href: "/contracts" },
  { title: "Service Alerts", icon: Bell, href: "/alerts" },
  { title: "Service History", icon: History, href: "/history" },
]

interface UnclaimedTechnician {
  id: string
  name: string
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, role, loading } = useAuth()

  const [companyName, setCompanyName] = useState("Remindi")
  const [companySubtitle, setCompanySubtitle] = useState("")
  const [fullName, setFullName] = useState("")

  // --- My Work linking state (technician role only) ---
  const [linkedTechnicianId, setLinkedTechnicianId] = useState<string | null>(null)
  const [linkedTechnicianName, setLinkedTechnicianName] = useState<string | null>(null)
  const [checkingLink, setCheckingLink] = useState(false)
  const [selectModalOpen, setSelectModalOpen] = useState(false)
  const [unclaimed, setUnclaimed] = useState<UnclaimedTechnician[]>([])
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  // Load company profile for display
  useEffect(() => {
    const loadProfile = async () => {
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
      if (data?.full_name) setFullName(data.full_name)
    }
    loadProfile()
  }, [user?.id])

  // Look up whether this technician-role login is already linked to a technician record
  useEffect(() => {
    const checkLink = async () => {
      if (!user?.id || role !== 'technician') return
      setCheckingLink(true)
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name')
        .eq('linked_user_id', user.id)
        .maybeSingle()
      if (!error && data?.id) {
        setLinkedTechnicianId(data.id)
        setLinkedTechnicianName(data.name)
      }
      setCheckingLink(false)
    }
    checkLink()
  }, [user?.id, role])

  const openSelectModal = async () => {
    if (!user?.id) return
    setLoadingUnclaimed(true)
    setSelectModalOpen(true)
    try {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .single()

      if (!membership?.org_id) {
        toast.error('Could not determine your organization')
        setLoadingUnclaimed(false)
        return
      }

      const { data: techs, error } = await supabase
        .from('technicians')
        .select('id, name')
        .eq('org_id', membership.org_id)
        .is('linked_user_id', null)

      if (error) throw error
      setUnclaimed((techs as UnclaimedTechnician[]) || [])
    } catch (error) {
      console.error('Failed to load technician list:', error)
      toast.error('Failed to load technician list')
    } finally {
      setLoadingUnclaimed(false)
    }
  }

  const handleClaim = async (techId: string, techName: string) => {
    if (!user?.id) return
    setClaiming(techId)
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ linked_user_id: user.id })
        .eq('id', techId)
        .is('linked_user_id', null)

      if (error) throw error

      setLinkedTechnicianId(techId)
      setLinkedTechnicianName(techName)
      setSelectModalOpen(false)
      router.push(`/technicians/${techId}`)
    } catch (error) {
      console.error('Failed to link technician profile:', error)
      toast.error('Failed to link your profile — it may have just been claimed by someone else')
    } finally {
      setClaiming(null)
    }
  }

  const handleMyWorkClick = () => {
    if (linkedTechnicianId) {
      router.push(`/technicians/${linkedTechnicianId}`)
    } else {
      openSelectModal()
    }
  }

  // Combine nav items based on role
  let navItems
  if (role === 'admin') {
    navItems = [...memberNavItems, ...adminOnlyNavItems]
  } else if (role === 'technician') {
    navItems = technicianNavItems
  } else {
    navItems = memberNavItems // fallback for members or unknown
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to logout')
    }
  }

  if (loading) {
    return <div className="w-16 md:w-64 h-screen animate-pulse bg-muted/20" />
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-sm font-bold">{companyName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">{companyName}</span>
            {companySubtitle && (
              <span className="text-xs text-sidebar-foreground/70">{companySubtitle}</span>
            )}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* My Work — technician role only, rendered first */}
              {role === 'technician' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!!linkedTechnicianId && pathname === `/technicians/${linkedTechnicianId}`}
                    tooltip="My Work"
                    onClick={handleMyWorkClick}
                    disabled={checkingLink}
                  >
                    <UserCircle className="size-4" />
                    <span>{linkedTechnicianName || 'My Work'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

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
            <span className="text-xs text-sidebar-foreground/70">
              {role === 'admin' ? 'Administrator' : role === 'technician' ? 'Technician' : 'Member'}
            </span>
          </div>
        </div>

        {/* Logout button – for members and technicians */}
        {(role === 'member' || role === 'technician') && (
          <div className="group-data-[collapsible=icon]:hidden">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </SidebarFooter>

      {/* First-time technician selection modal */}
      <Dialog open={selectModalOpen} onOpenChange={setSelectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select your name</DialogTitle>
            <DialogDescription>
              Choose your name from the technician list to link your account. You'll only need to do this once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {loadingUnclaimed ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : unclaimed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No technician profile found for you yet. Ask your admin to add you as a technician first.
              </p>
            ) : (
              unclaimed.map((tech) => (
                <Button
                  key={tech.id}
                  variant="outline"
                  className="justify-start"
                  disabled={claiming !== null}
                  onClick={() => handleClaim(tech.id, tech.name)}
                >
                  {claiming === tech.id ? 'Linking...' : tech.name}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
