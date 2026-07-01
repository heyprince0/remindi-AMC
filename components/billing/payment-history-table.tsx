'use client';

import { PaymentTransaction } from '@/lib/billing-types';
import {
  formatDate,
  formatCurrency,
  getPaymentStatusBadgeColor,
  getPaymentStatusLabel,
} from '@/lib/billing-helpers';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

interface PaymentHistoryTableProps {
  transactions: PaymentTransaction[];
}

export default function PaymentHistoryTable({
  transactions,
}: PaymentHistoryTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 overflow-x-auto">
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        Payment History
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-700">
              Date
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">
              Plan
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">
              Billing Cycle
            </th>
            <th className="text-right py-3 px-4 font-medium text-gray-700">
              Amount
            </th>
            <th className="text-left py-3 px-4 font-medium text-gray-700">
              Status
            </th>
            <th className="text-center py-3 px-4 font-medium text-gray-700">
              Invoice
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr
              key={txn.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-4 px-4 text-gray-900">
                {formatDate(txn.date)}
              </td>
              <td className="py-4 px-4 text-gray-900">{txn.plan}</td>
              <td className="py-4 px-4 text-gray-600">
                {txn.billingCycle.replace(/-/g, ' ')}
              </td>
              <td className="py-4 px-4 text-right font-medium text-gray-900">
                {formatCurrency(txn.amount)}
              </td>
              <td className="py-4 px-4">
                <Badge className={getPaymentStatusBadgeColor(txn.status)}>
                  {getPaymentStatusLabel(txn.status)}
                </Badge>
              </td>
              <td className="py-4 px-4 text-center">
                {txn.invoiceUrl ? (
                  <a
                    href={txn.invoiceUrl}
                    className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Download invoice"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
