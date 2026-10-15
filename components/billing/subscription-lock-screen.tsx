'use client'

import { useState } from 'react'
import { Lock, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlanSelectionModal from './PlanSelectionModal' // Adjust the import path if necessary

interface SubscriptionLockScreenProps {
  orgId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
}

export function SubscriptionLockScreen({ 
  orgId, 
  userEmail, 
  userName, 
  userPhone 
}: SubscriptionLockScreenProps) {
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)

  const handleSuccess = () => {
    // Refresh the page or trigger a re-fetch of subscription status
    window.location.reload()
  }

  return (
    <>
      <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10">
        <section className="flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-lg sm:p-10">
          
          {/* Lock Icon */}
          <div className="flex size-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
            <Lock aria-hidden="true" className="size-6" />
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-zinc-100">
              Subscription Expired
            </h1>
            <p className="text-sm text-zinc-400">
              Your Remindi subscription has expired. Renew your plan to regain access to your business dashboard.
            </p>
          </div>

          {/* Divider */}
          <div className="my-2 w-full border-t border-zinc-800" />

          {/* Data Safety Notice */}
          <div className="flex w-full flex-col items-start gap-2 text-left">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="size-5" />
              <span className="font-medium text-sm">Your business data is safe</span>
            </div>
            <p className="text-sm text-zinc-400">
              Your customers, contracts, invoices, and service history remain saved.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex w-full flex-col gap-3">
            <Button
              onClick={() => setIsPlanModalOpen(true)}
              className="w-full bg-blue-600 py-6 text-base font-semibold text-white hover:bg-blue-700"
            >
              Renew Subscription
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-zinc-800 bg-transparent py-6 text-base font-semibold text-zinc-100 hover:bg-zinc-900 hover:text-white"
            >
              <a href="mailto:support@remindi.online">
                <Mail className="mr-2 size-4" />
                Contact Support
              </a>
            </Button>
          </div>

          {/* Footer Text */}
          <p className="mt-4 text-xs text-zinc-500">
            Only billing, renewal, support, and any permitted data-export options remain accessible.
          </p>
        </section>
      </main>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        orgId={orgId}
        userEmail={userEmail}
        userName={userName}
        userPhone={userPhone}
        onSuccess={handleSuccess}
      />
    </>
  )
}
