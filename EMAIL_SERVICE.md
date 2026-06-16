# Email Service Documentation

## Overview

The Remindi email service provides a scalable, type-safe way to send transactional emails to users. It integrates with **Resend** as the email delivery provider.

## Architecture

### Components

1. **`lib/email-service.ts`** - Core email sending functions (server-side only)
   - Direct Resend API integration
   - Email sending logic
   - Error handling and logging
   
2. **`lib/email-actions.ts`** - Server actions for email triggers
   - Safe wrapper around email functions
   - Can be called from Client Components
   - Input validation and error handling

3. **`app/api/send-email/route.ts`** - Email API endpoint
   - Generic email sending endpoint
   - For external triggers or complex flows
   - Request/response validation

## Setup

### Prerequisites

- Resend account with verified domain (hello@remindi.online)
- Welcome email template published in Resend
- `RESEND_API_KEY` environment variable set in Vercel

### Environment Variables

Add to your Vercel project (already configured):
```
RESEND_API_KEY=your_resend_api_key
```

## Email Templates

Each email type maps to a Resend template:

| Email Type | Resend Template | Purpose |
|---|---|---|
| Welcome | `welcome` | Sent after user signup & profile setup |
| Invoice | `invoice` | Sent when invoice is created/sent |
| Password Reset | `password-reset` | Password reset flow |
| Service Reminder | `service-reminder` | Upcoming maintenance reminder |
| AMC Expiry Reminder | `amc-expiry-reminder` | Contract expiry notification |

**Note:** You need to create these templates in Resend and publish them before using the service.

### Template Variables

#### Welcome Email
- `name` - User's full name

#### Invoice Email
- `invoiceNumber` - Invoice ID/number
- `clientName` - Customer name
- `grandTotal` - Invoice total (formatted to 2 decimals)

#### Password Reset Email
- `name` - User's full name
- `resetLink` - Password reset URL

#### Service Reminder Email
- `contractName` - Name of the contract/service
- `serviceDate` - Next service date
- `customerName` - Customer name

#### AMC Expiry Reminder Email
- `contractName` - Name of the AMC contract
- `expiryDate` - Contract expiry date
- `customerName` - Customer name

## Usage Examples

### From Client Components (Server Actions)

```typescript
'use client'

import { triggerWelcomeEmail } from '@/lib/email-actions'

export default function MyComponent() {
  const handleSendEmail = async () => {
    const result = await triggerWelcomeEmail(
      'user@example.com',
      'John Doe'
    )
    
    if (result.success) {
      console.log('Email sent! Message ID:', result.messageId)
    } else {
      console.error('Email failed:', result.error)
    }
  }

  return <button onClick={handleSendEmail}>Send Email</button>
}
```

### From Server Components / Server-Side Code

```typescript
import { sendWelcomeEmail } from '@/lib/email-service'

export default async function MyPage() {
  const result = await sendWelcomeEmail('user@example.com', 'Jane Doe')
  
  if (result.success) {
    // Handle success
  } else {
    // Handle error
  }

  return <div>...</div>
}
```

### From API Routes / External Services

```typescript
// POST /api/send-email
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'invoice',
    userEmail: 'user@example.com',
    data: {
      invoiceNumber: 'INV-001',
      clientName: 'ACME Corp',
      grandTotal: 5000.00,
    },
  }),
})

const result = await response.json()
```

## API Reference

### `sendWelcomeEmail(userEmail, userName)`

Sends a welcome email to a new user after signup.

**Parameters:**
- `userEmail` (string) - User's email address
- `userName` (string) - User's full name

**Returns:** `EmailResponse`
```typescript
{
  success: boolean
  messageId?: string  // Resend message ID
  error?: string      // Error message if failed
}
```

**Example:**
```typescript
const result = await sendWelcomeEmail('john@example.com', 'John Doe')
```

### `sendInvoiceEmail(userEmail, invoiceNumber, clientName, grandTotal)`

Sends an invoice notification email.

**Parameters:**
- `userEmail` (string) - User's email address
- `invoiceNumber` (string) - Invoice ID/number
- `clientName` (string) - Customer name
- `grandTotal` (number) - Invoice total amount

**Returns:** `EmailResponse`

**Example:**
```typescript
const result = await sendInvoiceEmail(
  'user@example.com',
  'INV-2024-001',
  'ABC Enterprises',
  15000.50
)
```

### `sendPasswordResetEmail(userEmail, resetLink, userName)`

Sends a password reset email.

**Parameters:**
- `userEmail` (string) - User's email address
- `resetLink` (string) - Password reset URL
- `userName` (string) - User's full name

**Returns:** `EmailResponse`

