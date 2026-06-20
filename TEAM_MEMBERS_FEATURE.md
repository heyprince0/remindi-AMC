# Team Members Feature Documentation

## Overview

The Team Members feature allows administrators to manage organization members, send invitations, and handle role-based access control. Members can be invited to join an organization and can accept invitations via a secure link.

## Features Implemented

### 1. Team Page (`/dashboard/team`)
- View all organization members with their roles and join dates
- View pending invitations with expiration dates
- Admin-only actions: invite members, remove members, resend/revoke invites
- Responsive design with mobile support
- Real-time data loading with loading states

### 2. Invite Dialog
- Modal form to invite new team members
- Email input with validation
- Role selection (Admin/Member)
- Success and error handling with toast notifications
- Non-blocking email sending with warning handling

### 3. Members Table
- Displays all team members
- Shows name, email, role badge, and join date
- Admin-only remove action with confirmation dialog
- Formatted relative dates (e.g., "joined 2 days ago")

### 4. Pending Invites Table
- Shows pending invitations with email and role
- Displays sent date and expiration date
- Admin actions: Resend or Revoke invites
- Visual indicator for expired invites (can't resend)
- Dropdown menu for actions

### 5. Invite Accept Page (`/invite/accept/[token]`)
- Secure public page for accepting invites
- Shows organization name, inviter name, and offered role
- Handles three scenarios:
  - **Not logged in**: Shows signup form with email pre-filled
  - **Logged in with matching email**: Shows accept button
  - **Logged in with mismatched email**: Shows error and suggests logout
- Displays clear error states for expired/revoked/already-accepted invites
- Automatic redirect to dashboard after successful acceptance

## Database Schema

The feature uses these existing tables:

### `organizations`
- `id` (UUID, PK)
- `name` (text)
- `owner_id` (UUID, FK to auth.users)
- `created_at` (timestamp)

### `memberships`
- `id` (UUID, PK)
- `org_id` (UUID, FK to organizations)
- `user_id` (UUID, FK to auth.users)
- `role` (enum: 'admin' | 'member')
- `created_at` (timestamp)

### `invites`
- `id` (UUID, PK)
- `org_id` (UUID, FK to organizations)
- `email` (text)
- `role` (enum: 'admin' | 'member')
- `token` (text, unique)
- `invited_by` (UUID, FK to auth.users)
- `status` (enum: 'pending' | 'accepted' | 'revoked' | 'expired')
- `expires_at` (timestamp)
- `created_at` (timestamp)

## API Routes

### 1. POST `/api/invites/create`
**Purpose**: Create and send a new team invite

**Auth**: Requires Bearer token (user must be admin)

**Body**:
```json
{
  "email": "member@example.com",
  "role": "member",
  "orgId": "org-123"
}
```

**Response**:
```json
{
  "success": true,
  "invite": {...},
  "emailWarning": "optional warning message"
}
```

**Validation**:
- Only admins can send invites
- Organization must exist
- Automatic email sending via `triggerInviteMemberEmail()`

### 2. GET `/api/invites/[token]`
**Purpose**: Fetch invite details for acceptance page

**Auth**: None (public)

**Response**:
```json
{
  "invite": {
    "email": "member@example.com",
    "role": "member",
    "organizations": { "name": "My Company" },
    "inviter": { "full_name": "John Doe" },
    ...
  },
  "status": "pending|expired|revoked|accepted",
  "valid": true|false
}
```

### 3. POST `/api/invites/accept`
**Purpose**: Accept an invite and create membership

**Auth**: Requires Bearer token (email must match invite)

**Body**:
```json
{
  "token": "invite-token-string"
}
```

**Response**:
```json
{
  "success": true,
  "orgId": "org-123"
}
```

**Validation**:
- Invite must be pending
- Must not be expired
- User email must match invite email
- Creates membership record automatically

### 4. POST `/api/invites/manage`
**Purpose**: Resend or revoke pending invites

**Auth**: Requires Bearer token (user must be admin)

**Body**:
```json
{
  "action": "resend|revoke",
  "inviteId": "invite-123",
  "orgId": "org-123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invite resent successfully|Invite revoked"
}
```

**Validation**:
- Only admins can manage invites
- Resend only works for pending, non-expired invites
- Revoke updates status and prevents further accepts

## Components

### InviteDialog
**Location**: `components/team/invite-dialog.tsx`

Props:
- `open`: boolean
- `onOpenChange`: (open: boolean) => void
- `orgId`: string
- `onSuccess?`: () => void

Features:
- Email and role selection
- Session token handling for API calls
- Toast notifications

### MembersTable
**Location**: `components/team/members-table.tsx`

Props:
- `members`: Member[]
- `loading?`: boolean
- `isCurrentUserAdmin`: boolean
- `onRemoveClick?`: (memberId: string) => void

Features:
- Remove confirmation dialog
- Formatted dates with date-fns
- Admin-only actions
- Responsive layout

### PendingInvitesTable
**Location**: `components/team/pending-invites-table.tsx`

Props:
- `invites`: PendingInvite[]
- `loading?`: boolean
- `isCurrentUserAdmin`: boolean
- `orgId`: string
- `onRefresh?`: () => void

Features:
- Resend and revoke actions
- Expired invite detection
- Dropdown menu for actions
- Real-time status updates

### InviteAcceptCard
**Location**: `components/team/invite-accept-card.tsx`

Props:
- `token`: string
- `inviteDetails`: InviteDetails | null
- `loading`: boolean
- `userEmail?`: string

Features:
- Multi-scenario handling (logged in, not logged in, email mismatch)
- Signup form with email pre-filled
- Clear error states
- Password validation (6+ characters)

## Email Integration

The feature uses the existing email service (`lib/email-actions.ts`) with a new function:

### `triggerInviteMemberEmail()`
**Parameters**:
- `inviteeEmail`: string - Recipient's email
- `inviterName`: string - Name of person sending invite
- `businessName`: string - Organization name
- `role`: string - Role being offered
- `inviteLink`: string - Full URL to accept page

**Template Data** (passed to email service):
```json
{
  "type": "invite-member",
  "userEmail": "member@example.com",
  "data": {
    "inviterName": "John Doe",
    "businessName": "My Company",
    "role": "member",
    "inviteLink": "https://remindi.online/invite/accept/token123"
  }
}
```

**Email Template**: The email template should be created in Resend with template ID `invite-member`

## Navigation

The Team page is accessible from the sidebar under "Team Members" (between "Customers" and "Technicians").

## TODO Comments in Code

The Team page has TODO comments indicating where actual Supabase queries need to be implemented:

1. **Team Page - Fetch organization ID**: Currently assumes single org, needs logic to get current user's org
2. **Team Page - Fetch members**: Select from memberships with joins to profiles and auth.users
3. **Team Page - Fetch pending invites**: Select from invites table where status = 'pending'
4. **Team Page - Remove member**: Delete from memberships table

These TODOs mark the exact locations where your custom query logic should go based on your app's organization structure.

## Security Considerations

1. **Admin-Only Actions**: All invite/remove operations require admin role in organization
2. **Token Validation**: Invite tokens are cryptographically random (32 bytes)
3. **Email Matching**: Accepts must come from the invited email address
4. **Expiration**: Invites expire after 7 days
5. **Session Tokens**: API calls use Bearer token authentication
6. **Server-Side Validation**: All authorization checks happen server-side

## Testing Checklist

- [ ] Navigate to `/dashboard/team` as admin
- [ ] Open Invite Member dialog
- [ ] Send invite to test email with member role
- [ ] Verify toast notification
- [ ] Check pending invites section
- [ ] Click resend on pending invite
- [ ] Copy invite link from email/logs
- [ ] Open invite link without login
- [ ] Complete signup and accept invite
- [ ] Verify user now appears in members table
- [ ] Try revoking an invite
- [ ] Test email mismatch scenario
- [ ] Test expired invite handling
- [ ] Test remove member with confirmation

## Future Enhancements

1. **Role Management**: Allow changing member roles after joining
2. **Bulk Invites**: Send invites to multiple emails at once
3. **Invite History**: Show all invites (not just pending)
4. **Email Templates**: Customize invite email content
5. **Invite Auto-Expiry**: Cron job to mark old invites as expired
6. **Activity Log**: Track all team management actions
7. **Permissions**: Fine-grained role-based permissions

## Troubleshooting

**Invite not sending emails?**
- Verify `RESEND_API_KEY` is set in environment
- Check Resend has `invite-member` template created
- Look for console errors in API routes

**Members not appearing?**
- Check org_id is being set correctly
- Verify memberships table has entries
- Check profiles table has names for members

**Can't accept invite?**
- Verify token is correct
- Check invite hasn't expired (7 day window)
- Ensure email matches exactly
- Check auth session is valid

## Files Created

- `app/(dashboard)/team/page.tsx` - Main team page
- `app/invite/accept/[token]/page.tsx` - Invite acceptance page
- `app/api/invites/create/route.ts` - Create invite API
- `app/api/invites/[token]/route.ts` - Get invite details API
- `app/api/invites/accept/route.ts` - Accept invite API
- `app/api/invites/manage/route.ts` - Resend/revoke API
- `components/team/invite-dialog.tsx` - Invite form component
- `components/team/members-table.tsx` - Members display component
- `components/team/pending-invites-table.tsx` - Pending invites display
- `components/team/invite-accept-card.tsx` - Invite acceptance UI

## Files Modified

- `components/app-sidebar.tsx` - Added Team link to navigation
- `lib/email-actions.ts` - Added triggerInviteMemberEmail function
