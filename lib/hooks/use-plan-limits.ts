import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PlanLimits {
  planId: string | null;
  planName: string;
  status: string; // 'active' | 'trial' | 'expired' | 'cancelled' | 'inactive'
  maxContracts: number;
  maxCustomers: number;
  maxTechnicians: number;
  maxTeamSeats: number;
  maxQuotationsMonthly: number;
  maxInvoicesMonthly: number;
  maxInventory: number;          // 👈 new
  currentContractCount: number;
  currentCustomerCount: number;
  currentTechnicianCount: number;
  currentQuotationsThisMonth: number;
  currentInvoicesThisMonth: number;
  currentInventoryCount: number; // 👈 new
  isLoading: boolean;
  refetch: () => void;
}

export function usePlanLimits(orgId: string | null): PlanLimits {
  const [limits, setLimits] = useState<Omit<PlanLimits, 'isLoading' | 'refetch'>>({
    planId: null,
    planName: 'Free',
    status: 'inactive',
    maxContracts: 0,
    maxCustomers: 0,
    maxTechnicians: 0,
    maxTeamSeats: 0,
    maxQuotationsMonthly: 0,
    maxInvoicesMonthly: 0,
    maxInventory: 0,             // 👈 new
    currentContractCount: 0,
    currentCustomerCount: 0,
    currentTechnicianCount: 0,
    currentQuotationsThisMonth: 0,
    currentInvoicesThisMonth: 0,
    currentInventoryCount: 0,    // 👈 new
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLimits = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      // 1. Get subscription and plan
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('plan_id, status, plan:subscription_plans!fk_subscriptions_plan(*)')
        .eq('org_id', orgId)
        .maybeSingle();

      if (subError) throw subError;

      const plan = subData?.plan || {
        max_contracts: 0,
        max_customers: 0,
        max_technicians: 0,
        max_team_seats: 0,
        max_quotations_monthly: 0,
        max_invoices_monthly: 0,
        max_inventory: 0,        // 👈 new
        name: 'Free',
      };
      const planId = subData?.plan_id || null;
      const status = subData?.status || 'inactive';

      // 2. Count customers
      const { count: customerCount, error: countError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (countError) throw countError;

      // 3. Count contracts
      const { count: contractCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 4. Count technicians
      const { count: technicianCount } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 5. Count inventory items
      const { count: inventoryCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true);

      // 6. Count quotations this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count: quotationsThisMonth } = await supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', startOfMonth.toISOString());

      // 7. Count invoices this month
      const { count: invoicesThisMonth } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', startOfMonth.toISOString());

      setLimits({
        planId,
        planName: plan.name || 'Free',
        status,
        maxContracts: plan.max_contracts || 0,
        maxCustomers: plan.max_customers || 0,
        maxTechnicians: plan.max_technicians || 0,
        maxTeamSeats: plan.max_team_seats || 0,
        maxQuotationsMonthly: plan.max_quotations_monthly || 0,
        maxInvoicesMonthly: plan.max_invoices_monthly || 0,
        maxInventory: plan.max_inventory || 0,   // 👈 set from plan
        currentContractCount: contractCount || 0,
        currentCustomerCount: customerCount || 0,
        currentTechnicianCount: technicianCount || 0,
        currentQuotationsThisMonth: quotationsThisMonth || 0,
        currentInvoicesThisMonth: invoicesThisMonth || 0,
        currentInventoryCount: inventoryCount || 0, // 👈 set from DB
      });
    } catch (err) {
      console.error('Error fetching plan limits:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchLimits();
  }, [orgId]);

  return { ...limits, isLoading, refetch: fetchLimits };
}
