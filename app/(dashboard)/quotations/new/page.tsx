"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase, type Quotation, type QuotationItem } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Plus, Trash2, Save, ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function NewQuotationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [items, setItems] = useState<QuotationItem[]>([
    { id: "1", description: "", quantity: 1, unit_price: 0, amount: 0 },
  ])
  const [includeGst, setIncludeGst] = useState(true)
  const [gstRate, setGstRate] = useState(18)
  const [notes, setNotes] = useState("")

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const gstAmount = includeGst ? (subtotal * gstRate) / 100 : 0
  const total = subtotal + gstAmount

  const handleAddItem = () => {
    const newId = String(Math.max(...items.map(i => parseInt(i.id) || 0), 0) + 1)
    setItems([...items, { id: newId, description: "", quantity: 1, unit_price: 0, amount: 0 }])
  }

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id))
    } else {
      toast.error("You must have at least one item")
    }
  }

  const handleItemChange = (id: string, field: keyof QuotationItem, value: any) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === "quantity" || field === "unit_price") {
          updated.amount = (updated.quantity || 0) * (updated.unit_price || 0)
        }
        return updated
      }
      return item
    })
    setItems(updatedItems)
  }

  const handleSave = async () => {
    if (!user?.id) return

    // Validation
    if (!customerName.trim()) {
      toast.error("Please enter customer name")
      return
    }

    if (items.some(item => !item.description.trim() || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error("Please fill in all item details")
      return
    }

    setSaving(true)
    try {
      // Generate quote_no: QT-001, QT-002, etc.
      const { data: existingQuotes, error: countError } = await supabase
        .from("quotations")
        .select("quote_no", { count: "exact" })
        .eq("user_id", user.id)

      if (countError) throw countError

      const nextNumber = ((existingQuotes?.length || 0) + 1).toString().padStart(3, "0")
      const quoteNo = `QT-${nextNumber}`

      // Calculate grand_total: subtotal + SGST + CGST
      const calculatedSubtotal = (items ?? []).reduce((sum, item) => {
        return sum + (Number(item.qty ?? item.quantity ?? 0) * Number(item.rate ?? item.unit_price ?? 0))
      }, 0)
      const sgst = includeGst ? calculatedSubtotal * 0.09 : 0
      const cgst = includeGst ? calculatedSubtotal * 0.09 : 0
      const grandTotal = calculatedSubtotal + sgst + cgst

      const { data, error } = await supabase
        .from("quotations")
        .insert({
          user_id: user.id,
          quote_no: quoteNo,
          client_name: customerName,
          client_address: customerAddress,
          client_city: "",
          client_gstin: "",
          subject: "",
          items: items,
          subtotal: calculatedSubtotal,
          sgst: sgst,
          cgst: cgst,
          grand_total: grandTotal,
          include_gst: includeGst,
          notes: notes,
          status: "Draft",
          valid_till: null,
        })
        .select()

      if (error) throw error
      
      const newQuotationId = data?.[0]?.id
      if (!newQuotationId) throw new Error("Failed to get quotation ID")

      toast.success("Quotation created successfully")
      router.push(`/quotations/${newQuotationId}`)
    } catch (error) {
      console.error("Error saving quotation:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save quotation")
    } finally {
      setSaving(false)
    }
  }

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
            <CardDescription>Enter the customer details for this quotation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name*</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter customer address"
                rows={3}
              />
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
            {items.map((item, index) => (
              <div key={item.id} className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`desc-${item.id}`} className="text-xs">
                    Description
                  </Label>
                  <Input
                    id={`desc-${item.id}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                    placeholder="Service or product description"
                  />
                </div>
                <div className="w-20 space-y-2">
                  <Label htmlFor={`qty-${item.id}`} className="text-xs">
                    Qty
                  </Label>
                  <Input
                    id={`qty-${item.id}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, "quantity", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor={`price-${item.id}`} className="text-xs">
                    Unit Price (₹)
                  </Label>
                  <Input
                    id={`price-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label htmlFor={`amount-${item.id}`} className="text-xs">
                    Amount (₹)
                  </Label>
                  <div className="h-10 flex items-center px-3 bg-secondary rounded-md text-sm font-medium">
                    {item.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full"
            >
              <Plus className="mr-2 size-4" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 border-b border-border pb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
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

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>Add any additional terms or conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes or terms..."
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
                Creating...
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
