"use client"

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, FileText, Users, Wrench, UserCheck, Package, FileCheck, Receipt, TrendingUp, CreditCard, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import CurrentPlanCard from '@/components/billing/current-plan-card';
import PaymentHistoryTable from '@/components/billing/payment-history-table';
import PlanSelectionModal from '@/components/billing/PlanSelectionModal';
import LimitReachedModal, { LimitModalType } from '@/components/billing/limit-reached-modal';
import { PaymentTransaction } from '@/lib/billing-types';
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

// Returns tailwind color classes based on usage percentage
function getUsageColor(current: number, max: number) {
  if (max === 999999) return { bar: 'bg-primary', text: 'text-primary', bg: 'bg-primary/10', icon: 'text-primary' }
  const pct = (current / max) * 100
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-500/10', icon: 'text-red-500' }
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-500/10', icon: 'text-amber-500' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: 'text-emerald-500' }
}

interface UsageItemProps {
  label: string
  sublabel?: string
  current: number
  max: number
  icon: React.ReactNode
}

function UsageItem({ label, sublabel, current, max, icon }: UsageItemProps) {
  const isUnlimited = max === 999999
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100)
  const color = getUsageColor(current, max)
  const isNearLimit = !isUnlimited && pct >= 70
  const isAtLimit = !isUnlimited && pct >= 100

  return (
    <div className={cn(
      'rounded-xl border p-3.5 transition-colors',
      isAtLimit
        ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'
        : isNearLimit
        ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-900/10'
        : 'bg-card'
    )}>
      {/* Top row: icon + label + percentage */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', color.bg)}>
            <span className={color.icon}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{label}</p>
            {sublabel && (
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sublabel}</p>
            )}
          </div>
        </div>
        {isUnlimited ? (
          <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
            Unlimited
          </span>
        ) : (
          <span className={cn('text-xs font-bold tabular-nums shrink-0', color.text)}>
            {Math.round(pct)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mb-1.5">
        {isUnlimited ? (
          <div className="h-full w-full rounded-full bg-primary/20" />
        ) : (
          <div
            className={cn('h-full rounded-full transition-all', color.bar)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Bottom: used / max */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {isAtLimit ? '⚠ Limit reached' : isNearLimit ? '↑ Near limit' : 'Used'}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
          {current}{isUnlimited ? '' : ` / ${max}`}
        </span>
      </div>
    </div>
  )
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
    ? 'Free Trial usage'
    : billingMonthStart
      ? `Resets on the ${billingMonthStart.getDate()}th of every month`
      : 'Resets on the 1st of every month';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col gap-5 pb-20 md:pb-0">
          <div className="space-y-1.5">
            <div className="h-7 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-72 animate-pulse" />
          </div>
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const hasSubscription = !!subscription;

  // Detect any near/at-limit items to show upgrade nudge
  const nearLimitItems = hasSubscription ? [
    limits.maxContracts !== 999999 && limits.maxContracts > 0 && (limits.currentContractCount / limits.maxContracts) >= 0.7,
    limits.maxCustomers !== 999999 && limits.maxCustomers > 0 && (limits.currentCustomerCount / limits.maxCustomers) >= 0.7,
    limits.maxInventory !== 999999 && limits.maxInventory > 0 && (limits.currentInventoryCount / limits.maxInventory) >= 0.7,
    limits.maxQuotationsMonthly !== 999999 && limits.maxQuotationsMonthly > 0 && (limits.currentQuotationsThisMonth / limits.maxQuotationsMonthly) >= 0.7,
  ].some(Boolean) : false;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 md:gap-8 pb-20 md:pb-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground leading-tight">
              Billing & Subscription
            </h1>
            <p className="mt-1 text-sm md:text-base text-muted-foreground">
              Manage your plan, usage, and payment history
            </p>
          </div>
          {hasSubscription && !isTrial && (
            <Button size="sm" onClick={handleUpgrade} className="shrink-0 gap-1.5 hidden md:flex">
              <Zap className="size-4" />
              Upgrade
            </Button>
          )}
        </div>

        {/* ── Current Plan Card ── */}
        <section>
          {hasSubscription ? (
            <CurrentPlanCard subscription={subscription} onUpgrade={handleUpgrade} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <CreditCard className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No active subscription</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a plan to unlock all features
                  </p>
                </div>
                <Button onClick={handleUpgrade} className="gap-2">
                  <Zap className="size-4" />
                  Choose a Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Usage & Limits ── */}
        {hasSubscription && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Usage & Limits
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{resetLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                {isTrial && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                    Free Trial
                  </Badge>
                )}
                {nearLimitItems && (
                  <Button size="sm" variant="outline" onClick={handleUpgrade} className="h-7 px-2.5 text-xs gap-1 text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20">
                    <Zap className="size-3" />
                    Upgrade
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <UsageItem
                label="Contracts"
                current={limits.currentContractCount}
                max={limits.maxContracts}
                icon={<FileText className="size-3.5" />}
              />
              <UsageItem
                label="Customers"
                current={limits.currentCustomerCount}
                max={limits.maxCustomers}
                icon={<Users className="size-3.5" />}
              />
              <UsageItem
                label="Technicians"
                current={limits.currentTechnicianCount}
                max={limits.maxTechnicians}
                icon={<Wrench className="size-3.5" />}
              />
              <UsageItem
                label="Team Seats"
                current={limits.currentTeamSeats}
                max={limits.maxTeamSeats}
                icon={<UserCheck className="size-3.5" />}
              />
              <UsageItem
                label="Inventory"
                current={limits.currentInventoryCount}
                max={limits.maxInventory}
                icon={<Package className="size-3.5" />}
              />
              <UsageItem
                label="Quotations"
                sublabel={isTrial ? 'Trial total' : 'This month'}
                current={limits.currentQuotationsThisMonth}
                max={limits.maxQuotationsMonthly}
                icon={<FileCheck className="size-3.5" />}
              />
              <UsageItem
                label="Invoices"
                sublabel={isTrial ? 'Trial total' : 'This month'}
                current={limits.currentInvoicesThisMonth}
                max={limits.maxInvoicesMonthly}
                icon={<Receipt className="size-3.5" />}
              />
            </div>

            {/* Mobile upgrade CTA when near limit */}
            {nearLimitItems && (
              <button
                onClick={handleUpgrade}
                className="md:hidden mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 active:scale-[0.99] transition-all"
              >
                <Zap className="size-4" />
                You're near a limit — Upgrade your plan
              </button>
            )}
          </section>
        )}

        {/* ── Payment History ── */}
        <section>
          <div className="mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Payment History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your recent transactions</p>
          </div>
          <PaymentHistoryTable transactions={paymentHistory} />
        </section>

      </div>

      <PlanSelectionModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        orgId={orgId || undefined}
        onSuccess={() => fetchData()}
      />
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        type={limitModalType}
        onUpgrade={handleUpgrade}
      />
    </DashboardLayout>
  );
}
