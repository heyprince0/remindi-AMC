"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"

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

import { AddContractModal } from "@/components/add-contract-modal"

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ contracts: 0, dueToday: 0, dueThisWeek: 0, customers: 0, technicians: 0 })
  const [upcomingServices, setUpcomingServices] = useState<UpcomingService[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const loadData = async () => {
    try {
      if (!user?.id) return

      // Fetch contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
      
      if (contractsError) throw contractsError

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
      
      if (customersError) throw customersError

      // Fetch technicians
      const { data: techniciansData, error: techniciansError } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
      
      if (techniciansError) throw techniciansError

      // Calculate stats
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
          // Overdue
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
    loadData()

    // Set up realtime subscriptions
    const contractsSubscription = supabase
      .channel('contracts_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contracts',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        console.log('[v0] Contract changed:', payload)
        loadData()
      })
      .subscribe()

    const customersSubscription = supabase
      .channel('customers_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        console.log('[v0] Customer changed:', payload)
        loadData()
      })
      .subscribe()

    return () => {
      contractsSubscription.unsubscribe()
      customersSubscription.unsubscribe()
    }
  }, [user?.id])

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here{"'"}s your service overview.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/customers'} title="Go to customers page">
              <Plus className="mr-2 size-4" />
              Add Customer
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/technicians'} title="Go to technicians page">
              <Plus className="mr-2 size-4" />
              Add Technician
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)} title="Add a new contract">
              <Plus className="mr-2 size-4" />
              Add Contract
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Active Contracts"
            value={stats.contracts}
            icon={FileText}
            description="Total"
          />
          <StatCard
            title="Due Today"
            value={stats.dueToday}
            icon={CalendarClock}
            description="Needs attention"
            iconClassName="bg-alert-due-today/10"
          />
          <StatCard
            title="Due This Week"
            value={stats.dueThisWeek}
            icon={CalendarCheck}
            description="Scheduled"
          />
          <StatCard
            title="Total Customers"
            value={stats.customers}
            icon={Users}
            description="All customers"
          />
          <StatCard
            title="Technicians"
            value={stats.technicians}
            icon={Wrench}
            description="Available"
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming Services */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Upcoming Services</CardTitle>
                <CardDescription>Services scheduled for the next few days</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => window.location.href = '/alerts'}>
                View All
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : upcomingServices.length > 0 ? (
                  upcomingServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-start justify-between rounded-lg border border-border bg-secondary/30 p-4"
                    >
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

          {/* Quick Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Quick Access</CardTitle>
                <CardDescription>Navigate to manage data</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/contracts'} title="View and manage contracts">
                  <FileText className="mr-2 size-4" />
                  Manage Contracts
                  <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/customers'} title="View and manage customers">
                  <Users className="mr-2 size-4" />
                  Manage Customers
                  <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/technicians'} title="View and manage technicians">
                  <Wrench className="mr-2 size-4" />
                  Manage Technicians
                  <ArrowRight className="ml-auto size-4" />
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/history'} title="View service history">
                  <Clock className="mr-2 size-4" />
                  View Service History
                  <ArrowRight className="ml-auto size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Contract Modal */}
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
