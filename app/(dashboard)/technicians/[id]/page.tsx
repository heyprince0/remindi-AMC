'use client'

import { useEffect, useState, useMemo, useRef, type ChangeEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase, type Technician, type TechnicianJob, type Customer, type Contract, type ServiceHistory } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
  ArrowLeft, Phone, Wrench, Plus, CheckCircle2, Trash2,
  CalendarIcon, X, ScanBarcode, Camera, Loader2,
  Wallet, Receipt, IndianRupee, TrendingDown, TrendingUp,
  ImageIcon, MapPin, StickyNote, QrCode, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { AddTechnicianJobModal } from '@/components/add-technician-job-modal'
import { Input } from '@/components/ui/input'
import ScanBarcodeDialog from '../../stocks/components/ScanBarcodeDialog'
import { TechnicianAttendanceScanner } from '@/components/technician-attendance-scanner'
import { TechnicianAttendanceCalendar } from '@/components/technician-attendance-calendar'

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobWithCustomer extends TechnicianJob {
  customerName: string | null
}

interface HistoryDisplayItem {
  id: string
  completedDate: string | null
  title: string
  customerName: string | null
  source: 'manual' | 'service_alert' | 'service_history'
  notes: string | null
  photoUrl: string | null
  contractId: string | null
}

interface TechnicianFund {
  id: string
  amount: number
  notes: string | null
  given_at: string
  given_by: string | null
}

interface TechnicianExpense {
  id: string
  amount: number
  category: string
  description: string | null
  receipt_url: string | null
  expense_date: string
  created_at: string
}

