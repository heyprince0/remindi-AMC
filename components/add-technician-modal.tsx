'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase, type Technician } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface AddTechnicianModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingTechnician?: Technician | null
  userId: string
}

function parseSpecialization(raw: unknown): string {
  let current: unknown = raw
  for (let i = 0; i < 10; i++) {
    if (typeof current === 'string') {
      try { current = JSON.parse(current); continue } catch { return current }
    }
    if (Array.isArray(current) && current.length > 0) { current = current[0]; continue }
    break
  }
  return typeof current === 'string' ? current : ''
}

const SPECIALIZATION_OPTIONS = [
  'AC',
  'Lift',
  'RO Water Purifier',
  'CCTV',
  'Pest Control',
  'Generator',
  'Fire Safety',
  'UPS',
  'All Types'
]

const STATUS_OPTIONS = [
  'Available',
  'Busy',
  'On Leave'
]

export function AddTechnicianModal({
  open,
  onOpenChange,
  onSuccess,
  editingTechnician,
  userId
}: AddTechnicianModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialization: '',
    status: 'Available'
  })

  // Populate form with editing data
  useEffect(() => {
    if (editingTechnician) {
      setFormData({
        name: editingTechnician.name || '',
        phone: editingTechnician.phone || '',
        specialization: parseSpecialization(editingTechnician.specialization),
        status: editingTechnician.status || 'Available'
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        specialization: '',
        status: 'Available'
      })
    }
    setErrors({})
  }, [editingTechnician, open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required'
    }
    if (!formData.specialization.trim()) {
      newErrors.specialization = 'Specialization is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    try {
      const technicianData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        specialization: formData.specialization,
        status: formData.status.toLowerCase().replace(' ', '-')
      }

      if (editingTechnician) {
        // Update existing technician
        const { error } = await supabase
          .from('technicians')
          .update(technicianData)
          .eq('id', editingTechnician.id)

        if (error) throw error
        toast.success('Technician updated successfully!')
      } else {
        // Create new technician
        const { error } = await supabase
          .from('technicians')
          .insert({
            user_id: userId,
            ...technicianData
          })

        if (error) throw error
        toast.success('Technician added!')
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error saving technician:', error)
      toast.error(editingTechnician ? 'Failed to update technician' : 'Failed to add technician')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingTechnician ? 'Edit Technician' : 'Add Technician'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Enter technician name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone}</p>
            )}
          </div>

          {/* Specialization */}
          <div className="space-y-2">
            <Label htmlFor="specialization">Specialization *</Label>
            <Select
              value={formData.specialization}
              onValueChange={(value) => setFormData({ ...formData, specialization: value })}
            >
              <SelectTrigger 
                id="specialization"
                className={errors.specialization ? 'border-red-500' : ''}
              >
                <SelectValue placeholder="Select specialization" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALIZATION_OPTIONS.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.specialization && (
              <p className="text-sm text-red-500">{errors.specialization}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingTechnician ? 'Update Technician' : 'Save Technician'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
