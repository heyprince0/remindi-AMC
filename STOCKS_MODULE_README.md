# Stocks/Inventory Management Module

This document describes the Stocks/Inventory Management module for Remindi, an AMC management platform for Indian contractors.

## Overview

The Stocks module provides comprehensive inventory management capabilities including:
- Item/product management with SKU tracking
- Stock In/Out with reason and audit trails
- Multi-supplier management
- Category organization
- Low stock and out-of-stock monitoring
- Service integration with automatic stock deduction
- Complete audit ledger of all movements

## Database Schema

All database tables and schemas are defined in `remindi-stocks-schema.sql` and should be deployed to Supabase before using the module. Key tables:

- `inventory_categories` - Item categories (Filters, Pumps, Membranes, etc.)
- `inventory_suppliers` - Supplier/vendor information
- `inventory_items` - Individual inventory products with stock levels
- `inventory_stock_movements` - Complete audit log of all stock movements
- `inventory_technician_stock` - Stock assigned to and held by technicians
- `service_parts_used` - Parts consumed during service completion
- `contract_recommended_parts` - Recommended parts per contract type

## Module Structure

### Route
- **URL**: `/stocks`
- **Role Access**: Admin, Member (technicians have read-only views in some areas)

### Main Page (`app/(dashboard)/stocks/page.tsx`)
Displays:
- Summary strip with 5 key metrics (Total Items, Low Stock Count, Out of Stock, Inventory Value, Parts Used This Month)
- Tabbed interface for different management areas
- PDF export functionality

### Components

#### InventorySummaryStrip.tsx
Displays dashboard metrics:
- Total Items (count of active inventory)
- Low Stock (items below minimum threshold)
- Out of Stock (items with zero quantity)
- Total Inventory Value (current_stock × purchase_price sum)
- Parts Used This Month (aggregated from service_parts_used)

#### ItemsTable.tsx
Searchable, filterable table for inventory management:
- **Filters**: By name/SKU/brand, stock status (In Stock/Low/Out), category
- **Actions**: Add, Edit, Stock In, Stock Out, View History, Delete
- **Stock Status Badge**: Color-coded (green/amber/red) based on inventory level
- **Row Data**: Name, SKU, Category, Current Stock, Status, Inventory Value

#### AddEditItemSheet.tsx
Form for creating/editing inventory items:
- **Fields**: Name, SKU, Category, Brand, Unit, Purchase/Selling Price, Stock Levels, Storage Location, Notes
- **Validation**: Item name required, stock levels must be non-negative
- **Units**: piece, kg, liter, meter, box, pack, pair, set

#### StockInOutDialog.tsx
Quick adjustment dialog for stock movements:
- **Stock In**: Add quantity with reason (Purchase, Returned, Adjustment, Other) and optional supplier
- **Stock Out**: Remove quantity with reason (Returned, Adjustment, Damage, Sample, Other)
- **Validation**: Prevents negative stock, requires reason
- **Creates Audit Record**: Automatically logs to inventory_stock_movements

#### StockHistoryDialog.tsx
Chronological audit log per item:
- **Displays**: Date/time, movement type (In/Out), quantity, reason, notes
- **Sorted**: Most recent first
- **Limited**: Shows last 50 movements

#### StockMovementsTable.tsx
Global stock movements ledger:
- **Filters**: By item name, movement type (In/Out), reason
- **Columns**: Date, Item, Type, Quantity (+/-), Reason, Notes
- **Purpose**: Audit trail for compliance and reconciliation

#### CategoriesTab.tsx
Category management:
- **CRUD Operations**: Create, edit, delete categories
- **Used For**: Organizing inventory items
- **Common Categories**: Filters, Membranes, Pumps, Wiring, Lift Parts, CCTV Accessories, Batteries

#### AddEditCategorySheet.tsx
Simple form for category creation/editing with category name field.

#### SuppliersTab.tsx
Supplier/vendor management:
- **Fields**: Name, Contact Person, Phone, Email, GSTIN, Address
- **Used For**: Tracking stock-in source and supplier info
- **Search**: By name, email, or phone

#### AddEditSupplierSheet.tsx
Form for creating/editing supplier details.

#### ServicePartsDialog.tsx
Integration component for recording parts used during service completion:
- **Accessible From**: Service completion flows
- **Usage**: Select parts and quantities used, triggers `deduct_stock_for_service` RPC
- **Creates**: service_parts_used records, audit movements, stock deductions
- **Atomic**: All changes committed together via RPC to prevent partial failures

## Stock Integration with Services

### Deducting Stock for Completed Services

The module integrates with service completion via the `deduct_stock_for_service` RPC:

**Location**: `lib/stock-integration.ts`

**Function**:
```typescript
deductStockForService(
  orgId: string,
  serviceHistoryId: string,
  technicianId: string,
  parts: Array<{ item_id: string; quantity: number }>
): Promise<boolean>
```

**Behavior**:
1. Creates `service_parts_used` records
2. Deducts from technician stock if available, otherwise from warehouse
3. Creates audit movements for each part
4. All changes committed atomically via RPC

**Integration Point**: Call this function when marking a service as complete. The `ServicePartsDialog` component provides UI for this flow.

**Recommended Parts**: 
```typescript
getRecommendedParts(orgId: string, contractId: string)
```
Returns parts that should be pre-selected based on contract/equipment type.

## Features

### 1. Inventory Dashboard Summary Strip
- **Total Items**: Count of active items
- **Low Stock**: Items at or below min_stock_level
- **Out of Stock**: Items with 0 quantity
- **Inventory Value**: Sum of (current_stock × purchase_price)
- **Parts Used**: Parts consumed in services this month

