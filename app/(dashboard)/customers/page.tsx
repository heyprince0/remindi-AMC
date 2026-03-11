"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase, type Customer, type Contract } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Search, MoreHorizontal, Eye, Edit, Phone, MapPin, FileText, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<(Customer & { contractCount: number })[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<(Customer & { contractCount: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        if (!user?.id) return

        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', user.id)

        if (customersError) throw customersError

        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*')
          .eq('user_id', user.id)

        const customersWithContracts = (customersData as Customer[]).map(customer => {
          const contractCount = (contractsData as Contract[])?.filter(c => c.customer_id === customer.id).length || 0
          return {
            ...customer,
            contractCount
          }
        })

        setCustomers(customersWithContracts)
        setFilteredCustomers(customersWithContracts)
      } catch (error) {
        console.error('Error loading customers:', error)
        toast.error('Failed to load customers')
      } finally {
        setLoading(false)
      }
    }

    loadCustomers()
  }, [user?.id])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(term.toLowerCase()) ||
      c.phone.includes(term) ||
      (c.email && c.email.toLowerCase().includes(term.toLowerCase()))
    )
    setFilteredCustomers(filtered)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id)

        if (error) throw error
        setCustomers(customers.filter(c => c.id !== id))
        toast.success('Customer deleted successfully')
      } catch (error) {
        console.error('Error deleting customer:', error)
        toast.error('Failed to delete customer')
      }
    }
  }
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their contact information</p>
          </div>
          <Button onClick={() => window.location.href = '/customers?action=add'}>
            <Plus className="mr-2 size-4" />
            Add Customer
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customers by name, email, or phone..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">
              {searchTerm ? 'No customers found matching your search' : 'No customers yet'}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <Card key={customer.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-lg font-semibold text-primary">
                          {customer.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{customer.name}</CardTitle>
                        <CardDescription className="text-xs">{customer.email || 'No email'}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 size-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 size-4" />
                          Edit Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(customer.id)} className="text-red-600">
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{customer.contractCount}</span>
                      <span className="text-muted-foreground">contracts</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
