"use client"

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Temporarily commented out – will be re-enabled when payment is implemented
// import CurrentPlanCard from '@/components/billing/current-plan-card';
// import PaymentHistoryTable from '@/components/billing/payment-history-table';
// import PlanSelectionModal from '@/components/billing/PlanSelectionModal';
// import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
// import { BillingCycle, Plan } from '@/lib/billing-types';

// Feature flag – set to false to completely disable billing features
const BILLING_ENABLED = false;

export default function BillingPage() {
  const { user, orgId } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data states – kept but will be empty
  const [subscription, setSubscription] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [freePlan, setFreePlan] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // UI states – kept but not used
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<any>('expired');

  // Fetch data – completely disabled when BILLING_ENABLED is false
  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      if (!BILLING_ENABLED) {
        // 🔒 Billing is disabled – just set empty states and return
        setSubscription(null);
        setPlan(null);
        setFreePlan(null);
        setPaymentHistory([]);
        setLoading(false);
        return;
      }

      // ——— 🔓 Everything below is only run when BILLING_ENABLED = true ———
      // (Keep your existing fetch logic here, but it's commented out for now)

      /*
      // 1. Get free plan
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
      setPlan(subData?.plan || freePlanData);

      // 3. Get payment history
      const { data: txData, error: txError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (txError) throw txError;
      setPaymentHistory(txData || []);
      */

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

  // Placeholder handlers (do nothing)
  const handleUpgrade = () => {
    toast.info('Billing is currently disabled. Coming soon!');
  };
  const handleSelectUpgradePlan = (plan: any, billingCycle: any) => {
    toast.info('Billing is currently disabled. Coming soon!');
    setShowUpgradeModal(false);
  };
  const handleOpenLimitModal = (type: any) => {
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">Manage your subscription, view usage, and payment history</p>
        </div>

        {BILLING_ENABLED ? (
          // 🔓 Real billing UI (will be re-enabled later)
          <>
            {/* Current Plan */}
            <section>
              {/* Uncomment when ready: <CurrentPlanCard ... /> */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Your plan details will appear here.</p>
                </CardContent>
              </Card>
            </section>

            {/* Payment History */}
            <section>
              {/* Uncomment when ready: <PaymentHistoryTable transactions={paymentHistory} /> */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
                <p>Payment history will be available soon.</p>
              </div>
            </section>

            {/* Demo Modals – also disabled */}
            {/* ... */}
          </>
        ) : (
          // 🔒 Placeholder – everything is coming soon
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>🚧 Billing Under Construction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We're building the billing system. You'll be able to manage your subscription and view payment history soon.
                </p>
                <Button className="mt-4" variant="outline" disabled>
                  Upgrade (Coming Soon)
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
              <p>Payment history will appear here after your first payment.</p>
            </div>
          </div>
        )}

        {/* Modals – kept but won't be shown because BILLING_ENABLED is false */}
        {/* <PlanSelectionModal ... /> */}
        {/* <LimitReachedModal ... /> */}
      </div>
    </DashboardLayout>
  );
}
