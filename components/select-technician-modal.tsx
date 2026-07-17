'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase, type Technician } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'

interface SelectTechnicianModalProps {
  open: boolean
  onSuccess: (technicianId: string) => void
  orgId: string
  userId: string
}

export function SelectTechnicianModal({
  open,
  onSuccess,
  orgId,
  userId,
}: SelectTechnicianModalProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (open && orgId) {
      loadUnclaimedTechnicians()
    }
  }, [open, orgId])

  const loadUnclaimedTechnicians = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('org_id', orgId)
        .is('user_id', null)
        .order('name', { ascending: true })

      if (error) throw error
      setTechnicians((data as Technician[]) || [])
    } catch (error) {
      console.error('Error loading unclaimed technicians:', error)
      toast.error('Failed to load technician profiles')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (technicianId: string) => {
    try {
      setSelecting(true)
      setSelectedId(technicianId)

      const { error } = await supabase
        .from('technicians')
        .update({ user_id: userId })
        .eq('id', technicianId)
        .eq('org_id', orgId)

      if (error) throw error
      toast.success('Profile linked successfully!')
      onSuccess(technicianId)
    } catch (error) {
      console.error('Error linking technician:', error)
      toast.error('Failed to link profile')
      setSelectedId(null)
    } finally {
      setSelecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Select Your Technician Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : technicians.length === 0 ? (
          <div className="flex flex-col gap-3 py-8">
            <div className="flex gap-3">
              <AlertCircle className="size-5 text-alert-overdue flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                No technician profile found for you yet — ask your admin to add you as a technician first.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Select the technician profile that matches your account:
            </p>
            <ScrollArea className="h-64 rounded-md border border-border">
              <div className="p-4 space-y-2">
                {technicians.map((tech) => (
                  <Button
                    key={tech.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleSelect(tech.id)}
                    disabled={selecting}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{tech.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tech.specialization} • {tech.phone}
                      </span>
                    </div>
                    {selectedId === tech.id && selecting && (
                      <Loader2 className="ml-auto size-4 animate-spin" />
                    )}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