const EXPENSE_CATEGORIES = [
  'Fuel',
  'Food',
  'Transport',
  'Tools',
  'Spare Parts',
  'Other',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function TechnicianDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, role } = useAuth()
  const technicianId = params.id as string

  // ── Core state ──────────────────────────────────────────────────────────
  const [technician, setTechnician] = useState<Technician | null>(null)
  const [assignedJobs, setAssignedJobs] = useState<JobWithCustomer[]>([])
  const [jobHistory, setJobHistory] = useState<HistoryDisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [statusEditMode, setStatusEditMode] = useState(false)
  const [statusValue, setStatusValue] = useState('')
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('')
  const HISTORY_PAGE_SIZE = 10
  const [historyVisibleCount, setHistoryVisibleCount] = useState<number>(HISTORY_PAGE_SIZE)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [jobToComplete, setJobToComplete] = useState<JobWithCustomer | null>(null)
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<JobWithCustomer | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Attendance popup states ─────────────────────────────────────────────
  const [attendanceCalendarOpen, setAttendanceCalendarOpen] = useState(false)
  const [attendanceScannerOpen, setAttendanceScannerOpen] = useState(false)

  // ── Customer info popup state ───────────────────────────────────────────
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<Customer | null>(null)
  const [customerInfoLoading, setCustomerInfoLoading] = useState(false)

  // ── Expenses state (admin/owner only — see /technician-expenses for technicians) ──
  const [funds, setFunds] = useState<TechnicianFund[]>([])
  const [expenses, setExpenses] = useState<TechnicianExpense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  // ── Month filter ────────────────────────────────────────────────────────
  const [monthFilter, setMonthFilter] = useState<string>('all')

  // Give Funds dialog
  const [fundDialogOpen, setFundDialogOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundNotes, setFundNotes] = useState('')
  const [isSubmittingFund, setIsSubmittingFund] = useState(false)

  // Add Expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null)
  const [expenseReceiptPreview, setExpenseReceiptPreview] = useState<string | null>(null)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Delete expense
  const [deleteExpenseDialogOpen, setDeleteExpenseDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<TechnicianExpense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState(false)

  // Receipt lightbox
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null)

  // ── Month filter helpers ────────────────────────────────────────────────
  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    funds.forEach((f) => { if (f.given_at) months.add(f.given_at.slice(0, 7)) })
    expenses.forEach((e) => { if (e.expense_date) months.add(e.expense_date.slice(0, 7)) })
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [funds, expenses])

  const filteredFunds = useMemo(() => {
    if (monthFilter === 'all') return funds
    return funds.filter((f) => f.given_at.slice(0, 7) === monthFilter)
  }, [funds, monthFilter])

  const filteredExpenses = useMemo(() => {
    if (monthFilter === 'all') return expenses
    return expenses.filter((e) => e.expense_date.slice(0, 7) === monthFilter)
  }, [expenses, monthFilter])

  // ── Computed expense summary ────────────────────────────────────────────
  const totalFundsGiven = useMemo(
    () => filteredFunds.reduce((sum, f) => sum + Number(f.amount), 0),
    [filteredFunds]
  )
  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [filteredExpenses]
  )
  const balance = totalFundsGiven - totalSpent

  // ── Org ID loader ───────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Failed to fetch organization:', error)
            toast.error('Could not determine your organization')
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId && technicianId) {
      if (role === 'technician' && user?.id) {
        supabase
          .from('technicians')
          .select('linked_user_id')
          .eq('id', technicianId)
          .eq('org_id', currentOrgId)
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              router.push('/technicians')
              return
            }
            if (data.linked_user_id && data.linked_user_id !== user.id) {
              router.push('/technicians')
              return
            }
            setIsOwnProfile(data.linked_user_id === user.id)
            loadTechnicianDetails()
            // Note: expenses not loaded for technicians — they use /technician-expenses
          })
      } else {
        loadTechnicianDetails()
        loadExpenses()
      }
    }
  }, [currentOrgId, technicianId, role, user?.id, router])

  // ── Data loaders ────────────────────────────────────────────────────────
  const loadTechnicianDetails = async () => {
    try {
      if (!currentOrgId) return

      const { data: technicianData, error: technicianError } = await supabase
        .from('technicians')
        .select('*')
        .eq('id', technicianId)
        .eq('org_id', currentOrgId)
        .single()

      if (technicianError) throw technicianError
      if (!technicianData) {
        toast.error('Technician not found')
        router.push('/technicians')
        return
      }

      setTechnician(technicianData as Technician)
      setStatusValue(technicianData.status)

      const { data: assignedJobsData, error: assignedJobsError } = await supabase
        .from('technician_jobs')
        .select('*')
        .eq('technician_id', technicianId)
        .eq('status', 'pending')
        .eq('org_id', currentOrgId)
        .order('due_date', { ascending: true, nullsFirst: true })

      if (assignedJobsError) throw assignedJobsError

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', currentOrgId)

      if (customersError) throw customersError

      const assignedJobsWithCustomer = (assignedJobsData as TechnicianJob[]).map((job) => {
        const customer = (customersData as Customer[])?.find((c) => c.id === job.customer_id)
        return { ...job, customerName: customer?.name || null }
      })

      setAssignedJobs(assignedJobsWithCustomer)

      const { data: historyJobsData, error: historyJobsError } = await supabase
        .from('technician_jobs')
        .select('*')
        .eq('technician_id', technicianId)
        .eq('status', 'completed')
        .eq('org_id', currentOrgId)
        .order('completed_at', { ascending: false })

      if (historyJobsError) throw historyJobsError

      const historyFromJobs: HistoryDisplayItem[] = (historyJobsData as TechnicianJob[]).map((job) => {
        const customer = (customersData as Customer[])?.find((c) => c.id === job.customer_id)
        return {
          id: `job-${job.id}`,
          completedDate: job.completed_at ? job.completed_at.split('T')[0] : null,
          title: job.title,
          customerName: customer?.name || null,
          source: job.source === 'service_alert' ? 'service_alert' : 'manual',
          notes: job.notes,
          photoUrl: job.photo_url,
          contractId: job.contract_id,
        }
      })

      const { data: serviceHistoryData, error: serviceHistoryError } = await supabase
        .from('service_history')
        .select('*')
        .eq('technician_id', technicianId)
        .eq('org_id', currentOrgId)
        .order('service_date', { ascending: false })

      if (serviceHistoryError) throw serviceHistoryError

      const contractIds = ((serviceHistoryData as ServiceHistory[]) || [])
        .map((r) => r.contract_id)
        .filter((id): id is string => !!id)

      let contractsData: Contract[] = []
      if (contractIds.length > 0) {
        const { data: contractsResult, error: contractsError } = await supabase
          .from('contracts')
          .select('*')
          .in('id', contractIds)
          .eq('org_id', currentOrgId)

        if (contractsError) throw contractsError
        contractsData = (contractsResult as Contract[]) || []
      }

      const historyFromServiceHistory: HistoryDisplayItem[] = ((serviceHistoryData as ServiceHistory[]) || []).map((record) => {
        const contract = contractsData.find((c) => c.id === record.contract_id)
        const customer = contract
          ? (customersData as Customer[])?.find((c) => c.id === contract.customer_id)
          : undefined
        return {
          id: `sh-${record.id}`,
          completedDate: record.service_date,
          title: contract?.contract_name || 'Service Record',
          customerName: customer?.name || null,
          source: 'service_history',
          notes: record.notes,
          photoUrl: record.photo_url,
          contractId: record.contract_id,
        }
      })

      const jobCompletionKeys = new Set(
        historyFromJobs
          .filter((item) => item.contractId && item.completedDate)
          .map((item) => `${item.contractId}|${item.completedDate}`)
      )
      const dedupedHistoryFromServiceHistory = historyFromServiceHistory.filter((item) => {
        if (!item.contractId || !item.completedDate) return true
        return !jobCompletionKeys.has(`${item.contractId}|${item.completedDate}`)
      })

      const combinedHistory = [...historyFromJobs, ...dedupedHistoryFromServiceHistory].sort((a, b) => {
        if (!a.completedDate) return 1
        if (!b.completedDate) return -1
        return b.completedDate.localeCompare(a.completedDate)
      })

      setJobHistory(combinedHistory)
    } catch (error) {
      console.error('Error loading technician details:', error)
      toast.error('Failed to load technician details')
    } finally {
      setLoading(false)
    }
  }

  const loadExpenses = async () => {
    if (!currentOrgId) return
    setLoadingExpenses(true)
    try {
      const [{ data: fundsData, error: fundsError }, { data: expensesData, error: expensesError }] = await Promise.all([
        supabase
          .from('technician_funds')
          .select('*')
          .eq('technician_id', technicianId)
          .eq('org_id', currentOrgId)
          .order('given_at', { ascending: false }),
        supabase
          .from('technician_expenses')
          .select('*')
          .eq('technician_id', technicianId)
          .eq('org_id', currentOrgId)
          .order('expense_date', { ascending: false }),
      ])

      if (fundsError) throw fundsError
      if (expensesError) throw expensesError

      setFunds((fundsData as TechnicianFund[]) || [])
      setExpenses((expensesData as TechnicianExpense[]) || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
      toast.error('Failed to load expense data')
    } finally {
      setLoadingExpenses(false)
    }
  }

  // ── Customer info popup ────────────────────────────────────────────────
  const openCustomerInfo = async (customerId: string) => {
    if (!currentOrgId) return
    setCustomerInfoOpen(true)
    setCustomerInfoLoading(true)
    setCustomerInfo(null)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('org_id', currentOrgId)
        .single()
      if (error) throw error
      setCustomerInfo(data as Customer)
    } catch (err) {
      console.error('Error loading customer info:', err)
      toast.error('Failed to load customer info')
      setCustomerInfoOpen(false)
    } finally {
      setCustomerInfoLoading(false)
    }
  }

  // ── Photo helpers ──────────────────────────────────────────────────────
  const compressPhoto = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, 1280 / image.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('Could not prepare image')); return }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress image')), 'image/jpeg', 0.75)
      }
      image.onerror = () => reject(new Error('Could not read image'))
      image.src = URL.createObjectURL(file)
    })

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setSelectedPhoto(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  const clearSelectedPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setSelectedPhoto(null)
    setPhotoPreviewUrl(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // ── Receipt helpers ────────────────────────────────────────────────────
  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (expenseReceiptPreview) URL.revokeObjectURL(expenseReceiptPreview)
    setExpenseReceiptFile(file)
    setExpenseReceiptPreview(URL.createObjectURL(file))
  }

  const clearReceipt = () => {
    if (expenseReceiptPreview) URL.revokeObjectURL(expenseReceiptPreview)
    setExpenseReceiptFile(null)
    setExpenseReceiptPreview(null)
    if (receiptInputRef.current) receiptInputRef.current.value = ''
  }

  const resetExpenseDialog = () => {
    setExpenseAmount('')
    setExpenseCategory('')
    setExpenseDescription('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    clearReceipt()
  }

  const resetFundDialog = () => {
    setFundAmount('')
    setFundNotes('')
  }

  // ── Give Funds ────────────────────────────────────────────────────────
  const handleGiveFunds = async () => {
    if (!currentOrgId || !user) return
    const amt = parseFloat(fundAmount)
    if (!fundAmount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setIsSubmittingFund(true)
    try {
      const { error } = await supabase.from('technician_funds').insert({
        org_id: currentOrgId,
        technician_id: technicianId,
        amount: amt,
        notes: fundNotes.trim() || null,
        given_by: user.id,
        given_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Funds given successfully')
      setFundDialogOpen(false)
      resetFundDialog()
      loadExpenses()
    } catch (error) {
      console.error('Error giving funds:', error)
      toast.error('Failed to record funds')
    } finally {
      setIsSubmittingFund(false)
    }
  }

  // ── Add Expense ───────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    if (!currentOrgId || !user) return
    const amt = parseFloat(expenseAmount)
    if (!expenseAmount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!expenseCategory) {
      toast.error('Please select a category')
      return
    }
    if (!expenseDate) {
      toast.error('Please select a date')
      return
    }
    setIsSubmittingExpense(true)
    try {
      let receiptUrl: string | null = null

      if (expenseReceiptFile) {
        try {
          const compressed = await compressPhoto(expenseReceiptFile)
          const path = `${currentOrgId}/${technicianId}-${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('expense-receipts')
            .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
          if (uploadError) throw uploadError
          receiptUrl = supabase.storage.from('expense-receipts').getPublicUrl(path).data.publicUrl
        } catch (uploadErr) {
          console.error('Receipt upload failed:', uploadErr)
          toast.warning('Expense will be saved, but the receipt photo failed to upload')
        }
      }

      const { error } = await supabase.from('technician_expenses').insert({
        org_id: currentOrgId,
        technician_id: technicianId,
        amount: amt,
        category: expenseCategory,
        description: expenseDescription.trim() || null,
        receipt_url: receiptUrl,
        expense_date: expenseDate,
        created_by: user.id,
      })
      if (error) throw error
      toast.success('Expense added successfully')
      setExpenseDialogOpen(false)
      resetExpenseDialog()
      loadExpenses()
    } catch (error) {
      console.error('Error adding expense:', error)
      toast.error('Failed to add expense')
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  // ── Delete Expense ────────────────────────────────────────────────────
  const handleConfirmDeleteExpense = async () => {
    if (!currentOrgId || !expenseToDelete || deletingExpense) return
    setDeletingExpense(true)
    try {
      const { error } = await supabase
        .from('technician_expenses')
        .delete()
        .eq('id', expenseToDelete.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      toast.success('Expense deleted')
      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id))
      setDeleteExpenseDialogOpen(false)
      setExpenseToDelete(null)
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    } finally {
      setDeletingExpense(false)
    }
  }

  // ── Job actions ────────────────────────────────────────────────────────
  const openCompleteDialog = (job: JobWithCustomer) => {
    setJobToComplete(job)
    setFeedbackNotes('')
    clearSelectedPhoto()
    setCompleteDialogOpen(true)
  }

  const handleConfirmComplete = async () => {
    if (!currentOrgId || !jobToComplete || isCompleting) return
    setIsCompleting(true)
    try {
      const completionNotes = feedbackNotes.trim() || jobToComplete.notes
      let photoUrl: string | null = null

      if (selectedPhoto) {
        try {
          const compressedPhoto = await compressPhoto(selectedPhoto)
          const photoPath = `${currentOrgId}/${jobToComplete.id}-${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(photoPath, compressedPhoto, { contentType: 'image/jpeg', upsert: false })
          if (uploadError) throw uploadError
          photoUrl = supabase.storage.from('job-photos').getPublicUrl(photoPath).data.publicUrl
        } catch (photoError) {
          console.error('Error uploading job photo:', photoError)
          toast.warning('Job will be completed, but the photo failed to upload')
        }
      }

      const { error } = await supabase
        .from('technician_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: completionNotes,
          photo_url: photoUrl,
        })
        .eq('id', jobToComplete.id)
        .eq('org_id', currentOrgId)

      if (error) throw error

      if (jobToComplete.contract_id) {
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data: contractData, error: contractFetchError } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', jobToComplete.contract_id)
            .eq('org_id', currentOrgId)
            .single()
          if (contractFetchError) throw contractFetchError

          const { error: historyError } = await supabase.from('service_history').insert({
            contract_id: jobToComplete.contract_id,
            technician_id: technicianId,
            service_date: today,
            status: 'completed',
            notes: completionNotes || null,
            photo_url: photoUrl,
            org_id: currentOrgId,
          })
          if (historyError) throw historyError

          if (contractData?.frequency_days != null) {
            const nextServiceDate = new Date(today)
            nextServiceDate.setDate(nextServiceDate.getDate() + contractData.frequency_days)
            const { error: contractUpdateError } = await supabase
              .from('contracts')
              .update({
                start_date: today,
                next_service_date: nextServiceDate.toISOString().split('T')[0],
                status: 'active',
              })
              .eq('id', jobToComplete.contract_id)
              .eq('org_id', currentOrgId)
            if (contractUpdateError) throw contractUpdateError
          }
        } catch (linkError) {
          console.error('Error syncing linked service alert completion:', linkError)
          toast.warning('Job marked complete, but the linked service record may not be fully updated')
        }
      }

      toast.success('Job marked as complete!')
      setCompleteDialogOpen(false)
      setJobToComplete(null)
      setFeedbackNotes('')
      clearSelectedPhoto()
      loadTechnicianDetails()
    } catch (error) {
      console.error('Error marking job complete:', error)
      toast.error('Failed to mark job as complete')
    } finally {
      setIsCompleting(false)
    }
  }

  const openDeleteDialog = (job: JobWithCustomer) => {
    setJobToDelete(job)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!currentOrgId || !jobToDelete || deleting) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('technician_jobs')
        .delete()
        .eq('id', jobToDelete.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      toast.success('Job deleted successfully')
      setAssignedJobs(assignedJobs.filter((job) => job.id !== jobToDelete.id))
      setDeleteDialogOpen(false)
      setJobToDelete(null)
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job')
    } finally {
      setDeleting(false)
    }
  }

  const sendWorkWhatsApp = async (jobId: string) => {
    try {
      if (!currentOrgId) return
      const { data: job, error: jobErr } = await supabase
        .from('technician_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('org_id', currentOrgId)
        .single()
      if (jobErr || !job) { console.error('notify(work): job fetch failed', jobErr); return }

      let customerName = 'Customer'
      let customerPhone = ''
      if (job.customer_id) {
        const { data: customer, error: cErr } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('id', job.customer_id)
          .eq('org_id', currentOrgId)
          .single()
        if (cErr) console.error('notify(work): customer fetch failed', cErr)
        customerName = customer?.name || 'Customer'
        customerPhone = customer?.phone || ''
      }

      const res = await fetch('/api/whatsapp/notify-technician', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: 'work',
          technicianId: job.technician_id,
          title: job.title,
          customerName,
          customerPhone,
          assignedDate: job.assigned_date,
          dueDate: job.due_date,
          notes: job.notes,
          orgId: currentOrgId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('notify(work): API failed', res.status, err)
        toast.error('Could not send WhatsApp notification')
      }
    } catch (err) {
      console.error('notify(work): unexpected', err)
    }
  }

  const handleModalSuccess = async () => {
    await loadTechnicianDetails()
    setTimeout(async () => {
      if (!currentOrgId) return
      const { data: latestJob } = await supabase
        .from('technician_jobs')
        .select('id')
        .eq('technician_id', technicianId)
        .eq('org_id', currentOrgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (latestJob?.id) await sendWorkWhatsApp(latestJob.id)
    }, 800)
  }

  const handleStatusSave = async () => {
    try {
      if (!currentOrgId || !technician) return
      const { error } = await supabase
        .from('technicians')
        .update({ status: statusValue })
        .eq('id', technicianId)
        .eq('org_id', currentOrgId)
      if (error) throw error
      toast.success('Status updated successfully')
      setStatusEditMode(false)
      setTechnician({ ...technician, status: statusValue })
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
      setStatusValue(technician?.status || '')
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500'
      case 'busy': return 'bg-yellow-500'
      case 'on-leave': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getSourceBadgeLabel = (source: HistoryDisplayItem['source']) => {
    switch (source) {
      case 'service_alert': return 'Service Alert'
      case 'service_history': return 'Service Record'
      default: return 'Manual'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Fuel': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'Food': return 'bg-green-100 text-green-800 border-green-200'
      case 'Transport': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Tools': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Spare Parts': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

  const filteredHistory = useMemo(() => {
    if (!historyDateFilter) return jobHistory
    return jobHistory.filter((item) => item.completedDate === historyDateFilter)
  }, [jobHistory, historyDateFilter])

  const visibleHistory = useMemo(() => filteredHistory.slice(0, historyVisibleCount), [filteredHistory, historyVisibleCount])
  const hasMoreHistory = filteredHistory.length > historyVisibleCount

  const handleLoadMoreHistory = () => setHistoryVisibleCount((prev) => prev + HISTORY_PAGE_SIZE)
  const clearDateFilter = () => { setHistoryDateFilter(''); setHistoryVisibleCount(HISTORY_PAGE_SIZE) }

  const isAdmin = role === 'admin' || role === 'owner'

  // ── Guards ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading technician details...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!technician) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Technician not found</p>
        </div>
      </DashboardLayout>
    )
  }

  const showBackButton = !(role === 'technician' && isOwnProfile)

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => router.push('/technicians')} className="size-9">
                <ArrowLeft className="size-4" />
                <span className="sr-only">Back to technicians</span>
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{technician.name}</h1>
              <p className="text-muted-foreground">Technician Details</p>
            </div>
          </div>
          {role === 'technician' && isOwnProfile && (
            <Button variant="outline" onClick={() => setScanDialogOpen(true)}>
              <ScanBarcode className="mr-2 size-4" />
              Scan Barcode
            </Button>
          )}
        </div>

        {/* ── Contact card ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-lg font-semibold text-primary">{technician.name.charAt(0)}</span>
              </span>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <Phone className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{technician.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wrench className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Specialization</p>
                  <p className="font-medium text-foreground">{technician.specialization}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-4 flex items-center justify-center">
                  <div className={`size-2 rounded-full ${getStatusDotColor(technician.status)}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {role === 'technician' && isOwnProfile ? (
                    statusEditMode ? (
                      <div className="flex gap-2 items-center mt-1">
                        <select
                          value={statusValue}
                          onChange={(e) => setStatusValue(e.target.value)}
                          className="px-2 py-1 border border-input rounded text-sm"
                        >
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="on-leave">On Leave</option>
                        </select>
                        <Button size="sm" onClick={handleStatusSave} className="gap-1">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setStatusEditMode(false); setStatusValue(technician.status) }}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <p className="font-medium text-foreground capitalize">{technician.status.replace('-', ' ')}</p>
                        <Button size="sm" variant="outline" onClick={() => setStatusEditMode(true)}>Edit</Button>
                      </div>
                    )
                  ) : (
                    <p className="font-medium text-foreground capitalize">{technician.status.replace('-', ' ')}</p>
                  )}
                </div>
              </div>

              {/* Attendance Button just below Status */}
              {role === 'technician' && isOwnProfile && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 gap-1.5 text-xs"
                      onClick={() => setAttendanceCalendarOpen(true)}
                    >
                      <CalendarDays className="size-3.5" />
                      Your Attendance
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════
            EXPENSES TRACKING SECTION — hidden for technicians
            (technicians use the dedicated /technician-expenses page)
        ════════════════════════════════════════════════════════════════ */}
        {role !== 'technician' && (
          <>
            {/* ── Month filter row ──────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="size-4 text-muted-foreground shrink-0" />
                <h2 className="text-base font-semibold truncate">Expense Tracker</h2>
                {monthFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                    {formatMonthLabel(monthFilter)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">Period:</span>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[170px] h-9">
                    <CalendarIcon className="mr-2 size-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    {availableMonths.map((ym) => (
                      <SelectItem key={ym} value={ym}>{formatMonthLabel(ym)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Summary strip ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
                    <TrendingUp className="size-4" />
                    <p className="text-xs font-medium">Funds Given</p>
                  </div>
                  <p className="text-xl font-bold text-blue-800 dark:text-blue-300">{formatCurrency(totalFundsGiven)}</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-500 mt-0.5">{filteredFunds.length} transaction{filteredFunds.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                    <TrendingDown className="size-4" />
                    <p className="text-xs font-medium">Total Spent</p>
                  </div>
                  <p className="text-xl font-bold text-red-800 dark:text-red-300">{formatCurrency(totalSpent)}</p>
                  <p className="text-xs text-red-600/70 dark:text-red-500 mt-0.5">{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card className={`${balance >= 0 ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900' : 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900'}`}>
                <CardContent className="p-4">
                  <div className={`flex items-center gap-2 mb-1 ${balance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    <Wallet className="size-4" />
                    <p className="text-xs font-medium">Balance</p>
                  </div>
                  <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-800 dark:text-green-300' : 'text-orange-800 dark:text-orange-300'}`}>
                    {formatCurrency(Math.abs(balance))}
                  </p>
                  <p className={`text-xs mt-0.5 ${balance >= 0 ? 'text-green-600/70 dark:text-green-500' : 'text-orange-600/70 dark:text-orange-500'}`}>
                    {balance >= 0 ? 'Remaining' : 'Overspent'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Desktop: Expenses table ───────────────────────────── */}
            <Card className="hidden md:block">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="size-5" />
                    {monthFilter === 'all' ? 'All Transactions' : formatMonthLabel(monthFilter)}
                  </CardTitle>
                  <CardDescription>
                    Funds issued and expenses logged for this technician
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => { resetFundDialog(); setFundDialogOpen(true) }}
                    >
                      <IndianRupee className="size-4" />
                      Give Funds
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => { resetExpenseDialog(); setExpenseDialogOpen(true) }}
                  >
                    <Plus className="size-4" />
                    Add Expense
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isAdmin && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Funds Issued</h3>
                    {funds.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                        No funds given to this technician yet
                      </div>
                    ) : filteredFunds.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                        No funds given in {formatMonthLabel(monthFilter)}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFunds.map((fund) => (
                            <TableRow key={fund.id}>
                              <TableCell className="text-sm">{new Date(fund.given_at).toLocaleDateString('en-IN')}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">{formatCurrency(fund.amount)}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{fund.notes || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expenses Logged</h3>
                  {loadingExpenses ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : expenses.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                      No expenses recorded yet
                    </div>
                  ) : filteredExpenses.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                      No expenses in {formatMonthLabel(monthFilter)}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Receipt</TableHead>
                          {isAdmin && <TableHead />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="text-sm">
                              {new Date(expense.expense_date).toLocaleDateString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs font-normal ${getCategoryColor(expense.category)}`}>
                                {expense.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {expense.description || '—'}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-red-700">{formatCurrency(expense.amount)}</span>
                            </TableCell>
                            <TableCell>
                              {expense.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => setReceiptModalUrl(expense.receipt_url)}
                                  className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label="View receipt"
                                >
                                  <img
                                    src={expense.receipt_url}
                                    alt="Receipt"
                                    className="size-10 rounded-md object-cover border"
                                  />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => { setExpenseToDelete(expense); setDeleteExpenseDialogOpen(true) }}
                                >
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">Delete expense</span>
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Mobile: Expenses section ───────────────────────────── */}
            <div className="flex flex-col gap-3 md:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-1.5">
                    <Receipt className="size-4 text-muted-foreground" />
                    {monthFilter === 'all' ? 'All Transactions' : formatMonthLabel(monthFilter)}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} logged
                  </p>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => { resetFundDialog(); setFundDialogOpen(true) }}
                    >
                      <IndianRupee className="size-3.5" />
                      Give
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => { resetExpenseDialog(); setExpenseDialogOpen(true) }}
                  >
                    <Plus className="size-3.5" />
                    Expense
                  </Button>
                </div>
              </div>

              {isAdmin && funds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funds Issued</p>
                  {filteredFunds.length === 0 ? (
                    <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                      No funds in {formatMonthLabel(monthFilter)}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
                      {filteredFunds.map((fund) => (
                        <div key={fund.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                            <IndianRupee className="size-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-blue-700">{formatCurrency(fund.amount)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(fund.given_at).toLocaleDateString('en-IN')}</p>
                            {fund.notes && <p className="text-xs text-muted-foreground italic truncate">{fund.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expenses</p>
                {loadingExpenses ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    No expenses recorded yet
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    No expenses in {formatMonthLabel(monthFilter)}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
                    {filteredExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 mt-0.5">
                          <TrendingDown className="size-4 text-red-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-red-700">{formatCurrency(expense.amount)}</p>
                              <p className="text-xs text-muted-foreground">{new Date(expense.expense_date).toLocaleDateString('en-IN')}</p>
                            </div>
                            <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 font-normal ${getCategoryColor(expense.category)}`}>
                              {expense.category}
                            </Badge>
                          </div>
                          {expense.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{expense.description}</p>
                          )}
                          {expense.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setReceiptModalUrl(expense.receipt_url)}
                              className="mt-2 flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                            >
                              <ImageIcon className="size-3" />
                              View Receipt
                            </button>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 -mr-2"
                            onClick={() => { setExpenseToDelete(expense); setDeleteExpenseDialogOpen(true) }}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            JOBS SECTION
        ════════════════════════════════════════════════════════════════ */}

        {/* Desktop jobs table */}
        <Card className="hidden md:block">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="size-5" />
                Assigned Jobs
              </CardTitle>
              <CardDescription>
                {assignedJobs.length} job{assignedJobs.length !== 1 ? 's' : ''} assigned to this technician
              </CardDescription>
            </div>
            {role !== 'technician' && (
              <Button onClick={() => setModalOpen(true)} size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Job
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {assignedJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No jobs assigned to this technician</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell>{job.assigned_date}</TableCell>
                        <TableCell>{job.due_date || '—'}</TableCell>
                        <TableCell>{job.customerName || '—'}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-2">{job.notes || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">Pending</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => openCompleteDialog(job)}>
                              <CheckCircle2 className="size-4" />
                              Complete
                            </Button>
                            {job.customer_id && (
                              <Button size="sm" variant="outline" onClick={() => job.customer_id && openCustomerInfo(job.customer_id)}>
                                View
                              </Button>
                            )}
                            {role !== 'technician' && (
                              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-600" onClick={() => openDeleteDialog(job)}>
                                <Trash2 className="size-4" />
                                <span className="sr-only">Delete job</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile jobs cards */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-1.5">
                <Wrench className="size-4 text-muted-foreground" />
                Assigned Jobs
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignedJobs.length} job{assignedJobs.length !== 1 ? 's' : ''} pending
              </p>
            </div>
            {role !== 'technician' && (
              <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1">
                <Plus className="size-3.5" />
                Add Job
              </Button>
            )}
          </div>

          {assignedJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No jobs assigned to this technician</div>
          ) : (
            assignedJobs.map((job) => (
              <Card key={job.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Wrench className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm font-semibold">{job.title}</CardTitle>
                        <CardDescription className="mt-0.5 truncate text-xs">{job.customerName || 'No customer'}</CardDescription>
                      </div>
                    </div>
                    <Badge className="shrink-0 bg-blue-100 text-blue-800 border-blue-200">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div><p className="text-xs text-muted-foreground">Assigned Date</p><p className="text-sm font-medium">{job.assigned_date}</p></div>
                    <div><p className="text-xs text-muted-foreground">Due Date</p><p className="text-sm font-medium">{job.due_date || '—'}</p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="text-sm font-medium line-clamp-2">{job.notes || '—'}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => openCompleteDialog(job)}><CheckCircle2 className="size-4" />Complete</Button>
                      {job.customer_id && <Button size="sm" variant="outline" onClick={() => job.customer_id && openCustomerInfo(job.customer_id)}>View</Button>}
                      {role !== 'technician' && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-600" onClick={() => openDeleteDialog(job)}><Trash2 className="size-4" /><span className="sr-only">Delete job</span></Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Desktop Job History ───────────────────────────────────────── */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5" />
              Job History
            </CardTitle>
            <CardDescription>
              {filteredHistory.length} completed job{filteredHistory.length !== 1 ? 's' : ''}
              {historyDateFilter && ` on ${historyDateFilter}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => { setHistoryDateFilter(e.target.value); setHistoryVisibleCount(HISTORY_PAGE_SIZE) }}
                  className="pl-8 w-[200px]"
                />
              </div>
              {historyDateFilter && (
                <Button variant="outline" size="sm" onClick={clearDateFilter} className="gap-1">
                  <X className="size-3" />
                  Clear
                </Button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {historyDateFilter ? 'No completed jobs on this date' : 'No completed jobs yet for this technician'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Completed Date</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Image</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleHistory.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>{job.completedDate || '—'}</TableCell>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell>{job.customerName || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">{getSourceBadgeLabel(job.source)}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground line-clamp-2">{job.notes || '—'}</span>
                          </TableCell>
                          <TableCell>
                            {job.photoUrl ? (
                              <button type="button" onClick={() => setPhotoModalUrl(job.photoUrl)} className="block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View photo for ${job.title}`}>
                                <img src={job.photoUrl} alt="Completed work" className="size-10 rounded-md object-cover" />
                              </button>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {hasMoreHistory && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" size="sm" onClick={handleLoadMoreHistory}>
                      View More ({filteredHistory.length - historyVisibleCount} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Mobile Job History ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 md:hidden">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Job History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredHistory.length} completed job{filteredHistory.length !== 1 ? 's' : ''}
              {historyDateFilter && ` on ${historyDateFilter}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <CalendarIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="date"
                value={historyDateFilter}
                onChange={(e) => { setHistoryDateFilter(e.target.value); setHistoryVisibleCount(HISTORY_PAGE_SIZE) }}
                className="pl-8 w-full"
              />
            </div>
            {historyDateFilter && (
              <Button variant="outline" size="sm" onClick={clearDateFilter} className="gap-1 shrink-0">
                <X className="size-3" />
                Clear
              </Button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {historyDateFilter ? 'No completed jobs on this date' : 'No completed jobs yet for this technician'}
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
                {visibleHistory.map((job) => (
                  <div key={job.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <CheckCircle2 className="size-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug break-words">{job.title}</p>
                        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 font-normal">{getSourceBadgeLabel(job.source)}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        <span>{job.completedDate || '—'}</span>
                        {job.customerName && (<><span className="opacity-40">•</span><span className="truncate">{job.customerName}</span></>)}
                      </div>
                      {job.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">{job.notes}</p>}
                      {job.photoUrl && (
                        <button type="button" onClick={() => setPhotoModalUrl(job.photoUrl)} className="mt-2 block overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View photo for ${job.title}`}>
                          <img src={job.photoUrl} alt={`Photo for ${job.title}`} className="h-16 w-16 rounded-md object-cover" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreHistory && (
                <div className="flex justify-center mt-1">
                  <Button variant="outline" size="sm" onClick={handleLoadMoreHistory}>
                    View More ({filteredHistory.length - historyVisibleCount} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── FAB for Attendance Scanning ─────────────────────────────── */}
        {role === 'technician' && isOwnProfile && (
          <div className="fixed z-50 right-4 bottom-[84px] md:right-6 md:bottom-6">
            <Button
              size="icon"
              onClick={() => setAttendanceScannerOpen(true)}
              className="size-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
            >
              <Camera className="size-6" />
              <span className="sr-only">Mark Attendance</span>
            </Button>
          </div>
        )}

        {/* ─── Modals ────────────────────────────────────────────────────── */}

        {/* Attendance Calendar Dialog */}
        <Dialog open={attendanceCalendarOpen} onOpenChange={setAttendanceCalendarOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                My Attendance
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <TechnicianAttendanceCalendar technicianId={technicianId} />
            </div>
          </DialogContent>
        </Dialog>

        {/* Attendance Scanner Dialog */}
        <Dialog open={attendanceScannerOpen} onOpenChange={setAttendanceScannerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-orange-600" />
                Mark Attendance
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <TechnicianAttendanceScanner technicianId={technicianId} />
            </div>
          </DialogContent>
        </Dialog>

        {user && currentOrgId && (
          <AddTechnicianJobModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            onSuccess={handleModalSuccess}
            technicianId={technicianId}
            orgId={currentOrgId}
            userId={user.id}
          />
        )}

        {/* Customer info popup */}
        <Dialog open={customerInfoOpen} onOpenChange={setCustomerInfoOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="size-5 text-primary" />
                Customer Details
              </DialogTitle>
            </DialogHeader>
            {customerInfoLoading || !customerInfo ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-border">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-base font-semibold text-primary">
                      {customerInfo.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{customerInfo.name}</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Phone className="size-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</p>
                    <a
                      href={`tel:${customerInfo.phone}`}
                      className="font-medium text-primary hover:underline text-sm"
                    >
                      {customerInfo.phone}
                    </a>
                  </div>
                </div>

                {customerInfo.address && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</p>
                      <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{customerInfo.address}</p>
                    </div>
                  </div>
                )}

                {customerInfo.notes && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <StickyNote className="size-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
                      <p className="font-medium text-foreground text-sm whitespace-pre-wrap">{customerInfo.notes}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setCustomerInfoOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Give Funds dialog */}
        <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IndianRupee className="size-5 text-blue-600" />
                Give Funds to {technician.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fund-amount">Amount (₹) <span className="text-red-500">*</span></Label>
                <Input
                  id="fund-amount"
                  type="number"
                  placeholder="e.g. 500"
                  min="1"
                  step="1"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-notes">Notes (optional)</Label>
                <Textarea
                  id="fund-notes"
                  placeholder="e.g. Travel advance for site visit..."
                  value={fundNotes}
                  onChange={(e) => setFundNotes(e.target.value)}
                  className="min-h-20 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setFundDialogOpen(false); resetFundDialog() }}>Cancel</Button>
                <Button onClick={handleGiveFunds} disabled={isSubmittingFund} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  {isSubmittingFund ? <Loader2 className="size-4 animate-spin" /> : <IndianRupee className="size-4" />}
                  {isSubmittingFund ? 'Saving...' : 'Give Funds'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Expense dialog */}
        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-red-600" />
                Add Expense
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Amount (₹) <span className="text-red-500">*</span></Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    placeholder="e.g. 200"
                    min="1"
                    step="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-date">Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-category">Category <span className="text-red-500">*</span></Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger id="expense-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-description">Description</Label>
                <Textarea
                  id="expense-description"
                  placeholder="e.g. Petrol for site visit to customer location..."
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="min-h-20 resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Receipt Photo (optional)</Label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptChange}
                  className="sr-only"
                />
                {expenseReceiptPreview ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img src={expenseReceiptPreview} alt="Receipt preview" className="max-h-48 w-full object-cover" />
                    <Button type="button" variant="secondary" size="sm" onClick={clearReceipt} className="absolute right-2 top-2">
                      Remove
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Camera className="size-6" />
                    <span className="text-sm">Tap to capture or upload receipt</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setExpenseDialogOpen(false); resetExpenseDialog() }}>Cancel</Button>
                <Button onClick={handleAddExpense} disabled={isSubmittingExpense} className="gap-2">
                  {isSubmittingExpense ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {isSubmittingExpense ? 'Saving...' : 'Add Expense'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Complete Job dialog */}
        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add feedback about this completed work..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  className="min-h-24 resize-none"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="sr-only" />
                {photoPreviewUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img src={photoPreviewUrl} alt="Selected completed work" className="max-h-56 w-full object-cover" />
                    <Button type="button" variant="secondary" size="sm" onClick={clearSelectedPhoto} className="absolute right-2 top-2">Remove</Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Camera className="size-6" />
                    <span className="text-sm">Tap to add a photo of the completed work</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setCompleteDialogOpen(false); setJobToComplete(null); setFeedbackNotes(''); clearSelectedPhoto() }}>Cancel</Button>
                <Button type="button" onClick={handleConfirmComplete} className="gap-2" disabled={isCompleting}>
                  {isCompleting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {isCompleting ? 'Uploading...' : 'Complete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Job photo lightbox */}
        <Dialog open={!!photoModalUrl} onOpenChange={(open) => !open && setPhotoModalUrl(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Completed Work Photo</DialogTitle></DialogHeader>
            {photoModalUrl && <img src={photoModalUrl} alt="Full-size completed work" className="max-h-[70vh] w-full rounded-lg object-contain" />}
          </DialogContent>
        </Dialog>

        {/* Receipt lightbox */}
        <Dialog open={!!receiptModalUrl} onOpenChange={(open) => !open && setReceiptModalUrl(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Expense Receipt</DialogTitle></DialogHeader>
            {receiptModalUrl && <img src={receiptModalUrl} alt="Expense receipt" className="max-h-[75vh] w-full rounded-lg object-contain" />}
          </DialogContent>
        </Dialog>

        {/* Delete job dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{jobToDelete?.title}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete expense dialog */}
        <AlertDialog open={deleteExpenseDialogOpen} onOpenChange={setDeleteExpenseDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Expense</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {expenseToDelete?.category} expense of {expenseToDelete ? formatCurrency(expenseToDelete.amount) : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteExpense} disabled={deletingExpense} className="bg-red-600 hover:bg-red-700">
                {deletingExpense ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {currentOrgId && (
          <ScanBarcodeDialog
            open={scanDialogOpen}
            onOpenChange={setScanDialogOpen}
            orgId={currentOrgId}
            categories={[]}
            onRefresh={loadTechnicianDetails}
          />
        )}

      </div>
    </DashboardLayout>
  )
}
