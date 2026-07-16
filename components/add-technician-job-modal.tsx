'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase, type Customer } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface AddTechnicianJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  technicianId: string
  orgId: string
  userId: string
}

export function AddTechnicianJobModal({
  open,
  onOpenChange,
  onSuccess,
  technicianId,
  orgId,
  userId,
}: AddTechnicianJobModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    dueDate: '',
    customerId: '', // optional — empty string means "no customer selected"
  })

  useEffect(() => {
    if (open) {
      setFormData({
        title: '',
        notes: '',
        dueDate: '',
        customerId: '',
      })
      setErrors({})
      loadCustomers()
    }
  }, [open])

  const loadCustomers = async () => {
    if (!orgId) return
    setCustomersLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      setCustomers((data as Customer[]) || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      // Non-blocking — the field is optional, so a failed fetch shouldn't stop job creation
    } finally {
      setCustomersLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) newErrors.title = 'Job title is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('technician_jobs')
        .insert({
          org_id: orgId,
          technician_id: technicianId,
          customer_id: formData.customerId || null,
          contract_id: null,
          title: formData.title.trim(),
          notes: formData.notes.trim() || null,
          assigned_date: today,
          due_date: formData.dueDate || null,
          status: 'pending',
          source: 'manual',
        })

      if (error) throw error
      toast.success('Job added successfully!')

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error adding technician job:', error)
      toast.error('Failed to add job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Job Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="Enter job title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Select
              value={formData.customerId || undefined}
              onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              disabled={customersLoading}
            >
              <SelectTrigger id="customer">
                <SelectValue placeholder={customersLoading ? 'Loading customers...' : 'Select a customer (optional)'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this job..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="min-h-20 resize-none"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Add Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
