"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase, type Quotation } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Search, MoreHorizontal, Eye, Trash2, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "bg-slate-100", text: "text-slate-700", label: "Draft" },
    sent: { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    expired: { bg: "bg-orange-100", text: "text-orange-700", label: "Expired" },
  }
  const config = statusConfig[status] || statusConfig.draft
  return <Badge className={`${config.bg} ${config.text} border-0`}>{config.label}</Badge>
}

export default function QuotationsPage() {
  const { user } = useAuth()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    loadQuotations()
  }, [user?.id])

  const handleFilter = () => {
    let filtered = quotations

    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customer_phone?.includes(searchTerm)
      )
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(q => q.status === filterStatus)
    }

    setFilteredQuotations(filtered)
  }

  useEffect(() => {
    handleFilter()
  }, [searchTerm, filterStatus, quotations])

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this quotation?")) {
      try {
        const { error } = await supabase
          .from("quotations")
          .delete()
          .eq("id", id)

        if (error) throw error
        setQuotations(quotations.filter(q => q.id !== id))
        toast.success("Quotation deleted successfully")
      } catch (error) {
        console.error("Error deleting quotation:", error)
        toast.error("Failed to delete quotation")
      }
    }
  }

  const loadQuotations = async () => {
    try {
      if (!user?.id) return

      const { data, error } = await supabase
        .from("quotations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setQuotations((data as Quotation[]) || [])
      setFilteredQuotations((data as Quotation[]) || [])
    } catch (error) {
      console.error("Error loading quotations:", error)
      toast.error("Failed to load quotations")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
            <p className="text-muted-foreground">Create and manage customer quotations</p>
          </div>
          <Link href="/quotations/new">
            <Button>
              <Plus className="mr-2 size-4" />
              New Quotation
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by customer name, phone, or quotation number..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Quotations Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Quotations</CardTitle>
            <CardDescription>
              You have {filteredQuotations.length} quotations {filterStatus !== "all" ? "matching filters" : "in total"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading quotations...</div>
            ) : filteredQuotations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {quotations.length === 0 ? "No quotations yet. Create your first quotation!" : "No quotations matching your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotations.map((quotation) => (
                      <TableRow key={quotation.id}>
                        <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                        <TableCell>{quotation.customer_name}</TableCell>
                        <TableCell>{quotation.customer_phone || "—"}</TableCell>
                        <TableCell>{formatCurrency(quotation.total_amount)}</TableCell>
                        <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                        <TableCell>
                          {new Date(quotation.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/quotations/${quotation.id}`} className="cursor-pointer">
                                  <Eye className="mr-2 size-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/quotations/${quotation.id}/edit`} className="cursor-pointer">
                                  <FileText className="mr-2 size-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(quotation.id)}
                                className="text-red-600 cursor-pointer"
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
