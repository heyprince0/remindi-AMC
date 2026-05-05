# Quotation Tool Setup Guide

This guide will help you set up the Quotation Tool for your Remindi AMC management system.

## Overview

The Quotation Tool is a complete solution for creating, managing, and sharing quotations with customers. It includes:

- **Company Profile Management** - Set up your company info, logo, and brand color
- **Quotation Creation** - Create detailed quotations with multiple items, GST, and notes
- **PDF Generation** - Generate professional PDFs with your company branding
- **WhatsApp Integration** - Send quotations directly via WhatsApp
- **Status Tracking** - Track quotations through draft, sent, accepted, rejected, and expired states
- **Customer Management** - Store customer information with each quotation

## Database Setup

### Step 1: Run the Migration

The database schema has been created in `/lib/db-migrations.sql`. You need to run this SQL in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `/lib/db-migrations.sql`
5. Click "Run"

This will create three tables:
- `company_profile` - Stores your company information and branding
- `quotations` - Stores all quotations
- `invoices` - Stores invoices (for future "Convert to Invoice" feature)

All tables have Row Level Security (RLS) enabled to ensure users can only see their own data.

### Step 2: Verify Tables

After running the migration, verify the tables were created:

1. In Supabase dashboard, go to "Table Editor"
2. You should see three new tables: `company_profile`, `quotations`, `invoices`
3. Click on each table to verify the columns are correct

## Features

### 1. Company Profile Settings

Navigate to Settings → Company Profile to:
- Set your company name, email, phone, and address
- Upload your company logo
- Choose a theme color (used in PDF generation)

**Location:** `/quotations/settings/company-profile`

### 2. Create Quotations

1. Go to Quotations page
2. Click "New Quotation"
3. Fill in customer details
4. Add items (description, quantity, unit price)
5. Toggle GST on/off (defaults to 18%)
6. Add optional notes
7. Click "Create Quotation"

**Location:** `/quotations/new`

### 3. View & Manage Quotations

The main Quotations page shows:
- All quotations in a filterable table
- Search by customer name, phone, or quotation number
- Filter by status (Draft, Sent, Accepted, Rejected, Expired)
- Quick actions to view, edit, or delete

**Location:** `/quotations`

### 4. PDF Generation

On the quotation view page:
1. Click "Download PDF"
2. A professional PDF is generated with:
   - Your company header with theme color
   - Customer details
   - Itemized list of services/products
   - Subtotal, GST calculation, and total
   - Amount in words (in Indian Rupees format)
   - Notes section
   - Quotation ID and generation date

**PDF Features:**
- Theme color applied to header and accents
- Company logo (if uploaded)
- Professional table layout with auto-table
- Automatic number-to-words conversion for Indian Rupee format

### 5. WhatsApp Integration

On the quotation view page:
1. Click "Send via WhatsApp"
2. A WhatsApp conversation window opens with a pre-filled message
3. Message includes quotation number, items, and total
4. The quotation status automatically changes to "Sent"

**Requirements:**
- Customer must have a phone number entered
- Phone number can be in any format (will be cleaned automatically)

### 6. Status Management

From the quotation view page, you can set status:
- **Draft** - Initial state when creating a quotation
- **Sent** - After sending via WhatsApp or email
- **Accepted** - Customer has accepted the quotation
- **Rejected** - Customer has rejected the quotation
- **Expired** - Quotation is no longer valid

## Navigation

The Quotations menu item is added to the sidebar between "Contracts" and "Customers":

```
Dashboard
├── Contracts
├── Quotations ← NEW
├── Customers
├── Technicians
├── Service Alerts
├── Service History
├── Reports
└── Settings
```

## File Structure

```
app/(dashboard)/quotations/
├── page.tsx                 # List all quotations
├── new/
│   └── page.tsx            # Create new quotation
└── [id]/
    ├── page.tsx            # View quotation & PDF
    └── edit/
        └── page.tsx        # Edit quotation

app/(dashboard)/settings/
├── page.tsx                # Settings main page
└── company-profile.tsx     # Company profile component
```

## Type Definitions

Added to `/lib/supabase.ts`:

```typescript
type QuotationItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

type Quotation = {
  id: string
  user_id: string
  customer_id: string | null
  quotation_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  items: QuotationItem[]
  subtotal: number
  gst_amount: number
  total_amount: number
  include_gst: boolean
  gst_rate: number
  notes: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  created_at: string
  updated_at: string
}

type CompanyProfile = {
  id: string
  user_id: string
  company_name: string | null
  company_email: string | null
  company_phone: string | null
  company_address: string | null
  company_city: string | null
  company_state: string | null
  company_zip: string | null
  logo_url: string | null
  theme_color: string
  created_at: string
  updated_at: string
}
```

## Dependencies Added

- `jspdf-autotable@5.0.7` - For professional table layouts in PDF generation

## Quotation Number Format

Quotations are automatically assigned numbers in the format: `QT-{timestamp}`

Example: `QT-1715328000000`

This ensures unique quotation numbers without requiring a separate counter table.

## Email Integration (Future)

The WhatsApp integration uses the WhatsApp Web API. For email integration in the future:

1. Add SMTP configuration to environment variables
2. Create an API route `/api/quotations/send-email`
3. Add "Send via Email" button with similar functionality

## Troubleshooting

### PDF not generating
- Check browser console for errors
- Ensure jspdf and jspdf-autotable are installed: `pnpm add jspdf jspdf-autotable`
- Verify company profile has theme_color set

### WhatsApp not opening
- Ensure customer phone number is entered and valid
- Check if WhatsApp Web is working on your device
- Phone format should be +91XXXXXXXXXX for India

### Quotations not showing
- Verify RLS policies are enabled on quotations table
- Check that user is logged in and user_id matches
- Refresh the page to reload data

### Company profile not saving
- Ensure you're logged in
- Check network tab in developer tools for API errors
- Verify company_profile table exists in Supabase

## Next Steps

1. Run the database migration (see Step 1 above)
2. Log in to the application
3. Go to Settings → Company Profile and fill in your details
4. Navigate to Quotations and create your first quotation
5. Test PDF generation and WhatsApp sharing

## Support

For issues or feature requests, check the main README.md or contact support.
