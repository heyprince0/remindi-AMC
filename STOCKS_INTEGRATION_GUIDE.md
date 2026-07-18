# Stocks Module Integration Guide

This guide shows how to integrate the Stocks module with existing service completion flows.

## Quick Start

### Step 1: Import the Components

```typescript
import ServicePartsDialog from '@/app/(dashboard)/stocks/components/ServicePartsDialog'
import { deductStockForService, getRecommendedParts } from '@/lib/stock-integration'
```

### Step 2: Add State for Parts Dialog

```typescript
const [partsDialogOpen, setPartsDialogOpen] = useState(false)
const [serviceHistoryId, setServiceHistoryId] = useState<string | null>(null)
const [technicianId, setTechnicianId] = useState<string | null>(null)
```

### Step 3: Add Dialog to Your Component

```tsx
<ServicePartsDialog
  open={partsDialogOpen}
  onOpenChange={setPartsDialogOpen}
  serviceHistoryId={serviceHistoryId}
  technicianId={technicianId}
  contractId={contractId}
  orgId={currentOrgId}
  onSuccess={() => {
    // Refresh service data if needed
    loadServiceDetails()
    toast.success("Parts recorded successfully")
  }}
/>
```

### Step 4: Trigger Dialog When Marking Service Complete

```typescript
const handleMarkServiceComplete = async () => {
  try {
    // Create/update service_history record
    const { data: serviceData, error } = await supabase
      .from('service_history')
      .update({ status: 'completed' })
      .eq('id', serviceId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error

    // Show parts dialog
    setServiceHistoryId(serviceData.id)
    setTechnicianId(technicianId)
    setPartsDialogOpen(true)
  } catch (error) {
    toast.error('Failed to mark service complete')
  }
}
```

## Complete Example: Service Completion with Parts Recording

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import ServicePartsDialog from '@/app/(dashboard)/stocks/components/ServicePartsDialog'

interface CompleteServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceId: string
  technicianId: string
  contractId: string
  orgId: string
  onSuccess: () => void
}

export function CompleteServiceDialog({
  open,
  onOpenChange,
  serviceId,
  technicianId,
  contractId,
  orgId,
  onSuccess,
}: CompleteServiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  
  // For parts dialog
  const [partsDialogOpen, setPartsDialogOpen] = useState(false)
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null)

  const handleMarkComplete = async () => {
    setLoading(true)
    try {
      // Mark service as completed
      const { data: serviceData, error } = await supabase
        .from('service_history')
        .update({
          status: 'completed',
          notes: notes || null,
        })
        .eq('id', serviceId)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) throw error

      setCreatedServiceId(serviceData.id)
      
      // Show parts dialog if the service was successfully created
      if (serviceData.id) {
        setPartsDialogOpen(true)
      }
    } catch (error) {
      console.error('Error marking service complete:', error)
      toast.error('Failed to mark service complete')
    } finally {
      setLoading(false)
    }
  }

  const handlePartsSuccess = () => {
    setPartsDialogOpen(false)
    onOpenChange(false)
    onSuccess()
    toast.success('Service completed with parts recorded')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Service</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <textarea
              placeholder="Add notes about this service..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={loading}>
              {loading ? 'Processing...' : 'Complete & Record Parts'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parts recording dialog - shown after service is marked complete */}
      <ServicePartsDialog
        open={partsDialogOpen}
        onOpenChange={setPartsDialogOpen}
        serviceHistoryId={createdServiceId}
        technicianId={technicianId}
        contractId={contractId}
        orgId={orgId}
        onSuccess={handlePartsSuccess}
      />
    </>
  )
}
```

## Alternative: Direct Stock Deduction via RPC

If you want to handle parts selection outside of the dialog, use the RPC directly:

```typescript
import { deductStockForService } from '@/lib/stock-integration'

const parts = [
  { item_id: 'filter-1', quantity: 1 },
  { item_id: 'membrane-1', quantity: 1 },
]

const success = await deductStockForService(
  orgId,
  serviceHistoryId,
  technicianId,
  parts
)

if (success) {
  toast.success('Stock deducted successfully')
} else {
  toast.error('Failed to deduct stock')
}
```

## Using Recommended Parts

Get recommended parts for a contract and pre-populate the parts list:

```typescript
import { getRecommendedParts } from '@/lib/stock-integration'

