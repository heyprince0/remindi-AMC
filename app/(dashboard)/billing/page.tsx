"use client"

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import CurrentPlanCard from '@/components/billing/current-plan-card';
import PaymentHistoryTable from '@/components/billing/payment-history-table';
import PlanSelectionModal from '@/components/billing/PlanSelectionModal';
import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
import { BillingCycle, Plan, PaymentTransaction } from '@/lib/billing-types';
import { usePlanLimits } from '@/lib/hooks/use-plan-limits';

// Helper to compute billing month start from subscription start date
function getBillingMonthStart(startDate: string | null): Date | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const startDay = start.getDate();
  const now = new Date();
  const billingStart = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now.getDate() < startDay) {
    billingStart.setMonth(billingStart.getMonth() - 1);
  }
  billingStart.setHours(0, 0, 0, 0);
  return billingStart;
}

export default function BillingPage() {
  const { user, orgId } = useAuth();
  const [loading, setLoading] = useState(true);

  const [subscription, setSubscription] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalType, setLimitModalType] = useState<LimitModalType>('expired');

  // Get all limits and usage
  const limits = usePlanLimits(orgId);

  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans!fk_subscriptions_plan(*)')
        .eq('org_id', orgId)
        .maybeSingle();

      if (subError) throw subError;
      setSubscription(subData);

      const { data: txData, error: txError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txError) throw txError;

      const planIds = [...new Set((txData || []).map((row: any) => row.plan_id).filter(Boolean))];
      let planNameMap: Record<string, string> = {};

      if (planIds.length > 0) {
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('id, name')
          .in('id', planIds);

        planNameMap = (plansData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.name;
          return acc;
        }, {});
      }

      const mappedHistory: PaymentTransaction[] = (txData || []).map((row: any) => ({
        id: row.id,
        date: row.created_at,
        plan: planNameMap[row.plan_id] || row.plan_id || '—',
        billingCycle: row.billing_cycle || '—',
        amount: row.amount,
        status: row.status,
        invoiceUrl: row.invoice_url || null,
      }));

      setPaymentHistory(mappedHistory);
    } catch (error: any) {
      console.error('Error fetching billing data:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId]);

  const handleUpgrade = () => setShowUpgradeModal(true);
  const handleOpenLimitModal = (type: LimitModalType) => {
    setLimitModalType(type);
    setShowLimitModal(true);
  };

  // Determine billing month start for display
  const billingMonthStart = subscription?.start_date
    ? getBillingMonthStart(subscription.start_date)
    : null;

  // Check if user is on a free trial
  const isTrial = subscription?.status === 'trial';

  const resetLabel = isTrial
    ? 'Unlimited during trial'
    : billingMonthStart
      ? `Resets on the ${billingMonthStart.getDate()}th of every month`
      : 'Resets on the 1st of every month';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const hasSubscription = !!subscription;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">Manage your subscription, view usage, and payment history</p>
        </div>

        <section>
          {hasSubscription ? (
            <CurrentPlanCard
              subscription={subscription}
              onUpgrade={handleUpgrade}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Active Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  You don't have a subscription yet. Choose a plan to get started.
                </p>
                <Button onClick={handleUpgrade}>Choose a Plan</Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Usage & Limits Section */}
        {hasSubscription && (
          <section>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Usage & Limits</CardTitle>
                  {isTrial && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      Free Trial
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {resetLabel}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Contracts */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Contracts</span>
                      <span className="text-muted-foreground">
                        {limits.currentContractCount} / {limits.maxContracts === 999999 ? '∞' : limits.maxContracts}
                      </span>
                    </div>
                    {limits.maxContracts !== 999999 && limits.maxContracts > 0 ? (
                      <Progress
                        value={(limits.currentContractCount / limits.maxContracts) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Customers */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Customers</span>
                      <span className="text-muted-foreground">
                        {limits.currentCustomerCount} / {limits.maxCustomers === 999999 ? '∞' : limits.maxCustomers}
                      </span>
                    </div>
                    {limits.maxCustomers !== 999999 && limits.maxCustomers > 0 ? (
                      <Progress
                        value={(limits.currentCustomerCount / limits.maxCustomers) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Technicians */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Technicians</span>
                      <span className="text-muted-foreground">
                        {limits.currentTechnicianCount} / {limits.maxTechnicians === 999999 ? '∞' : limits.maxTechnicians}
                      </span>
                    </div>
                    {limits.maxTechnicians !== 999999 && limits.maxTechnicians > 0 ? (
                      <Progress
                        value={(limits.currentTechnicianCount / limits.maxTechnicians) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Team Seats */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Team Seats</span>
                      <span className="text-muted-foreground">
                        {limits.currentTeamSeats} / {limits.maxTeamSeats === 999999 ? '∞' : limits.maxTeamSeats}
                      </span>
                    </div>
                    {limits.maxTeamSeats !== 999999 && limits.maxTeamSeats > 0 ? (
                      <Progress
                        value={(limits.currentTeamSeats / limits.maxTeamSeats) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Inventory */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Inventory Items</span>
                      <span className="text-muted-foreground">
                        {limits.currentInventoryCount} / {limits.maxInventory === 999999 ? '∞' : limits.maxInventory}
                      </span>
                    </div>
                    {limits.maxInventory !== 999999 && limits.maxInventory > 0 ? (
                      <Progress
                        value={(limits.currentInventoryCount / limits.maxInventory) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Quotations */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {isTrial ? 'Quotations (trial – total)' : 'Quotations (this month)'}
                      </span>
                      <span className="text-muted-foreground">
                        {limits.currentQuotationsThisMonth} / {limits.maxQuotationsMonthly === 999999 ? '∞' : limits.maxQuotationsMonthly}
                      </span>
                    </div>
                    {limits.maxQuotationsMonthly !== 999999 && limits.maxQuotationsMonthly > 0 ? (
                      <Progress
                        value={(limits.currentQuotationsThisMonth / limits.maxQuotationsMonthly) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>

                  {/* Invoices */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {isTrial ? 'Invoices (trial – total)' : 'Invoices (this month)'}
                      </span>
                      <span className="text-muted-foreground">
                        {limits.currentInvoicesThisMonth} / {limits.maxInvoicesMonthly === 999999 ? '∞' : limits.maxInvoicesMonthly}
                      </span>
                    </div>
                    {limits.maxInvoicesMonthly !== 999999 && limits.maxInvoicesMonthly > 0 ? (
                      <Progress
                        value={(limits.currentInvoicesThisMonth / limits.maxInvoicesMonthly) * 100}
                        className="h-2"
                      />
                    ) : (
                      <div className="h-2 rounded-full bg-muted/20" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <PaymentHistoryTable transactions={paymentHistory} />
        </section>

        <PlanSelectionModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          orgId={orgId || undefined}
          onSuccess={() => {
            fetchData();
          }}
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
