import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, AlertTriangle, Minus, TrendingUp, Truck } from "lucide-react"

interface InventoryMetrics {
  totalItems: number
  lowStockCount: number
  outOfStockCount: number
  totalInventoryValue: number
  partsUsedThisMonth: number
}

interface InventorySummaryStripProps {
  metrics: InventoryMetrics | null
  loading: boolean
  orgId: string
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="size-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function InventorySummaryStrip({
  metrics,
  loading,
  orgId,
}: InventorySummaryStripProps) {
  if (loading || !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const formatINR = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Total Items */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Total Items</span>
              <span className="text-3xl font-bold">{metrics.totalItems}</span>
              <span className="text-xs text-muted-foreground">Active inventory</span>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Package className="size-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Count */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Low Stock</span>
              <span className="text-3xl font-bold text-amber-600">{metrics.lowStockCount}</span>
              <span className="text-xs text-muted-foreground">Below minimum</span>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="size-6 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Out of Stock */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Out of Stock</span>
              <span className="text-3xl font-bold text-red-600">{metrics.outOfStockCount}</span>
              <span className="text-xs text-muted-foreground">Zero available</span>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-red-500/10">
              <Minus className="size-6 text-red-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Inventory Value */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Inventory Value</span>
              <span className="text-3xl font-bold">{formatINR(metrics.totalInventoryValue)}</span>
              <span className="text-xs text-muted-foreground">Total valued stock</span>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="size-6 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Used This Month */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Parts Used</span>
              <span className="text-3xl font-bold">{metrics.partsUsedThisMonth}</span>
              <span className="text-xs text-muted-foreground">This month</span>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-purple-500/10">
              <Truck className="size-6 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
