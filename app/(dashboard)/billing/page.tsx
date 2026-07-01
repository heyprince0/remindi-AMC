"use client"

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import CurrentPlanCard from '@/components/billing/current-plan-card';
import PaymentHistoryTable from '@/components/billing/payment-history-table';
import PlanSelectionModal from '@/components/billing/PlanSelectionModal';
import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
import { BillingCycle, Plan } from '@/lib/billing-types';

export default function BillingPage() {
  const { user, orgId } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data states
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [freePlan, setFreePlan] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // UI states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('expired');

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Get free plan (fallback)
      const { data: freePlanData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', 'free')
        .single();
      if (freePlanData) setFreePlan(freePlanData);

      // 2. Get current subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:plan_id(*)')
        .eq('org_id', orgId)
        .maybeSingle();

      if (subError) throw subError;
      setSubscription(subData);

      // 3. Determine active plan (fallback to free if none)
      const activePlan = subData?.plan || freePlanData;
      setPlan(activePlan);

      // 4. Get payment history
      const { data: txData, error: txError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txError) throw txError;
      setPaymentHistory(txData || []);

    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId]);

  const handleUpgrade = () => setShowUpgradeModal(true);
  const handleSelectUpgradePlan = (plan: Plan, billingCycle: BillingCycle) => {
    // TODO: Razorpay integration
    alert(`Upgrading to ${plan.name} (${billingCycle})`);
    setShowUpgradeModal(false);
  };
  const handleOpenLimitModal = (type: LimitModalType) => {
    setLimitModalType(type);
    setShowLimitModal(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const hasSubscription = subscription && subscription.status === 'active';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">Manage your subscription, view usage, and payment history</p>
        </div>

        {/* Current Plan */}
        <section>
          {hasSubscription ? (
            <CurrentPlanCard
              subscription={subscription}
              plan={subscription.plan}
              onUpgrade={handleUpgrade}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Active Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  You are currently on the <strong>Free Trial</strong> plan. Upgrade to unlock more features and higher limits.
                </p>
                <Button onClick={handleUpgrade}>Upgrade Now</Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Payment History */}
        <section>
          <PaymentHistoryTable transactions={paymentHistory} />
        </section>

        {/* Demo Modals */}
        <section className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">🎯 Demo: Paywall Scenarios</h3>
          <p className="mb-4 text-sm text-muted-foreground">
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
        <PlanSelectionModal
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
    </DashboardLayout>
  );
}
