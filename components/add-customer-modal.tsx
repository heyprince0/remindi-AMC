'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase, type Customer } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface AddCustomerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingCustomer?: Customer | null
  userId: string
  orgId: string
}

export function AddCustomerModal({
  open,
  onOpenChange,
  onSuccess,
  editingCustomer,
  userId,
  orgId
}: AddCustomerModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    district: '',
    state: '',
    pin_code: '',
    notes: ''
  })

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || '',
        district: (editingCustomer as any).district || '',
        state: (editingCustomer as any).state || '',
        pin_code: (editingCustomer as any).pin_code || '',
        notes: editingCustomer.notes || ''
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        address: '',
        district: '',
        state: '',
        pin_code: '',
        notes: ''
      })
    }
    setErrors({})
  }, [editingCustomer, open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.address.trim()) newErrors.address = 'Address is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const customerData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        district: formData.district.trim() || null,
        state: formData.state.trim() || null,
        pin_code: formData.pin_code.trim() || null,
        notes: formData.notes.trim() || null,
        org_id: orgId
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id)
          .eq('org_id', orgId)
        if (error) throw error
        toast.success('Customer updated successfully')
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            user_id: userId,
            ...customerData
          })
        if (error) throw error
        toast.success('Customer added!')
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Failed to save customer')
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof typeof formData, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              placeholder="Customer name"
              value={formData.name}
              onChange={(e) => field('name', e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
            <Input
              id="phone"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => field('phone', e.target.value)}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
            <Textarea
              id="address"
              placeholder="Street / building address"
              value={formData.address}
              onChange={(e) => field('address', e.target.value)}
              className={errors.address ? 'border-red-500' : ''}
              rows={2}
            />
            {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
          </div>

          {/* District · State · Pin Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                placeholder="e.g. Pune"
                value={formData.district}
                onChange={(e) => field('district', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => field('state', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_code">Pin Code</Label>
              <Input
                id="pin_code"
                placeholder="411001"
                value={formData.pin_code}
                onChange={(e) => field('pin_code', e.target.value)}
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this customer"
              value={formData.notes}
              onChange={(e) => field('notes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : editingCustomer ? 'Update Customer' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
