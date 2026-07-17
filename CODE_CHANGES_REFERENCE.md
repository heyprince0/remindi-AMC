# Code Changes Reference

## Quick Guide to Implementation

### 1. AuthContext Enhancement (lib/auth-context.tsx)

Added `technicianId` field to track linked technician for authenticated users:

```typescript
interface AuthContextType {
  // ... existing fields ...
  technicianId: string | null  // NEW
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ... existing state ...
  const [technicianId, setTechnicianId] = useState<string | null>(null)  // NEW
  
  useEffect(() => {
    const fetchMembership = async () => {
      if (!user) {
        // ... existing reset ...
        setTechnicianId(null)  // NEW
        return
      }
      const { data, error } = await supabase
        .from('memberships')
        .select('role, org_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setRole(data.role)
        setOrgId(data.org_id)
        if (data.org_id) {
          // ... existing org fetch ...
          
          // NEW: For technician role, fetch linked technician_id
          if (data.role === 'technician') {
            const { data: techData } = await supabase
              .from('technicians')
              .select('id')
              .eq('user_id', user.id)
              .eq('org_id', data.org_id)
              .maybeSingle()
            setTechnicianId(techData?.id || null)
          } else {
            setTechnicianId(null)
          }
        }
      }
    }
    fetchMembership()
  }, [user])
  
  return (
    <AuthContext.Provider 
      value={{ 
        user, session, loading, error, role, orgId, orgName, recovery,
        technicianId  // NEW
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
```

### 2. SelectTechnicianModal Component (components/select-technician-modal.tsx)

New component created to handle technician profile selection on first login:

**Key Features:**
- Fetches unclaimed technicians: `WHERE user_id IS NULL`
- Updates selected technician with `user_id = auth.uid()`
- Non-dismissible modal (prevents skipping)
- Handles empty state with helpful message
- Loading and error states with toast notifications

**Usage Example:**
```tsx
<SelectTechnicianModal
  open={showModal}
  onSuccess={(technicianId) => router.push(`/technicians/${technicianId}`)}
  orgId={orgId}
  userId={userId}
/>
```

### 3. Dashboard Page Redirect Logic (app/(dashboard)/page.tsx)

Added technician redirect logic at the root dashboard:

```typescript
export default function DashboardPage() {
  const { user, loading: authLoading, role, orgId, technicianId } = useAuth()  // NEW: added role, technicianId
  // ... other state ...
  const [showSelectTechnicianModal, setShowSelectTechnicianModal] = useState(false)  // NEW

  // NEW: Technician redirect and modal logic
  useEffect(() => {
    if (authLoading || !user || !role) return

    // If technician with linked technician_id, redirect to their profile
    if (role === 'technician' && technicianId) {
      router.push(`/technicians/${technicianId}`)
      return
    }

    // If technician without linked technician_id, show modal
    if (role === 'technician' && !technicianId && orgId) {
      setShowSelectTechnicianModal(true)
    }
  }, [authLoading, user, role, technicianId, orgId, router])

  // ... existing logic ...

  // NEW: Show modal for technicians without linked profile
  if (role === 'technician' && !technicianId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
        {orgId && (
          <SelectTechnicianModal
            open={showSelectTechnicianModal}
            onSuccess={(id) => {
              router.push(`/technicians/${id}`)
            }}
            orgId={orgId}
            userId={user.id}
          />
        )}
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* ... existing dashboard content ... */}
    </DashboardLayout>
  )
}
```

### 4. Technician Detail Page Access Control (app/(dashboard)/technicians/[id]/page.tsx)

Added access validation, role-based UI, and status editing:

