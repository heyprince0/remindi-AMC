"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase, type Contract, type Customer, calculateNextServiceDate } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

const contractSchema = z.object({
  contract_name: z.string().min(1, "Contract name is required"),
  customer_id: z.string().min(1, "Customer is required"),
  service_type: z.string().min(1, "Service type is required"),
  frequency_days: z.string().min(1, "Frequency is required"),
  start_date: z.string().min(1, "Start date is required"),
  status: z.string().default("Active"),
  notes: z.string().optional(),
})

type ContractFormValues = z.infer<typeof contractSchema>

interface AddContractModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editingContract?: Contract | null
}

export function AddContractModal({
  open,
  onOpenChange,
  onSuccess,
  editingContract,
}: AddContractModalProps) {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [nextServiceDate, setNextServiceDate] = useState("")

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contract_name: editingContract?.contract_name || "",
      customer_id: editingContract?.customer_id || "",
      service_type: editingContract?.service_type || "",
      frequency_days: editingContract?.frequency_days.toString() || "",
      start_date: editingContract?.start_date || "",
      status: editingContract?.status || "Active",
      notes: editingContract?.notes || "",
    },
  })

  const frequencyOptions = [
    { label: "30 days (Monthly)", value: "30" },
    { label: "60 days (Every 2 months)", value: "60" },
    { label: "90 days (Quarterly)", value: "90" },
    { label: "180 days (Every 6 months)", value: "180" },
    { label: "365 days (Yearly)", value: "365" },
  ]

  const serviceTypes = [
    "AC",
    "Lift",
    "RO Water Purifier",
    "CCTV",
    "Pest Control",
    "Generator",
    "Fire Safety",
    "UPS",
    "Other",
  ]

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        if (!user?.id) return

        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)

        if (error) throw error
        setCustomers(data || [])
      } catch (error) {
        console.error("Error loading customers:", error)
        toast.error("Failed to load customers")
      } finally {
        setLoadingCustomers(false)
      }
    }

    loadCustomers()
  }, [user?.id])

  // Calculate next service date when start_date or frequency_days changes
  useEffect(() => {
    const startDate = form.watch("start_date")
    const frequencyDays = form.watch("frequency_days")

    if (startDate && frequencyDays) {
      const nextDate = calculateNextServiceDate(startDate, parseInt(frequencyDays))
      setNextServiceDate(nextDate)
    }
  }, [form.watch("start_date"), form.watch("frequency_days")])

  const onSubmit = async (values: ContractFormValues) => {
    try {
      setLoading(true)

      if (!user?.id) {
        toast.error("User not authenticated")
        return
      }

      const contractData = {
        user_id: user.id,
        customer_id: values.customer_id,
        contract_name: values.contract_name,
        service_type: values.service_type,
        frequency_days: parseInt(values.frequency_days),
        start_date: values.start_date,
        next_service_date: nextServiceDate,
        status: values.status.toLowerCase(),
        notes: values.notes || null,
      }

      if (editingContract) {
        // Update existing contract
        const { error } = await supabase
          .from("contracts")
          .update(contractData)
          .eq("id", editingContract.id)

        if (error) throw error
        toast.success("Contract updated successfully")
      } else {
        // Create new contract
        const { error } = await supabase
          .from("contracts")
          .insert([contractData])

        if (error) throw error
        toast.success("Contract added successfully")
      }

      onOpenChange(false)
      form.reset()
      onSuccess()
    } catch (error) {
      console.error("Error saving contract:", error)
      toast.error("Failed to save contract")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingContract ? "Edit Contract" : "Add Contract"}
          </DialogTitle>
          <DialogDescription>
            {editingContract
              ? "Update the contract details below"
              : "Fill in the details to create a new contract"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contract Name */}
            <FormField
              control={form.control}
              name="contract_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contract name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingCustomers ? (
                        <SelectItem value="">Loading customers...</SelectItem>
                      ) : customers.length === 0 ? (
                        <SelectItem value="">No customers found</SelectItem>
                      ) : (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Service Type */}
            <FormField
              control={form.control}
              name="service_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Frequency */}
            <FormField
              control={form.control}
              name="frequency_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(new Date(field.value), "MMM dd, yyyy")
                            : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(
                              date.toISOString().split("T")[0]
                            )
                          }
                        }}
                        disabled={(date) =>
                          date > new Date() ||
                          date <
                            new Date(new Date().setFullYear(new Date().getFullYear() - 1))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Next Service Date (Auto-calculated) */}
            {nextServiceDate && (
              <FormItem>
                <FormLabel>Next Service Date</FormLabel>
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {format(new Date(nextServiceDate), "MMM dd, yyyy")}
                  </span>
                </div>
                <FormDescription>
                  Automatically calculated based on start date and frequency
                </FormDescription>
              </FormItem>
            )}

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Contract"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
