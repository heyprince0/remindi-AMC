// Billing Types and Interfaces

export type BillingCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'yearly';
export type PlanType = 'free' | 'starter' | 'growth';
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled';
export type PaymentStatus = 'success' | 'failed' | 'refunded' | 'pending';

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  features: string[];
  limits: {
    contracts: number;
    customers: number;
    teamSeats: number;
    quotations: number;
    invoices: number;
  };
  badge?: string;
  recommended?: boolean;
}

export interface BillingCycleOption {
  cycle: BillingCycle;
  months: number;
  discount: number;
  label: string;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPrice: number;
  startDate: Date;
  endDate: Date;
  renewalDate?: Date;
  cancelledAt?: Date;
  trialDaysRemaining?: number;
}

export interface UsageData {
  quotations: {
    used: number;
    limit: number;
  };
  invoices: {
    used: number;
    limit: number;
  };
  teamSeats: {
    used: number;
    limit: number;
  };
}

export interface PaymentTransaction {
  id: string;
  date: Date;
  plan: string;
  billingCycle: BillingCycle;
  amount: number;
  status: PaymentStatus;
  invoiceUrl?: string;
}

export interface OrderSummary {
  plan: Plan;
  billingCycle: BillingCycle;
  basePrice: number;
  discount: number;
  totalPrice: number;
  renewalDate: Date;
}
