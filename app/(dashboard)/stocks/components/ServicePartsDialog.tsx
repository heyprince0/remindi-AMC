"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InventoryItem {
  id: string
  name: string
  current_stock: number
  unit: string
}

interface PartUsed {
  item_id: string
  quantity: number
}

interface ServicePartsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceHistoryId: string | null
  technicianId: string | null
  contractId: string | null
  orgId: string
  onSuccess: () => void
}

export default function ServicePartsDialog({
  open,
  onOpenChange,
  serviceHistoryId,
  technicianId,
  contractId,
  orgId,
  onSuccess,
}: ServicePartsDialogProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [selectedParts, setSelectedParts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      loadItems()
      setSelectedParts(new Map())
      setError("")
    }
  }, [open, orgId])

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, current_stock, unit")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error("Error loading items:", error)
      toast.error("Failed to load inventory items")
    }
  }

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      selectedParts.delete(itemId)
      setSelectedParts(new Map(selectedParts))
    } else {
      selectedParts.set(itemId, quantity)
      setSelectedParts(new Map(selectedParts))
    }
  }

  const handleSubmit = async () => {
    if (!serviceHistoryId || !technicianId) {
      setError("Service history ID and technician ID are required")
      return
    }

    if (selectedParts.size === 0) {
      setError("Please select at least one part to use")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Prepare parts data for the RPC
      const partsData = Array.from(selectedParts.entries()).map(([item_id, quantity]) => ({
        item_id,
        quantity,
      }))

      // Call the deduct_stock_for_service RPC
      const { error: rpcError } = await supabase.rpc("deduct_stock_for_service", {
        p_org_id: orgId,
        p_service_history_id: serviceHistoryId,
        p_technician_id: technicianId,
        p_parts: partsData,
      })

      if (rpcError) throw rpcError

      toast.success(`${selectedParts.size} part(s) recorded for this service`)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error recording parts:", error)
      setError("Failed to record parts used. Please try again.")
      toast.error("Failed to record parts used")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Parts Used</DialogTitle>
          <DialogDescription>
            Select and record which parts were used during this service
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Use</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead className="text-right">Stock Available</TableHead>
                <TableHead className="text-right">Quantity Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No inventory items available
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isSelected = selectedParts.has(item.id)
                  const quantity = selectedParts.get(item.id) || 0

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              selectedParts.delete(item.id)
                              setSelectedParts(new Map(selectedParts))
                            } else {
                              selectedParts.set(item.id, 1)
                              setSelectedParts(new Map(selectedParts))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right text-sm">
                        {item.current_stock} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelected && (
                          <Input
                            type="number"
                            min="1"
                            max={item.current_stock}
                            value={quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-20"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedParts.size > 0 && (
            <p>Selected {selectedParts.size} part(s) to record</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedParts.size === 0}>
            {loading ? "Recording..." : "Record Parts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
