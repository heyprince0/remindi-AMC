"use client"

import { useEffect, useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  History,
  ArrowUp,
  ArrowDown,
  Package,
  Tag,
  X,
} from "lucide-react"
import { toast } from "sonner"
import StockInOutDialog from "./StockInOutDialog"
import StockHistoryDialog from "./StockHistoryDialog"

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  storage_location: string | null
  notes: string | null
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CatalogProduct {
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

type ViewMode = "inventory" | "pricelist"

interface ItemsTableProps {
  orgId: string
  onItemsChange: () => void
  onAddItem: () => void
  onEditItem: (item: InventoryItem) => void
  onEditProduct?: (product: CatalogProduct) => void
  categories: Category[]
  refreshTrigger?: number
  onStockAction?: () => boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStockStatus(current: number, min: number) {
  if (current <= 0)  return { status: "Out of Stock", color: "bg-red-500/10 text-red-600 border-red-500/20" }
  if (current <= min) return { status: "Low Stock",   color: "bg-amber-500/10 text-amber-600 border-amber-500/20" }
  return               { status: "In Stock",          color: "bg-green-500/10 text-green-600 border-green-500/20" }
}

const formatINR = (amount: number | null) =>
  `₹${(amount || 0).toLocaleString("en-IN")}`

// ─── Component ────────────────────────────────────────────────────────────────

export default function ItemsTable({
  orgId,
  onItemsChange,
  onAddItem,
  onEditItem,
  onEditProduct,
  categories,
  refreshTrigger,
  onStockAction,
}: ItemsTableProps) {

  // ── View toggle ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("inventory")

  // ── Inventory state ────────────────────────────────────────────────────────
  const [items, setItems]               = useState<InventoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [searchTerm, setSearchTerm]     = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterLocation, setFilterLocation] = useState("all")

  const [stockDialogOpen, setStockDialogOpen]   = useState(false)
  const [stockDialogMode, setStockDialogMode]   = useState<"in" | "out">("in")
  const [selectedItem, setSelectedItem]         = useState<InventoryItem | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyItem, setHistoryItem]           = useState<InventoryItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete]         = useState<InventoryItem | null>(null)
  const [deleting, setDeleting]                 = useState(false)

  // ── Price list state ───────────────────────────────────────────────────────
  const [products, setProducts]               = useState<CatalogProduct[]>([])
  const [filteredProducts, setFilteredProducts] = useState<CatalogProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch]     = useState("")
  const [productCategory, setProductCategory] = useState("all")
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null)
  const [deletingProduct, setDeletingProduct] = useState(false)

  // ─── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => { loadInventory() },  [orgId, refreshTrigger])
  useEffect(() => { loadPriceList() },  [orgId, refreshTrigger])

  const loadInventory = async () => {
    try {
      setLoadingItems(true)
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
      if (error) throw error
      setItems(data || [])
    } catch {
      toast.error("Failed to load inventory items")
    } finally {
      setLoadingItems(false)
    }
  }

  const loadPriceList = async () => {
    try {
      setLoadingProducts(true)
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      setProducts(data || [])
    } catch {
      toast.error("Failed to load price list")
    } finally {
      setLoadingProducts(false)
    }
  }

  // ─── Filters: inventory ─────────────────────────────────────────────────────

  useEffect(() => {
    let f = items
    if (searchTerm)
      f = f.filter((i) =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.sku  && i.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (i.brand && i.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    if (filterStatus !== "all")
      f = f.filter((i) => {
        const s = getStockStatus(i.current_stock, i.min_stock_level).status
        if (filterStatus === "in-stock") return s === "In Stock"
        if (filterStatus === "low")      return s === "Low Stock"
        if (filterStatus === "out")      return s === "Out of Stock"
        return true
      })
    if (filterCategory !== "all") f = f.filter((i) => i.category_id === filterCategory)
    if (filterLocation  !== "all") f = f.filter((i) => i.storage_location === filterLocation)
    setFilteredItems(f)
  }, [searchTerm, filterStatus, filterCategory, filterLocation, items])

  // ─── Filters: price list ────────────────────────────────────────────────────

  useEffect(() => {
    let f = products
    if (productSearch)
      f = f.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    if (productCategory !== "all")
      f = f.filter((p) => (p.category ?? "Uncategorised") === productCategory)
    setFilteredProducts(f)
  }, [productSearch, productCategory, products])

  const productCategories = Array.from(
    new Set(products.map((p) => p.category ?? "Uncategorised"))
  ).sort()

  // ─── Derived ────────────────────────────────────────────────────────────────

  const locations = Array.from(
    new Set(items.map((i) => i.storage_location).filter((l): l is string => !!l && l.trim() !== ""))
  ).sort()

  const hasInventoryFilters =
    searchTerm !== "" || filterStatus !== "all" || filterCategory !== "all" || filterLocation !== "all"

  const hasProductFilters = productSearch !== "" || productCategory !== "all"

  const clearInventoryFilters = () => {
    setSearchTerm(""); setFilterStatus("all"); setFilterCategory("all"); setFilterLocation("all")
  }

  const clearProductFilters = () => { setProductSearch(""); setProductCategory("all") }

  // ─── Inventory actions ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: false })
        .eq("id", itemToDelete.id)
        .eq("org_id", orgId)
      if (error) throw error
      setItems(items.filter((i) => i.id !== itemToDelete.id))
      toast.success("Item deleted")
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      onItemsChange()
    } catch {
      toast.error("Failed to delete item")
    } finally {
      setDeleting(false)
    }
  }

  const handleStockClick = (item: InventoryItem, mode: "in" | "out") => {
    if (onStockAction && onStockAction()) return
    setSelectedItem(item)
    setStockDialogMode(mode)
    setStockDialogOpen(true)
  }

  const handleHistoryClick = (item: InventoryItem) => {
    setHistoryItem(item)
    setHistoryDialogOpen(true)
  }

  const handleStockSuccess = () => { loadInventory(); onItemsChange() }

  // ─── Price list actions ─────────────────────────────────────────────────────

  const handleDeleteProduct = async () => {
    if (!productToDelete) return
    setDeletingProduct(true)
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", productToDelete.id)
        .eq("org_id", orgId)
      if (error) throw error
      setProducts(products.filter((p) => p.id !== productToDelete.id))
      toast.success("Product removed from price list")
      setDeleteProductDialogOpen(false)
      setProductToDelete(null)
    } catch {
      toast.error("Failed to delete product")
    } finally {
      setDeletingProduct(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6 overflow-x-hidden pb-24 md:pb-0">

      {/* ══════════════════════════════════════════════════════════════════════
          SEGMENT TOGGLE — Inventory / Price List
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
        <button
          type="button"
          onClick={() => setViewMode("inventory")}
          className={`
            flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
            ${viewMode === "inventory"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"}
          `}
        >
          <Package className="size-4" />
          Inventory
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
            ${viewMode === "inventory" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {items.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode("pricelist")}
          className={`
            flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
            ${viewMode === "pricelist"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"}
          `}
        >
          <Tag className="size-4" />
          Price List
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
            ${viewMode === "pricelist" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {products.length}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          INVENTORY VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "inventory" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, SKU, or brand..."
                className="h-11 pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-2 md:flex md:flex-none md:gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="in-stock">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full md:w-[130px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger className="w-full md:w-[130px]">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasInventoryFilters && (
                <Button variant="outline" size="sm" onClick={clearInventoryFilters}
                  className="shrink-0 px-2 text-muted-foreground hover:text-foreground md:px-3">
                  <X className="size-4 md:mr-1" />
                  <span className="hidden md:inline">Clear</span>
                </Button>
              )}
              <Button onClick={onAddItem} className="ml-auto hidden md:inline-flex">
                <Plus className="mr-2 size-4" />
                Add Item
              </Button>
            </div>
            {!loadingItems && (
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filteredItems.length}</span> of{" "}
                <span className="font-medium text-foreground">{items.length}</span> items
                {hasInventoryFilters && <span className="ml-1">· filtered</span>}
              </p>
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardHeader><CardTitle>Inventory Items</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingItems ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Loading inventory items...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {hasInventoryFilters ? "No items found matching filters" : "No inventory items yet"}
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.map((item) => {
                      const stockStatus = getStockStatus(item.current_stock, item.min_stock_level)
                      const category = categories.find((c) => c.id === item.category_id)
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.sku || "—"}</TableCell>
                          <TableCell className="text-sm">{item.brand || "—"}</TableCell>
                          <TableCell className="text-sm">{category?.name || "—"}</TableCell>
                          <TableCell className="text-right">{item.current_stock} {item.unit}</TableCell>
                          <TableCell>
                            <Badge className={stockStatus.color}>{stockStatus.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatINR(item.current_stock * item.purchase_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleStockClick(item, "in")}>
                                <ArrowUp className="mr-1 size-4" /> In
                              </Button>
                              <Button variant="ghost" size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleStockClick(item, "out")}>
                                <ArrowDown className="mr-1 size-4" /> Out
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onEditItem(item)}>
                                    <Edit className="mr-2 size-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleHistoryClick(item)}>
                                    <History className="mr-2 size-4" /> History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true) }}>
                                    <Trash2 className="mr-2 size-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards — inventory */}
          <div className="flex flex-col gap-4 md:hidden">
            {loadingItems ? (
              <div className="text-center py-8 text-muted-foreground">Loading inventory items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasInventoryFilters ? "No items found matching filters" : "No inventory items yet"}
              </div>
            ) : filteredItems.map((item) => {
              const stockStatus = getStockStatus(item.current_stock, item.min_stock_level)
              const category = categories.find((c) => c.id === item.category_id)
              return (
                <Card key={item.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold leading-tight break-words">
                            {item.name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {item.sku || "—"}{item.brand ? ` · ${item.brand}` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge className={stockStatus.color}>{stockStatus.status}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditItem(item)}>
                              <Edit className="mr-2 size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleHistoryClick(item)}>
                              <History className="mr-2 size-4" /> History
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true) }}>
                              <Trash2 className="mr-2 size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Current Stock</p>
                        <p className="text-lg font-bold leading-none">
                          {item.current_stock}{" "}
                          <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {category?.name && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                          <p className="text-sm font-medium">{category.name}</p>
                        </div>
                      )}
                      <div className={category?.name ? "" : "col-span-2"}>
                        <p className="text-xs text-muted-foreground mb-0.5">Selling Price</p>
                        <p className="text-sm font-medium">{formatINR(item.selling_price)}</p>
                      </div>
                      {item.storage_location && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                          <p className="text-sm font-medium">{item.storage_location}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-2.5">
                      <Button variant="outline" size="sm"
                        className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                        onClick={() => handleStockClick(item, "in")}>
                        <ArrowUp className="mr-1.5 size-4" /> Stock In
                      </Button>
                      <Button variant="outline" size="sm"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleStockClick(item, "out")}>
                        <ArrowDown className="mr-1.5 size-4" /> Stock Out
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PRICE LIST VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === "pricelist" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                className="h-11 pl-10 pr-10"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={productCategory} onValueChange={setProductCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {productCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasProductFilters && (
                <Button variant="outline" size="sm" onClick={clearProductFilters}
                  className="px-2 text-muted-foreground hover:text-foreground md:px-3">
                  <X className="size-4 md:mr-1" />
                  <span className="hidden md:inline">Clear</span>
                </Button>
              )}
              <Button onClick={onAddItem} className="ml-auto hidden md:inline-flex">
                <Plus className="mr-2 size-4" />
                Add Product
              </Button>
            </div>

            {!loadingProducts && (
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filteredProducts.length}</span> of{" "}
                <span className="font-medium text-foreground">{products.length}</span> products
                {hasProductFilters && <span className="ml-1">· filtered</span>}
              </p>
            )}
          </div>

          {/* Desktop table — price list */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Price List</CardTitle>
              <CardDescription>
                Products and services that autofill in quotations and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Selling Price</TableHead>
                      <TableHead>HSN / SAC</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Loading price list...
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Tag className="size-8 opacity-30" />
                            <p className="text-sm">
                              {hasProductFilters ? "No products match this filter" : "No products in price list yet"}
                            </p>
                            {!hasProductFilters && (
                              <p className="text-xs">Click &ldquo;Add Product&rdquo; and choose Price List to get started.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{product.category || "—"}</TableCell>
                        <TableCell className="text-sm">{product.unit || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {product.selling_price != null ? formatINR(product.selling_price) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.hsn_code || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditProduct?.(product)}>
                                <Edit className="mr-2 size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => { setProductToDelete(product); setDeleteProductDialogOpen(true) }}>
                                <Trash2 className="mr-2 size-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards — price list */}
          <div className="flex flex-col gap-3 md:hidden">
            {loadingProducts ? (
              <div className="text-center py-8 text-muted-foreground">Loading price list...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Tag className="size-8 opacity-30" />
                <p className="text-sm">
                  {hasProductFilters ? "No products match this filter" : "No products in price list yet"}
                </p>
                {!hasProductFilters && (
                  <p className="text-xs text-center px-4">
                    Tap the + button below and choose Price List to add your first product.
                  </p>
                )}
              </div>
            ) : filteredProducts.map((product) => (
              <Card key={product.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: icon + name + meta */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                        <Tag className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight break-words">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">
                            {product.description}
                          </p>
                        )}
                        {/* Category + Unit row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {product.category && (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {product.category}
                            </span>
                          )}
                          {product.unit && (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {product.unit}
                            </span>
                          )}
                          {product.hsn_code && (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              HSN: {product.hsn_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: price + menu */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-base font-bold text-foreground">
                        {product.selling_price != null ? formatINR(product.selling_price) : "—"}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 -mr-1">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditProduct?.(product)}>
                            <Edit className="mr-2 size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => { setProductToDelete(product); setDeleteProductDialogOpen(true) }}>
                            <Trash2 className="mr-2 size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FAB — Add (mobile only, works for both modes)
      ══════════════════════════════════════════════════════════════════════ */}
      <Button
        onClick={onAddItem}
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg transition-all hover:shadow-xl active:scale-95 md:hidden"
        aria-label="Add Item"
      >
        <Plus className="size-6" />
      </Button>

      {/* ── Dialogs: inventory ─────────────────────────────────────────────── */}
      <StockInOutDialog
        open={stockDialogOpen}
        onOpenChange={setStockDialogOpen}
        item={selectedItem}
        mode={stockDialogMode}
        orgId={orgId}
        onSuccess={handleStockSuccess}
      />
      <StockHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        item={historyItem}
        orgId={orgId}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{itemToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogs: price list ────────────────────────────────────────────── */}
      <AlertDialog open={deleteProductDialogOpen} onOpenChange={setDeleteProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{productToDelete?.name}&quot; from your price list? It will no longer autofill in quotations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} disabled={deletingProduct} className="bg-red-600">
              {deletingProduct ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
