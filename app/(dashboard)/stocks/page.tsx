"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Package, AlertTriangle, Minus, TrendingUp, Truck, Plus, Download } from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import InventorySummaryStrip from "./components/InventorySummaryStrip"
import ItemsTable from "./components/ItemsTable"
import StockMovementsTable from "./components/StockMovementsTable"
import SuppliersTab from "./components/SuppliersTab"
import CategoriesTab from "./components/CategoriesTab"
import { usePlanLimits } from "@/lib/hooks/use-plan-limits"
import LimitReachedModal from "@/components/billing/limit-reached-modal"

interface InventoryMetrics {
  totalItems: number
  lowStockCount: number
  outOfStockCount: number
  totalInventoryValue: number
  partsUsedThisMonth: number
}

export default function StocksPage() {
  const { user } = useAuth()
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("items")
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Plan limits
  const { maxInventory, currentInventoryCount, status } = usePlanLimits(currentOrgId)

  // Limit modal state
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitModalType, setLimitModalType] = useState<'expired' | 'resource-limit'>('expired')
  const [limitModalCustom, setLimitModalCustom] = useState<{ title?: string; description?: string }>({})

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to fetch organization:", error)
            toast.error("Could not determine your organization")
          } else if (data?.org_id) {
            setCurrentOrgId(data.org_id)
          }
        })
    }
  }, [user?.id])

  useEffect(() => {
    if (currentOrgId) {
      loadMetrics()
    }
  }, [currentOrgId, refreshTrigger])

  const loadMetrics = async () => {
    if (!currentOrgId) return
    setLoading(true)
    try {
      // Fetch all items with current stock
      const { data: itemsData, error: itemsError } = await supabase
        .from("inventory_items")
        .select("id, current_stock, min_stock_level, purchase_price")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)

      if (itemsError) throw itemsError

      const items = itemsData || []

      const totalItems = items.length
      const lowStockCount = items.filter(
        (item) => item.current_stock <= item.min_stock_level && item.current_stock > 0
      ).length
      const outOfStockCount = items.filter((item) => item.current_stock <= 0).length
      const totalInventoryValue = items.reduce((sum, item) => {
        return sum + (item.current_stock * (item.purchase_price || 0))
      }, 0)

      // Fetch parts used this month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0]
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0]

      const { data: partsData, error: partsError } = await supabase
        .from("service_parts_used")
        .select("quantity")
        .eq("org_id", currentOrgId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)

      if (partsError) throw partsError

      const { data: usedMovementsData, error: usedMovementsError } = await supabase
        .from("inventory_stock_movements")
        .select("quantity")
        .eq("org_id", currentOrgId)
        .eq("movement_type", "out")
        .eq("reason", "Used")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)

      if (usedMovementsError) throw usedMovementsError

      const partsUsedThisMonth =
        (partsData || []).reduce((sum, part) => sum + (part.quantity || 0), 0) +
        (usedMovementsData || []).reduce((sum, movement) => sum + (movement.quantity || 0), 0)

      setMetrics({
        totalItems,
        lowStockCount,
        outOfStockCount,
        totalInventoryValue,
        partsUsedThisMonth,
      })
    } catch (error) {
      console.error("Error loading metrics:", error)
      toast.error("Failed to load inventory metrics")
    } finally {
      setLoading(false)
    }
  }

  // ✅ Check limits – only called when clicking Add Item
  const checkAndShowLimitModal = () => {
    if (status === 'expired' || status === 'cancelled') {
      setLimitModalType('expired')
      setLimitModalCustom({})
      setShowLimitModal(true)
      return true
    }
    if (maxInventory > 0 && currentInventoryCount >= maxInventory) {
      setLimitModalType('resource-limit')
      setLimitModalCustom({
        title: "You've reached your inventory limit",
        description: `Your current plan allows a maximum of ${maxInventory} inventory items. You currently have ${currentInventoryCount} items. Upgrade to add more items.`,
      })
      setShowLimitModal(true)
      return true
    }
    return false
  }

  const handleAddItem = () => {
    if (checkAndShowLimitModal()) return
    // Trigger add item in ItemsTable via a ref or state
    // We'll use a custom event or prop method
    document.dispatchEvent(new CustomEvent('open-add-item-sheet'))
  }

  const handleUpgrade = () => {
    window.location.href = '/billing'
  }

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [22, 45, 60]
  }

  const exportInventoryPDF = () => {
    if (!metrics) {
      toast.error("No data to export")
      return
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageW = 297
      const margin = 15
      const themeColor = "#162d3c"
      const [r, g, b] = hexToRgb(themeColor)

      doc.setFillColor(r, g, b)
      doc.rect(0, 0, pageW, 14, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Inventory Report", margin, 9)
      doc.setTextColor(200, 200, 200)
      doc.setFontSize(8)
      doc.text("STOCKS MANAGEMENT", pageW - margin, 9, { align: "right" })

      const dateStr = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(8)
      doc.text(
        `Exported: ${dateStr}  |  Total Items: ${metrics.totalItems}  |  Low Stock: ${metrics.lowStockCount}  |  Out of Stock: ${metrics.outOfStockCount}`,
        margin,
        22
      )

      const metricsData = [
        ["Total Items", metrics.totalItems],
        ["Low Stock Items", metrics.lowStockCount],
        ["Out of Stock", metrics.outOfStockCount],
        ["Total Inventory Value", `Rs. ${metrics.totalInventoryValue.toLocaleString("en-IN")}`],
        ["Parts Used This Month", metrics.partsUsedThisMonth],
      ]

      autoTable(doc, {
        startY: 28,
        head: [["Metric", "Value"]],
        body: metricsData.map((row) => [row[0], String(row[1])]),
        theme: "striped",
        headStyles: {
          fillColor: [r, g, b],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 60 },
        },
        margin: { left: margin, right: margin },
      })

      const finalY = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text("Generated by Remindi · remindi.online", pageW / 2, finalY, { align: "center" })

      doc.save(`Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Inventory report exported successfully")
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast.error("Failed to export inventory report")
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">Manage your stock, items, and parts inventory</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportInventoryPDF} disabled={loading || !metrics}>
              <Download className="mr-2 size-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Inventory Summary Strip */}
        {currentOrgId && (
          <InventorySummaryStrip
            metrics={metrics}
            loading={loading}
            orgId={currentOrgId}
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="items">
              Items ({currentInventoryCount || 0})
            </TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4">
            {currentOrgId && (
              <ItemsTable
                orgId={currentOrgId}
                onItemsChange={loadMetrics}
                onAddItem={handleAddItem}
              />
            )}
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            {currentOrgId && (
              <StockMovementsTable orgId={currentOrgId} />
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            {currentOrgId && (
              <CategoriesTab orgId={currentOrgId} />
            )}
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            {currentOrgId && (
              <SuppliersTab orgId={currentOrgId} />
            )}
          </TabsContent>
        </Tabs>

        {/* Limit Reached Modal */}
        <LimitReachedModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          type={limitModalType}
          onUpgrade={handleUpgrade}
          customTitle={limitModalCustom.title}
          customDescription={limitModalCustom.description}
        />
      </div>
    </DashboardLayout>
  )
}
