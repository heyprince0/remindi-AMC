import { BillingCycle, Plan } from './billing-types';
import { BILLING_CYCLES } from './billing-mock-data';

export function calculatePrice(
  basePrice: number,
  billingCycle: BillingCycle,
): number {
  const cycle = BILLING_CYCLES.find((c) => c.cycle === billingCycle);
  if (!cycle) return basePrice;

  const subtotal = basePrice * cycle.months;
  const discount = subtotal * (cycle.discount / 100);
  return Math.round((subtotal - discount) * 100) / 100;
}

export function getDiscountPercentage(billingCycle: BillingCycle): number {
  const cycle = BILLING_CYCLES.find((c) => c.cycle === billingCycle);
  return cycle?.discount || 0;
}

export function getBillingCycleLabel(billingCycle: BillingCycle): string {
  const cycle = BILLING_CYCLES.find((c) => c.cycle === billingCycle);
  return cycle?.label || 'Monthly';
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getStatusColor(
  status: 'active' | 'trial' | 'expired' | 'cancelled',
): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'trial':
      return 'bg-blue-100 text-blue-800';
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(
  status: 'active' | 'trial' | 'expired' | 'cancelled',
): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getPaymentStatusColor(
  status: 'success' | 'failed' | 'refunded' | 'pending',
): string {
  switch (status) {
    case 'success':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    case 'refunded':
      return 'text-orange-600';
    case 'pending':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
}

export function getPaymentStatusBadgeColor(
  status: 'success' | 'failed' | 'refunded' | 'pending',
): string {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'refunded':
      return 'bg-orange-100 text-orange-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPaymentStatusLabel(
  status: 'success' | 'failed' | 'refunded' | 'pending',
): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function calculateRenewalDate(
  billingCycle: BillingCycle,
  startDate: Date = new Date(),
): Date {
  const cycle = BILLING_CYCLES.find((c) => c.cycle === billingCycle);
  if (!cycle) return startDate;

  const renewalDate = new Date(startDate);
  renewalDate.setMonth(renewalDate.getMonth() + cycle.months);
  return renewalDate;
}

export function getUsagePercentage(used: number, limit: number): number {
  if (limit === Infinity) return 0;
  return Math.round((used / limit) * 100);
}

export function getUsageColor(percentage: number): string {
  if (percentage < 50) return 'bg-green-500';
  if (percentage < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getUsageTextColor(percentage: number): string {
  if (percentage < 50) return 'text-green-700';
  if (percentage < 80) return 'text-yellow-700';
  return 'text-red-700';
}
