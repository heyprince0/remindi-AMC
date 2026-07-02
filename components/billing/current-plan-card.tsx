'use client';

import {
  formatDate,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '@/lib/billing-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Matches your real `subscription_plans` table
interface PlanData {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_semi_annual: number | null;
  price_annual: number | null;
}

// Matches your real `subscriptions` table
interface SubscriptionData {
  id: string;
  org_id: string;
  plan_id: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | string;
  billing_cycle: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | null;
  start_date: string | null;
  end_date: string | null;
  trial_end_date: string | null;
  next_billing_date: string | null;
  last_payment_date: string | null;
  plan: PlanData;
}

interface CurrentPlanCardProps {
  subscription: SubscriptionData;
  onUpgrade: () => void;
  onCancel?: () => void;
}

const CYCLE_PRICE_FIELD: Record<string, keyof PlanData> = {
  monthly: 'price_monthly',
  quarterly: 'price_quarterly',
  'semi-annual': 'price_semi_annual',
  annual: 'price_annual',
};

const CYCLE_PERIOD_LABEL: Record<string, string> = {
  monthly: 'month',
  quarterly: '3 months',
  'semi-annual': '6 months',
  annual: 'year',
};

export default function CurrentPlanCard({
  subscription,
  onUpgrade,
  onCancel,
}: CurrentPlanCardProps) {
  if (!subscription || !subscription.plan) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
        <p>No plan details available.</p>
      </div>
    );
  }

  const { plan, status, billing_cycle } = subscription;

  // Pick the right price field based on billing_cycle, fall back to monthly
  const priceField = billing_cycle ? CYCLE_PRICE_FIELD[billing_cycle] : 'price_monthly';
  const currentPrice = plan[priceField] ?? plan.price_monthly ?? null;
  const periodLabel = billing_cycle ? CYCLE_PERIOD_LABEL[billing_cycle] || 'month' : 'month';

  // Trial days remaining, computed from trial_end_date (your schema
  // stores a date, not a pre-calculated day count)
  const trialDaysRemaining = subscription.trial_end_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;
  const trialPercentage = trialDaysRemaining != null ? (trialDaysRemaining / 15) * 100 : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
            <Badge className={getStatusColor(status as any)}>{getStatusLabel(status as any)}</Badge>
          </div>
          {plan.description && (
            <p className="text-sm text-gray-600">{plan.description}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {/* Trial Progress */}
        {status === 'trial' && trialDaysRemaining != null && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">Trial Period</p>
              <p className="text-sm font-bold text-blue-900">{trialDaysRemaining} days left</p>
            </div>
            <Progress value={trialPercentage} className="h-2 bg-blue-200" />
            <p className="mt-2 text-xs text-blue-700">
              Your trial will end on {formatDate(subscription.trial_end_date)}
            </p>
          </div>
        )}

        {/* Active Status Info — Start & Renewal Dates */}
        {status === 'active' && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-green-900">
              <span className="font-medium">Started on</span> {formatDate(subscription.start_date)}
            </p>
            {(subscription.next_billing_date || subscription.end_date) && (
              <p className="text-sm text-green-900 mt-1">
                <span className="font-medium">Renews on</span>{' '}
                {formatDate(subscription.next_billing_date || subscription.end_date)}
              </p>
            )}
          </div>
        )}

        {/* Expired Status Info */}
        {status === 'expired' && (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-900 font-medium">Your subscription has expired</p>
            <p className="text-sm text-red-700 mt-1">
              Started on {formatDate(subscription.start_date)} · Expired on{' '}
              {formatDate(subscription.end_date)}
            </p>
          </div>
        )}

        {/* Cancelled Status Info */}
        {status === 'cancelled' && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-900 font-medium">Subscription cancelled</p>
            <p className="text-sm text-gray-700 mt-1">
              Access ends on {formatDate(subscription.end_date)}
            </p>
          </div>
        )}

        {/* Price Info */}
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Plan Price</p>
          <p className="text-2xl font-bold text-gray-900">
            {currentPrice != null ? `${formatCurrency(currentPrice)}/${periodLabel}` : '—'}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={onUpgrade} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
          Upgrade Plan
        </Button>
        {onCancel && (
          <Button onClick={onCancel} variant="ghost" className="text-gray-600 hover:text-gray-900">
            Cancel Subscription
          </Button>
        )}
      </div>
    </div>
  );
}
