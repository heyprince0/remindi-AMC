"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Category {
  id: string
  org_id: string
  name: string
  created_at: string
}

interface AddEditCategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCategory: Category | null
  orgId: string
  onSuccess: () => void
}

export default function AddEditCategorySheet({
  open,
  onOpenChange,
  editingCategory,
  orgId,
  onSuccess,
}: AddEditCategorySheetProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name)
    } else {
      setName("")
    }
  }, [editingCategory, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!name.trim()) {
        toast.error("Category name is required")
        return
      }

      const categoryData = {
        org_id: orgId,
        name: name.trim(),
      }

      if (editingCategory) {
        const { error } = await supabase
          .from("inventory_categories")
          .update(categoryData)
          .eq("id", editingCategory.id)
          .eq("org_id", orgId)

        if (error) throw error
        toast.success("Category updated successfully")
      } else {
        const { error } = await supabase
          .from("inventory_categories")
          .insert([categoryData])

        if (error) throw error
        toast.success("Category created successfully")
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("Error saving category:", error)
      toast.error("Failed to save category")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-xl">
            {editingCategory ? "Edit Category" : "Add New Category"}
          </SheetTitle>
          <SheetDescription>
            {editingCategory ? "Update category name" : "Create a new inventory category"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Filters, Pumps, Membranes"
                className="rounded-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={loading} className="rounded-lg">
            {loading ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
