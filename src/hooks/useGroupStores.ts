import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from '@/contexts/AuthContext';

export interface GroupStore {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  owner_id: string;
}

/**
 * Hook para buscar todas as lojas do mesmo grupo/owner
 * Todas as lojas com mesmo owner_id formam um "grupo"
 */
export function useGroupStores() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: ['group-stores', tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // 1. Buscar owner_id do tenant atual
      const { data: currentTenant, error: tenantError } = await supabase
        .from('tenants')
        .select('owner_id')
        .eq('id', tenantId)
        .single();
      
      if (tenantError || !currentTenant?.owner_id) {
        console.error('Error fetching current tenant:', tenantError);
        return [];
      }
      
      // 2. Buscar todas lojas do mesmo owner (grupo)
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, is_active, created_at, owner_id')
        .eq('owner_id', currentTenant.owner_id)
        .order('created_at');
      
      if (error) {
        console.error('Error fetching group stores:', error);
        return [];
      }
      
      return (data || []) as GroupStore[];
    },
    enabled: !!tenantId && !!user?.id,
  });
  
  // Lojas além da atual (outras lojas do grupo)
  const otherStores = query.data?.filter(store => store.id !== tenantId) || [];
  
  // Total de lojas no grupo
  const totalStores = query.data?.length || 0;
  
  // Verificar se o usuário atual é owner das lojas
  const isOwnerOfGroup = query.data?.[0]?.owner_id === user?.id;
  
  return {
    ...query,
    stores: query.data || [],
    otherStores,
    totalStores,
    isOwnerOfGroup,
  };
}
