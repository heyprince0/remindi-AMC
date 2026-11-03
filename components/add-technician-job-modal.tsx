'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase, type Customer } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, Search, ChevronsUpDown, X } from 'lucide-react'

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

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

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
      setCustomerSearch('')
      setCustomerDropdownOpen(false)
      loadCustomers()
    } else {
      setCustomerSearch('')
      setCustomerDropdownOpen(false)
    }
  }, [open])

  // Close the customer search dropdown when clicking outside it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false)
      }
    }
    if (customerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [customerDropdownOpen])

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

  const selectedCustomer = customers.find((c) => c.id === formData.customerId)
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  )

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

          {/* Customer (searchable, optional) */}
          <div className="space-y-2">
            <Label htmlFor="customer">
              Customer <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative" ref={customerDropdownRef}>
              <button
                type="button"
                id="customer"
                onClick={() => !customersLoading && setCustomerDropdownOpen((v) => !v)}
                disabled={customersLoading}
                className={`flex w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm ${
                  errors.customerId ? 'border-red-500' : 'border-input'
                } ${customersLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span className={selectedCustomer ? '' : 'text-muted-foreground'}>
                  {customersLoading
                    ? 'Loading customers...'
                    : selectedCustomer?.name || 'Select a customer (optional)'}
                </span>
                <div className="flex items-center gap-1">
                  {selectedCustomer && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFormData({ ...formData, customerId: '' })
                        setCustomerSearch('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          setFormData({ ...formData, customerId: '' })
                          setCustomerSearch('')
                        }
                      }}
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label="Clear customer selection"
                    >
                      <X className="size-3.5 opacity-60" />
                    </span>
                  )}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </div>
              </button>

              {customerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="size-4 opacity-50" />
                    <input
                      autoFocus
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customers..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {customers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No customers available</div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No matching customers</div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          type="button"
                          key={customer.id}
                          onClick={() => {
                            setFormData({ ...formData, customerId: customer.id })
                            setCustomerDropdownOpen(false)
                            setCustomerSearch('')
                          }}
                          className={`block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                            customer.id === formData.customerId ? 'bg-accent' : ''
                          }`}
                        >
                          {customer.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
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
