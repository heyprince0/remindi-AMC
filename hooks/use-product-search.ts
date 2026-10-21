"use client"

import { useCallback, useState } from "react"
import { supabase } from "@/lib/supabase"

export type ProductSuggestion = {
  id: string
  name: string
  unit: string
  selling_price: number
  hsn_code: string | null
}

export function useProductSearch(orgId: string | null) {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])

  const search = useCallback(async (query: string) => {
    if (!orgId || query.trim().length < 1) {
      setSuggestions([])
      return
    }

    const { data } = await supabase
      .from("products")
      .select("id, name, unit, selling_price, hsn_code")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .ilike("name", `%${query.trim()}%`)
      .order("name")
      .limit(8)

    setSuggestions(data ?? [])
  }, [orgId])

  const clear = useCallback(() => setSuggestions([]), [])

  return { suggestions, search, clear }
}