```typescript
export default function TechnicianDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, role } = useAuth()  // NEW: added role
  const technicianId = params.id as string

  const [technician, setTechnician] = useState<Technician | null>(null)
  // ... other state ...
  const [isOwnProfile, setIsOwnProfile] = useState(false)  // NEW
  const [statusEditMode, setStatusEditMode] = useState(false)  // NEW
  const [statusValue, setStatusValue] = useState('')  // NEW

  // NEW: Access control for technicians
  useEffect(() => {
    if (currentOrgId && technicianId) {
      if (role === 'technician' && user?.id) {
        supabase
          .from('technicians')
          .select('user_id')
          .eq('id', technicianId)
          .eq('org_id', currentOrgId)
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              router.push('/technicians')
              return
            }
            if (data.user_id && data.user_id !== user.id) {
              router.push(`/technicians/${data.user_id === user.id ? technicianId : ''}`)
              return
            }
            setIsOwnProfile(data.user_id === user.id)
            loadTechnicianDetails()
          })
      } else {
        loadTechnicianDetails()
      }
    }
  }, [currentOrgId, technicianId, role, user?.id, router])

  // NEW: Status update handler
  const handleStatusSave = async () => {
    try {
      if (!currentOrgId || !technician) return

      const { error } = await supabase
        .from('technicians')
        .update({ status: statusValue })
        .eq('id', technicianId)
        .eq('org_id', currentOrgId)

      if (error) throw error
      toast.success('Status updated successfully')
      setStatusEditMode(false)
      setTechnician({ ...technician, status: statusValue })
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
      setStatusValue(technician?.status || '')
    }
  }

  // NEW: Editable status field for technicians on their own profile
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* ... existing header ... */}
        <Card>
          <CardHeader>
            {/* ... existing header ... */}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* ... existing fields ... */}
              <div className="flex items-center gap-3">
                <div className="size-4 flex items-center justify-center">
                  <div className="size-2 rounded-full bg-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {role === 'technician' && isOwnProfile ? (
                    statusEditMode ? (
                      <div className="flex gap-2 items-center mt-1">
                        <select
                          value={statusValue}
                          onChange={(e) => setStatusValue(e.target.value)}
                          className="px-2 py-1 border border-input rounded text-sm"
                        >
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="on-leave">On Leave</option>
                        </select>
                        <Button size="sm" onClick={handleStatusSave}>Save</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStatusEditMode(false)
                            setStatusValue(technician.status)
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <p className="font-medium text-foreground capitalize">
                          {technician.status.replace('-', ' ')}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatusEditMode(true)}
                        >
                          Edit
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className="font-medium text-foreground capitalize">
                      {technician.status.replace('-', ' ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NEW: Hide "Add Job" button for technicians */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="size-5" />
                Assigned Jobs
              </CardTitle>
              <CardDescription>
                {assignedJobs.length} job{assignedJobs.length !== 1 ? 's' : ''} assigned
              </CardDescription>
            </div>
            {role !== 'technician' && (  {/* NEW: Only show for non-technicians */}
              <Button onClick={() => setModalOpen(true)} size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Job
              </Button>
            )}
          </CardHeader>
          {/* ... rest of jobs section ... */}
        </Card>

        {/* ... rest of page ... */}
      </div>
    </DashboardLayout>
  )
}
```

## SQL Queries Used

### Fetch unclaimed technicians
```sql
SELECT * FROM technicians 
WHERE org_id = $1 AND user_id IS NULL
ORDER BY name ASC;
```

### Link technician to user
```sql
UPDATE technicians 
SET user_id = $1 
WHERE id = $2 AND org_id = $3;
```

### Fetch linked technician for current user
```sql
SELECT id FROM technicians 
WHERE user_id = $1 AND org_id = $2;
```

### Update technician status
```sql
UPDATE technicians 
SET status = $1 
WHERE id = $2 AND org_id = $3;
```

## Component Props & Hooks

### SelectTechnicianModal Props
```typescript
interface SelectTechnicianModalProps {
  open: boolean                              // Is modal visible
  onSuccess: (technicianId: string) => void // Called after successful linking
  orgId: string                              // Organization ID
  userId: string                             // Authenticated user ID
}
```

### Updated useAuth Hook
```typescript
const { 
  user,           // Supabase user
  role,           // 'admin' | 'member' | 'technician'
  orgId,          // Organization ID
  technicianId,   // NEW: Linked technician ID (null if not linked)
  loading,        // Auth loading state
  // ... other fields ...
} = useAuth()
```

## Import Statements

### Dashboard Page
```typescript
import { SelectTechnicianModal } from "@/components/select-technician-modal"
```

### Technician Detail Page
```typescript
// No new imports needed, uses existing ones
```

## Error Messages & User Feedback

### Toast Messages
- "Profile linked successfully!" - On successful technician linking
- "Failed to link profile" - On error during linking
- "Status updated successfully" - On status update
- "Failed to update status" - On status update error
- "Technician not found" - On access denied

### Modal Messages
- "No technician profile found for you yet — ask your admin to add you as a technician first." - When no unclaimed profiles

## State Management Flow

```
User Login
    ↓
AuthContext.fetchMembership()
    ├─ Fetch membership (role, org_id)
    ├─ For technician role: Fetch technician_id
    └─ Update context with all values
    ↓
Dashboard Component
    ├─ useAuth() gets role, technicianId
    ├─ If technician with technicianId: Redirect to /technicians/[id]
    ├─ If technician without technicianId: Show SelectTechnicianModal
    └─ If admin/member: Show normal dashboard
    ↓
SelectTechnicianModal (if shown)
    ├─ User selects technician
    ├─ Modal updates technicians.user_id = auth.uid()
    ├─ onSuccess callback triggers
    └─ Redirect to /technicians/[id]
    ↓
Technician Detail Page
    ├─ Load technician details
    ├─ Show editable status field
    └─ Hide "Add Job" button
```

## Testing Commands (for verification)

```bash
# Check if SelectTechnicianModal component loads
cd /vercel/share/v0-project
npm run dev  # Dev server runs on port 5000

# Check TypeScript compilation
npm run build

# Check linting
npm run lint
```

## Deployment Notes

1. Ensure the `technicians` table has `user_id` column (nullable UUID)
2. Ensure the `technicians` table has `org_id` column (required UUID)
3. Add RLS policies for security (see TECHNICIAN_IMPLEMENTATION.md)
4. Consider adding indexes: `technicians(org_id, user_id)`
5. Monitor modal dismissal attempts in logs
6. Log status changes for audit trail
