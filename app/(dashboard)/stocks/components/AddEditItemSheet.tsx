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
import { Tag, Boxes } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface CatalogProduct {
  id: string
  org_id: string
  name: string
  description: string | null
  unit: string
  selling_price: number | null
  hsn_code: string | null
  category: string | null
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
  editingItem?: InventoryItem | null
  editingProduct?: CatalogProduct | null
  categories?: Category[]
  prefillSku?: string
  orgId: string
  onSuccess: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

type Mode = "catalog" | "inventory"

const INVENTORY_UNITS = ["piece", "kg", "liter", "meter", "box", "pack", "pair", "set"]

const CATALOG_UNITS = [
  "Piece (PCS)", "Set", "Unit", "Nos.", "Meter (m)",
  "Feet (ft)", "Kilogram (kg)", "Liter (L)", "Box",
  "Pack", "Roll", "Hour (hr)", "Day", "Job", "Visit",
]

const CATALOG_CATEGORY_SUGGESTIONS = [
  "Filters", "Labour", "Parts", "AMC", "Repair", "Installation", "Other",
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddEditItemSheet({
  open,
  onOpenChange,
  editingItem = null,
  editingProduct = null,
  categories = [],
  prefillSku,
  orgId,
  onSuccess,
}: AddEditItemSheetProps) {
  const [loading, setLoading] = useState(false)

  // Determine initial mode:
  // - editing an inventory item → lock to inventory
  // - editing a catalog product → lock to catalog
  // - new → default to catalog (Price List), user can switch
  const getInitialMode = (): Mode => {
    if (editingItem) return "inventory"
    if (editingProduct) return "catalog"
    return "catalog"
  }

  const [mode, setMode] = useState<Mode>(getInitialMode)

  // Lock mode when editing — don't let the user switch tables mid-edit
  const isEditing = !!(editingItem || editingProduct)

  // ─── Catalog form state ─────────────────────────────────────────────────

  const [catalogForm, setCatalogForm] = useState({
    name: "",
    category: "",
    unit: "Nos.",
    selling_price: "",
    hsn_code: "",
    description: "",
  })

  // ─── Inventory form state ───────────────────────────────────────────────

  const [inventoryForm, setInventoryForm] = useState({
    name: "",
    sku: "",
    category_id: "",
    brand: "",
    unit: "piece",
    purchase_price: "",
    selling_price: "",
    current_stock: "",
    min_stock_level: "",
    max_stock_level: "",
    storage_location: "",
    notes: "",
  })

  // ─── Populate forms when sheet opens ───────────────────────────────────

  useEffect(() => {
    if (!open) return

    // Reset mode based on what we're editing
    setMode(getInitialMode())

    if (editingProduct) {
      setCatalogForm({
        name: editingProduct.name,
        category: editingProduct.category ?? "",
        unit: editingProduct.unit ?? "Nos.",
        selling_price: editingProduct.selling_price?.toString() ?? "",
        hsn_code: editingProduct.hsn_code ?? "",
        description: editingProduct.description ?? "",
      })
    } else {
      setCatalogForm({
        name: "",
        category: "",
        unit: "Nos.",
        selling_price: "",
        hsn_code: "",
        description: "",
      })
    }

    if (editingItem) {
      setInventoryForm({
        name: editingItem.name,
        sku: editingItem.sku,
        category_id: editingItem.category_id ?? "",
        brand: editingItem.brand ?? "",
        unit: editingItem.unit,
        purchase_price: editingItem.purchase_price?.toString() ?? "",
        selling_price: editingItem.selling_price?.toString() ?? "",
        current_stock: editingItem.current_stock?.toString() ?? "",
        min_stock_level: editingItem.min_stock_level?.toString() ?? "",
        max_stock_level: editingItem.max_stock_level?.toString() ?? "",
        storage_location: editingItem.storage_location ?? "",
        notes: editingItem.notes ?? "",
      })
    } else {
      setInventoryForm({
        name: "",
        sku: prefillSku ?? "",
        category_id: "",
        brand: "",
        unit: "piece",
        purchase_price: "",
        selling_price: "",
        current_stock: "",
        min_stock_level: "",
        max_stock_level: "",
        storage_location: "",
        notes: "",
      })
    }
  }, [open, editingItem, editingProduct, prefillSku])

  // ─── Submit: catalog → products table ──────────────────────────────────

  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catalogForm.name.trim()) {
      toast.error("Product name is required")
      return
    }
    setLoading(true)
    try {
      const payload = {
        org_id: orgId,
        name: catalogForm.name.trim(),
        category: catalogForm.category.trim() || null,
        unit: catalogForm.unit,
        selling_price: parseFloat(catalogForm.selling_price) || null,
        hsn_code: catalogForm.hsn_code.trim() || null,
        description: catalogForm.description.trim() || null,
        is_active: true,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id)
          .eq("org_id", orgId)
        if (error) throw error
        toast.success("Product updated")
      } else {
        const { error } = await supabase.from("products").insert([payload])
        if (error) throw error
        toast.success("Product added to price list")
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error("Failed to save product")
    } finally {
      setLoading(false)
    }
  }

  // ─── Submit: inventory → inventory_items table ──────────────────────────

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inventoryForm.name.trim()) {
      toast.error("Item name is required")
      return
    }
    setLoading(true)
    try {
      const itemData = {
        org_id: orgId,
        name: inventoryForm.name.trim(),
        sku: inventoryForm.sku.trim(),
        category_id: inventoryForm.category_id || null,
        brand: inventoryForm.brand.trim() || null,
        unit: inventoryForm.unit,
        purchase_price: parseFloat(inventoryForm.purchase_price) || 0,
        selling_price: parseFloat(inventoryForm.selling_price) || 0,
        current_stock: parseFloat(inventoryForm.current_stock) || 0,
        min_stock_level: parseFloat(inventoryForm.min_stock_level) || 0,
        max_stock_level: inventoryForm.max_stock_level
          ? parseFloat(inventoryForm.max_stock_level)
          : null,
        storage_location: inventoryForm.storage_location.trim() || null,
        notes: inventoryForm.notes.trim() || null,
        is_active: true,
      }

      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update(itemData)
          .eq("id", editingItem.id)
          .eq("org_id", orgId)
        if (error) throw error
        toast.success("Item updated")
      } else {
        const { error } = await supabase.from("inventory_items").insert([itemData])
        if (error) throw error
        toast.success("Item added to inventory")
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error("Failed to save item")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = mode === "catalog" ? handleCatalogSubmit : handleInventorySubmit

  // ─── Sheet title ────────────────────────────────────────────────────────

  const title = isEditing
    ? mode === "catalog" ? "Edit Product" : "Edit Item"
    : "Add New"

  const description = isEditing
    ? mode === "catalog"
      ? "Update this product in your price list"
      : "Update this inventory item"
    : "Choose how you want to add this — price list only, or with stock tracking."

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {/* ── MODE SELECTOR (only shown when adding new) ─────────────────── */}
        {!isEditing && (
          <div className="border-b border-border px-6 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What do you want to do?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Price List button */}
              <button
                type="button"
                onClick={() => setMode("catalog")}
                className={`
                  flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all
                  ${mode === "catalog"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/60"}
                `}
              >
                <div className={`rounded-lg p-1.5 ${mode === "catalog" ? "bg-primary/10" : "bg-muted"}`}>
                  <Tag className="size-4" />
                </div>
                <span className="text-sm font-semibold leading-tight text-foreground">
                  Price List
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Just name + price. Autofills in quotations.
                </span>
              </button>

              {/* Track Stock button */}
              <button
                type="button"
                onClick={() => setMode("inventory")}
                className={`
                  flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all
                  ${mode === "inventory"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/60"}
                `}
              >
                <div className={`rounded-lg p-1.5 ${mode === "inventory" ? "bg-primary/10" : "bg-muted"}`}>
                  <Boxes className="size-4" />
                </div>
                <span className="text-sm font-semibold leading-tight text-foreground">
                  Track Stock
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Qty, low stock alerts, movements.
                </span>
              </button>
            </div>
          </div>
        )}

        <form
          id="item-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-6"
        >

          {/* ══════════════════════════════════════════════════════════════
              PRICE LIST MODE — saves to `products` table
          ══════════════════════════════════════════════════════════════ */}
          {mode === "catalog" && (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Product Details</h3>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-name">Product / Service Name *</Label>
                  <Input
                    id="catalog-name"
                    placeholder="e.g., Carbon Filter, Annual Service Visit"
                    className="rounded-lg"
                    value={catalogForm.name}
                    onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="catalog-category">Category</Label>
                    <Input
                      id="catalog-category"
                      list="category-suggestions"
                      placeholder="e.g., Filters"
                      className="rounded-lg"
                      value={catalogForm.category}
                      onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })}
                    />
                    <datalist id="category-suggestions">
                      {CATALOG_CATEGORY_SUGGESTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="catalog-unit">Unit</Label>
                    <Select
                      value={catalogForm.unit}
                      onValueChange={(val) => setCatalogForm({ ...catalogForm, unit: val })}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATALOG_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="catalog-price">Selling Price (₹)</Label>
                    <Input
                      id="catalog-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="rounded-lg"
                      value={catalogForm.selling_price}
                      onFocus={(e) => { if (e.target.value === "0") e.target.value = "" }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        setCatalogForm({ ...catalogForm, selling_price: isNaN(val) ? "" : val.toString() })
                      }}
                      onChange={(e) => setCatalogForm({ ...catalogForm, selling_price: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="catalog-hsn">
                      HSN / SAC Code{" "}
                      <span className="text-xs text-muted-foreground">(Optional)</span>
                    </Label>
                    <Input
                      id="catalog-hsn"
                      placeholder="e.g., 8414"
                      className="rounded-lg"
                      value={catalogForm.hsn_code}
                      onChange={(e) => setCatalogForm({ ...catalogForm, hsn_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="catalog-desc">
                    Description{" "}
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  </Label>
                  <Textarea
                    id="catalog-desc"
                    placeholder="Short description of this product or service..."
                    className="rounded-lg"
                    rows={3}
                    value={catalogForm.description}
                    onChange={(e) => setCatalogForm({ ...catalogForm, description: e.target.value })}
                  />
                </div>
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TRACK STOCK MODE — saves to `inventory_items` table
          ══════════════════════════════════════════════════════════════ */}
          {mode === "inventory" && (
            <div className="flex flex-col gap-6">
              {/* Basic Info */}
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Basic Info</h3>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Sediment Filter"
                    className="rounded-lg"
                    value={inventoryForm.name}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      placeholder="e.g., SF-001"
                      className="rounded-lg"
                      value={inventoryForm.sku}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, sku: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      placeholder="e.g., Kent"
                      className="rounded-lg"
                      value={inventoryForm.brand}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, brand: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={inventoryForm.category_id}
                      onValueChange={(val) => setInventoryForm({ ...inventoryForm, category_id: val })}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={inventoryForm.unit}
                      onValueChange={(val) => setInventoryForm({ ...inventoryForm, unit: val })}
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVENTORY_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Pricing & Stock */}
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Pricing &amp; Stock</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="purchase-price">Purchase Price (Rs.)</Label>
                    <Input
                      id="purchase-price"
                      type="number"
                      placeholder="0"
                      className="rounded-lg"
                      value={inventoryForm.purchase_price}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, purchase_price: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="selling-price">Selling Price (Rs.)</Label>
                    <Input
                      id="selling-price"
                      type="number"
                      placeholder="0"
                      className="rounded-lg"
                      value={inventoryForm.selling_price}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, selling_price: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="current-stock">Current Stock</Label>
                    <Input
                      id="current-stock"
                      type="number"
                      placeholder="0"
                      className="rounded-lg"
                      value={inventoryForm.current_stock}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, current_stock: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="min-stock">Minimum Stock Level</Label>
                    <Input
                      id="min-stock"
                      type="number"
                      placeholder="0"
                      className="rounded-lg"
                      value={inventoryForm.min_stock_level}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, min_stock_level: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="max-stock">Max Stock Level</Label>
                    <Input
                      id="max-stock"
                      type="number"
                      placeholder="Optional"
                      className="rounded-lg"
                      value={inventoryForm.max_stock_level}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, max_stock_level: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="location">Storage Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g., Shelf A-1"
                      className="rounded-lg"
                      value={inventoryForm.storage_location}
                      onChange={(e) => setInventoryForm({ ...inventoryForm, storage_location: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">Additional Details</h3>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this item..."
                    className="rounded-lg"
                    value={inventoryForm.notes}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </section>
            </div>
          )}
        </form>

        {/* ── Sticky footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="item-form" disabled={loading} className="rounded-lg">
            {loading
              ? "Saving..."
              : mode === "catalog"
                ? editingProduct ? "Update Product" : "Add to Price List"
                : editingItem    ? "Update Item"    : "Add to Inventory"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
