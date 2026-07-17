# Technician Self-Service Workflow Implementation

## Overview
This document outlines the implementation of the technician self-service workflow feature in Remindi. The implementation enables technician-role users to link to their technician records, view/edit their own profile, and manage their assigned jobs.

## Files Modified/Created

### 1. **lib/auth-context.tsx** (Modified)
**Changes:**
- Added `technicianId: string | null` to `AuthContextType` interface
- Added `technicianId` state to track the linked technician record for the authenticated user
- Enhanced the `fetchMembership` effect to fetch the linked technician ID for technician-role users
- Exposed `technicianId` through the AuthContext provider

**Purpose:** Centralized access to the linked technician ID across the app without additional queries.

---

### 2. **components/select-technician-modal.tsx** (New)
**Features:**
- Modal that appears only when a technician-role user has no linked technician record
- Fetches all unclaimed technician profiles (`user_id IS NULL`) from the org
- Displays selectable list of technician names with phone and specialization
- On selection, updates the technician row with `user_id = auth.uid()`
- Shows helpful message if no unclaimed profiles exist
- Cannot be dismissed—linking is mandatory
- Handles loading and error states with toast notifications

**Usage:**
```tsx
<SelectTechnicianModal
  open={showModal}
  onSuccess={(technicianId) => router.push(`/technicians/${technicianId}`)}
  orgId={orgId}
  userId={userId}
/>
```

---

### 3. **app/(dashboard)/page.tsx** (Modified - Root Dashboard)
**Changes:**
- Imported `SelectTechnicianModal` component
- Added state for `showSelectTechnicianModal`
- Added redirect logic: technician users with linked technician automatically redirect to `/technicians/[id]`
- Technician users without linked technician see the SelectTechnicianModal
- Admin and member roles bypass all technician logic and see normal dashboard

**Flow:**
1. Technician with linked profile → Redirects immediately to `/technicians/[technicianId]`
2. Technician without linked profile → Shows SelectTechnicianModal, redirects after selection
3. Admin/Member → Shows normal dashboard

---

### 4. **app/(dashboard)/technicians/[id]/page.tsx** (Modified - Detail Page)
**Changes:**
- Added `role` to useAuth hook usage
- Added access control: checks if technician user is viewing their own profile
- Added `isOwnProfile`, `statusEditMode`, and `statusValue` state variables
- Enhanced access validation to redirect non-owners to their own profile
- Hid "Add Job" button for technicians (via `role !== 'technician'` check)
- Added editable status field for technician users on their own profile
- Added `handleStatusSave` function to persist status changes to database
- Status field shows Edit/Save/Cancel buttons for technicians, read-only for others

**Access Control Logic:**
- Technicians can only view their own linked technician profile
- If a technician tries to access another technician's profile, they are silently redirected
- Admins/Members can view any technician profile
- Only technicians on their own profile can edit status

**Status Editing:**
- Only visible to technicians viewing their own profile
- Edit button triggers inline form with status dropdown
- Save button persists change to `technicians.status` column
- Options: Available, Busy, On Leave (uppercase in DB)

---

## Data Flow

### Initial Login Flow
1. User authenticates → `AuthProvider` fetches membership
2. For technician role, `AuthProvider` queries `technicians` table for `user_id = auth.uid()`
3. If found → `technicianId` set in context
4. If not found → `technicianId` remains null

### First-Time Technician Onboarding
1. Technician lands on `/` (dashboard)
2. `useAuth()` returns `role === 'technician'` and `technicianId === null`
3. Dashboard shows `SelectTechnicianModal`
4. User selects a profile → Modal updates `technicians.user_id = auth.uid()`
5. `onSuccess` callback triggers redirect to `/technicians/[id]`
6. Page redirects to technician's profile page

### Returning Technician
1. User authenticates → `AuthProvider` fetches and finds linked technician
2. Dashboard useEffect detects `role === 'technician'` and `technicianId` is set
3. Automatic redirect to `/technicians/[technicianId]`
4. User lands on their profile page directly