const recommendedParts = await getRecommendedParts(orgId, contractId)

// recommendedParts will be:
// [
//   { item_id: '...', item_name: 'Sediment Filter', default_quantity: 1, is_optional: false },
//   { item_id: '...', item_name: 'Carbon Filter', default_quantity: 1, is_optional: false },
// ]
```

Then in your parts dialog/form, pre-select these items:

```typescript
const [selectedParts, setSelectedParts] = useState<Map<string, number>>(new Map())

useEffect(() => {
  if (contractId) {
    getRecommendedParts(orgId, contractId).then(parts => {
      const partsMap = new Map(parts.map(p => [p.item_id, p.default_quantity]))
      setSelectedParts(partsMap)
    })
  }
}, [contractId])
```

## Integration Points

### Service History Page
Add a "Record Parts" action to completed services:

```typescript
// In your service history table
{service.status === 'completed' && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      setServiceHistoryId(service.id)
      setTechnicianId(service.technician_id)
      setPartsDialogOpen(true)
    }}
  >
    Record Parts
  </Button>
)}
```

### Technician Detail Page
Show parts used in job history:

```typescript
// Link each completed job to service_parts_used
const { data: partsUsed } = await supabase
  .from('service_parts_used')
  .select('inventory_items(name), quantity')
  .eq('service_history_id', serviceId)

// Display: "Filter (1), Membrane (1)" in the job history table
```

### Customer Detail Page
Display total parts used for a customer:

```typescript
// Sum all parts used across customer's services
const { data: partsSummary } = await supabase
  .rpc('get_customer_parts_summary', { p_customer_id: customerId })

// Shows: "Total parts used: 42 items"
```

## Error Handling

The `deduct_stock_for_service` RPC handles errors atomically:

```typescript
const success = await deductStockForService(orgId, serviceId, techId, parts)

if (!success) {
  // All changes rolled back - no partial state
  // Possible causes:
  // - Insufficient stock
  // - Invalid item/service/technician IDs
  // - Database constraints violated
  
  toast.error('Failed to record parts. Please check stock levels.')
}
```

## Testing the Integration

1. **Create a test service** with completed status
2. **Open ServicePartsDialog** for that service
3. **Select a part** and set quantity
4. **Submit** and verify:
   - `service_parts_used` record created
   - `inventory_stock_movements` record created
   - `inventory_items.current_stock` decreased
   - `inventory_technician_stock` decreased (if technician has assigned stock)

## Troubleshooting

### "Failed to record parts"
- Check if service_history_id is valid
- Check if technician_id is valid
- Check if items exist and have sufficient stock

### "Stock goes negative"
- The deduct_stock_for_service RPC validates this
- Ensure min_stock_level is set appropriately
- Consider checking stock before attempting deduction

### "No parts recorded"
- User may have closed dialog without selecting parts (this is okay)
- Check service_parts_used table directly: `SELECT * WHERE service_history_id = ...`

## Next Steps

1. **Test** the module with your existing service workflow
2. **Train** your team on recording parts during service completion
3. **Monitor** stock levels using the dashboard summary
4. **Adjust** min/max stock levels based on usage patterns
5. **Add** recommended parts for your common contract types
6. **Issue** stock to technicians and track via technician_stock table

## API Reference

### `deductStockForService()`
```typescript
Promise<boolean>

Params:
- orgId: string - Organization ID
- serviceHistoryId: string - Service history record ID
- technicianId: string - Technician who performed service
- parts: Array<{item_id: string, quantity: number}>

Returns: true if successful, false otherwise
```

### `getRecommendedParts()`
```typescript
Promise<Array<{
  item_id: string
  item_name: string
  default_quantity: number
  is_optional: boolean
}>>

Params:
- orgId: string - Organization ID
- contractId: string - Contract ID

Returns: Array of recommended parts for the contract
```

### `hasTechnicianStock()`
```typescript
Promise<boolean>

Params:
- orgId: string - Organization ID
- technicianId: string - Technician ID

Returns: true if technician has any assigned stock
```

### `getItemStock()`
```typescript
Promise<number>

Params:
- orgId: string - Organization ID
- itemId: string - Item ID

Returns: Current stock quantity
```
