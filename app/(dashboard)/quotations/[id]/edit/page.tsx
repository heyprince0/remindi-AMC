"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { supabase, type Quotation, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { Loader2, Trash2, Plus } from "lucide-react"

interface Item {
  id?: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export default function EditQuotationPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [formData, setFormData] = useState({
    quoteNo: "",
    clientName: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientPinCode: "",
    clientGstin: "",
    clientDistrict: "",
    subject: "",
    notes: "",
    validTill: "",
    includeGst: true,
    gstRate: 18,
  })

  // Fetch org_id
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.org_id) {
            setOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  // Load quotation and company profile
  useEffect(() => {
    if (orgId && id) {
      loadData()
    }
  }, [orgId, id])

  const loadData = async () => {
    try {
      setLoading(true)
      // Fetch quotation
      const { data: qData, error: qError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .single()

      if (qError) throw qError
      if (!qData) {
        toast.error("Quotation not found")
        router.push("/quotations")
        return
      }

      setQuotation(qData)
      setFormData({
        quoteNo: qData.quote_no || "",
        clientName: qData.client_name || "",
        clientAddress: qData.client_address || "",
        clientCity: qData.client_city || "",
        clientState: qData.client_state || "",
        clientPinCode: qData.client_pin_code || "",
        clientGstin: qData.client_gstin || "",
        clientDistrict: qData.client_district || "",
        subject: qData.subject || "",
        notes: qData.notes || "",
        validTill: qData.valid_till || "",
        includeGst: qData.include_gst ?? true,
        gstRate: qData.gst_rate || 18,
      })

      // Parse items
      if (qData.items) {
        const parsedItems = Array.isArray(qData.items)
          ? qData.items
          : typeof qData.items === "string"
          ? JSON.parse(qData.items)
          : []
        setItems(parsedItems.map((item: any, index: number) => ({
          id: item.id || `item-${index}`,
          description: item.particulars || item.description || "",
          quantity: Number(item.qty || item.quantity || 1),
          rate: Number(item.rate || item.unit_price || 0),
          amount: Number(item.amount || 0),
        })))
      } else {
        setItems([])
      }

      // Fetch company profile
      const { data: pData } = await supabase
        .from("company_profile")
        .select("*")
        .eq("org_id", orgId)
        .single()
      if (pData) setProfile(pData)

    } catch (error) {
      console.error("Error loading quotation:", error)
      toast.error("Failed to load quotation")
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (index: number, field: keyof Item, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    // Recalculate amount
    if (field === "quantity" || field === "rate") {
      const qty = Number(updated[index].quantity) || 0
      const rate = Number(updated[index].rate) || 0
      updated[index].amount = qty * rate
    }
    setItems(updated)
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: `item-${Date.now()}`, description: "", quantity: 1, rate: 0, amount: 0 },
    ])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, i) => sum + (i.amount || 0), 0)
    const gst = formData.includeGst ? (subtotal * (formData.gstRate / 100)) / 2 : 0
    return {
      subtotal,
      sgst: gst,
      cgst: gst,
      grandTotal: subtotal + (formData.includeGst ? subtotal * (formData.gstRate / 100) : 0),
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !user?.id) return

    // Validate
    if (!formData.clientName.trim()) {
      toast.error("Client name is required")
      return
    }
    if (!formData.quoteNo.trim()) {
      toast.error("Quote number is required")
      return
    }
    if (items.length === 0) {
      toast.error("Add at least one item")
      return
    }

    setSaving(true)
    try {
      const { subtotal, sgst, cgst, grandTotal } = calculateTotals()
      const payload = {
        quote_no: formData.quoteNo,
        client_name: formData.clientName,
        client_address: formData.clientAddress || null,
        client_city: formData.clientCity || null,
        client_state: formData.clientState || null,
        client_pin_code: formData.clientPinCode || null,
        client_gstin: formData.clientGstin || null,
        client_district: formData.clientDistrict || null,
        subject: formData.subject || null,
        notes: formData.notes || null,
        valid_till: formData.validTill || null,
        include_gst: formData.includeGst,
        gst_rate: formData.gstRate,
        items: items.map(i => ({
          particulars: i.description,
          qty: i.quantity,
          rate: i.rate,
          amount: i.amount,
        })),
        subtotal,
        sgst,
        cgst,
        grand_total: grandTotal,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("quotations")
        .update(payload)
        .eq("id", id)
        .eq("org_id", orgId)

      if (error) throw error

      toast.success("Quotation updated successfully")
      router.push(`/quotations/${id}`)
    } catch (error) {
      console.error("Error updating quotation:", error)
      toast.error("Failed to update quotation")
    } finally {
      setSaving(false)
    }
  }

  const totals = calculateTotals()

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Quotation</h1>
            <p className="text-muted-foreground">{formData.quoteNo || "No number"}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/quotations/${id}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quote Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quoteNo">Quote Number *</Label>
                <Input
                  id="quoteNo"
                  value={formData.quoteNo}
                  onChange={(e) => setFormData({ ...formData, quoteNo: e.target.value })}
                  placeholder="Q-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTill">Valid Till</Label>
                <Input
                  id="validTill"
                  type="date"
                  value={formData.validTill}
                  onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="AC Service Quotation"
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Details */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clientAddress">Address</Label>
                <Input
                  id="clientAddress"
                  value={formData.clientAddress}
                  onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientCity">City</Label>
                <Input
                  id="clientCity"
                  value={formData.clientCity}
                  onChange={(e) => setFormData({ ...formData, clientCity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientState">State</Label>
                <Input
                  id="clientState"
                  value={formData.clientState}
                  onChange={(e) => setFormData({ ...formData, clientState: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPinCode">Pin Code</Label>
                <Input
                  id="clientPinCode"
                  value={formData.clientPinCode}
                  onChange={(e) => setFormData({ ...formData, clientPinCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientDistrict">District</Label>
                <Input
                  id="clientDistrict"
                  value={formData.clientDistrict}
                  onChange={(e) => setFormData({ ...formData, clientDistrict: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientGstin">GSTIN</Label>
                <Input
                  id="clientGstin"
                  value={formData.clientGstin}
                  onChange={(e) => setFormData({ ...formData, clientGstin: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 size-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No items added</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.id || index} className="flex flex-wrap gap-3 items-end p-3 border rounded-lg">
                      <div className="flex-1 min-w-[150px] space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          placeholder="Service description"
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs">Rate (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", Number(e.target.value))}
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input
                          type="text"
                          value={item.amount.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* GST and Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Tax & Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeGst"
                  checked={formData.includeGst}
                  onCheckedChange={(checked) => setFormData({ ...formData, includeGst: !!checked })}
                />
                <Label htmlFor="includeGst">Include GST (18%)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-bold">₹{totals.subtotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SGST (9%)</p>
                  <p className="text-lg font-bold">₹{totals.sgst.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CGST (9%)</p>
                  <p className="text-lg font-bold">₹{totals.cgst.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grand Total</p>
                  <p className="text-lg font-bold text-blue-600">₹{totals.grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes / Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Terms & conditions, delivery schedule, etc."
              />
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  )
}
