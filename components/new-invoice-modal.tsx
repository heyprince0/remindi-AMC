"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase, type Quotation } from "@/lib/supabase"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface NewInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

export function NewInvoiceModal({ open, onOpenChange, userId }: NewInvoiceModalProps) {
  const router = useRouter()
  const [acceptedQuotations, setAcceptedQuotations] = useState<Quotation[]>([])
  const [selectedQuotationId, setSelectedQuotationId] = useState("")
  const [loading, setLoading] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toISOString().split('T')[0]
  })
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState("")
  const [invoiceNotes, setInvoiceNotes] = useState("")
  const [orderNo, setOrderNo] = useState("")
  const [orderDate, setOrderDate] = useState("")

  useEffect(() => {
    if (open && userId) {
      loadData()
    }
  }, [open, userId])

  const loadData = async () => {
    setLoading(true)
    try {
      const nextNo = await generateNextInvoiceNo()
      setInvoiceNo(nextNo)

      const { data, error } = await supabase
        .from("quotations")
        .select("id, quote_no, client_name, subtotal, sgst, cgst, grand_total, include_gst, items, client_address, client_district, client_state, client_pin_code, subject, body_text")
        .eq("user_id", userId)
        .eq("status", "Accepted")
        .order("created_at", { ascending: false })

      if (error) throw error
      setAcceptedQuotations((data as Quotation[]) || [])
    } catch (err) {
      console.error(err)
      toast.error("Failed to load quotations")
    } finally {
      setLoading(false)
    }
  }

  const generateNextInvoiceNo = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_no", { count: "exact" })
        .eq("user_id", userId)
      if (error) throw error
      const count = (data?.length ?? 0) + 1
      return `INV-${String(count).padStart(3, '0')}`
    } catch (err) {
      console.error(err)
      return `INV-001`
    }
  }

  const selectedQuotation = acceptedQuotations.find(q => q.id === selectedQuotationId)

  const handleGenerateInvoice = async () => {
    if (!selectedQuotation) {
      toast.error("Please select a quotation")
      return
    }

    setGeneratingInvoice(true)
    try {
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          quotation_id: selectedQuotation.id,
          invoice_no: invoiceNo,
          order_no: orderNo || null,
          order_date: orderDate || null,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: selectedPaymentTerms,
          payment_status: "Unpaid",
          notes: invoiceNotes,
          client_name: selectedQuotation.client_name,
          client_address: selectedQuotation.client_address,
          client_district: selectedQuotation.client_district,
          client_state: selectedQuotation.client_state,
          client_pin_code: selectedQuotation.client_pin_code,
          subject: selectedQuotation.subject,
          body_text: selectedQuotation.body_text,
          items: selectedQuotation.items,
          subtotal: selectedQuotation.subtotal,
          sgst: selectedQuotation.sgst,
          cgst: selectedQuotation.cgst,
          grand_total: selectedQuotation.grand_total,
          include_gst: selectedQuotation.include_gst,
        })
        .select()
        .single()

      if (error) throw error
      toast.success("Invoice created successfully")
      onOpenChange(false)
      router.push(`/invoices/${data.id}`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to create invoice: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setGeneratingInvoice(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!generatingInvoice) {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          {selectedQuotation && (
            <p className="text-xs text-muted-foreground mt-1">From {selectedQuotation.quote_no}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : acceptedQuotations.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                No accepted quotations found. Accept a quotation first to create an invoice.
              </p>
            </div>
          ) : (
            <>
              {/* Select Quotation */}
              <div className="space-y-2">
                <Label htmlFor="quotation-select">Select Quotation</Label>
                <Select value={selectedQuotationId} onValueChange={setSelectedQuotationId}>
                  <SelectTrigger id="quotation-select">
                    <SelectValue placeholder="Select a quotation" />
                  </SelectTrigger>
                  <SelectContent>
                    {acceptedQuotations.map((qt) => (
                      <SelectItem key={qt.id} value={qt.id}>
                        {qt.quote_no} — {qt.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Number */}
              <div className="space-y-2">
                <Label htmlFor="order-no">Order Number (Optional)</Label>
                <Input
                  id="order-no"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="e.g. PO-2026-001"
                />
              </div>

              {/* Order Date */}
              <div className="space-y-2">
                <Label htmlFor="order-date">Order Date (Optional)</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              {/* Invoice Number */}
              <div className="space-y-2">
                <Label htmlFor="invoice-no">Invoice Number</Label>
                <Input
                  id="invoice-no"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="INV-001"
                />
              </div>

              {/* Invoice Date */}
              <div className="space-y-2">
                <Label htmlFor="invoice-date">Invoice Date</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Payment Terms */}
              <div className="space-y-2">
                <Label htmlFor="payment-terms">Payment Terms</Label>
                <Select value={selectedPaymentTerms} onValueChange={setSelectedPaymentTerms}>
                  <SelectTrigger id="payment-terms">
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100% advance along with work order">100% advance along with work order</SelectItem>
                    <SelectItem value="50% advance, balance on completion">50% advance, balance on completion</SelectItem>
                    <SelectItem value="Net 7 days">Net 7 days</SelectItem>
                    <SelectItem value="Net 14 days">Net 14 days</SelectItem>
                    <SelectItem value="Net 30 days">Net 30 days</SelectItem>
                    <SelectItem value="On completion">On completion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="invoice-notes">Notes (Optional)</Label>
                <Textarea
                  id="invoice-notes"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="e.g. Please transfer to bank account..."
                  className="min-h-[80px] resize-none"
                />
              </div>

              {/* Summary */}
              {selectedQuotation && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Client:</span> {selectedQuotation.client_name}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Subtotal:</span> ₹{selectedQuotation.subtotal.toLocaleString("en-IN")}
                  </p>
                  {selectedQuotation.include_gst && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">SGST 9%:</span> ₹{selectedQuotation.sgst.toLocaleString("en-IN")}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">CGST 9%:</span> ₹{selectedQuotation.cgst.toLocaleString("en-IN")}
                      </p>
                    </>
                  )}
                  <p className="text-foreground font-semibold border-t border-border pt-2">
                    Grand Total: ₹{selectedQuotation.grand_total.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {acceptedQuotations.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generatingInvoice}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInvoice}
              disabled={generatingInvoice || !selectedQuotationId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generatingInvoice ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Invoice"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
