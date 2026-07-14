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

  useEffect(() => {
    if (open) {
      loadTechnicians()
      const today = new Date().toISOString().split("T")[0]
      setServiceDate(today)
      setNotes("")
      setTechnicianId("")
    }
  }, [open])

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
          supabase.from("company_profile").select("*").eq("org_id", orgId).single(), // <-- FIXED: was "company_profiles"
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
              companyName: company?.company_name || "",
              customerName: customer.name || "",
              customerPhone: customer.phone,
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