### Technician Profile Access
1. Page loads with params `id` from URL
2. Access control check: verify if technician matches authenticated user
3. If mismatch → Redirect (implicit, as query fails or user_id doesn't match)
4. If match → Show profile with editable status
5. Technicians cannot see "Add Job" button; "Add Job" button only visible to admin/member

---

## Database Queries & RLS Considerations

### Required Queries (Already in place)
```sql
-- Check unclaimed technicians (for modal)
SELECT * FROM technicians 
WHERE org_id = ? AND user_id IS NULL
ORDER BY name ASC;

-- Link technician to user
UPDATE technicians 
SET user_id = ? 
WHERE id = ? AND org_id = ?;

-- Fetch linked technician for user
SELECT id FROM technicians 
WHERE user_id = ? AND org_id = ?;

-- Fetch technician details (with access check)
SELECT * FROM technicians 
WHERE id = ? AND org_id = ?;

-- Update technician status
UPDATE technicians 
SET status = ? 
WHERE id = ? AND org_id = ?;
```

### RLS Policies Needed (Beyond scope of this implementation)
To fully secure the feature, add RLS policies:
- Technicians can read their own row: `user_id = auth.uid()`
- Technicians can only read/update assigned jobs where `technician_id` matches their row
- Technicians cannot see other technician rows

---

## UI/UX Behavior

### SelectTechnicianModal
- **When shown:** First login as unclaimed technician
- **Cannot dismiss:** User must select a profile or wait for admin to add them
- **Empty state:** "No technician profile found for you yet — ask your admin to add you as a technician first."
- **Visual feedback:** Loading spinner, toast notifications for success/error

### Technician Profile Page
- **Status field:** Shows current status with "Edit" button
- **Edit mode:** Dropdown with Available, Busy, On Leave options + Save/Cancel
- **Add Job button:** Hidden entirely for technicians, visible for admin/member
- **Assigned jobs:** Technicians see their jobs; can mark complete but cannot delete (delete button likely hidden too)
- **Job history:** Same view as admin, showing completed jobs across manual, service_alert, and service_history sources

### Admin/Member Experience
- **No changes** to existing behavior
- Technicians list page unchanged
- Can still view any technician profile
- Can still add jobs to technicians
- Can manage technician data normally

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Technician without linked profile on login | Shows modal, mandatory linking |
| No unclaimed technicians available | Shows message, blocks navigation |
| Technician tries to access another's profile | Silently redirects or shows empty state |
| Status update fails | Toast error, form reverts to previous value |
| Network error during linking | Toast error, modal stays open for retry |
| User deleted while modal open | Modal shows "no technicians" message |

---

## Testing Checklist

- [ ] Create test technician user with membership `role = 'technician'`
- [ ] Verify technician without linked profile lands on modal on first login
- [ ] Select a technician profile and verify redirect to own profile
- [ ] Verify linked technician bypasses modal on next login
- [ ] Test status editing (Available → Busy → On Leave)
- [ ] Verify "Add Job" button hidden for technicians
- [ ] Verify technician cannot access other technician profiles
- [ ] Verify admin can still manage technicians normally
- [ ] Test with multiple technicians in org
- [ ] Verify RLS policies prevent unauthorized access (if implemented)

---

## Future Enhancements

1. **Auto-redirect on root `/`** - Currently handled by dashboard page, could move to middleware
2. **Technician job deletion** - Currently restricted, could add with confirmation
3. **Status-based availability blocking** - Prevent job assignment to "on-leave" technicians
4. **Mobile-friendly status picker** - Current inline select could be improved for mobile
5. **Technician availability calendar** - Visual weekly availability editor
6. **Email notification on job assignment** - Alert technicians when assigned new jobs

---

## Database Schema Changes Assumed

```sql
-- technicians table must have:
ALTER TABLE technicians ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE technicians ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Status enum values (lowercase in DB):
-- 'available', 'busy', 'on-leave'
```

The `user_id` column is nullable to allow unclaimed technician profiles that admins create before technicians join.
