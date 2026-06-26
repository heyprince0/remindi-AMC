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
}

const FREQUENCY_OPTIONS = [
  { value: '30', label: '30 days (Monthly)' },
  { value: '60', label: '60 days (Every 2 months)' },
  { value: '90', label: '90 days (Quarterly)' },
  { value: '180', label: '180 days (Every 6 months)' },
  { value: '365', label: '365 days (Yearly)' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' }
]

export function AddContractModal({
  open,
  onOpenChange,
  onSuccess,
  editingContract,
  userId
}: AddContractModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nextServiceDate, setNextServiceDate] = useState('')

  const [formData, setFormData] = useState({
    contractName: '',
    customerId: '',
    frequency: '',
    startDate: '',
    status: 'active',
    notes: '',
    contractPrice: ''
  })

  // Load customers on mount
  useEffect(() => {
    if (open) {
      loadCustomers()
    }
  }, [open])

  // Calculate next service date when start date or frequency changes
  useEffect(() => {
    if (formData.startDate && formData.frequency) {
      const nextDate = calculateNextServiceDate(formData.startDate, parseInt(formData.frequency))
      setNextServiceDate(nextDate)
    }
  }, [formData.startDate, formData.frequency])

  // Prefill form if editing
  useEffect(() => {
    if (editingContract && open) {
      setFormData({
        contractName: editingContract.contract_name,
        customerId: editingContract.customer_id,
        frequency: editingContract.frequency_days.toString(),
        startDate: editingContract.start_date,
        status: editingContract.status,
        notes: editingContract.notes || '',
        contractPrice: editingContract.contracts_price != null ? editingContract.contracts_price.toString() : ''
      })
      setNextServiceDate(editingContract.next_service_date)
    } else if (open) {
      setFormData({
        contractName: '',
        customerId: '',
        frequency: '',
        startDate: '',
        status: 'active',
        notes: '',
        contractPrice: ''
      })
      setNextServiceDate('')
      setErrors({})
    }
  }, [editingContract, open])

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)

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

    if (!formData.contractName.trim()) {
      newErrors.contractName = 'Contract Name is required'
    }
    if (!formData.customerId) {
      newErrors.customerId = 'Customer is required'
    }
    if (!formData.frequency) {
      newErrors.frequency = 'Frequency is required'
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start Date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)

      const contractData = {
        user_id: userId,
        customer_id: formData.customerId,
        contract_name: formData.contractName,
        frequency_days: parseInt(formData.frequency),
        start_date: formData.startDate,
        next_service_date: nextServiceDate,
        status: formData.status,
        notes: formData.notes || null,
        contracts_price: formData.contractPrice ? parseFloat(formData.contractPrice) : null
      }

      if (editingContract) {
        // Update existing contract
        const { error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', editingContract.id)

        if (error) throw error
        toast.success('Contract updated successfully')
      } else {
        // Create new contract
        const { error } = await supabase
          .from('contracts')
          .insert([contractData])

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
            <Label htmlFor="contractName">
              Contract Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="contractName"
              placeholder="e.g., AC Maintenance 2024"
              value={formData.contractName}
              onChange={(e) => {
                setFormData({ ...formData, contractName: e.target.value })
                if (errors.contractName) {
                  setErrors({ ...errors, contractName: '' })
                }
              }}
              className={errors.contractName ? 'border-red-500' : ''}
            />
            {errors.contractName && (
              <p className="text-xs text-red-500">{errors.contractName}</p>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="customer">
              Customer <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.customerId} onValueChange={(value) => {
              setFormData({ ...formData, customerId: value })
              if (errors.customerId) {
                setErrors({ ...errors, customerId: '' })
              }
            }}>
              <SelectTrigger id="customer" className={errors.customerId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {loadingCustomers ? (
                  <SelectItem disabled value="loading">
                    Loading customers...
                  </SelectItem>
                ) : customers.length === 0 ? (
                  <SelectItem disabled value="empty">
                    No customers available
                  </SelectItem>
                ) : (
                  customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.customerId && (
              <p className="text-xs text-red-500">{errors.customerId}</p>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">
              Frequency <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.frequency} onValueChange={(value) => {
              setFormData({ ...formData, frequency: value })
              if (errors.frequency) {
                setErrors({ ...errors, frequency: '' })
              }
            }}>
              <SelectTrigger id="frequency" className={errors.frequency ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.frequency && (
              <p className="text-xs text-red-500">{errors.frequency}</p>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                setFormData({ ...formData, startDate: e.target.value })
                if (errors.startDate) {
                  setErrors({ ...errors, startDate: '' })
                }
              }}
              className={errors.startDate ? 'border-red-500' : ''}
            />
            {errors.startDate && (
              <p className="text-xs text-red-500">{errors.startDate}</p>
            )}
          </div>

          {/* Next Service Date (Auto-calculated) */}
          <div className="space-y-2">
            <Label htmlFor="nextServiceDate">Next Service Date (Auto-calculated)</Label>
            <Input
              id="nextServiceDate"
              type="text"
              value={nextServiceDate}
              disabled
              placeholder="Will be calculated automatically"
              className="bg-muted"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => {
              setFormData({ ...formData, status: value })
            }}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contract Price */}
          <div className="space-y-2">
            <Label htmlFor="contractPrice">Contract Price (₹)</Label>
            <Input
              id="contractPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5000"
              value={formData.contractPrice}
              onChange={(e) => setFormData({ ...formData, contractPrice: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this contract..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
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
