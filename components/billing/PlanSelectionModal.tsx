'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PlanCard from './PlanCard';

type BillingCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_quarterly: number;
  price_semi_annual: number;
  price_annual: number;
  features: string[];
  max_contracts: number;
  max_customers: number;
  max_technicians: number;
  max_team_seats: number;
  max_quotations_monthly: number;
  max_invoices_monthly: number;
}

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
  onSuccess?: () => void;   // 👈 added
}

const CYCLE_LABELS: Record<BillingCycle, { label: string; period: string; months: number }> = {
  monthly: { label: 'Monthly', period: 'month', months: 1 },
  quarterly: { label: '3 Months', period: '3 months', months: 3 },
  'semi-annual': { label: '6 Months', period: '6 months', months: 6 },
  annual: { label: 'Yearly', period: 'year', months: 12 },
};

let razorpayLoaded = false;
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PlanSelectionModal({
  isOpen,
  onClose,
  orgId: propOrgId,
  onSuccess,   // 👈 added
}: PlanSelectionModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orgId, setOrgId] = useState<string | undefined>(propOrgId);
  const [isFetchingOrg, setIsFetchingOrg] = useState(false);

  // Fetch orgId from memberships if not provided
  useEffect(() => {
    const fetchOrgId = async () => {
      if (propOrgId) {
        setOrgId(propOrgId);
        return;
      }
      if (!isOpen) return;

      setIsFetchingOrg(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No user logged in');
          return;
        }

        const { data: membership, error } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching membership:', error);
          toast.error('Could not retrieve organization information.');
          return;
        }

        if (membership?.org_id) {
          setOrgId(membership.org_id);
          console.log('✅ Fetched orgId:', membership.org_id);
        } else {
          console.error('No organization found for this user.');
          toast.error('You are not assigned to any organization.');
        }
      } catch (err) {
        console.error('Failed to fetch org id:', err);
      } finally {
        setIsFetchingOrg(false);
      }
    };

    fetchOrgId();
  }, [propOrgId, isOpen]);

  // Fetch plans from Supabase
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        const parsed = (data || []).map((p: any) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]'),
        }));
        const filtered = parsed.filter((p: Plan) => p.id !== 'free');
        setPlans(filtered);
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast.error('Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    if (isOpen) fetchPlans();
  }, [isOpen]);

  const getPrice = (plan: Plan) => {
    const map: Record<BillingCycle, number> = {
      monthly: plan.price_monthly,
      quarterly: plan.price_quarterly,
      'semi-annual': plan.price_semi_annual,
      annual: plan.price_annual,
    };
    return map[selectedCycle] || 0;
  };

  const getDiscountPercent = (plan: Plan) => {
    const { months } = CYCLE_LABELS[selectedCycle];
    if (months === 1) return 0;
    const currentPrice = getPrice(plan);
    const equivalentMonthlyTotal = plan.price_monthly * months;
    if (!equivalentMonthlyTotal || !currentPrice) return 0;
    const savings = equivalentMonthlyTotal - currentPrice;
    if (savings <= 0) return 0;
    return Math.round((savings / equivalentMonthlyTotal) * 100);
  };

  const getSavingsAmount = (plan: Plan) => {
    const { months } = CYCLE_LABELS[selectedCycle];
    if (months === 1) return 0;
    const currentPrice = getPrice(plan);
    const equivalentMonthlyTotal = plan.price_monthly * months;
    return Math.max(equivalentMonthlyTotal - currentPrice, 0);
  };

  const handleSelect = async (plan: Plan) => {
    if (isProcessing) return;

    if (!orgId || orgId.trim() === '') {
      toast.error('Organization ID not found. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Payment system could not be loaded. Please try again.');
        setIsProcessing(false);
        return;
      }

      const amount = getPrice(plan);
      if (amount === 0) {
        toast.error('This plan is free – no payment required.');
        setIsProcessing(false);
        return;
      }

      const payload = {
        planId: plan.id,
        billingCycle: selectedCycle,
        orgId: orgId.trim(),
      };
      console.log('📤 Sending to API:', payload);

      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const { orderId, amount: orderAmount, currency, keyId } = await response.json();

      const options = {
        key: keyId,
        amount: orderAmount,
        currency,
        order_id: orderId,
        name: 'Remindi AMC',
        description: `${plan.name} Plan – ${CYCLE_LABELS[selectedCycle].label}`,
        prefill: {},
        handler: function (response: any) {
          toast.success('Payment successful! Your subscription is being activated.');
          onSuccess?.();   // 👈 call refresh callback
          onClose();
        },
        modal: {
          ondismiss: function () {
            toast.info('Payment cancelled.');
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || isFetchingOrg) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!max-w-4xl w-[95vw]">
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-12 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (plans.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!max-w-lg w-[95vw]">
          <div className="text-center py-12">
            <p className="text-gray-500">No paid plans available at the moment.</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-4xl w-[95vw] max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl sm:text-3xl font-bold text-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            Select the plan that fits your business needs. Upgrade anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 my-6 sm:my-8">
          {Object.entries(CYCLE_LABELS).map(([cycle, { label }]) => (
            <button
              key={cycle}
              onClick={() => setSelectedCycle(cycle as BillingCycle)}
              className={`px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCycle === cycle
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-6">
          {plans.map((plan) => {
            const price = getPrice(plan);
            const isFree = price === 0;
            const isPopular = plan.id === 'pro';
            const discountPercent = getDiscountPercent(plan);
            const savingsAmount = getSavingsAmount(plan);

            return (
              <PlanCard
                key={plan.id}
                plan={{
                  id: plan.id,
                  name: plan.name,
                  description: plan.description,
                  price,
                  period: CYCLE_LABELS[selectedCycle].period,
                  features: plan.features,
                  isPopular,
                  isFree,
                  discountPercent,
                  savingsAmount,
                  onSelect: () => handleSelect(plan),
                  disabled: isProcessing || !orgId,
                }}
              />
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-500 mt-10 sm:mt-12">
          All plans include free updates. Cancel anytime.
        </p>
      </DialogContent>
    </Dialog>
  );
}
