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
  // team seats – excluding the owner
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

      // 2. Compute billing month start from subscription start_date
      let billingMonthStart: Date;
      if (subData?.start_date) {
        const startDay = new Date(subData.start_date).getDate();
        const now = new Date();
        billingMonthStart = new Date(now.getFullYear(), now.getMonth(), startDay);
        if (now.getDate() < startDay) {
          billingMonthStart.setMonth(billingMonthStart.getMonth() - 1);
        }
      } else {
        billingMonthStart = new Date();
        billingMonthStart.setDate(1);
        billingMonthStart.setHours(0, 0, 0, 0);
      }
      billingMonthStart.setHours(0, 0, 0, 0);
      const billingMonthStartStr = billingMonthStart.toISOString();

      // 3. Fetch the organization owner
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', orgId)
        .single();
      if (orgError) throw orgError;
      const ownerId = orgData?.owner_id;

      // 4. Count customers
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 5. Count contracts
      const { count: contractCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 6. Count technicians
      const { count: technicianCount } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      // 7. Count inventory items
      const { count: inventoryCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true);

      // 8. Count team members (excluding owner)
      let teamCount = 0;
      if (ownerId) {
        const { count: allMembers } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId);
        // Since we can't subtract in the query, we'll fetch the list and filter
        const { data: membersData } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('org_id', orgId);
        if (membersData) {
          teamCount = membersData.filter(m => m.user_id !== ownerId).length;
        }
      } else {
        // If no owner, count all memberships
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId);
        teamCount = count || 0;
      }

      // 9. Count quotations this billing month
      const { count: quotationsCount } = await supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', billingMonthStartStr);

      // 10. Count invoices this billing month
      const { count: invoicesCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', billingMonthStartStr);

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
        currentQuotationsThisMonth: quotationsCount || 0,
        currentInvoicesThisMonth: invoicesCount || 0,
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
