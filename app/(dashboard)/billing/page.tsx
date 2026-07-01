'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import CurrentPlanCard from '@/components/billing/current-plan-card';
import UsageIndicators from '@/components/billing/usage-indicators';
import TeamSeatsIndicator from '@/components/billing/team-seats-indicator';
import PaymentHistoryTable from '@/components/billing/payment-history-table';
import UpgradePlanModal from '@/components/billing/upgrade-plan-modal';
import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
import { BillingCycle, Plan } from '@/lib/billing-types';

export default function BillingPage() {
  const { user, orgId } = useAuth();
  const [loading, setLoading] = useState(true);

  // Real data states
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [freePlan, setFreePlan] = useState<any>(null); // fallback plan
  const [usage, setUsage] = useState({
    contracts: 0,
    customers: 0,
    technicians: 0,
    teamSeats: 0,
    quotationsThisMonth: 0,
    invoicesThisMonth: 0,
  });
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // UI states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('expired');

  // Fetch all billing data
  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Get the Free plan (fallback)
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

      // 3. Set the active plan (if subscription exists, use its plan, else use free plan)
      if (subData?.plan) {
        setPlan(subData.plan);
      } else {
        setPlan(freePlanData || null);
      }

      // 4. Get usage stats
      const [
        { count: contractsCount },
        { count: customersCount },
        { count: techniciansCount },
        { count: teamSeatsCount },
      ] = await Promise.all([
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
      ]);

      // Monthly quotations and invoices
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { count: quotationsCount } = await supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const { count: invoicesCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      setUsage({
        contracts: contractsCount || 0,
        customers: customersCount || 0,
        technicians: techniciansCount || 0,
        teamSeats: teamSeatsCount || 0,
        quotationsThisMonth: quotationsCount || 0,
        invoicesThisMonth: invoicesCount || 0,
      });

      // 5. Get payment history
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

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleSelectUpgradePlan = (plan: Plan, billingCycle: BillingCycle) => {
    // TODO: Implement Razorpay integration
    alert(`Upgrading to ${plan.name} (${billingCycle})`);
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

  // Determine if the user has an active subscription
  const hasSubscription = subscription && subscription.status === 'active';

  // Plan to use for usage limits: active plan or fallback to free plan
  const activePlan = plan || freePlan;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscription, view usage, and payment history
          </p>
        </div>

        {/* Current Plan Section – shows either the subscription or a "No plan" card */}
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

        {/* Usage & Team Seats Grid – always show usage, using the active plan (or free plan) for limits */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UsageIndicators usage={usage} plan={activePlan} />
          </div>
          <TeamSeatsIndicator usage={usage} plan={activePlan} />
        </section>

        {/* Payment History */}
        <section>
          <PaymentHistoryTable transactions={paymentHistory} />
        </section>

        {/* Demo Section: Limit Modals */}
        <section className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            🎯 Demo: Paywall Scenarios
          </h3>
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
    </DashboardLayout>
  );
}
