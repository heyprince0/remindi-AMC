'use client';

import { Subscription } from '@/lib/billing-types';
import {
  formatDate,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '@/lib/billing-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface CurrentPlanCardProps {
  subscription: Subscription;
  onUpgrade: () => void;
  onCancel?: () => void;
}

export default function CurrentPlanCard({
  subscription,
  onUpgrade,
  onCancel,
}: CurrentPlanCardProps) {
  const trialPercentage = subscription.trialDaysRemaining
    ? (subscription.trialDaysRemaining / 15) * 100
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {subscription.plan.name}
            </h3>
            <Badge className={getStatusColor(subscription.status)}>
              {getStatusLabel(subscription.status)}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            {subscription.plan.description}
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {/* Trial Progress */}
        {subscription.status === 'trial' && subscription.trialDaysRemaining && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                Trial Period
              </p>
              <p className="text-sm font-bold text-blue-900">
                {subscription.trialDaysRemaining} days left
              </p>
            </div>
            <Progress value={trialPercentage} className="h-2 bg-blue-200" />
            <p className="mt-2 text-xs text-blue-700">
              Your trial will end on {formatDate(subscription.endDate)}
            </p>
          </div>
        )}

        {/* Active Status Info */}
        {subscription.status === 'active' && subscription.renewalDate && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-green-900">
              <span className="font-medium">Active since</span>{' '}
              {formatDate(subscription.startDate)}
            </p>
            <p className="text-sm text-green-900 mt-1">
              <span className="font-medium">Renews on</span>{' '}
              {formatDate(subscription.renewalDate)}
            </p>
          </div>
        )}

        {/* Expired Status Info */}
        {subscription.status === 'expired' && (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-900 font-medium">
              Your subscription has expired
            </p>
            <p className="text-sm text-red-700 mt-1">
              Expired on {formatDate(subscription.endDate)}
            </p>
          </div>
        )}

        {/* Price Info */}
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Monthly Price</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(subscription.currentPrice)}/month
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onUpgrade}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          Upgrade Plan
        </Button>
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            Cancel Subscription
          </Button>
        )}
      </div>
    </div>
  );
}
