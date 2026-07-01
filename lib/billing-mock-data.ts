import {
  Plan,
  BillingCycleOption,
  Subscription,
  UsageData,
  PaymentTransaction,
} from './billing-types';

export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Free Trial',
    description: 'Get started with all features',
    basePrice: 0,
    currency: '₹',
    features: [
      'Unlimited contracts',
      'Unlimited customers',
      'Unlimited quotations',
      'Unlimited invoices',
      '1 team seat',
      '15 days free',
    ],
    limits: {
      contracts: Infinity,
      customers: Infinity,
      teamSeats: 1,
      quotations: Infinity,
      invoices: Infinity,
    },
    badge: '15 days free',
    recommended: true,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams',
    basePrice: 499,
    currency: '₹',
    features: [
      '75 contracts',
      '100 customers',
      '50 quotations/month',
      '50 invoices/month',
      '2 team seats',
      'Priority support',
    ],
    limits: {
      contracts: 75,
      customers: 100,
      teamSeats: 2,
      quotations: 50,
      invoices: 50,
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'For scaling businesses',
    basePrice: 799,
    currency: '₹',
    features: [
      '500 contracts',
      '500 customers',
      '300 quotations/month',
      '300 invoices/month',
      '10 team seats',
      'Priority support',
      'API access',
    ],
    limits: {
      contracts: 500,
      customers: 500,
      teamSeats: 10,
      quotations: 300,
      invoices: 300,
    },
  },
};

export const BILLING_CYCLES: BillingCycleOption[] = [
  {
    cycle: 'monthly',
    months: 1,
    discount: 0,
    label: 'Monthly',
  },
  {
    cycle: 'quarterly',
    months: 3,
    discount: 5,
    label: 'Quarterly (5% off)',
  },
  {
    cycle: 'semi-annual',
    months: 6,
    discount: 10,
    label: 'Semi-Annual (10% off)',
  },
  {
    cycle: 'yearly',
    months: 12,
    discount: 15,
    label: 'Yearly (15% off)',
  },
];

// Mock subscription state for demo
export const MOCK_SUBSCRIPTION: Subscription = {
  id: 'sub_123',
  userId: 'user_123',
  plan: PLANS.starter,
  status: 'trial',
  billingCycle: 'monthly',
  currentPrice: 499,
  startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
  endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
  trialDaysRemaining: 9,
};

// Mock usage data for demo
export const MOCK_USAGE: UsageData = {
  quotations: {
    used: 32,
    limit: 50,
  },
  invoices: {
    used: 18,
    limit: 50,
  },
  teamSeats: {
    used: 2,
    limit: 2,
  },
};

// Mock payment history for demo
export const MOCK_PAYMENT_HISTORY: PaymentTransaction[] = [
  {
    id: 'txn_001',
    date: new Date(2024, 11, 1),
    plan: 'Starter',
    billingCycle: 'monthly',
    amount: 499,
    status: 'success',
    invoiceUrl: '#',
  },
  {
    id: 'txn_002',
    date: new Date(2024, 10, 1),
    plan: 'Starter',
    billingCycle: 'monthly',
    amount: 499,
    status: 'success',
    invoiceUrl: '#',
  },
  {
    id: 'txn_003',
    date: new Date(2024, 9, 1),
    plan: 'Starter',
    billingCycle: 'monthly',
    amount: 499,
    status: 'failed',
  },
  {
    id: 'txn_004',
    date: new Date(2024, 8, 1),
    plan: 'Free Trial',
    billingCycle: 'monthly',
    amount: 0,
    status: 'success',
  },
];
