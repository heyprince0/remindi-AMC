"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { Search } from "lucide-react"
import { toast } from "sonner"

interface StockMovement {
  id: string
  org_id: string
  item_id: string
  movement_type: "in" | "out"
  quantity: number
  reason: string
  reference_type: string | null
  reference_id: string | null
  supplier_id: string | null
  technician_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

interface InventoryItem {
  id: string
  name: string
}

interface StockMovementsTableProps {
  orgId: string
}

export default function StockMovementsTable({ orgId }: StockMovementsTableProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterReason, setFilterReason] = useState("all")

  useEffect(() => {
    loadData()
  }, [orgId])

  const loadData = async () => {
    try {
      setLoading(true)

      const [movementsRes, itemsRes] = await Promise.all([
        supabase
          .from("inventory_stock_movements")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("inventory_items")
          .select("id, name")
          .eq("org_id", orgId),
      ])

      if (movementsRes.error) throw movementsRes.error
      if (itemsRes.error) throw itemsRes.error

      setMovements(movementsRes.data || [])
      setItems(itemsRes.data || [])
    } catch (error) {
      console.error("Error loading stock movements:", error)
      toast.error("Failed to load stock movements")
    } finally {
      setLoading(false)
    }
  }

  const getItemName = (itemId: string) => {
    return items.find((i) => i.id === itemId)?.name || "Unknown Item"
  }

  const filteredMovements = movements.filter((movement) => {
    const itemName = getItemName(movement.item_id).toLowerCase()
    const matchesSearch = itemName.includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || movement.movement_type === filterType
    const matchesReason = filterReason === "all" || movement.reason === filterReason

    return matchesSearch && matchesType && matchesReason
  })

  const uniqueReasons = Array.from(
    new Set(movements.map((m) => m.reason).filter(Boolean))
  ).sort()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Movements</CardTitle>
        <CardDescription>Complete audit ledger of all inventory movements</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center flex-wrap">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search items..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="in">Stock In</SelectItem>
                <SelectItem value="out">Stock Out</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterReason} onValueChange={setFilterReason}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {uniqueReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading stock movements...
                  </TableCell>
                </TableRow>
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm || filterType !== "all" || filterReason !== "all"
                      ? "No movements found matching filters"
                      : "No stock movements recorded"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(movement.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{getItemName(movement.item_id)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          movement.movement_type === "in"
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                        }
                      >
                        {movement.movement_type === "in" ? "In" : "Out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {movement.movement_type === "in" ? "+" : "-"}
                      {movement.quantity}
                    </TableCell>
                    <TableCell className="text-sm">{movement.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {movement.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
