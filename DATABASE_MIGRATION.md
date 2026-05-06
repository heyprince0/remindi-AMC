# Database Migration Guide for Quotations Update

## Quick Start

If you're starting fresh with no existing quotations:

### Step 1: Go to Supabase
1. Open your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy the Complete Migration

Copy and paste the entire contents of `/lib/db-migrations.sql` into the query editor.

### Step 3: Run the Migration

Click **Run** to execute the migration.

---

## For Existing Data (Migrate Old Quotations)

If you already have quotations in the database, follow these steps:

### Step 1: Add New Columns

Run this SQL first:

```sql
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS quote_no TEXT,
ADD COLUMN IF NOT EXISTS client_district TEXT,
ADD COLUMN IF NOT EXISTS client_state TEXT,
ADD COLUMN IF NOT EXISTS client_pin_code TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS body_text TEXT,
ADD COLUMN IF NOT EXISTS sgst NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valid_till DATE;
```

### Step 2: Migrate Data

Map old column names to new ones:

```sql
UPDATE quotations
SET 
  client_name = customer_name,
  client_address = customer_address,
  quote_no = quotation_number,
  sgst = CASE WHEN include_gst THEN (subtotal * 0.09)::NUMERIC(10,2) ELSE 0 END,
  cgst = CASE WHEN include_gst THEN (subtotal * 0.09)::NUMERIC(10,2) ELSE 0 END,
  grand_total = CASE WHEN include_gst THEN subtotal + (subtotal * 0.18)::NUMERIC(10,2) ELSE subtotal END
WHERE client_name IS NULL;
```

### Step 3: Drop Old Columns

Once the data is migrated and verified, drop the old columns:

```sql
ALTER TABLE quotations
DROP COLUMN IF EXISTS customer_email,
DROP COLUMN IF EXISTS customer_phone,
DROP COLUMN IF EXISTS customer_id,
DROP COLUMN IF EXISTS quotation_number,
DROP COLUMN IF EXISTS gst_amount,
DROP COLUMN IF EXISTS total_amount,
DROP COLUMN IF EXISTS customer_name,
DROP COLUMN IF EXISTS customer_address;
```

### Step 4: Verify Migration

Check that the new columns have data:

```sql
SELECT 
  id,
  quote_no,
  client_name,
  client_district,
  client_state,
  client_pin_code,
  subject,
  body_text,
  sgst,
  cgst,
  grand_total
FROM quotations
LIMIT 5;
```

---

## Schema Reference

### New Quotations Table Structure

```sql
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_no TEXT,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_city TEXT,
  client_district TEXT,
  client_state TEXT,
  client_pin_code TEXT,
  client_gstin TEXT,
  subject TEXT,
  body_text TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(10, 2) DEFAULT 0,
  sgst NUMERIC(10, 2) DEFAULT 0,
  cgst NUMERIC(10, 2) DEFAULT 0,
  grand_total NUMERIC(10, 2) DEFAULT 0,
  include_gst BOOLEAN DEFAULT true,
  gst_rate NUMERIC(5, 2) DEFAULT 18,
  notes TEXT,
  status TEXT DEFAULT 'Draft',
  valid_till DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
```

### Column Descriptions

| Column | Type | Description | Required |
|--------|------|-------------|----------|
| id | UUID | Unique identifier | Yes |
| user_id | UUID | Owner of the quotation | Yes |
| quote_no | TEXT | Quotation number (e.g., QT-001) | No |
| client_name | TEXT | Customer/Client name | Yes |
| client_address | TEXT | Customer address | No |
| client_city | TEXT | Customer city | No |
| client_district | TEXT | Customer district (NEW) | No |
| client_state | TEXT | Customer state (NEW) | No |
| client_pin_code | TEXT | Customer pin code (NEW) | No |
| client_gstin | TEXT | Customer GSTIN for invoicing | No |
| subject | TEXT | Quotation subject (NEW) | No |
| body_text | TEXT | Letter body text (NEW) | No |
| items | JSONB | Array of line items | No |
| subtotal | NUMERIC | Sum of all items amount | No |
| sgst | NUMERIC | SGST amount (9%) (NEW) | No |
| cgst | NUMERIC | CGST amount (9%) (NEW) | No |
| grand_total | NUMERIC | Total with taxes (NEW) | No |
| include_gst | BOOLEAN | Whether to include GST | No |
| gst_rate | NUMERIC | GST rate (default 18) | No |
| notes | TEXT | Terms & conditions | No |
| status | TEXT | Draft/Sent/Accepted/Rejected | No |
| valid_till | DATE | Validity date (NEW) | No |
| created_at | TIMESTAMP | Creation timestamp | Auto |
| updated_at | TIMESTAMP | Last update timestamp | Auto |

---

## Rollback Instructions

If you need to revert the migration:

### Option A: Drop and Recreate (Full Rollback)

```sql
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS company_profile;
```

Then run the original migration again.

### Option B: Keep Data and Revert Schema

To keep the data but revert to old schema:

```sql
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_id UUID,
ADD COLUMN IF NOT EXISTS quotation_number TEXT,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);

UPDATE quotations
SET
  customer_name = client_name,
  customer_address = client_address,
  quotation_number = quote_no,
  gst_amount = sgst + cgst,
  total_amount = grand_total
WHERE customer_name IS NULL;

ALTER TABLE quotations
DROP COLUMN IF EXISTS quote_no,
DROP COLUMN IF EXISTS client_district,
DROP COLUMN IF EXISTS client_state,
DROP COLUMN IF EXISTS client_pin_code,
DROP COLUMN IF EXISTS subject,
DROP COLUMN IF EXISTS body_text,
DROP COLUMN IF EXISTS sgst,
DROP COLUMN IF EXISTS cgst,
DROP COLUMN IF EXISTS grand_total,
DROP COLUMN IF EXISTS valid_till,
DROP COLUMN IF EXISTS client_name,
DROP COLUMN IF EXISTS client_address;
```

---

## Verification Checklist

After migration, verify:

```sql
-- Check table exists and has data
SELECT COUNT(*) as quotation_count FROM quotations;

-- Check new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='quotations' 
ORDER BY column_name;

-- Check RLS policies are enabled
SELECT tablename 
FROM pg_tables 
WHERE tablename='quotations';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename='quotations';
```

---

## Common Issues

### Error: "Cannot drop column X, it is still being used"
- Check if there are views or functions using the column
- If you created views, drop them first

### Error: "Constraint violation"
- Foreign keys might be preventing changes
- Add `CASCADE` to the DROP COLUMN statement

### Data migration shows 0 rows updated
- Existing data might already be migrated
- Check if `client_name IS NOT NULL` in all rows
- Run `SELECT COUNT(*) FROM quotations WHERE client_name IS NULL` to verify

### Missing indexes after migration
- Run the CREATE INDEX statements from `db-migrations.sql`

---

## Support

If you encounter issues during migration:

1. **Check the Supabase logs**: Database → Migrations
2. **Verify connection**: Try running `SELECT 1` in SQL Editor
3. **Check permissions**: Ensure you have write access to the database
4. **Contact Support**: Open a support ticket with the error message

---

## Migration Complete!

Once migration is complete:

✅ New form will work correctly  
✅ New PDF layout will display  
✅ All new fields will be saved  
✅ Existing data (if any) will be preserved  

You're ready to use the updated Quotations system!
