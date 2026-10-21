"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit3, Loader2, Package, Plus, Power, Search } from "lucide-react"
import { toast } from "sonner"

type Product = {
  id: string
  org_id: string
  name: string
  description: string | null
  unit: string
  selling_price: number
  hsn_code: string | null
  category: string | null
  is_active: boolean
}

const units = ["PCS", "Set", "Unit", "Nos.", "m", "ft", "kg", "L", "Box", "Pack", "Roll", "hr", "Day", "Job", "Visit"]
const categorySuggestions = ["Filters", "Labour", "Parts", "AMC", "Repair", "Installation", "Other"]
const emptyForm = { name: "", category: "", unit: "PCS", selling_price: "0", hsn_code: "", description: "", is_active: true }

export default function ProductsPage() {
  const { user } = useAuth()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadProducts = async (nextOrgId = orgId) => {
    if (!nextOrgId) return
    setLoading(true)
    const { data, error } = await supabase.from("products").select("id, org_id, name, description, unit, selling_price, hsn_code, category, is_active").eq("org_id", nextOrgId).order("name", { ascending: true })
    if (error) toast.error("Could not load products")
    else setProducts((data ?? []) as Product[])
    setLoading(false)
  }

  useEffect(() => {
    if (!user?.id) return
    supabase.from("memberships").select("org_id").eq("user_id", user.id).single().then(({ data, error }) => {
      if (error || !data?.org_id) {
        toast.error("Could not determine your organization")
        setLoading(false)
        return
      }
      setOrgId(data.org_id)
      loadProducts(data.org_id)
    })
  }, [user?.id])

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort() as string[], [products])
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === "all" || product.category === category
    return matchesSearch && matchesCategory && (!activeOnly || product.is_active)
  }), [products, search, category, activeOnly])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({ name: product.name, category: product.category ?? "", unit: product.unit, selling_price: String(product.selling_price ?? 0), hsn_code: product.hsn_code ?? "", description: product.description ?? "", is_active: product.is_active })
    setDialogOpen(true)
  }

  const saveProduct = async () => {
    if (!orgId || !form.name.trim()) { toast.error("Product or service name is required"); return }
    setSaving(true)
    const payload = { name: form.name.trim(), category: form.category.trim() || null, unit: form.unit, selling_price: Number.parseFloat(form.selling_price) || 0, hsn_code: form.hsn_code.trim() || null, description: form.description.trim() || null, is_active: form.is_active }
    const result = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id).eq("org_id", orgId)
      : await supabase.from("products").insert({ ...payload, org_id: orgId })
    setSaving(false)
    if (result.error) { toast.error(editing ? "Could not update product" : "Could not add product"); return }
    toast.success(editing ? "Product updated" : "Product added")
    setDialogOpen(false)
    await loadProducts()
  }

  const toggleProduct = async (product: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id).eq("org_id", orgId)
    if (error) toast.error("Could not update product status")
    else { toast.success(product.is_active ? "Product deactivated" : "Product activated"); await loadProducts() }
  }

  const setField = (field: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }))
  const formatPrice = (price: number) => `₹${Number(price || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package aria-hidden="true" /></div>
            <div><h1 className="text-2xl font-bold tracking-tight">My Products</h1><p className="text-sm text-muted-foreground">Manage your product and service catalog. These autofill in quotations and invoices.</p></div>
          </div>
          <Button onClick={openAdd}><Plus data-icon="inline-start" />Add Product</Button>
        </header>

        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Product catalog</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="pl-9" aria-label="Search products" /></div>
              <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full md:w-52" aria-label="Filter by category"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"><Checkbox checked={activeOnly} onCheckedChange={(checked) => setActiveOnly(checked === true)} />Show active only</label>
            </div>
            <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Price (₹)</TableHead><TableHead>HSN Code</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
              {loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}>{Array.from({ length: 7 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-5 w-full max-w-28" /></TableCell>)}</TableRow>) : filteredProducts.length === 0 ? <TableRow><TableCell colSpan={7} className="h-56 text-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><Package className="size-9" /><p>No products yet. Add your first product.</p></div></TableCell></TableRow> : filteredProducts.map((product) => <TableRow key={product.id}><TableCell className="font-medium">{product.name}</TableCell><TableCell>{product.category || "—"}</TableCell><TableCell>{product.unit}</TableCell><TableCell>{formatPrice(product.selling_price)}</TableCell><TableCell>{product.hsn_code || "—"}</TableCell><TableCell><Badge variant={product.is_active ? "default" : "secondary"}>{product.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}><Edit3 /></Button><Button variant="ghost" size="icon" onClick={() => toggleProduct(product)} aria-label={`${product.is_active ? "Deactivate" : "Activate"} ${product.name}`}><Power /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle><DialogDescription>{editing ? "Update the details in your catalog." : "Add a reusable product or service to your catalog."}</DialogDescription></DialogHeader><div className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2"><Label htmlFor="product-name">Product / Service Name*</Label><Input id="product-name" value={form.name} onChange={(event) => setField("name", event.target.value)} required /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="product-category">Category</Label><Input id="product-category" list="product-categories" value={form.category} onChange={(event) => setField("category", event.target.value)} /><datalist id="product-categories">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label htmlFor="product-unit">Unit</Label><Select value={form.unit} onValueChange={(value) => setField("unit", value)}><SelectTrigger id="product-unit"><SelectValue /></SelectTrigger><SelectContent>{units.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-col gap-2"><Label htmlFor="selling-price">Selling Price ₹</Label><Input id="selling-price" type="number" step="0.01" value={form.selling_price} onFocus={(event) => { event.currentTarget.value = "" }} onBlur={(event) => setField("selling_price", String(Number.parseFloat(event.currentTarget.value) || 0))} onChange={(event) => setField("selling_price", event.target.value)} /></div></div>
        <div className="flex flex-col gap-2"><Label htmlFor="hsn-code">HSN / SAC Code</Label><Input id="hsn-code" placeholder="e.g. 8414" value={form.hsn_code} onChange={(event) => setField("hsn_code", event.target.value)} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="description">Description</Label><Textarea id="description" placeholder="Short description of this product" value={form.description} onChange={(event) => setField("description", event.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_active} onCheckedChange={(checked) => setField("is_active", checked === true)} />Active</label>
      </div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={saveProduct} disabled={saving}>{saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}{editing ? "Update Product" : "Save Product"}</Button></DialogFooter></DialogContent></Dialog>
    </DashboardLayout>
  )
}