**Example:**
```typescript
const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
const result = await sendPasswordResetEmail(
  'user@example.com',
  resetLink,
  'Jane Doe'
)
```

### `sendServiceReminderEmail(userEmail, contractName, serviceDate, customerName)`

Sends an upcoming service reminder email.

**Parameters:**
- `userEmail` (string) - User's email address
- `contractName` (string) - Service/contract name
- `serviceDate` (string) - Next service date
- `customerName` (string) - Customer name

**Returns:** `EmailResponse`

**Example:**
```typescript
const result = await sendServiceReminderEmail(
  'user@example.com',
  'AC Maintenance',
  '2024-07-15',
  'XYZ Office'
)
```

### `sendAMCExpiryReminderEmail(userEmail, contractName, expiryDate, customerName)`

Sends an AMC/contract expiry reminder email.

**Parameters:**
- `userEmail` (string) - User's email address
- `contractName` (string) - Contract/AMC name
- `expiryDate` (string) - Contract expiry date
- `customerName` (string) - Customer name

**Returns:** `EmailResponse`

**Example:**
```typescript
const result = await sendAMCExpiryReminderEmail(
  'user@example.com',
  'Lift AMC',
  '2024-12-31',
  'Corporate Building'
)
```

## Current Implementation

### Welcome Email Integration

The welcome email is automatically sent when a user completes signup and profile setup:

1. User signs up at `/signup`
2. User is redirected to `/profile-setup`
3. User completes profile setup
4. `triggerWelcomeEmail()` is called in the submit handler
5. Email is sent in the background (non-blocking)

**Code Location:** `app/profile-setup/page.tsx` (lines 82-109)

## Logging

All email operations are logged for debugging and monitoring:

```
[Email Service] Sending welcome email to user@example.com
[Email Service] Welcome email sent successfully to user@example.com. Message ID: abc123xyz
[Email Service] Welcome email failed for user@example.com: {error details}
```

## Error Handling

- Email failures don't block critical user flows (profile setup, etc.)
- All errors are logged to console for debugging
- Errors are returned to caller for optional client-side notification
- Resend API errors are caught and formatted consistently

## Adding New Email Types

To add a new email template type:

1. **Create template in Resend** and publish it
2. **Add function to `lib/email-service.ts`:**
   ```typescript
   export async function sendMyEmail(
     userEmail: string,
     templateVariable: string
   ): Promise<EmailResponse> {
     try {
       const response = await resend.emails.send({
         from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
         to: userEmail,
         template: 'my-template',
         props: { templateVariable },
       })
       // Handle response
     } catch (error) {
       // Handle error
     }
   }
   ```

3. **Add server action to `lib/email-actions.ts`:**
   ```typescript
   export async function triggerMyEmail(userEmail: string, variable: string) {
     // Validation and error handling wrapper
   }
   ```

4. **Add API endpoint support** in `app/api/send-email/route.ts`:
   ```typescript
   case 'my-template':
     result = await sendMyEmail(userEmail, variable)
     break
   ```

## Monitoring

### Check Logs in Vercel

1. Go to Vercel Project → Deployments → Logs
2. Look for `[Email Service]` prefixed messages
3. Filter by email type, recipient, or timestamp

### Resend Dashboard

Monitor email delivery at https://resend.com/emails:
- Delivery status
- Open rates
- Click rates
- Bounce/complaint rates

## Testing

### Local Testing

1. Ensure `RESEND_API_KEY` is in your `.env.local`
2. Call email functions from your application
3. Check Resend dashboard for delivery status
4. Review console logs for debugging

### Staging/Production

- All emails sent to real addresses
- Monitor Resend dashboard for delivery issues
- Check application logs for errors
- Verify email content in test inbox

## Security

- **API Key Protection:** `RESEND_API_KEY` is server-side only (never exposed to client)
- **Input Validation:** All email functions validate required parameters
- **Rate Limiting:** Implement at application level if needed
- **Email Verification:** Sender domain (hello@remindi.online) is verified in Resend

## Performance

- **Non-blocking:** Email sending happens asynchronously
- **No Performance Impact:** User flows complete without waiting for email delivery
- **Resend Handles Retry:** Failed emails are retried by Resend
- **Batch Emails:** Can send multiple emails in parallel using Promise.all()

## Support

For issues:
1. Check email function logs in Vercel
2. Verify Resend API key in environment variables
3. Ensure email templates are published in Resend
4. Check Resend dashboard for delivery failures
5. Review RESEND_API_KEY hasn't been rotated

## Deployment

The email service works out of the box on Vercel:
1. Add `RESEND_API_KEY` to Vercel environment variables
2. Deploy your application
3. Email functions will work automatically
