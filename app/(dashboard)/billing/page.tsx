'use client';

import { useState } from 'react';
import { MOCK_SUBSCRIPTION, MOCK_USAGE, MOCK_PAYMENT_HISTORY } from '@/lib/billing-mock-data';
import CurrentPlanCard from '@/components/billing/current-plan-card';
import UsageIndicators from '@/components/billing/usage-indicators';
import TeamSeatsIndicator from '@/components/billing/team-seats-indicator';
import PaymentHistoryTable from '@/components/billing/payment-history-table';
import UpgradePlanModal from '@/components/billing/upgrade-plan-modal';
import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
import { Button } from '@/components/ui/button';
import { BillingCycle, Plan } from '@/lib/billing-types';

export default function BillingPage() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('expired');

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleSelectUpgradePlan = (plan: Plan, billingCycle: BillingCycle) => {
    alert(`Upgrading to ${plan.name} (${billingCycle})`);
  };

  const handleOpenLimitModal = (type: LimitModalType) => {
    setLimitModalType(type);
    setShowLimitModal(true);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-2 text-gray-600">
          Manage your subscription, view usage, and payment history
        </p>
      </div>

      {/* Current Plan Section */}
      <section>
        <CurrentPlanCard
          subscription={MOCK_SUBSCRIPTION}
          onUpgrade={handleUpgrade}
        />
      </section>

      {/* Usage & Team Seats Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <UsageIndicators usage={MOCK_USAGE} />
        </div>
        <TeamSeatsIndicator usage={MOCK_USAGE} />
      </section>

      {/* Payment History */}
      <section>
        <PaymentHistoryTable transactions={MOCK_PAYMENT_HISTORY} />
      </section>

      {/* Demo Section: Limit Modals */}
      <section className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          🎯 Demo: Paywall Scenarios
        </h3>
        <p className="mb-4 text-sm text-gray-700">
          Click any button below to see how paywall modals appear when users hit limits:
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleOpenLimitModal('expired')}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            Subscription Expired
          </Button>
          <Button
            onClick={() => handleOpenLimitModal('monthly-limit')}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            Monthly Limit Reached
          </Button>
          <Button
            onClick={() => handleOpenLimitModal('team-seats')}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            Team Seat Limit Reached
          </Button>
        </div>
      </section>

      {/* Modals */}
      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSelectPlan={handleSelectUpgradePlan}
      />

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        type={limitModalType}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}
