"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase, type Contract, type Customer, type Technician, getDaysUntilService, getAuthUser } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import {
  FileText,
  Users,
  Wrench,
  CalendarClock,
  CalendarCheck,
  Plus,
  ArrowRight,
  Clock,
  Bell,
} from "lucide-react"
import { AddContractModal } from "@/components/add-contract-modal"
import { subscribeToNotifications } from "@/lib/push-notifications"
import { toast } from "sonner"

interface UpcomingService {
  id: string
  customer: string
  service: string
  date: string
  time: string
  technician: string | null
  status: "due-today" | "upcoming" | "overdue"
}

function getStatusBadge(status: string) {
  switch (status) {
    case "due-today":
      return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Due Today</Badge>
    case "upcoming":
      return <Badge className="bg-alert-upcoming/10 text-alert-upcoming border-alert-upcoming/20">Upcoming</Badge>
    case "overdue":
      return <Badge className="bg-alert-overdue/10 text-alert-overdue border-alert-overdue/20">Overdue</Badge>
    default:
      return null
  }
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({ contracts: 0, dueToday: 0, dueThisWeek: 0, customers: 0, technicians: 0 })
  const [upcomingServices, setUpcomingServices] = useState<UpcomingService[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)

  const handleEnableNotifications = async () => {
    if (!user?.id) {
      toast.error('User not found')
      return
    }

    setNotificationLoading(true)
    const result = await subscribeToNotifications(user.id)
    
    if (result.success) {
      toast.success('Notifications enabled successfully!')
    } else {
      toast.error(result.error || 'Failed to enable notifications')
    }
    
    setNotificationLoading(false)
  }

  // ✅ AUTH CHECK
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/landing.html'
    }
  }, [user, authLoading])

  const loadData = async () => {
    try {
      if (!user?.id) return

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
      if (contractsError) throw contractsError

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
      if (customersError) throw customersError

      const { data: techniciansData, error: techniciansError } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
      if (techniciansError) throw techniciansError

      const activeContracts = (contractsData as Contract[]).filter(c => c.status === 'active').length
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)

      let dueToday = 0
      let dueThisWeek = 0
      const services: UpcomingService[] = []

      for (const contract of (contractsData as Contract[]) || []) {
        const customer = (customersData as Customer[])?.find(c => c.id === contract.customer_id)
        const days = getDaysUntilService(contract.next_service_date)

        if (days < 0) {
          services.push({
            id: contract.id,
            customer: customer?.name || 'Unknown',
            service: contract.contract_name,
            date: 'Overdue',
            time: '',
            technician: null,
            status: 'overdue'
          })
        } else if (days === 0) {
          dueToday++
          services.push({
            id: contract.id,
            customer: customer?.name || 'Unknown',
            service: contract.contract_name,
            date: 'Today',
            time: '',
            technician: null,
            status: 'due-today'
          })
        } else if (days <= 7) {
          dueThisWeek++
          services.push({
            id: contract.id,
            customer: customer?.name || 'Unknown',
            service: contract.contract_name,
            date: new Date(contract.next_service_date).toLocaleDateString(),
            time: '',
            technician: null,
            status: 'upcoming'
          })
        }
      }

      setStats({
        contracts: activeContracts,
        dueToday,
        dueThisWeek,
        customers: (customersData as Customer[])?.length || 0,
        technicians: (techniciansData as Technician[])?.length || 0,
      })

      setUpcomingServices(services.slice(0, 4))
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    loadData()

    const contractsSubscription = supabase
      .channel('contracts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${user?.id}` }, () => loadData())
      .subscribe()

    const customersSubscription = supabase
      .channel('customers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `user_id=eq.${user?.id}` }, () => loadData())
      .subscribe()

    const techniciansSubscription = supabase
      .channel('technicians_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians', filter: `user_id=eq.${user?.id}` }, () => loadData())
      .subscribe()

    return () => {
      contractsSubscription.unsubscribe()
      customersSubscription.unsubscribe()
      techniciansSubscription.unsubscribe()
    }
  }, [user?.id])

  // Show spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Don't render while redirecting to landing
  if (!user) return null

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here{"'"}s your service overview.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleEnableNotifications}
              disabled={notificationLoading}
            >
              <Bell className="mr-2 size-4" />
              {notificationLoading ? 'Enabling...' : 'Enable Notifications'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/customers'}>
              <Plus className="mr-2 size-4" />
              Add Customer
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/technicians'}>
              <Plus className="mr-2 size-4" />
              Add Technician
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add Contract
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Active Contracts" value={stats.contracts} icon={FileText} description="Total" />
          <StatCard title="Due Today" value={stats.dueToday} icon={CalendarClock} description="Needs attention" iconClassName="bg-alert-due-today/10" />
          <StatCard title="Due This Week" value={stats.dueThisWeek} icon={CalendarCheck} description="Scheduled" />
          <StatCard title="Total Customers" value={stats.customers} icon={Users} description="All customers" />
          <StatCard title="Technicians" value={stats.technicians} icon={Wrench} description="Available" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Upcoming Services</CardTitle>
                <CardDescription>Services scheduled for the next few days</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => window.location.href = '/alerts'}>
                View All <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : upcomingServices.length > 0 ? (
                  upcomingServices.map((service) => (
                    <div key={service.id} className="flex items-start justify-between rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-card-foreground">{service.customer}</span>
                        <span className="text-sm text-muted-foreground">{service.service}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{service.date} {service.time}</span>
                        </div>
                      </div>
                      {getStatusBadge(service.status)}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No upcoming services</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Access</CardTitle>
              <CardDescription>Navigate to manage data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/contracts'}>
                  <FileText className="mr-2 size-4" /> Manage Contracts <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/customers'}>
                  <Users className="mr-2 size-4" /> Manage Customers <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/technicians'}>
                  <Wrench className="mr-2 size-4" /> Manage Technicians <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/history'}>
                  <Clock className="mr-2 size-4" /> View Service History <ArrowRight className="ml-auto size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {user && (
          <AddContractModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={loadData}
            editingContract={null}
            userId={user.id}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
