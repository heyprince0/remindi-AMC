"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import { Plus, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import AddEditCategorySheet from "./AddEditCategorySheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Category {
  id: string
  org_id: string
  name: string
  created_at: string
}

interface CategoryWithCount extends Category {
  itemCount: number
}

interface CategoriesTabProps {
  orgId: string
}

export default function CategoriesTab({ orgId }: CategoriesTabProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [filteredCategories, setFilteredCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [orgId])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("inventory_categories")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Get item counts per category (only active items)
      const { data: itemsData, error: itemsError } = await supabase
        .from("inventory_items")
        .select("category_id")
        .eq("org_id", orgId)
        .eq("is_active", true)

      if (itemsError) throw itemsError

      const countsByCategory = (itemsData || []).reduce((acc: Record<string, number>, item) => {
        if (item.category_id) {
          acc[item.category_id] = (acc[item.category_id] || 0) + 1
        }
        return acc
      }, {})

      const categoriesWithCount: CategoryWithCount[] = (data || []).map((category) => ({
        ...category,
        itemCount: countsByCategory[category.id] || 0,
      }))

      setCategories(categoriesWithCount)
      setFilteredCategories(categoriesWithCount)
    } catch (error) {
      console.error("Error loading categories:", error)
      toast.error("Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const filtered = categories.filter((category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredCategories(filtered)
  }, [searchTerm, categories])

  const handleDelete = async () => {
    if (!categoryToDelete) return
    setDeleting(true)
    try {
      // Check if any active items reference this category
      const { count, error: countError } = await supabase
        .from("inventory_items")
        .select("*", { count: "exact", head: true })
        .eq("category_id", categoryToDelete.id)
        .eq("org_id", orgId)
        .eq("is_active", true)

      if (countError) throw countError

      if (count && count > 0) {
        toast.error(
          `Cannot delete "${categoryToDelete.name}" – it is used by ${count} active item(s). Remove or reassign them first.`
        )
        setDeleteDialogOpen(false)
        setCategoryToDelete(null)
        return
      }

      // Hard delete if no references
      const { error } = await supabase
        .from("inventory_categories")
        .delete()
        .eq("id", categoryToDelete.id)
        .eq("org_id", orgId)

      if (error) throw error

      setCategories(categories.filter((c) => c.id !== categoryToDelete.id))
      toast.success("Category deleted successfully")
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (error) {
      console.error("Error deleting category:", error)
      toast.error("Failed to delete category")
    } finally {
      setDeleting(false)
    }
  }

  const handleAddCategory = () => {
    setEditingCategory(null)
    setSheetOpen(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setSheetOpen(true)
  }

  const handleSheetSuccess = () => {
    loadCategories()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Manage inventory item categories</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search categories..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={handleAddCategory}>
            <Plus className="mr-2 size-4" />
            Add Category
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading categories...
                  </TableCell>
                </TableRow>
              ) : filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No categories found matching your search" : "No categories yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{category.itemCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(category.created_at).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                            <Edit className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCategoryToDelete(category)
                              setDeleteDialogOpen(true)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add/Edit Category Sheet */}
        <AddEditCategorySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editingCategory={editingCategory}
          orgId={orgId}
          onSuccess={handleSheetSuccess}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{categoryToDelete?.name}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600">
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
