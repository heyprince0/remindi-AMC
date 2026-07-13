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
import { supabase, type Customer, type Contract, calculateNextServiceDate } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface AddContractModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingContract?: Contract | null
  userId: string
  orgId: string
}

const FREQUENCY_OPTIONS = [
  { value: '30', label: '30 days (Monthly)' },
  { value: '60', label: '60 days (Every 2 months)' },
  { value: '90', label: '90 days (Quarterly)' },
  { value: '120', label: '120 days (Every 4 months)' },
  { value: '180', label: '180 days (Every 6 months)' },
  { value: '365', label: '365 days (Yearly)' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' },
]

export function AddContractModal({
  open,
  onOpenChange,
  onSuccess,
  editingContract,
  userId,
  orgId,
}: AddContractModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nextServiceDate, setNextServiceDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [formData, setFormData] = useState({
    contractName: '',
    customerId: '',
    frequency: '',
    startDate: '',
    durationYears: '',
    status: 'active',
    notes: '',
    contractPrice: '',
  })

  useEffect(() => {
    if (open) loadCustomers()
  }, [open])

  // Auto‑calculate next service date
  useEffect(() => {
    if (formData.startDate && formData.frequency) {
      const nextDate = calculateNextServiceDate(formData.startDate, parseInt(formData.frequency))
      setNextServiceDate(nextDate)
    } else {
      setNextServiceDate('')
    }
  }, [formData.startDate, formData.frequency])

  // Auto‑calculate contract end date
  useEffect(() => {
    if (formData.startDate && formData.durationYears) {
      const years = parseInt(formData.durationYears)
      if (years > 0) {
        const start = new Date(formData.startDate)
        const end = new Date(start)
        end.setFullYear(end.getFullYear() + years)
        setEndDate(end.toISOString().split('T')[0])
      } else {
        setEndDate('')
      }
    } else {
      setEndDate('')
    }
  }, [formData.startDate, formData.durationYears])

  // Populate form when editing
  useEffect(() => {
    if (editingContract && open) {
      setFormData({
        contractName: editingContract.contract_name,
        customerId: editingContract.customer_id,
        frequency: editingContract.frequency_days.toString(),
        startDate: editingContract.start_date,
        durationYears: editingContract.duration_years?.toString() || '',
        status: editingContract.status,
        notes: editingContract.notes || '',
        contractPrice: editingContract.contracts_price != null ? editingContract.contracts_price.toString() : '',
      })
      setNextServiceDate(editingContract.next_service_date)
      // Compute end date from start_date + duration_years if present
      if (editingContract.start_date && editingContract.duration_years) {
        const start = new Date(editingContract.start_date)
        const end = new Date(start)
        end.setFullYear(end.getFullYear() + editingContract.duration_years)
        setEndDate(end.toISOString().split('T')[0])
      } else {
        setEndDate('')
      }
    } else if (open) {
      setFormData({
        contractName: '',
        customerId: '',
        frequency: '',
        startDate: '',
        durationYears: '',
        status: 'active',
        notes: '',
        contractPrice: '',
      })
      setNextServiceDate('')
      setEndDate('')
      setErrors({})
    }
  }, [editingContract, open])

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', orgId)
      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.contractName.trim()) newErrors.contractName = 'Contract Name is required'
    if (!formData.customerId) newErrors.customerId = 'Customer is required'
    if (!formData.frequency) newErrors.frequency = 'Frequency is required'
    if (!formData.startDate) newErrors.startDate = 'Start Date is required'
    if (!formData.durationYears) {
      newErrors.durationYears = 'Duration is required'
    } else {
      const years = parseInt(formData.durationYears)
      if (isNaN(years) || years <= 0) {
        newErrors.durationYears = 'Duration must be a positive number'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const contractData = {
        user_id: userId,
        customer_id: formData.customerId,
        contract_name: formData.contractName,
        frequency_days: parseInt(formData.frequency),
        start_date: formData.startDate,
        next_service_date: nextServiceDate,
        duration_years: parseInt(formData.durationYears),
        status: formData.status,
        notes: formData.notes || null,
        contracts_price: formData.contractPrice ? parseFloat(formData.contractPrice) : null,
        org_id: orgId,
      }

      if (editingContract) {
        const { error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', editingContract.id)
          .eq('org_id', orgId)
        if (error) throw error
        toast.success('Contract updated successfully')
      } else {
        const { error } = await supabase.from('contracts').insert([contractData])
        if (error) throw error
        toast.success('Contract added successfully')
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error saving contract:', error)
      toast.error(editingContract ? 'Failed to update contract' : 'Failed to add contract')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingContract ? 'Edit Contract' : 'Add New Contract'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contract Name */}
          <div className="space-y-2">
            <Label htmlFor="contractName">Contract Name <span className="text-red-500">*</span></Label>
            <Input
              id="contractName"
              placeholder="e.g., AC Maintenance 2024"
              value={formData.contractName}
              onChange={(e) => setFormData({ ...formData, contractName: e.target.value })}
              className={errors.contractName ? 'border-red-500' : ''}
            />
            {errors.contractName && <p className="text-xs text-red-500">{errors.contractName}</p>}
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer <span className="text-red-500">*</span></Label>
            <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value })}>
              <SelectTrigger className={errors.customerId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {loadingCustomers ? (
                  <SelectItem disabled value="loading">Loading customers...</SelectItem>
                ) : customers.length === 0 ? (
                  <SelectItem disabled value="empty">No customers available</SelectItem>
                ) : (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.customerId && <p className="text-xs text-red-500">{errors.customerId}</p>}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Service Frequency <span className="text-red-500">*</span></Label>
            <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
              <SelectTrigger className={errors.frequency ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.frequency && <p className="text-xs text-red-500">{errors.frequency}</p>}
          </div>

          {/* Start Date (unchanged) */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className={errors.startDate ? 'border-red-500' : ''}
            />
            {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
          </div>

          {/* NEW: Duration in Years */}
          <div className="space-y-2">
            <Label htmlFor="durationYears">Contract Duration (Years) <span className="text-red-500">*</span></Label>
            <Input
              id="durationYears"
              type="number"
              min="1"
              step="1"
              placeholder="e.g., 1"
              value={formData.durationYears}
              onChange={(e) => setFormData({ ...formData, durationYears: e.target.value })}
              className={errors.durationYears ? 'border-red-500' : ''}
            />
            {errors.durationYears && <p className="text-xs text-red-500">{errors.durationYears}</p>}
          </div>

          {/* NEW: Auto‑calculated Contract End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate">Contract End Date (Auto‑calculated)</Label>
            <Input
              id="endDate"
              type="text"
              value={endDate}
              disabled
              placeholder="Calculated from start date + duration"
              className="bg-muted"
            />
          </div>

          {/* Next Service Date (unchanged) */}
          <div className="space-y-2">
            <Label htmlFor="nextServiceDate">Next Service Date (Auto‑calculated)</Label>
            <Input
              id="nextServiceDate"
              type="text"
              value={nextServiceDate}
              disabled
              placeholder="Calculated from start date + frequency"
              className="bg-muted"
            />
          </div>

          {/* Status, Price, Notes – unchanged */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractPrice">Contract Price (₹)</Label>
            <Input
              id="contractPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5000"
              value={formData.contractPrice}
              onChange={(e) => setFormData({ ...formData, contractPrice: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingContract ? 'Update Contract' : 'Save Contract'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
