'use client';

import { PaymentTransaction } from '@/lib/billing-types';
import {
  formatDate,
  formatCurrency,
  getPaymentStatusBadgeColor,
  getPaymentStatusLabel,
} from '@/lib/billing-helpers';
import { Badge } from '@/components/ui/badge';

interface PaymentHistoryTableProps {
  transactions: PaymentTransaction[];
}

// Safe formatters that never throw
const safeFormatCurrency = (amount: any): string => {
  if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount)) {
    return '—';
  }
  return formatCurrency(amount);
};

const safeFormatDate = (date: any): string => {
  if (!date) return '—';
  try {
    return formatDate(date);
  } catch {
    return '—';
  }
};

export default function PaymentHistoryTable({
  transactions,
}: PaymentHistoryTableProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
        <p>No payment history yet.</p>
        <p className="text-sm">Your transactions will appear here once you make a payment.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 overflow-x-auto">
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        Payment History
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Plan</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Billing Cycle</th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr
              key={txn.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-4 px-4 text-gray-900">
                {safeFormatDate(txn.date)}
              </td>
              <td className="py-4 px-4 text-gray-900">
                {txn.plan || '—'}
              </td>
              <td className="py-4 px-4 text-gray-600">
                {txn.billingCycle ? txn.billingCycle.replace(/-/g, ' ') : '—'}
              </td>
              <td className="py-4 px-4 text-right font-medium text-gray-900">
                {safeFormatCurrency(txn.amount)}
              </td>
              <td className="py-4 px-4">
                {txn.status ? (
                  <Badge className={getPaymentStatusBadgeColor(txn.status)}>
                    {getPaymentStatusLabel(txn.status)}
                  </Badge>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
