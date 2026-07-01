'use client';

import { UsageData } from '@/lib/billing-types';
import { getUsagePercentage, getUsageColor, getUsageTextColor } from '@/lib/billing-helpers';
import { Progress } from '@/components/ui/progress';

interface UsageIndicatorsProps {
  usage: UsageData;
}

export default function UsageIndicators({ usage }: UsageIndicatorsProps) {
  const quotationsPercentage = getUsagePercentage(
    usage.quotations.used,
    usage.quotations.limit,
  );
  const invoicesPercentage = getUsagePercentage(
    usage.invoices.used,
    usage.invoices.limit,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        Usage This Month
      </h3>

      <div className="space-y-6">
        {/* Quotations */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Quotations
            </label>
            <span className={`text-sm font-bold ${getUsageTextColor(quotationsPercentage)}`}>
              {usage.quotations.used} / {usage.quotations.limit}
            </span>
          </div>
          <Progress
            value={quotationsPercentage}
            className={`h-2 bg-gray-200 ${getUsageColor(quotationsPercentage)}`}
          />
          <p className="mt-1 text-xs text-gray-500">
            Resets on the 1st of every month
          </p>
        </div>

        {/* Invoices */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Invoices
            </label>
            <span className={`text-sm font-bold ${getUsageTextColor(invoicesPercentage)}`}>
              {usage.invoices.used} / {usage.invoices.limit}
            </span>
          </div>
          <Progress
            value={invoicesPercentage}
            className={`h-2 bg-gray-200 ${getUsageColor(invoicesPercentage)}`}
          />
          <p className="mt-1 text-xs text-gray-500">
            Resets on the 1st of every month
          </p>
        </div>
      </div>
    </div>
  );
}
