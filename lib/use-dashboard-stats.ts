import { useEffect, useState } from 'react'
import { supabase, type Contract, type Customer, type Technician, getDaysUntilService } from './supabase'

export interface DashboardStats {
  contracts: number
  dueToday: number
  dueThisWeek: number
  customers: number
  technicians: number
}

export interface UpcomingService {
  id: string
  customer: string
  service: string
  date: string
  time: string
  technician: string | null
  status: "due-today" | "upcoming" | "overdue"
}

export function useDashboardStats(userId: string | undefined, refreshTrigger?: number) {
  const [stats, setStats] = useState<DashboardStats>({
    contracts: 0,
    dueToday: 0,
    dueThisWeek: 0,
    customers: 0,
    technicians: 0,
  })
  const [upcomingServices, setUpcomingServices] = useState<UpcomingService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!userId) return

        // Fetch contracts
        const { data: contractsData, error: contractsError } = await supabase
          .from('contracts')
          .select('*')
          .eq('user_id', userId)
        
        if (contractsError) throw contractsError

        // Fetch customers
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', userId)
        
        if (customersError) throw customersError

        // Fetch technicians
        const { data: techniciansData, error: techniciansError } = await supabase
          .from('technicians')
          .select('*')
          .eq('user_id', userId)
        
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

    loadData()
  }, [userId, refreshTrigger])

  return { stats, upcomingServices, loading }
}
