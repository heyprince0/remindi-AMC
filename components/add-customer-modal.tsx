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
  orgId: string   // <-- added
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
    address: ''
  })

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || ''
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        address: ''
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
        org_id: orgId   // <-- include org_id
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              placeholder="Customer name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
            <Input
              id="phone"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
            <Textarea
              id="address"
              placeholder="Customer address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={errors.address ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Save Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
