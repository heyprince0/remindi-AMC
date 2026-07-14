"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { supabase, type Quotation, type CompanyProfile } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"

export default function EditQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

  // Form state
  const [clientName, setClientName] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [clientDistrict, setClientDistrict] = useState("")
  const [clientState, setClientState] = useState("")
  const [clientPinCode, setClientPinCode] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [includeGst, setIncludeGst] = useState(true)
  const [notes, setNotes] = useState("")
  const [quoteNo, setQuoteNo] = useState("")
  const [orderNo, setOrderNo] = useState("")
  const [orderDate, setOrderDate] = useState("")
  const [validTill, setValidTill] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")

  // Fetch org_id
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            toast.error("Could not determine your organization")
            router.push("/quotations")
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user, router])

  // Load data
  useEffect(() => {
    if (user?.id && id && currentOrgId) {
      loadData()
    }
  }, [id, user, currentOrgId])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", id)
        .eq("org_id", currentOrgId)
        .single()

      if (qErr) throw qErr

      const { data: pData } = await supabase
        .from("company_profile")
        .select("*")
        .eq("org_id", currentOrgId)
        .single()

      setQuotation(qData)
      if (pData) setProfile(pData)

      // Populate form fields
      setClientName(qData.client_name || "")
      setClientAddress(qData.client_address || "")
      setClientDistrict(qData.client_district || "")
      setClientState(qData.client_state || "")
      setClientPinCode(qData.client_pin_code || "")
      setSubject(qData.subject || "")
      setBodyText(qData.body_text || "")
      setItems(qData.items || [])
      setIncludeGst(qData.include_gst ?? true)
      setNotes(qData.notes || "")
      setQuoteNo(qData.quote_no || "")
      setOrderNo(qData.order_no || "")
      setOrderDate(qData.order_date || "")
      setValidTill(qData.valid_till || "")
      setPaymentTerms(qData.payment_terms || "")
    } catch (err) {
      console.error(err)
      toast.error("Failed to load quotation")
      router.push("/quotations")
    } finally {
      setLoading(false)
    }
  }

  // Item handlers
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        particulars: "",
        qty: 1,
        rate: 0,
        amount: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index][field] = value
    // Recalculate amount if qty or rate changes
    if (field === "qty" || field === "rate") {
      const qty = Number(newItems[index].qty) || 0
      const rate = Number(newItems[index].rate) || 0
      newItems[index].amount = qty * rate
    }
    setItems(newItems)
  }

  // Calculate totals (for preview)
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    const sgst = includeGst ? Math.round(subtotal * 0.09) : 0
    const cgst = includeGst ? Math.round(subtotal * 0.09) : 0
    const grandTotal = subtotal + sgst + cgst
    return { subtotal, sgst, cgst, grandTotal }
  }

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quotation || !currentOrgId) return

    const { subtotal, sgst, cgst, grandTotal } = calculateTotals()

    setSubmitting(true)
    try {
      // 1. Update the quotation
      const updateData = {
        client_name: clientName,
        client_address: clientAddress,
        client_district: clientDistrict,
        client_state: clientState,
        client_pin_code: clientPinCode,
        subject: subject,
        body_text: bodyText,
        items: items,
        include_gst: includeGst,
        notes: notes,
        order_no: orderNo || null,
        order_date: orderDate || null,
        valid_till: validTill || null,
        payment_terms: paymentTerms || null,
        subtotal,
        sgst,
        cgst,
        grand_total: grandTotal,
        updated_at: new Date().toISOString(),
      }

      const { data: updatedQuotation, error: updateError } = await supabase
        .from("quotations")
        .update(updateData)
        .eq("id", id)
        .eq("org_id", currentOrgId)
        .select() // get the updated record with invoice_id

      if (updateError) throw updateError

      toast.success("Quotation updated successfully")

      // 2. If this quotation has a linked invoice, sync it
      if (updatedQuotation?.invoice_id) {
        // Optional: only sync if invoice is not Paid
        const { data: invoice } = await supabase
          .from("invoices")
          .select("payment_status")
          .eq("id", updatedQuotation.invoice_id)
          .single()

        if (invoice && invoice.payment_status !== "Paid") {
          const { error: invoiceError } = await supabase
            .from("invoices")
            .update({
              client_name: updatedQuotation.client_name,
              client_address: updatedQuotation.client_address,
              client_district: updatedQuotation.client_district,
              client_state: updatedQuotation.client_state,
              client_pin_code: updatedQuotation.client_pin_code,
              subject: updatedQuotation.subject,
              body_text: updatedQuotation.body_text,
              items: updatedQuotation.items,
              subtotal: updatedQuotation.subtotal,
              sgst: updatedQuotation.sgst,
              cgst: updatedQuotation.cgst,
              grand_total: updatedQuotation.grand_total,
              include_gst: updatedQuotation.include_gst,
              notes: updatedQuotation.notes,
              payment_terms: updatedQuotation.payment_terms,
              // Do NOT update invoice_no, order_no, order_date, invoice_date, due_date, payment_status
            })
            .eq("id", updatedQuotation.invoice_id)

          if (invoiceError) {
            console.error("Failed to sync invoice:", invoiceError)
            toast.warning("Quotation updated, but linked invoice could not be synced")
          } else {
            toast.success("Linked invoice also updated")
          }
        } else {
          toast.info("Linked invoice is Paid, not auto-updated")
        }
      }

      // Redirect to view page
      router.push(`/quotations/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update quotation")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!quotation) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Quotation not found</p>
          <Link href="/quotations">
            <Button>Back to Quotations</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const { subtotal, sgst, cgst, grandTotal } = calculateTotals()

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/quotations/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Quotation</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quotation Details */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quoteNo">Quotation Number</Label>
                  <Input id="quoteNo" value={quoteNo} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderNo">Order Number (Optional)</Label>
                  <Input
                    id="orderNo"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="e.g. PO-2026-001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderDate">Order Date (Optional)</Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validTill">Valid Till (Optional)</Label>
                  <Input
                    id="validTill"
                    type="date"
                    value={validTill}
                    onChange={(e) => setValidTill(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms (Optional)</Label>
                <Input
                  id="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% advance, balance on delivery"
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientAddress">Client Address</Label>
                <Input
                  id="clientAddress"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientDistrict">District</Label>
                  <Input
                    id="clientDistrict"
                    value={clientDistrict}
                    onChange={(e) => setClientDistrict(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientState">State</Label>
                  <Input
                    id="clientState"
                    value={clientState}
                    onChange={(e) => setClientState(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPinCode">Pin Code</Label>
                  <Input
                    id="clientPinCode"
                    value={clientPinCode}
                    onChange={(e) => setClientPinCode(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subject & Body */}
          <Card>
            <CardHeader>
              <CardTitle>Subject & Body</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyText">Body Text</Label>
                <Textarea
                  id="bodyText"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" onClick={handleAddItem} size="sm">
                <Plus className="size-4 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No items added yet.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-end gap-3 border-b border-border pb-3">
                      <div className="flex-1">
                        <Label className="text-xs">Particulars</Label>
                        <Input
                          value={item.particulars || ""}
                          onChange={(e) => handleItemChange(index, "particulars", e.target.value)}
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, "qty", Number(e.target.value))}
                          min="1"
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Rate</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", Number(e.target.value))}
                          min="0"
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Amount</Label>
                        <Input value={item.amount || 0} disabled className="bg-muted" />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col items-end gap-1 pt-4">
                <div className="text-sm">Subtotal: ₹{subtotal.toLocaleString("en-IN")}</div>
                {includeGst && (
                  <>
                    <div className="text-sm">SGST (9%): ₹{sgst.toLocaleString("en-IN")}</div>
                    <div className="text-sm">CGST (9%): ₹{cgst.toLocaleString("en-IN")}</div>
                  </>
                )}
                <div className="text-lg font-bold">Grand Total: ₹{grandTotal.toLocaleString("en-IN")}</div>
              </div>
            </CardContent>
          </Card>

          {/* GST Toggle & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={includeGst} onCheckedChange={setIncludeGst} />
                <Label>Include GST (9% + 9%)</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Terms & Conditions / Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Enter any terms, conditions, or additional notes..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Link href={`/quotations/${id}`}>
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
