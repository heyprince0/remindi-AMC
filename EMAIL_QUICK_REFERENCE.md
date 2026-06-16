# Email Service - Quick Reference Guide

## 📧 Available Email Functions

### 1. Welcome Email
Send after user signup completes.

**Client Component:**
```typescript
'use client'
import { triggerWelcomeEmail } from '@/lib/email-actions'

const result = await triggerWelcomeEmail(
  'user@example.com',    // userEmail
  'John Doe'             // userName
)
```

**Server Component:**
```typescript
import { sendWelcomeEmail } from '@/lib/email-service'

const result = await sendWelcomeEmail(
  'user@example.com',
  'John Doe'
)
```

**API:**
```bash
POST /api/send-email
{
  "type": "welcome",
  "userEmail": "user@example.com",
  "data": { "userName": "John Doe" }
}
```

### 2. Invoice Email
Send when invoice is created or sent to customer.

**Client Component:**
```typescript
const result = await triggerInvoiceEmail(
  'user@example.com',           // userEmail
  'INV-2024-001',              // invoiceNumber
  'ABC Enterprises',           // clientName
  15000.50                     // grandTotal
)
```

**API:**
```bash
POST /api/send-email
{
  "type": "invoice",
  "userEmail": "user@example.com",
  "data": {
    "invoiceNumber": "INV-2024-001",
    "clientName": "ABC Enterprises",
    "grandTotal": 15000.50
  }
}
```

### 3. Password Reset Email
Send when user requests password reset.

**Client Component:**
```typescript
const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset?token=${token}`

