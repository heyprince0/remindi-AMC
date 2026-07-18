"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface InventoryItem {
  id: string
  org_id: string
  name: string
  sku: string
  category_id: string | null
  brand: string | null
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
  min_stock_level: number
  max_stock_level: number | null
  storage_location: string | null
  notes: string | null
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Category {
  id: string
  name: string
}

interface AddEditItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: InventoryItem | null
  categories: Category[]
  orgId: string
  onSuccess: () => void
}

const UNITS = ["piece", "kg", "liter", "meter", "box", "pack", "pair", "set"]

export default function AddEditItemSheet({
  open,
  onOpenChange,
  editingItem,
  categories,
  orgId,
  onSuccess,
}: AddEditItemSheetProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category_id: "",
    brand: "",
    unit: "piece",
    purchase_price: 0,
    selling_price: 0,
    current_stock: 0,
    min_stock_level: 0,
    max_stock_level: "",
    storage_location: "",
    notes: "",
  })

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name,
        sku: editingItem.sku,
        category_id: editingItem.category_id || "",
        brand: editingItem.brand || "",
        unit: editingItem.unit,
        purchase_price: editingItem.purchase_price,
        selling_price: editingItem.selling_price,
        current_stock: editingItem.current_stock,
        min_stock_level: editingItem.min_stock_level,
        max_stock_level: editingItem.max_stock_level?.toString() || "",
        storage_location: editingItem.storage_location || "",
        notes: editingItem.notes || "",
      })
    } else {
      setFormData({
        name: "",
        sku: "",
        category_id: "",
        brand: "",
        unit: "piece",
        purchase_price: 0,
        selling_price: 0,
        current_stock: 0,
        min_stock_level: 0,
        max_stock_level: "",
        storage_location: "",
        notes: "",
      })
    }
  }, [editingItem, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.name.trim()) {
        toast.error("Item name is required")
        return
      }

      const itemData = {
        org_id: orgId,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        category_id: formData.category_id || null,
        brand: formData.brand.trim() || null,
        unit: formData.unit,
        purchase_price: parseFloat(String(formData.purchase_price)) || 0,
        selling_price: parseFloat(String(formData.selling_price)) || 0,
        current_stock: parseFloat(String(formData.current_stock)) || 0,
        min_stock_level: parseFloat(String(formData.min_stock_level)) || 0,
        max_stock_level: formData.max_stock_level ? parseFloat(formData.max_stock_level) : null,
        storage_location: formData.storage_location.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: true,
      }

      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update(itemData)
          .eq("id", editingItem.id)
          .eq("org_id", orgId)

        if (error) throw error
        toast.success("Item updated successfully")
      } else {
        const { error } = await supabase
          .from("inventory_items")
          .insert([itemData])

        if (error) throw error
        toast.success("Item created successfully")
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error saving item:", error)
      toast.error("Failed to save item")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-screen overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingItem ? "Edit Item" : "Add New Item"}</SheetTitle>
          <SheetDescription>
            {editingItem ? "Update item details" : "Create a new inventory item"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Sediment Filter"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              placeholder="e.g., SF-001"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category_id} onValueChange={(val) => setFormData({ ...formData, category_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              placeholder="e.g., Kent"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
          </div>

          {/* Unit */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit">Unit</Label>
            <Select value={formData.unit} onValueChange={(val) => setFormData({ ...formData, unit: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Purchase Price */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchase-price">Purchase Price (Rs.)</Label>
            <Input
              id="purchase-price"
              type="number"
              placeholder="0"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Selling Price */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="selling-price">Selling Price (Rs.)</Label>
            <Input
              id="selling-price"
              type="number"
              placeholder="0"
              value={formData.selling_price}
              onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Current Stock */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-stock">Current Stock</Label>
            <Input
              id="current-stock"
              type="number"
              placeholder="0"
              value={formData.current_stock}
              onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Min Stock Level */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="min-stock">Minimum Stock Level</Label>
            <Input
              id="min-stock"
              type="number"
              placeholder="0"
              value={formData.min_stock_level}
              onChange={(e) => setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Max Stock Level */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-stock">Maximum Stock Level (optional)</Label>
            <Input
              id="max-stock"
              type="number"
              placeholder="0"
              value={formData.max_stock_level}
              onChange={(e) => setFormData({ ...formData, max_stock_level: e.target.value })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Storage Location */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Storage Location</Label>
            <Input
              id="location"
              placeholder="e.g., Shelf A-1"
              value={formData.storage_location}
              onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this item..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="mt-4">
            {loading ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
