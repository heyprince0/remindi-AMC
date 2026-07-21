import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PlanLimits {
  planId: string | null;
  planName: string;
  status: string;
  maxContracts: number;
  maxCustomers: number;
  maxTechnicians: number;
  maxTeamSeats: number;
  maxQuotationsMonthly: number;
  maxInvoicesMonthly: number;
  maxInventory: number;
  currentContractCount: number;
  currentCustomerCount: number;
  currentTechnicianCount: number;
  currentTeamSeats: number;
  currentQuotationsThisMonth: number;
  currentInvoicesThisMonth: number;
  currentInventoryCount: number;
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
    maxInventory: 0,
    currentContractCount: 0,
    currentCustomerCount: 0,
    currentTechnicianCount: 0,
    currentTeamSeats: 0,
    currentQuotationsThisMonth: 0,
    currentInvoicesThisMonth: 0,
    currentInventoryCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLimits = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      // 1. Get subscription, plan, and organization owner
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('plan_id, status, start_date, plan:subscription_plans!fk_subscriptions_plan(*)')
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
        max_inventory: 0,
        name: 'Free',
      };
      const planId = subData?.plan_id || null;
      const status = subData?.status || 'inactive';

      // 2. Determine date filter for quotations and invoices
      let quotaStartDate: Date | null = null;
      let useTotalForTrial = false;

      if (status === 'trial' && subData?.start_date) {
        // For trial users: count all quotations/invoices created since trial start
        useTotalForTrial = true;
        quotaStartDate = new Date(subData.start_date);
        quotaStartDate.setHours(0, 0, 0, 0);
      } else if (subData?.start_date) {
        // For paid users: billing month reset based on start day
        const startDay = new Date(subData.start_date).getDate();
        const now = new Date();
        quotaStartDate = new Date(now.getFullYear(), now.getMonth(), startDay);
        if (now.getDate() < startDay) {
          quotaStartDate.setMonth(quotaStartDate.getMonth() - 1);
        }
        quotaStartDate.setHours(0, 0, 0, 0);
      } else {
        // Fallback: 1st of current month
        quotaStartDate = new Date();
        quotaStartDate.setDate(1);
        quotaStartDate.setHours(0, 0, 0, 0);
      }

      // Convert to ISO date string (YYYY-MM-DD) for Supabase query
      const quotaStartStr = quotaStartDate?.toISOString().split('T')[0];

      // 3. Count customers (lifetime)
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 4. Count contracts (lifetime)
      const { count: contractCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 5. Count technicians (lifetime)
      const { count: technicianCount } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 6. Count inventory items (lifetime)
      const { count: inventoryCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true);

      // 7. Count team members (excluding owner)
      let teamCount = 0;
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', orgId)
        .single();
      if (!orgError && orgData?.owner_id) {
        const { data: membersData } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('org_id', orgId);
        if (membersData) {
          teamCount = membersData.filter(m => m.user_id !== orgData.owner_id).length;
        }
      } else {
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId);
        teamCount = count || 0;
      }

      // 8. Count quotations (filtered)
      let quotationsCount = 0;
      if (quotaStartStr) {
        const { count } = await supabase
          .from('quotations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', quotaStartStr); // compare as string YYYY-MM-DD
        quotationsCount = count || 0;
      }

      // 9. Count invoices (filtered)
      let invoicesCount = 0;
      if (quotaStartStr) {
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', quotaStartStr);
        invoicesCount = count || 0;
      }

      // 10. Debug logs (remove after verification)
      console.log('🔍 [usePlanLimits] quotaStartStr:', quotaStartStr);
      console.log('🔍 [usePlanLimits] quotationsCount:', quotationsCount);
      console.log('🔍 [usePlanLimits] invoicesCount:', invoicesCount);

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
        maxInventory: plan.max_inventory || 0,
        currentContractCount: contractCount || 0,
        currentCustomerCount: customerCount || 0,
        currentTechnicianCount: technicianCount || 0,
        currentTeamSeats: teamCount,
        currentQuotationsThisMonth: quotationsCount,
        currentInvoicesThisMonth: invoicesCount,
        currentInventoryCount: inventoryCount || 0,
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
