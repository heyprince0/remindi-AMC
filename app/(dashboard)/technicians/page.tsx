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
import { supabase, type Technician } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Search, MoreHorizontal, Eye, Edit, Phone, Briefcase, Trash2 } from "lucide-react"
import { toast } from "sonner"

function getStatusBadge(status: string) {
  switch (status) {
    case "available":
      return <Badge className="bg-alert-success/10 text-alert-success border-alert-success/20">Available</Badge>
    case "busy":
      return <Badge className="bg-alert-due-today/10 text-alert-due-today border-alert-due-today/20">Busy</Badge>
    case "on-leave":
      return <Badge className="bg-muted text-muted-foreground border-muted">On Leave</Badge>
    default:
      return null
  }
}

export default function TechniciansPage() {
  const { user } = useAuth()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [filteredTechnicians, setFilteredTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        if (!user?.id) return

        const { data, error } = await supabase
          .from('technicians')
          .select('*')
          .eq('user_id', user.id)

        if (error) throw error
        setTechnicians(data as Technician[])
        setFilteredTechnicians(data as Technician[])
      } catch (error) {
        console.error('Error loading technicians:', error)
        toast.error('Failed to load technicians')
      } finally {
        setLoading(false)
      }
    }

    loadTechnicians()
  }, [user?.id])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    const filtered = technicians.filter(t =>
      t.name.toLowerCase().includes(term.toLowerCase()) ||
      t.phone.includes(term)
    )
    setFilteredTechnicians(filtered)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this technician?')) {
      try {
        const { error } = await supabase
          .from('technicians')
          .delete()
          .eq('id', id)

        if (error) throw error
        setTechnicians(technicians.filter(t => t.id !== id))
        toast.success('Technician deleted successfully')
      } catch (error) {
        console.error('Error deleting technician:', error)
        toast.error('Failed to delete technician')
      }
    }
  }
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Technicians</h1>
            <p className="text-muted-foreground">Manage your service technicians and their assignments</p>
          </div>
          <Button onClick={() => window.location.href = '/technicians?action=add'}>
            <Plus className="mr-2 size-4" />
            Add Technician
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search technicians by name or phone..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Technicians Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">Loading technicians...</div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="text-center py-8 col-span-full text-muted-foreground">
              {searchTerm ? 'No technicians found matching your search' : 'No technicians yet'}
            </div>
          ) : (
            filteredTechnicians.map((tech) => (
              <Card key={tech.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <span className="text-sm font-semibold">
                          {tech.name.split(" ").map((n) => n[0]).join("")}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base">{tech.name}</CardTitle>
                        <CardDescription className="text-xs">{tech.specialization?.[0] || 'No specialization'}</CardDescription>
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
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 size-4" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(tech.id)} className="text-red-600">
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
                    <span>{tech.phone}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(tech.specialization) ? (
                      tech.specialization.map((spec) => (
                        <Badge key={spec} variant="outline" className="text-xs font-normal">
                          {spec}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal">
                        {tech.specialization}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Status: </span>
                    </div>
                    {getStatusBadge(tech.status)}
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
