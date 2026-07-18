import { supabase } from "@/lib/supabase"

/**
 * Deduct stock for a completed service
 * Calls the deduct_stock_for_service RPC which atomically:
 * 1. Creates service_parts_used records
 * 2. Updates technician_stock or warehouse stock
 * 3. Creates audit movements
 * 
 * @param orgId - Organization ID
 * @param serviceHistoryId - Service history record ID
 * @param technicianId - Technician who performed the service
 * @param parts - Array of {item_id, quantity} objects
 * @returns Success boolean
 */
export async function deductStockForService(
  orgId: string,
  serviceHistoryId: string,
  technicianId: string,
  parts: Array<{ item_id: string; quantity: number }>
): Promise<boolean> {
  try {
    if (!parts || parts.length === 0) {
      return true // No parts to deduct is not an error
    }

    const { error } = await supabase.rpc("deduct_stock_for_service", {
      p_org_id: orgId,
      p_service_history_id: serviceHistoryId,
      p_technician_id: technicianId,
      p_parts: parts,
    })

    if (error) {
      console.error("RPC error:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error deducting stock:", error)
    return false
  }
}

/**
 * Get recommended parts for a service based on contract/equipment
 * Returns parts that should be checked off during service completion
 * 
 * @param orgId - Organization ID
 * @param contractId - Contract ID
 * @returns Array of recommended parts with quantities
 */
export async function getRecommendedParts(
  orgId: string,
  contractId: string
): Promise<Array<{ item_id: string; item_name: string; default_quantity: number; is_optional: boolean }>> {
  try {
    const { data: recommendedParts, error } = await supabase
      .from("contract_recommended_parts")
      .select(
        `
        item_id,
        default_quantity,
        is_optional,
        inventory_items!inner(name)
        `
      )
      .eq("org_id", orgId)
      .eq("contract_id", contractId)

    if (error) {
      console.error("Error fetching recommended parts:", error)
      return []
    }

    return (recommendedParts || []).map((part: any) => ({
      item_id: part.item_id,
      item_name: part.inventory_items?.[0]?.name || "Unknown",
      default_quantity: part.default_quantity || 1,
      is_optional: part.is_optional || false,
    }))
  } catch (error) {
    console.error("Error getting recommended parts:", error)
    return []
  }
}

/**
 * Check if a technician has assigned stock
 * 
 * @param orgId - Organization ID
 * @param technicianId - Technician ID
 * @returns True if technician has any assigned stock
 */
export async function hasTechnicianStock(
  orgId: string,
  technicianId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("inventory_technician_stock")
      .select("id")
      .eq("org_id", orgId)
      .eq("technician_id", technicianId)
      .gte("quantity", 1)
      .limit(1)

    if (error) throw error
    return (data && data.length > 0) || false
  } catch (error) {
    console.error("Error checking technician stock:", error)
    return false
  }
}

/**
 * Get current stock level for an item
 * 
 * @param orgId - Organization ID
 * @param itemId - Item ID
 * @returns Current stock quantity
 */
export async function getItemStock(
  orgId: string,
  itemId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("current_stock")
      .eq("org_id", orgId)
      .eq("id", itemId)
      .single()

    if (error) throw error
    return data?.current_stock || 0
  } catch (error) {
    console.error("Error getting item stock:", error)
    return 0
  }
}
