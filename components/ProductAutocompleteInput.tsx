"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { Tag, Loader2 } from "lucide-react"

interface Product {
  id: string
  name: string
  unit: string | null
  selling_price: number | null
  category: string | null
}

interface ProductAutocompleteInputProps {
  id?: string
  value: string
  orgId: string | null
  placeholder?: string
  onChange: (value: string) => void
  onProductSelect: (product: { description: string; unit: string; unit_price: number }) => void
}

export default function ProductAutocompleteInput({
  id,
  value,
  orgId,
  placeholder = "Service or product description",
  onChange,
  onProductSelect,
}: ProductAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Search products when user types ──────────────────────────────────────
  const search = useCallback(async (query: string) => {
    if (!orgId || query.trim().length < 1) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, selling_price, category")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(7)
      if (!error && data && data.length > 0) {
        setSuggestions(data)
        setOpen(true)
      } else {
        setSuggestions([])
        setOpen(false)
      }
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    setActiveIndex(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 200)
  }

  // ── Select a suggestion ───────────────────────────────────────────────────
  const handleSelect = (product: Product) => {
    onProductSelect({
      description: product.name,
      unit: product.unit ?? "Nos.",
      unit_price: product.selling_price ?? 0,
    })
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  // ── Format price ──────────────────────────────────────────────────────────
  const formatINR = (n: number | null) =>
    n != null ? `₹${n.toLocaleString("en-IN")}` : null

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-8"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          className="
            absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px]
            rounded-xl border border-border bg-popover shadow-lg
            overflow-hidden
          "
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <Tag className="size-3 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Price List
            </span>
          </div>

          {/* Suggestions */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {suggestions.map((product, index) => (
              <li key={product.id}>
                <button
                  type="button"
                  className={`
                    w-full px-3 py-2.5 text-left transition-colors
                    ${index === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60"}
                  `}
                  onMouseDown={(e) => {
                    e.preventDefault() // prevent input blur before click fires
                    handleSelect(product)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Name + category */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[product.category, product.unit].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {/* Price */}
                    {product.selling_price != null && (
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatINR(product.selling_price)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Footer hint */}
          <div className="border-t border-border px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">
              ↑↓ navigate · Enter select · Esc dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
