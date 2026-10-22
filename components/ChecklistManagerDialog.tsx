"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  GripVertical,
  ListChecks,
  ChevronUp,
  ChevronDown,
} from "lucide-react"

interface ChecklistItem {
  id: string
  org_id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
}

interface ChecklistManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

const DEFAULT_ITEMS = [
  "PIT SW",
  "UP FINAL TERMINAL",
  "DOWN FINAL TERMINAL",
  "CAR SWITCH GATE",
  "GATE LOCK",
  "STOP",
  "ALARM",
  "FAN",
  "TUBE LIGHT",
]

export default function ChecklistManagerDialog({
  open,
  onOpenChange,
  orgId,
}: ChecklistManagerDialogProps) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newItemName, setNewItemName] = useState("")
  const [addingDefault, setAddingDefault] = useState(false)

  // ── Load checklist items ──────────────────────────────────────────────────

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("*")
        .eq("org_id", orgId)
        .order("display_order")
      if (error) throw error
      setItems(data ?? [])
    } catch {
      toast.error("Failed to load checklist")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && orgId) load()
  }, [open, orgId])

  // ── Add single item ───────────────────────────────────────────────────────

  const handleAdd = async () => {
    const name = newItemName.trim()
    if (!name) return
    setSaving(true)
    try {
      const nextOrder = items.length > 0
        ? Math.max(...items.map((i) => i.display_order)) + 1
        : 0
      const { error } = await supabase
        .from("checklist_templates")
        .insert([{ org_id: orgId, name, display_order: nextOrder, is_active: true }])
      if (error) throw error
      setNewItemName("")
      toast.success("Item added")
      load()
    } catch {
      toast.error("Failed to add item")
    } finally {
      setSaving(false)
    }
  }

  // ── Load default safety items ─────────────────────────────────────────────

  const handleLoadDefaults = async () => {
    setAddingDefault(true)
    try {
      const existingNames = new Set(items.map((i) => i.name.toLowerCase()))
      const toAdd = DEFAULT_ITEMS.filter((d) => !existingNames.has(d.toLowerCase()))
      if (toAdd.length === 0) {
        toast.info("All default items already exist")
        return
      }
      const startOrder = items.length > 0
        ? Math.max(...items.map((i) => i.display_order)) + 1
        : 0
      const rows = toAdd.map((name, idx) => ({
        org_id: orgId,
        name,
        display_order: startOrder + idx,
        is_active: true,
      }))
      const { error } = await supabase.from("checklist_templates").insert(rows)
      if (error) throw error
      toast.success(`Added ${toAdd.length} default items`)
      load()
    } catch {
      toast.error("Failed to add defaults")
    } finally {
      setAddingDefault(false)
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggle = async (item: ChecklistItem) => {
    try {
      const { error } = await supabase
        .from("checklist_templates")
        .update({ is_active: !item.is_active })
        .eq("id", item.id)
        .eq("org_id", orgId)
      if (error) throw error
      setItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, is_active: !i.is_active } : i)
      )
    } catch {
      toast.error("Failed to update item")
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("checklist_templates")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId)
      if (error) throw error
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success("Item removed")
    } catch {
      toast.error("Failed to delete item")
    }
  }

  // ── Move up / down ────────────────────────────────────────────────────────

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newItems = [...items]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newItems.length) return

    // Swap in local state
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]

    // Reassign display_order
    const updated = newItems.map((item, idx) => ({ ...item, display_order: idx }))
    setItems(updated)

    // Persist both rows
    try {
      await Promise.all([
        supabase
          .from("checklist_templates")
          .update({ display_order: updated[index].display_order })
          .eq("id", updated[index].id),
        supabase
          .from("checklist_templates")
          .update({ display_order: updated[swapIndex].display_order })
          .eq("id", updated[swapIndex].id),
      ])
    } catch {
      toast.error("Failed to reorder")
      load() // revert
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Manage Safety Checklist</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                These items appear on every new work report.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">

          {/* Load defaults banner — shown only when list is empty */}
          {!loading && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No checklist items yet. Start with the standard elevator safety checks.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadDefaults}
                disabled={addingDefault}
              >
                {addingDefault ? "Adding..." : "Load Default Safety Items"}
              </Button>
            </div>
          )}

          {/* Items list */}
          {loading ? (
            <p className="text-sm text-center text-muted-foreground py-4">Loading...</p>
          ) : items.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`
                    flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors
                    ${item.is_active
                      ? "border-border bg-background"
                      : "border-border/50 bg-muted/30"}
                  `}
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, "down")}
                      disabled={index === items.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>

                  <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />

                  {/* Name */}
                  <span className={`flex-1 text-sm font-medium truncate ${!item.is_active ? "text-muted-foreground line-through" : ""}`}>
                    {item.name}
                  </span>

                  {/* Active toggle */}
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={() => handleToggle(item)}
                    className="shrink-0"
                  />

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* If has items, show load defaults as link */}
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleLoadDefaults}
              disabled={addingDefault}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline self-start disabled:opacity-50"
            >
              {addingDefault ? "Adding..." : "+ Load default safety items"}
            </button>
          )}

          {/* Add new item */}
          <div className="flex gap-2 border-t border-border pt-4">
            <Input
              placeholder="e.g., BUFFER SPRING"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd() } }}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!newItemName.trim() || saving}
              className="shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground -mt-2">
            Toggle the switch to show or hide an item on reports. Items are ordered top to bottom.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
