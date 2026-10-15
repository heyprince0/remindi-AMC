'use client'

import { CreditCard, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubscriptionLockScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-12" aria-labelledby="subscription-expired-title">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CreditCard aria-hidden="true" className="size-8" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 id="subscription-expired-title" className="text-2xl font-semibold">Subscription Expired</h1>
          <p className="text-muted-foreground">Your subscription has expired. Renew your plan to regain access to your Remindi dashboard.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1">
            <a href="/billing"><CreditCard data-icon="inline-start" />Renew Subscription</a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <a href="mailto:support@remindi.online"><Mail data-icon="inline-start" />Contact Support</a>
          </Button>
        </div>
      </section>
    </main>
  )
}
