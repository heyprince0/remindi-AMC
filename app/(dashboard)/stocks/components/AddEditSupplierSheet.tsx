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
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Supplier {
  id: string
  org_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  created_at: string
}

interface AddEditSupplierSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSupplier: Supplier | null
  orgId: string
  onSuccess: () => void
}

export default function AddEditSupplierSheet({
  open,
  onOpenChange,
  editingSupplier,
  orgId,
  onSuccess,
}: AddEditSupplierSheetProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
  })

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name,
        contact_person: editingSupplier.contact_person || "",
        phone: editingSupplier.phone || "",
        email: editingSupplier.email || "",
        gstin: editingSupplier.gstin || "",
        address: editingSupplier.address || "",
      })
    } else {
      setFormData({
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        gstin: "",
        address: "",
      })
    }
  }, [editingSupplier, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.name.trim()) {
        toast.error("Supplier name is required")
        return
      }

      const supplierData = {
        org_id: orgId,
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        gstin: formData.gstin.trim() || null,
        address: formData.address.trim() || null,
      }

      if (editingSupplier) {
        const { error } = await supabase
          .from("inventory_suppliers")
          .update(supplierData)
          .eq("id", editingSupplier.id)
          .eq("org_id", orgId)

        if (error) throw error
        toast.success("Supplier updated successfully")
      } else {
        const { error } = await supabase
          .from("inventory_suppliers")
          .insert([supplierData])

        if (error) throw error
        toast.success("Supplier created successfully")
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error saving supplier:", error)
      toast.error("Failed to save supplier")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</SheetTitle>
          <SheetDescription>
            {editingSupplier ? "Update supplier details" : "Create a new supplier"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Supplier Name *</Label>
            <Input
              id="name"
              placeholder="e.g., ABC Supplies"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Contact Person */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact">Contact Person</Label>
            <Input
              id="contact"
              placeholder="e.g., John Doe"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g., +91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g., supplier@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* GSTIN */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              placeholder="e.g., 27AABCB1234H1Z0"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Supplier address..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="mt-4">
            {loading ? "Saving..." : editingSupplier ? "Update Supplier" : "Create Supplier"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
