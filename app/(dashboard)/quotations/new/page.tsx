"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import ProductAutocompleteInput from "@/components/ProductAutocompleteInput"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase, type Quotation, type QuotationItem } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Trash2, Save, ArrowLeft, Loader2, Percent, Search, X } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

// ─── types ───────────────────────────────────────────────────────────────────

interface CustomerRecord {
  id: string
  name: string
  phone: string | null
  address: string | null
}

// ─── constants ───────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  "Piece (PCS)", "Set", "Unit", "Nos.", "Meter (m)",
  "Feet (ft)", "Kilogram (kg)", "Liter (L)", "Box",
  "Pack", "Roll", "Hour (hr)", "Day", "Job", "Visit"
]

// ─── CustomerAutocomplete ─────────────────────────────────────────────────────
// Drop-in replacement for the customer name Input that shows a suggestion list
// and fills address / district / state / pin_code when a customer is selected.

interface CustomerAutocompleteProps {
  value: string
  onChange: (name: string) => void
  onSelect: (customer: CustomerRecord) => void
  onClear: () => void
  orgId: string | null
  selectedId: string | null
}

function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  onClear,
  orgId,
  selectedId,
}: CustomerAutocompleteProps) {
  const [results, setResults] = useState<CustomerRecord[]>([])
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const search = async (query: string) => {
    if (!orgId || query.trim().length < 1) {
      setResults([])
      setOpen(false)
      return
    }
    setFetching(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("org_id", orgId)
        .ilike("name", `%${query.trim()}%`)
        .order("name", { ascending: true })
        .limit(8)

      if (error) throw error
      setResults((data as CustomerRecord[]) ?? [])
      setOpen(true)
    } catch {
      // silent — user can still type manually
    } finally {
      setFetching(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 220)
  }

  const handleSelect = (customer: CustomerRecord) => {
    onSelect(customer)
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          id="customer-name"
          value={value}
          onChange={handleChange}
          onFocus={() => value.trim().length >= 1 && results.length > 0 && setOpen(true)}
          placeholder="Type customer name to search…"
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {(value || selectedId) && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
              className="flex flex-col w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <span className="font-medium text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground mt-0.5 truncate">
                {c.address || c.phone || "—"}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !fetching && results.length === 0 && value.trim().length >= 1 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2.5 text-sm text-muted-foreground">
          No customers found — you can still type the name manually.
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewQuotationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)

  // customer fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerDistrict, setCustomerDistrict] = useState("")
  const [customerState, setCustomerState] = useState("")
  const [customerPinCode, setCustomerPinCode] = useState("")

  const [orderNo, setOrderNo] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyText, setBodyText] = useState("")

  const [items, setItems] = useState<any[]>([
    { id: "1", description: "", quantity: 1, unit: "Nos.", unit_price: 0, amount: 0 },
  ])
  const [includeGst, setIncludeGst] = useState(true)
  const [gstRate, setGstRate] = useState(18)
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage")
  const [discountValue, setDiscountValue] = useState(0)
  const [notes, setNotes] = useState("")

  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  // org_id
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to fetch organization:", error)
            toast.error("Could not determine your organization")
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  // Auto-generate order number
  useEffect(() => {
    if (!currentOrgId) return
    const generate = async () => {
      try {
        const { data, error } = await supabase
          .from("quotations")
          .select("order_no")
          .eq("org_id", currentOrgId)
          .not("order_no", "is", null)
          .like("order_no", "ORD-%")
        if (error) throw error
        let maxNum = 0
        data?.forEach((q) => {
          const match = q.order_no?.match(/ORD-(\d+)/i)
          if (match) {
            const n = parseInt(match[1], 10)
            if (!isNaN(n) && n > maxNum) maxNum = n
          }
        })
        setOrderNo(`ORD-${String(maxNum + 1).padStart(3, "0")}`)
      } catch {
        setOrderNo("ORD-001")
      }
    }
    generate()
  }, [currentOrgId])

  // ── autofill handler ──────────────────────────────────────────────────────
  // Fills address from the customers table, then looks up district / state /
  // pin_code from the most recent quotation or invoice for that customer name.
  const handleCustomerSelect = async (customer: CustomerRecord) => {
    setSelectedCustomerId(customer.id)
    setCustomerName(customer.name)
    setCustomerAddress(customer.address ?? "")
    // Reset location fields while we fetch
    setCustomerDistrict("")
    setCustomerState("")
    setCustomerPinCode("")

    if (!currentOrgId) return

    // 1. Check quotations first (most recent 5, pick first with any location data)
    const { data: prevQuotes } = await supabase
      .from("quotations")
      .select("client_district, client_state, client_pin_code")
      .eq("org_id", currentOrgId)
      .eq("client_name", customer.name)
      .order("created_at", { ascending: false })
      .limit(5)

    const fromQuote = prevQuotes?.find(
      (q) => q.client_district || q.client_state || q.client_pin_code
    )

    if (fromQuote) {
      setCustomerDistrict(fromQuote.client_district ?? "")
      setCustomerState(fromQuote.client_state ?? "")
      setCustomerPinCode(fromQuote.client_pin_code ?? "")
      return
    }

    // 2. Fall back to invoices if no quotation had location data
    const { data: prevInvoices } = await supabase
      .from("invoices")
      .select("client_district, client_state, client_pin_code")
      .eq("org_id", currentOrgId)
      .eq("client_name", customer.name)
      .order("created_at", { ascending: false })
      .limit(5)

    const fromInvoice = prevInvoices?.find(
      (i) => i.client_district || i.client_state || i.client_pin_code
    )

    if (fromInvoice) {
      setCustomerDistrict(fromInvoice.client_district ?? "")
      setCustomerState(fromInvoice.client_state ?? "")
      setCustomerPinCode(fromInvoice.client_pin_code ?? "")
    }
  }

  const handleCustomerClear = () => {
    setSelectedCustomerId(null)
    setCustomerName("")
    setCustomerAddress("")
    setCustomerDistrict("")
    setCustomerState("")
    setCustomerPinCode("")
    // Note: district/state/pin still cleared so user can re-pick a different customer
  }

  // ── totals ────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const discountAmount = Math.min(
    subtotal,
    Math.max(0, discountType === "percentage"
      ? subtotal * (Number(discountValue) || 0) / 100
      : Number(discountValue) || 0)
  )
  const discountedSubtotal = subtotal - discountAmount
  const gstAmount = includeGst ? Math.round(discountedSubtotal * (Number(gstRate ?? 18) / 100)) : 0
  const total = discountedSubtotal + gstAmount

  // ── item helpers ──────────────────────────────────────────────────────────
  const handleAddItem = () => {
    const newId = String(Math.max(...items.map(i => parseInt(i.id) || 0), 0) + 1)
    setItems([...items, { id: newId, description: "", quantity: 1, unit: "Nos.", unit_price: 0, amount: 0 }])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id))
    else toast.error("You must have at least one item")
  }

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      if (field === "quantity" || field === "unit_price") {
        updated.amount = (updated.quantity || 0) * (updated.unit_price || 0)
      }
      return updated
    }))
  }

  const handleProductSelect = (
    itemId: string,
    product: { description: string; unit: string; unit_price: number }
  ) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        description: product.description,
        unit: product.unit,
        unit_price: product.unit_price,
        amount: (item.quantity || 1) * product.unit_price,
      }
    }))
  }

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id || !currentOrgId) return
    if (!customerName.trim()) { toast.error("Please enter customer name"); return }
    if (items.some(item => !item.description.trim() || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error("Please fill in all item details")
      return
    }

    setSaving(true)
    try {
      const { data: existingQuotes, error: countError } = await supabase
        .from("quotations")
        .select("quote_no", { count: "exact" })
        .eq("org_id", currentOrgId)
      if (countError) throw countError

      const nextNumber = ((existingQuotes?.length || 0) + 1).toString().padStart(3, "0")
      const quoteNo = `QT-${nextNumber}`

      const calcSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)), 0)
      const calcDiscount = Math.min(
        calcSubtotal,
        Math.max(0, discountType === "percentage"
          ? calcSubtotal * (Number(discountValue) || 0) / 100
          : Number(discountValue) || 0)
      )
      const discountedSub = calcSubtotal - calcDiscount
      const sgst = includeGst ? Math.round(discountedSub * 0.09) : 0
      const cgst = includeGst ? Math.round(discountedSub * 0.09) : 0
      const grandTotal = discountedSub + sgst + cgst

      const { data, error } = await supabase
        .from("quotations")
        .insert({
          user_id: user.id,
          org_id: currentOrgId,
          quote_no: quoteNo,
          order_no: orderNo || null,
          client_name: customerName,
          client_address: customerAddress,
          client_district: customerDistrict,
          client_state: customerState,
          client_pin_code: customerPinCode,
          client_city: "",
          client_gstin: "",
          subject,
          body_text: bodyText,
          items,
          subtotal: calcSubtotal,
          discount_type: discountType,
          discount_value: Number(discountValue) || 0,
          discount_amount: calcDiscount,
          sgst,
          cgst,
          grand_total: grandTotal,
          include_gst: includeGst,
          gst_rate: includeGst ? 18 : 0,
          notes,
          status: "Draft",
          valid_till: null,
        })
        .select()

      if (error) throw error
      const newId = data?.[0]?.id
      if (!newId) throw new Error("Failed to get quotation ID")
      toast.success("Quotation created successfully")
      router.push(`/quotations/${newId}`)
    } catch (error) {
      console.error("Error saving quotation:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save quotation")
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="outline" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create Quotation</h1>
            <p className="text-muted-foreground">Prepare a new quotation for your customer</p>
          </div>
        </div>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>
              Search an existing customer to auto-fill their details, or type manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* ── Customer name autocomplete ── */}
            <div className="space-y-2">
              <Label htmlFor="customer-name">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <CustomerAutocomplete
                value={customerName}
                onChange={setCustomerName}
                onSelect={handleCustomerSelect}
                onClear={handleCustomerClear}
                orgId={currentOrgId}
                selectedId={selectedCustomerId}
              />
              {selectedCustomerId && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  ✓ Customer details auto-filled from your records
                </p>
              )}
            </div>

            {/* ── Order number ── */}
            <div className="space-y-2">
              <Label htmlFor="order-no">
                Order Number{" "}
                <span className="text-xs text-muted-foreground">(Auto-generated, editable)</span>
              </Label>
              <Input
                id="order-no"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="e.g. ORD-001"
              />
            </div>

            {/* ── Address ── */}
            <div className="space-y-2">
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Street / building address"
                rows={2}
              />
            </div>

            {/* ── District · State · Pin Code ── */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="customer-district">District</Label>
                <Input
                  id="customer-district"
                  value={customerDistrict}
                  onChange={(e) => setCustomerDistrict(e.target.value)}
                  placeholder="District"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-state">State</Label>
                <Input
                  id="customer-state"
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-pin-code">Pin Code</Label>
                <Input
                  id="customer-pin-code"
                  value={customerPinCode}
                  onChange={(e) => setCustomerPinCode(e.target.value)}
                  placeholder="Pin Code"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Subject and Letter Body */}
        <Card>
          <CardHeader>
            <CardTitle>Letter Details</CardTitle>
            <CardDescription>Add subject and letter body for this quotation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Regarding AC AMC works at above mention place"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-text">Letter Body</Label>
              <Textarea
                id="body-text"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="e.g. Respected Sir/Madam, As per discussion held with you, regarding following works…"
                rows={4}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setBodyText(bodyText + (bodyText ? "\n" : "") + "Respected Sir/Madam,")}
                >
                  "Respected Sir/Madam,"
                </Button>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => setBodyText(bodyText + (bodyText ? "\n" : "") + "As per discussion held with you, regarding following works at above mention place. Details are given as below;")}
                >
                  "As per discussion…"
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>Add services or products to this quotation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`desc-${item.id}`} className="text-xs">Description</Label>
                  <ProductAutocompleteInput
                    id={`desc-${item.id}`}
                    value={item.description}
                    orgId={currentOrgId}
                    onChange={(val) => handleItemChange(item.id, "description", val)}
                    onProductSelect={(product) => handleProductSelect(item.id, product)}
                  />
                </div>
                <div className="w-20 space-y-2">
                  <Label htmlFor={`qty-${item.id}`} className="text-xs">Qty</Label>
                  <Input
                    id={`qty-${item.id}`}
                    type="number" min="1"
                    value={item.quantity}
                    onFocus={(e) => { e.target.value = '' }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value)
                      handleItemChange(item.id, "quantity", isNaN(val) || val <= 0 ? 1 : val)
                    }}
                    onChange={(e) => handleItemChange(item.id, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-28 space-y-2">
                  <Label htmlFor={`unit-${item.id}`} className="text-xs">Unit</Label>
                  <Select
                    value={item.unit || "Nos."}
                    onValueChange={(val) => handleItemChange(item.id, "unit", val)}
                  >
                    <SelectTrigger id={`unit-${item.id}`} className="h-10">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor={`price-${item.id}`} className="text-xs">Unit Price (₹)</Label>
                  <Input
                    id={`price-${item.id}`}
                    type="number" min="0" step="0.01"
                    value={item.unit_price}
                    onFocus={(e) => { e.target.value = '' }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value)
                      handleItemChange(item.id, "unit_price", isNaN(val) ? 0 : val)
                    }}
                    onChange={(e) => handleItemChange(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor={`amount-${item.id}`} className="text-xs">Amount (₹)</Label>
                  <div className="h-10 flex items-center px-3 bg-secondary rounded-md text-sm font-medium">
                    {item.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="flex items-end justify-end sm:justify-start">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={handleAddItem} className="w-full">
              <Plus className="mr-2 size-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 border-b border-border pb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-muted-foreground shrink-0" />
                  <Label className="text-sm text-muted-foreground shrink-0">Discount</Label>
                  <Select value={discountType} onValueChange={(val) => setDiscountType(val as "percentage" | "fixed")}>
                    <SelectTrigger className="h-9 w-[104px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">₹ Amount</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min="0" step="0.01"
                    value={discountValue}
                    onFocus={(e) => { e.target.value = '' }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value)
                      setDiscountValue(isNaN(val) || val < 0 ? 0 : val)
                    }}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder={discountType === "percentage" ? "0" : "0.00"}
                    className="h-9 w-28"
                  />
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm pl-6">
                    <span className="text-muted-foreground">Discount Amount:</span>
                    <span className="font-medium text-red-600">
                      − ₹{discountAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="include-gst"
                  checked={includeGst}
                  onCheckedChange={(checked) => setIncludeGst(checked as boolean)}
                />
                <Label htmlFor="include-gst" className="text-sm cursor-pointer">
                  Include GST ({gstRate}%)
                </Label>
              </div>
              {includeGst && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">GST Amount:</span>
                  <span className="font-medium">₹{gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
            <CardDescription>Add any additional terms or conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes or terms…"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link href="/quotations">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Create Quotation
              </>
            )}
          </Button>
        </div>

      </div>
    </DashboardLayout>
  )
}
