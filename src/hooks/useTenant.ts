import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TenantMembership {
  tenant_id: string;
  is_owner: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function useTenant() {
  const { user } = useAuth();

  const { data: membership, isLoading, error } = useQuery({
    queryKey: ['tenant-membership', user?.id],
    queryFn: async (): Promise<TenantMembership | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('tenant_members')
        .select(`
          tenant_id,
          is_owner,
          tenant:tenants(id, name, slug)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;

      return {
        tenant_id: data.tenant_id,
        is_owner: data.is_owner ?? false,
        tenant: data.tenant as TenantMembership['tenant'],
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    tenantId: membership?.tenant_id ?? null,
    tenant: membership?.tenant ?? null,
    isOwner: membership?.is_owner ?? false,
    isLoading,
    error,
    hasTenant: !!membership?.tenant_id,
  };
}
