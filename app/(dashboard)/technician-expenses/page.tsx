'use client'

import { useEffect, useState, useMemo, useRef, type ChangeEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { supabase, type Technician } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
  ArrowLeft, Plus, Trash2, CalendarIcon, Loader2, UserCircle,
  Wallet, Receipt, IndianRupee, TrendingDown, TrendingUp,
  ImageIcon, Camera, HandCoins,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface TechnicianCollection {
  id: string
  amount: number
  payment_mode: string
  collected_date: string
  notes: string | null
  created_at: string
  received_at: string | null
}

const EXPENSE_CATEGORIES = ['Fuel', 'Food', 'Transport', 'Tools', 'Spare Parts', 'Other']
const PAYMENT_MODES = ['Cash', 'UPI', 'Cheque', 'Bank Transfer', 'Other']

// ─── Inner content (uses searchParams) ─────────────────────────────────────

function TechnicianExpensesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, role } = useAuth()

  const isAdmin = role === 'admin' || role === 'owner'
  const isTechnician = role === 'technician'

  // Resolved technician ID — auto-detected for technicians, from query for admins
  const [effectiveTechnicianId, setEffectiveTechnicianId] = useState<string | null>(null)
  const [technician, setTechnician] = useState<Technician | null>(null)
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)

  // Funds / expenses data
  const [funds, setFunds] = useState<TechnicianFund[]>([])
  const [expenses, setExpenses] = useState<TechnicianExpense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)

  // Month filter
  const [monthFilter, setMonthFilter] = useState<string>('all')

  // Dialogs
  const [fundDialogOpen, setFundDialogOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundNotes, setFundNotes] = useState('')
  const [isSubmittingFund, setIsSubmittingFund] = useState(false)

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null)
  const [expenseReceiptPreview, setExpenseReceiptPreview] = useState<string | null>(null)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const [deleteExpenseDialogOpen, setDeleteExpenseDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<TechnicianExpense | null>(null)
  const [deletingExpense, setDeletingExpense] = useState(false)

  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null)

  // ── Collections state ─────────────────────────────────────────────────
  const [collections, setCollections] = useState<TechnicianCollection[]>([])
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [collectionAmount, setCollectionAmount] = useState('')
  const [collectionMode, setCollectionMode] = useState('Cash')
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [collectionNotes, setCollectionNotes] = useState('')
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false)
  const [deleteCollectionDialogOpen, setDeleteCollectionDialogOpen] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<TechnicianCollection | null>(null)
  const [deletingCollection, setDeletingCollection] = useState(false)

  // ── Month filter helpers ───────────────────────────────────────────────
  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    funds.forEach((f) => { if (f.given_at) months.add(f.given_at.slice(0, 7)) })
    expenses.forEach((e) => { if (e.expense_date) months.add(e.expense_date.slice(0, 7)) })
    collections.forEach((c) => { if (c.collected_date) months.add(c.collected_date.slice(0, 7)) })
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [funds, expenses, collections])

  const filteredFunds = useMemo(() => {
    if (monthFilter === 'all') return funds
    return funds.filter((f) => f.given_at.slice(0, 7) === monthFilter)
  }, [funds, monthFilter])

  const filteredExpenses = useMemo(() => {
    if (monthFilter === 'all') return expenses
    return expenses.filter((e) => e.expense_date.slice(0, 7) === monthFilter)
  }, [expenses, monthFilter])

  const filteredCollections = useMemo(() => {
    if (monthFilter === 'all') return collections
    return collections.filter((c) => c.collected_date.slice(0, 7) === monthFilter)
  }, [collections, monthFilter])

  const totalFundsGiven = useMemo(
    () => filteredFunds.reduce((sum, f) => sum + Number(f.amount), 0),
    [filteredFunds]
  )
  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [filteredExpenses]
  )
  // Only unreceived collections count — once owner marks received, it's settled
  const totalCollected = useMemo(
    () => filteredCollections.filter((c) => !c.received_at).reduce((sum, c) => sum + Number(c.amount), 0),
    [filteredCollections]
  )
  const balance = totalFundsGiven + totalCollected - totalSpent

  // ── Load org ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
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
  }, [user?.id])

  // ── Resolve technician ID ──────────────────────────────────────────────
  // ⚠️ DO NOT set loading=false here for technician-success / admin-with-query
  // paths. Those still need the load effect below to fetch technician data.
  useEffect(() => {
    if (!currentOrgId || !user?.id) return

    const resolve = async () => {
      // Technician role: auto-detect their own linked technician
      if (isTechnician) {
        const { data, error } = await supabase
          .from('technicians')
          .select('id')
          .eq('linked_user_id', user.id)
          .eq('org_id', currentOrgId)
          .maybeSingle()

        if (error) {
          console.error('Failed to look up linked technician:', error)
        }

        if (!data?.id) {
          setNotLinked(true)
          setLoading(false)
          return
        }
        setEffectiveTechnicianId(data.id)
        // ⚠️ loading stays true → load effect below will end it
        return
      }

      // Admin: pick from query param, else load list for picker
      if (isAdmin) {
        const { data: techs } = await supabase
          .from('technicians')
          .select('*')
          .eq('org_id', currentOrgId)
          .order('name', { ascending: true })

        setAllTechnicians((techs as Technician[]) || [])

        const techFromQuery = searchParams.get('tech')
        if (techFromQuery && techs?.some((t) => t.id === techFromQuery)) {
          setEffectiveTechnicianId(techFromQuery)
          // ⚠️ loading stays true → load effect will end it
          return
        }
      }

      // Admin with no query (show picker), or unknown role
      setLoading(false)
    }

    resolve()
  }, [currentOrgId, user?.id, isTechnician, isAdmin, searchParams])

  // ── Load technician + expenses when ID resolves ───────────────────────
  // ⚠️ Always sets loading=false when done (success or failure).
  useEffect(() => {
    if (!effectiveTechnicianId || !currentOrgId) return

    const load = async () => {
      try {
        const { data: techData, error: techErr } = await supabase
          .from('technicians')
          .select('*')
          .eq('id', effectiveTechnicianId)
          .eq('org_id', currentOrgId)
          .single()

        if (techErr) throw techErr
        setTechnician(techData as Technician)
        setMonthFilter('all')
        await loadExpenses(effectiveTechnicianId)
      } catch (err) {
        console.error('Error loading technician:', err)
        toast.error('Failed to load technician data')
      } finally {
        // ⭐ THIS was missing — that's why the loader hung forever
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTechnicianId, currentOrgId])

  const loadExpenses = async (techId: string) => {
    if (!currentOrgId) return
    setLoadingExpenses(true)
    try {
      const [
        { data: fundsData, error: fundsError },
        { data: expensesData, error: expensesError },
        { data: collectionsData, error: collectionsError },
      ] = await Promise.all([
        supabase
          .from('technician_funds')
          .select('*')
          .eq('technician_id', techId)
          .eq('org_id', currentOrgId)
          .order('given_at', { ascending: false }),
        supabase
          .from('technician_expenses')
          .select('*')
          .eq('technician_id', techId)
          .eq('org_id', currentOrgId)
          .order('expense_date', { ascending: false }),
        supabase
          .from('technician_collections')
          .select('*')
          .eq('technician_id', techId)
          .eq('org_id', currentOrgId)
          .order('collected_date', { ascending: false }),
      ])

      if (fundsError) throw fundsError
      if (expensesError) throw expensesError
      if (collectionsError) throw collectionsError

      setFunds((fundsData as TechnicianFund[]) || [])
      setExpenses((expensesData as TechnicianExpense[]) || [])
      setCollections((collectionsData as TechnicianCollection[]) || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
      toast.error('Failed to load expense data')
    } finally {
      setLoadingExpenses(false)
    }
  }

  // ── Receipt helpers ────────────────────────────────────────────────────
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

  const resetCollectionDialog = () => {
    setCollectionAmount('')
    setCollectionMode('Cash')
    setCollectionDate(new Date().toISOString().split('T')[0])
    setCollectionNotes('')
  }

  // ── Log Collection ────────────────────────────────────────────────────
  // Both technicians and admins can log a collection
  const handleLogCollection = async () => {
    if (!currentOrgId || !user || !effectiveTechnicianId) return
    const amt = parseFloat(collectionAmount)
    if (!collectionAmount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!collectionDate) {
      toast.error('Please select a date')
      return
    }
    setIsSubmittingCollection(true)
    try {
      const { error } = await supabase.from('technician_collections').insert({
        org_id: currentOrgId,
        technician_id: effectiveTechnicianId,
        amount: amt,
        payment_mode: collectionMode,
        collected_date: collectionDate,
        notes: collectionNotes.trim() || null,
        created_by: user.id,
      })
      if (error) throw error
      toast.success('Collection recorded successfully')
      setCollectionDialogOpen(false)
      resetCollectionDialog()
      loadExpenses(effectiveTechnicianId)
    } catch (error) {
      console.error('Error logging collection:', error)
      toast.error('Failed to record collection')
    } finally {
      setIsSubmittingCollection(false)
    }
  }

  // ── Delete Collection (admin only) ────────────────────────────────────
  const handleConfirmDeleteCollection = async () => {
    if (!currentOrgId || !collectionToDelete || deletingCollection) return
    setDeletingCollection(true)
    try {
      const { error } = await supabase
        .from('technician_collections')
        .delete()
        .eq('id', collectionToDelete.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      toast.success('Collection deleted')
      setCollections((prev) => prev.filter((c) => c.id !== collectionToDelete.id))
      setDeleteCollectionDialogOpen(false)
      setCollectionToDelete(null)
    } catch (error) {
      console.error('Error deleting collection:', error)
      toast.error('Failed to delete collection')
    } finally {
      setDeletingCollection(false)
    }
  }

  // ── Mark Received (admin/owner only) ─────────────────────────────────
  const [markingReceivedId, setMarkingReceivedId] = useState<string | null>(null)

  const handleMarkReceived = async (col: TechnicianCollection) => {
    if (!currentOrgId || markingReceivedId) return
    setMarkingReceivedId(col.id)
    try {
      const { error } = await supabase
        .from('technician_collections')
        .update({ received_at: new Date().toISOString() })
        .eq('id', col.id)
        .eq('org_id', currentOrgId)
      if (error) throw error
      toast.success(`${formatCurrency(col.amount)} marked as received`)
      setCollections((prev) =>
        prev.map((c) => c.id === col.id ? { ...c, received_at: new Date().toISOString() } : c)
      )
    } catch (err) {
      console.error(err)
      toast.error('Failed to mark as received')
    } finally {
      setMarkingReceivedId(null)
    }
  }

  // ── Give Funds ────────────────────────────────────────────────────────
  const handleGiveFunds = async () => {
    if (!currentOrgId || !user || !effectiveTechnicianId) return
    const amt = parseFloat(fundAmount)
    if (!fundAmount || isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setIsSubmittingFund(true)
    try {
      const { error } = await supabase.from('technician_funds').insert({
        org_id: currentOrgId,
        technician_id: effectiveTechnicianId,
        amount: amt,
        notes: fundNotes.trim() || null,
        given_by: user.id,
        given_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Funds given successfully')
      setFundDialogOpen(false)
      resetFundDialog()
      loadExpenses(effectiveTechnicianId)
    } catch (error) {
      console.error('Error giving funds:', error)
      toast.error('Failed to record funds')
    } finally {
      setIsSubmittingFund(false)
    }
  }

  // ── Add Expense ───────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    if (!currentOrgId || !user || !effectiveTechnicianId) return
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
          const path = `${currentOrgId}/${effectiveTechnicianId}-${Date.now()}.jpg`
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
        technician_id: effectiveTechnicianId,
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
      loadExpenses(effectiveTechnicianId)
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

  // ── Helpers ───────────────────────────────────────────────────────────
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

  const handleTechnicianSwitch = (techId: string) => {
    setEffectiveTechnicianId(techId)
    router.replace(`/technician-expenses?tech=${techId}`)
  }

  // ── Loading / guards ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notLinked) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <UserCircle className="size-6 text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground">Account not linked</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your account is not linked to a technician profile yet. Ask your admin to link it.
        </p>
      </div>
    )
  }

  // ── Admin: no technician selected yet ─────────────────────────────────
  if (isAdmin && !effectiveTechnicianId) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Technician Expenses</h1>
          <p className="text-sm text-muted-foreground">Select a technician to view and manage their expenses</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {allTechnicians.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No technicians in your organization yet.
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-md">
                <Label>Choose a technician</Label>
                <Select onValueChange={handleTechnicianSwitch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTechnicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!technician) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Technician not found</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/technicians')}
              className="size-9 shrink-0"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground md:text-2xl truncate">
              {isTechnician ? 'My Expenses' : `${technician.name}'s Expenses`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTechnician ? 'Funds and expenses' : 'Expense Tracker'}
            </p>
          </div>
        </div>

        {/* Admin: quick technician switcher */}
        {isAdmin && allTechnicians.length > 0 && (
          <div className="shrink-0">
            <Select value={effectiveTechnicianId ?? ''} onValueChange={handleTechnicianSwitch}>
              <SelectTrigger className="w-[220px] h-9">
                <UserCircle className="mr-2 size-3.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTechnicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Month filter ───────────────────────────────────────────── */}
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

      {/* ── Summary strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1">
              <HandCoins className="size-4" />
              <p className="text-xs font-medium">Collected</p>
            </div>
            <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(totalCollected)}</p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-0.5">
              {filteredCollections.filter((c) => !c.received_at).length} pending
            </p>
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
              <p className="text-xs font-medium">Net Balance</p>
            </div>
            <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-800 dark:text-green-300' : 'text-orange-800 dark:text-orange-300'}`}>
              {formatCurrency(Math.abs(balance))}
            </p>
            <p className={`text-xs mt-0.5 ${balance >= 0 ? 'text-green-600/70 dark:text-green-500' : 'text-orange-600/70 dark:text-orange-500'}`}>
              {balance >= 0 ? 'With you' : 'Overspent'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Desktop: Transactions table ────────────────────────────── */}
      <Card className="hidden md:block">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5" />
              {monthFilter === 'all' ? 'All Transactions' : formatMonthLabel(monthFilter)}
            </CardTitle>
            <CardDescription>Funds issued and expenses logged</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
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
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => { resetCollectionDialog(); setCollectionDialogOpen(true) }}
            >
              <HandCoins className="size-4" />
              Log Collection
            </Button>
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
                  No funds given yet
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer Collections</h3>
            {loadingExpenses ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                No collections recorded yet — tap &quot;Log Collection&quot; to record cash received from a customer
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg text-sm">
                No collections in {formatMonthLabel(monthFilter)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.map((col) => (
                    <TableRow key={col.id} className={col.received_at ? 'opacity-60' : ''}>
                      <TableCell className="text-sm">{new Date(col.collected_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${col.received_at ? 'text-muted-foreground line-through' : 'text-emerald-700'}`}>
                          {formatCurrency(col.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal bg-emerald-50 text-emerald-800 border-emerald-200">
                          {col.payment_mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{col.notes || '—'}</TableCell>
                      <TableCell>
                        {col.received_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            <CheckCircle2 className="size-3.5" />
                            Received
                          </span>
                        ) : isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                            disabled={markingReceivedId === col.id}
                            onClick={() => handleMarkReceived(col)}
                          >
                            {markingReceivedId === col.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <CheckCircle2 className="size-3.5" />}
                            Mark Received
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {!col.received_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setCollectionToDelete(col); setDeleteCollectionDialogOpen(true) }}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete collection</span>
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

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

      {/* ── Mobile: Transactions ───────────────────────────────────── */}
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
          <div className="flex gap-2 flex-wrap justify-end">
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
              variant="outline"
              size="sm"
              className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => { resetCollectionDialog(); setCollectionDialogOpen(true) }}
            >
              <HandCoins className="size-3.5" />
              Collect
            </Button>
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Collections</p>
          {loadingExpenses ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No collections yet — tap &quot;Collect&quot; to record cash from a customer
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              No collections in {formatMonthLabel(monthFilter)}
            </div>
          ) : (
            <div className="rounded-lg border bg-card divide-y divide-border overflow-hidden">
              {filteredCollections.map((col) => (
                <div key={col.id} className={`flex items-start gap-3 px-4 py-3 ${col.received_at ? 'opacity-60' : ''}`}>
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${col.received_at ? 'bg-green-100' : 'bg-emerald-100'}`}>
                    {col.received_at
                      ? <CheckCircle2 className="size-4 text-green-600" />
                      : <HandCoins className="size-4 text-emerald-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${col.received_at ? 'text-muted-foreground line-through' : 'text-emerald-700'}`}>
                          {formatCurrency(col.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(col.collected_date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 font-normal bg-emerald-50 text-emerald-800 border-emerald-200">
                        {col.payment_mode}
                      </Badge>
                    </div>
                    {col.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{col.notes}</p>
                    )}
                    {col.received_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium mt-1">
                        <CheckCircle2 className="size-3" />
                        Received
                      </span>
                    ) : isAdmin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        disabled={markingReceivedId === col.id}
                        onClick={() => handleMarkReceived(col)}
                      >
                        {markingReceivedId === col.id
                          ? <Loader2 className="size-3 animate-spin" />
                          : <CheckCircle2 className="size-3.5" />}
                        Mark Received
                      </Button>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium mt-1 inline-block">Pending</span>
                    )}
                  </div>
                  {isAdmin && !col.received_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 -mr-2"
                      onClick={() => { setCollectionToDelete(col); setDeleteCollectionDialogOpen(true) }}
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

      {/* ─── Modals ────────────────────────────────────────────────── */}

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

      {/* Log Collection dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="size-5 text-emerald-600" />
              Log Customer Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Record cash or payment received from a customer on-site.
            </p>
            <div className="space-y-2">
              <Label htmlFor="col-amount">Amount (₹) <span className="text-red-500">*</span></Label>
              <Input
                id="col-amount"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 2500"
                value={collectionAmount}
                onChange={(e) => setCollectionAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-mode">Payment Mode <span className="text-red-500">*</span></Label>
              <Select value={collectionMode} onValueChange={setCollectionMode}>
                <SelectTrigger id="col-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-date">Date <span className="text-red-500">*</span></Label>
              <Input
                id="col-date"
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-notes">Notes (optional)</Label>
              <Textarea
                id="col-notes"
                placeholder="e.g. AMC renewal payment for 3rd floor..."
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                className="min-h-20 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCollectionDialogOpen(false); resetCollectionDialog() }}>
                Cancel
              </Button>
              <Button
                onClick={handleLogCollection}
                disabled={isSubmittingCollection}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmittingCollection ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}
                {isSubmittingCollection ? 'Saving...' : 'Log Collection'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete collection dialog (admin only) */}
      <AlertDialog open={deleteCollectionDialogOpen} onOpenChange={setDeleteCollectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {collectionToDelete?.payment_mode} collection of{' '}
              {collectionToDelete ? formatCurrency(collectionToDelete.amount) : ''}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteCollection}
              disabled={deletingCollection}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingCollection ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt lightbox */}
      <Dialog open={!!receiptModalUrl} onOpenChange={(open) => !open && setReceiptModalUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Expense Receipt</DialogTitle></DialogHeader>
          {receiptModalUrl && <img src={receiptModalUrl} alt="Expense receipt" className="max-h-[75vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>

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

    </div>
  )
}

// ─── Page wrapper with Suspense (required for useSearchParams) ─────────────

export default function TechnicianExpensesPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <TechnicianExpensesContent />
      </Suspense>
    </DashboardLayout>
  )
}
