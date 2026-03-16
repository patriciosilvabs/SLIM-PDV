import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPlatformAdminByEmail,
  getPlatformAdminByUserId,
  getSubscriptionByTenant,
  listProfilesByIds,
  listSubscriptionPlans,
  listSubscriptions,
  listTenantMembers,
  listTenants,
} from '@/lib/firebaseTenantCrud';

export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data: isPlatformAdmin, isLoading } = useQuery({
    queryKey: ['platform-admin', user?.id, user?.email],
    queryFn: async () => {
      if (!user) return false;

      if (user.id) {
        const byUserId = await getPlatformAdminByUserId(user.id);
        if (byUserId) return true;
      }

      if (user.email) {
        const byEmail = await getPlatformAdminByEmail(user.email);
        if (byEmail) return true;
      }

      return false;
    },
    enabled: !!user,
  });

  return {
    isPlatformAdmin: isPlatformAdmin ?? false,
    isLoading,
  };
}

export interface TenantWithDetails {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  owner_name?: string;
  member_count?: number;
  subscription?: {
    id: string;
    status: string;
    plan_id: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    plan?: {
      name: string;
      price_monthly: number;
    };
  } | null;
}

export function usePlatformTenants() {
  return useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const [tenants, plans] = await Promise.all([listTenants(), listSubscriptionPlans()]);
      const planMap = new Map(plans.map((plan) => [plan.id, plan]));

      const tenantsWithDetails: TenantWithDetails[] = await Promise.all(
        tenants.map(async (tenant) => {
          const members = await listTenantMembers(tenant.id);
          const owner = members.find((m) => m.is_owner);

          let ownerProfile = null;
          if (owner?.user_id) {
            const profiles = await listProfilesByIds([owner.user_id]);
            ownerProfile = profiles[0] ?? null;
          }

          const memberCount = members.length;
          const subscription = await getSubscriptionByTenant(tenant.id);
          const plan = subscription ? planMap.get(subscription.plan_id) : null;

          return {
            ...tenant,
            owner_name: ownerProfile?.name,
            member_count: memberCount,
            subscription: subscription ? {
              id: subscription.id,
              status: subscription.status || 'inactive',
              plan_id: subscription.plan_id,
              trial_ends_at: subscription.trial_ends_at,
              current_period_end: subscription.current_period_end,
              plan: plan ? { name: plan.name, price_monthly: Number(plan.price_monthly || 0) } : undefined,
            } : null,
          };
        })
      );

      return tenantsWithDetails;
    },
  });
}

export function usePlatformSubscriptions() {
  return useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const [subscriptions, plans, tenants] = await Promise.all([
        listSubscriptions(),
        listSubscriptionPlans(),
        listTenants(),
      ]);

      const planMap = new Map(plans.map((plan) => [plan.id, plan]));
      const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));

      return subscriptions.map((subscription) => ({
        ...subscription,
        subscription_plans: (() => {
          const plan = planMap.get(subscription.plan_id);
          return plan ? { name: plan.name, price_monthly: Number(plan.price_monthly || 0) } : null;
        })(),
        tenants: (() => {
          const tenant = tenantMap.get(subscription.tenant_id);
          return tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null;
        })(),
      }));
    },
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const [tenants, subscriptions, plans] = await Promise.all([
        listTenants(),
        listSubscriptions(),
        listSubscriptionPlans(),
      ]);
      const totalTenants = tenants.length;
      const activeTenants = tenants.filter((t) => t.is_active).length;
      const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active').length;
      const trialSubscriptions = subscriptions.filter((subscription) => subscription.status === 'trialing').length;
      const planMap = new Map(plans.map((plan) => [plan.id, plan]));
      const mrr = subscriptions
        .filter((subscription) => subscription.status === 'active')
        .reduce((acc, subscription) => acc + Number(planMap.get(subscription.plan_id)?.price_monthly || 0), 0);

      return {
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        activeSubscriptions: activeSubscriptions || 0,
        trialSubscriptions: trialSubscriptions || 0,
        mrr,
      };
    },
  });
}