const result = await triggerPasswordResetEmail(
  'user@example.com',    // userEmail
  resetLink,             // resetLink (full URL)
  'John Doe'            // userName
)
```

**API:**
```bash
POST /api/send-email
{
  "type": "password-reset",
  "userEmail": "user@example.com",
  "data": {
    "resetLink": "https://remindi.online/reset?token=abc123",
    "userName": "John Doe"
  }
}
```

### 4. Service Reminder Email
Send upcoming service maintenance reminder.

**Client Component:**
```typescript
const result = await triggerServiceReminderEmail(
  'user@example.com',     // userEmail
  'AC Maintenance',       // contractName
  '2024-07-15',          // serviceDate
  'XYZ Office'           // customerName
)
```

**API:**
```bash
POST /api/send-email
{
  "type": "service-reminder",
  "userEmail": "user@example.com",
  "data": {
    "contractName": "AC Maintenance",
    "serviceDate": "2024-07-15",
    "customerName": "XYZ Office"
  }
}
```

### 5. AMC Expiry Reminder Email
Send contract/AMC expiry notification.

**Client Component:**
```typescript
const result = await triggerAMCExpiryReminderEmail(
  'user@example.com',     // userEmail
  'Lift AMC',            // contractName
  '2024-12-31',          // expiryDate
  'Corporate Building'   // customerName
)
```

**API:**
```bash
POST /api/send-email
{
  "type": "amc-expiry-reminder",
  "userEmail": "user@example.com",
  "data": {
    "contractName": "Lift AMC",
    "expiryDate": "2024-12-31",
    "customerName": "Corporate Building"
  }
}
```

## 🎯 Response Format

All functions return this format:

**Success:**
```typescript
{
  success: true,
  messageId: "message-id-from-resend"  // Unique ID for tracking
}
```

**Failure:**
```typescript
{
  success: false,
  error: "Error message describing what went wrong"
}
```

## 🚀 Real-World Examples

### Example 1: Send Welcome Email in Profile Setup
```typescript
// app/profile-setup/page.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  // Save profile to database
  await saveProfile(userData)
  
  // Send welcome email (non-blocking)
  try {
    const emailResult = await triggerWelcomeEmail(
      user.email,
      fullName
    )
    if (emailResult.success) {
      console.log('Welcome email sent!')
    }
  } catch (error) {
    console.error('Email failed:', error)
  }
  
  // Navigate regardless of email success
  router.push('/')
}
```

### Example 2: Send Invoice Email from Invoice Creation
```typescript
// app/(dashboard)/invoices/create/page.tsx
const handleCreateInvoice = async (invoiceData) => {
  // Create invoice in database
  const invoice = await createInvoice(invoiceData)
  
  // Send invoice email to business user
  await triggerInvoiceEmail(
    currentUser.email,
    invoice.invoiceNumber,
    invoice.clientName,
    invoice.grandTotal
  )
  
  toast.success('Invoice created and email sent!')
}
```

### Example 3: Send Password Reset Email
```typescript
// app/forgot-password/page.tsx
const handleForgotPassword = async (email: string) => {
  // Generate reset token
  const token = generateResetToken()
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
  
  // Get user name
  const user = await getUserByEmail(email)
  
  // Send reset email
  const result = await triggerPasswordResetEmail(
    email,
    resetLink,
    user.fullName
  )
  
  if (result.success) {
    toast.success('Reset link sent to your email')
  } else {
    toast.error('Failed to send reset email')
  }
}
```

### Example 4: Batch Email Sending
```typescript
// Send reminder emails to multiple users
const sendReminderBatch = async (contracts) => {
  const results = await Promise.all(
    contracts.map(contract =>
      triggerServiceReminderEmail(
        contract.userEmail,
        contract.contractName,
        contract.nextServiceDate,
        contract.customerName
      )
    )
  )
  
  const sent = results.filter(r => r.success).length
  console.log(`Sent ${sent} out of ${results.length} reminders`)
}
```

## 🔍 Debugging

### Enable Email Logging
All email operations are automatically logged. Look for messages starting with `[Email Service]`:

```
[Email Service] Sending welcome email to john@example.com
[Email Service] Welcome email sent successfully. Message ID: abc123xyz
[Email Service] Welcome email failed: Invalid API key
```

### Check Email Status
1. Go to [Resend Dashboard](https://resend.com/emails)
2. Find your email by recipient or subject
3. View delivery status, opens, clicks
4. Check bounce/complaint reasons

### Verify Templates
1. Go to [Resend Templates](https://resend.com/templates)
2. Ensure these templates exist and are **published**:
   - `welcome`
   - `invoice`
   - `password-reset`
   - `service-reminder`
   - `amc-expiry-reminder`

## ⚙️ Configuration Checklist

Before deploying to production:

- [ ] `RESEND_API_KEY` added to Vercel environment variables
- [ ] Sender domain verified in Resend (hello@remindi.online)
- [ ] All 5 email templates created in Resend
- [ ] All templates published (not in draft)
- [ ] Test email sent successfully
- [ ] Verified email received in test inbox
- [ ] Resend webhook configured (optional, for tracking)

## 📝 Common Issues & Solutions

### "Email service is not configured"
**Problem:** RESEND_API_KEY environment variable not set
**Solution:** Add to Vercel project environment variables

### Email not received
**Problem:** Template not published or doesn't exist
**Solution:** 
1. Go to Resend Templates
2. Verify template exists
3. Click "Publish" if in draft state
4. Verify template ID matches function call

### Build error with missing API key
**Problem:** Build happens without RESEND_API_KEY
**Solution:** This is normal and safe. The service handles it gracefully:
1. Add RESEND_API_KEY to environment
2. Redeploy the application
3. Email sending will work in production

### Template variable not substituting
**Problem:** Variables like {{name}} not being replaced
**Solution:**
1. Check template variables match function parameters
2. Verify variable names in template match `data` object keys
3. Ensure template is published

## 📚 Additional Resources

- **Full Documentation:** `EMAIL_SERVICE.md`
- **Implementation Details:** `EMAIL_IMPLEMENTATION_SUMMARY.md`
- **Type Definitions:** `types/email.ts`
- **Email Service Code:** `lib/email-service.ts`
- **Server Actions:** `lib/email-actions.ts`
- **API Endpoint:** `app/api/send-email/route.ts`

## 🎓 Best Practices

✅ **DO:**
- Use server actions from Client Components
- Handle email failures gracefully
- Log email operations for debugging
- Test emails before sending
- Keep reset links short-lived
- Include unsubscribe in marketing emails
- Monitor delivery rates in Resend dashboard

❌ **DON'T:**
- Expose RESEND_API_KEY to client
- Block user flows waiting for email
- Send emails to unverified addresses
- Use old/expired reset links
- Hardcode email addresses
- Ignore email sending errors completely

## 🚨 Rate Limiting

Resend allows up to 100 emails per second on free plan. For higher volume:
1. Upgrade Resend plan
2. Implement queue system (Vercel Queues)
3. Batch email sending with delays

## 💡 Tips

1. **Message IDs:** Store `messageId` for tracking email delivery
2. **Error Messages:** Show user-friendly errors, log technical details
3. **Template Testing:** Test templates in Resend before using
4. **Batch Operations:** Use `Promise.all()` for sending multiple emails
5. **Monitoring:** Set up alerts in Resend for bounce/complaint rates

---

**Need help?** Check `EMAIL_SERVICE.md` for comprehensive documentation.
