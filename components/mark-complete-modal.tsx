"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase, type Contract, type Technician } from "@/lib/supabase"
import { toast } from "sonner"

interface MarkCompleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: Contract | null
  userId: string
  orgId: string
  customerId?: string
  onSuccess: () => void
}

export function MarkCompleteModal({
  open,
  onOpenChange,
  contract,
  userId,
  orgId,
  customerId,
  onSuccess,
}: MarkCompleteModalProps) {
  const [serviceDate, setServiceDate] = useState("")
  const [technicianId, setTechnicianId] = useState("")
  const [notes, setNotes] = useState("")
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTechs, setLoadingTechs] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerHasPhone, setCustomerHasPhone] = useState(false)

  useEffect(() => {
    if (open) {
      loadTechnicians()
      loadCustomerPreview()
      const today = new Date().toISOString().split("T")[0]
      setServiceDate(today)
      setNotes("")
      setTechnicianId("")
    }
  }, [open])

  const loadCustomerPreview = async () => {
    try {
      if (!contract?.customer_id) return
      const { data, error } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", contract.customer_id)
        .single()

      if (error) throw error
      setCustomerName(data?.name || "")
      setCustomerHasPhone(!!data?.phone)
    } catch (error) {
      console.error("Error loading customer preview:", error)
    }
  }

  const loadTechnicians = async () => {
    try {
      setLoadingTechs(true)
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("org_id", orgId)

      if (error) throw error
      setTechnicians(data || [])
    } catch (error) {
      console.error("Error loading technicians:", error)
      toast.error("Failed to load technicians")
    } finally {
      setLoadingTechs(false)
    }
  }

  const handleConfirm = async () => {
    try {
      if (!contract || !serviceDate) {
        toast.error("Please select a service date")
        return
      }

      setLoading(true)

      const { error: historyError } = await supabase
        .from("service_history")
        .insert({
          contract_id: contract.id,
          technician_id: technicianId || null,
          service_date: serviceDate,
          status: "completed",
          notes: notes || null,
          org_id: orgId,
        })

      if (historyError) throw historyError

      const serviceDateObj = new Date(serviceDate)
      const nextServiceDate = new Date(serviceDateObj)
      nextServiceDate.setDate(nextServiceDate.getDate() + contract.frequency_days)

      const { error: contractError } = await supabase
        .from("contracts")
        .update({
          next_service_date: nextServiceDate.toISOString().split("T")[0],
          status: "active",
        })
        .eq("id", contract.id)
        .eq("org_id", orgId)

      if (contractError) throw contractError

      // Step 3: Send WhatsApp notification (fire-and-forget)
      try {
        const [customerData, technicianData, companyData] = await Promise.all([
          supabase.from("customers").select("*").eq("id", contract.customer_id).single(),
          technicianId
            ? supabase.from("technicians").select("*").eq("id", technicianId).single()
            : Promise.resolve({ data: null }),
          supabase.from("company_profile").select("*").eq("org_id", orgId).single(),
        ])

        const customer = customerData.data
        const technician = technicianData.data
        const company = companyData.data

        if (customer?.phone) {
          const nextServiceDateStr = nextServiceDate.toISOString().split("T")[0]

          await fetch("/api/notify-service-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyName: company?.company_name?.toUpperCase() || "",
              customerName: customer.name || "",
              customerPhone: customer.phone,
              contractName: contract.contract_name || "",
              technicianName: technician?.name || "",
              serviceDate: serviceDate,
              nextServiceDate: nextServiceDateStr,
              companyPhone: company?.phone || "",
              companyEmail: company?.email || "",
            }),
          })
        }
      } catch (error) {
        console.error("Error sending WhatsApp notification:", error)
      }

      toast.success("Service marked as complete!")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error marking service complete:", error)
      toast.error("Failed to mark service as complete")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Service as Complete</DialogTitle>
          <DialogDescription>
            Record the completion details for this service
          </DialogDescription>
        </DialogHeader>

        {customerHasPhone && customerName && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
            <svg
              viewBox="0 0 24 24"
              className="size-4 shrink-0 fill-green-600"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.79 14.02c-.24.68-1.4 1.3-1.93 1.35-.5.05-1 .27-3.38-.7-2.86-1.18-4.68-4.06-4.82-4.25-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07.99-2.35.26-.28.56-.35.75-.35.19 0 .38 0 .54.01.18.01.41-.07.64.49.24.58.81 2 .88 2.15.07.15.11.32.02.51-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.61-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.63-.14.26.1 1.65.78 1.94.92.28.14.47.21.54.33.07.12.07.66-.17 1.29Z" />
            </svg>
            <p className="text-xs text-green-800">
              This update will be sent to <span className="font-medium">{customerName}</span> on WhatsApp
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-date">Service Date *</Label>
            <Input
              id="service-date"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="technician">Technician</Label>
            <Select value={technicianId} onValueChange={setTechnicianId} disabled={loadingTechs}>
              <SelectTrigger id="technician">
                <SelectValue placeholder={loadingTechs ? "Loading..." : "Select technician (optional)"} />
              </SelectTrigger>
              <SelectContent>
                {technicians.length === 0 ? (
                  <SelectItem value="none">No technician</SelectItem>
                ) : (
                  technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this service..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