### 2. Product (Item) Management
- **Add/Edit Items**: Full CRUD with 15+ fields
- **Fields**: Name, SKU, Category, Brand, Unit, Prices, Stock Levels, Storage Location, Notes
- **Image Support**: Optional image_url field for product photos
- **Validation**: Non-negative quantities, required name

### 3. Categories
- **Predefined Examples**: Filters, Membranes, Pumps, Wiring, Lift Parts, CCTV Accessories, Batteries
- **Custom Categories**: Users can create any category
- **Organization**: Group similar items for easier inventory management

### 4. Suppliers
- **Vendor Management**: Track supplier contact and GST information
- **Integration**: Link to stock-in movements and purchase tracking
- **Fields**: Name, Contact Person, Phone, Email, GSTIN, Address

### 5. Stock In/Out
- **Stock In**: Add inventory with reason and optional supplier
- **Stock Out**: Remove inventory with reason (Damage, Sample, Adjustment, etc.)
- **Reasons**: Predefined but flexible for different operations
- **Non-negative Validation**: Prevents accidentally reducing stock below zero

### 6. Audit Ledger
- **Complete Tracking**: Every movement (in/out) is logged
- **Movement Details**: Timestamp, item, type, quantity, reason, reference
- **Compliance**: Useful for audits and reconciliation
- **Reference Tracking**: Links movements to service history when applicable

### 7. Stock Status Monitoring
- **In Stock**: current_stock > min_stock_level
- **Low Stock**: 0 < current_stock ≤ min_stock_level
- **Out of Stock**: current_stock ≤ 0
- **Color-Coded Badges**: Green/Amber/Red status indicators
- **Dashboard Metric**: Count of low-stock items for quick overview

### 8. Service Integration (Most Important)
- **Parts Recording**: When completing a service, technician selects parts used
- **Automatic Deduction**: `deduct_stock_for_service` RPC atomically:
  - Records service_parts_used
  - Deducts from technician stock (if assigned) or warehouse
  - Creates audit movement
- **Recommended Parts**: Pre-populated from contract_recommended_parts
- **Technician Stock**: Separate tracking of stock issued to technicians

### 9. Search & Filtering
- **Items Table**: Filter by name/SKU/brand, status, category
- **Movements Table**: Filter by item, type (in/out), reason
- **Suppliers/Categories**: Search by name
- **All Filterable Across Dates**: Movements ledger supports date filtering

### 10. PDF Export
- **Inventory Report**: Exports dashboard metrics and summary
- **Date Stamped**: Shows export date and current metrics
- **Formatted**: Professional table layout with header and footer

## Business Logic

### Stock Deduction Priority
When a service is completed:
1. **Check Technician Stock**: If technician has assigned stock for the item, deduct from there first
2. **Fall Back to Warehouse**: If technician has no stock, deduct from warehouse (inventory_items.current_stock)
3. **Audit Logging**: Each deduction creates an audit movement with reference to the service

### Low Stock Calculation
Computed at read time (not stored):
```
if current_stock ≤ min_stock_level and current_stock > 0: "Low Stock"
if current_stock ≤ 0: "Out of Stock"
otherwise: "In Stock"
```

### Inventory Value
Calculated as:
```
Sum of (current_stock × purchase_price) for all active items
```
Used for balance sheet and asset tracking.

## Usage Examples

### Recording Parts for a Service
```typescript
import { deductStockForService } from '@/lib/stock-integration';

const parts = [
  { item_id: 'filter-id', quantity: 1 },
  { item_id: 'membrane-id', quantity: 1 },
];

const success = await deductStockForService(
  orgId,
  serviceHistoryId,
  technicianId,
  parts
);
```

### Getting Recommended Parts for a Contract
```typescript
import { getRecommendedParts } from '@/lib/stock-integration';

const parts = await getRecommendedParts(orgId, contractId);
// Returns: [
//   { item_id: '...', item_name: 'Sediment Filter', default_quantity: 1, is_optional: false },
//   { item_id: '...', item_name: 'Carbon Filter', default_quantity: 1, is_optional: false },
// ]
```

## RLS Policies

All inventory tables are protected by Row Level Security:
- Users can access only inventory for their organization
- `org_id` column used for org-scoping on all tables
- Uses `get_user_org_ids()` function to determine user's orgs

## Development Notes

- **No ORM**: Direct Supabase queries used throughout
- **Atomic Operations**: Use `deduct_stock_for_service` RPC for multi-table updates
- **Type Safety**: Full TypeScript interfaces for all entities
- **Error Handling**: All operations wrapped in try/catch with user feedback via toasts
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Accessibility**: Semantic HTML, ARIA attributes, keyboard navigation

## Future Enhancements

- [ ] Barcode scanning for quick stock adjustments
- [ ] Stock reorder alerts and automation
- [ ] Inventory transfer between locations
- [ ] Stock aging and expiration tracking
- [ ] Pricing history and cost tracking
- [ ] Multi-warehouse support
- [ ] Stock reconciliation tools
- [ ] Batch operations (e.g., bulk import)

## Integration Points

### With Service Completion
Use `ServicePartsDialog` component when marking a service as complete to record parts used.

### With Technician Management
Track stock assigned to individual technicians via `inventory_technician_stock` table.

### With Contracts
Use `contract_recommended_parts` to pre-populate parts checklist for specific contract types.

## Database Deployment

Before using this module, run the SQL schema from `remindi-stocks-schema.sql`:

```sql
-- Run in Supabase SQL editor
-- All tables, indexes, RLS policies, and functions will be created
```

This includes:
- All 7 main tables
- Indexes for performance
- RLS policies for security
- `deduct_stock_for_service()` RPC function
- Auto-update trigger for `updated_at`
