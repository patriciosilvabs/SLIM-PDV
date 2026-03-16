import { useQuery } from '@tanstack/react-query';
import { useTenant } from './useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantById, listTenantsByOwner } from '@/lib/firebaseTenantCrud';

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
      const currentTenant = await getTenantById(tenantId);
      if (!currentTenant?.owner_id) {
        console.error('Error fetching current tenant');
        return [];
      }
      
      // 2. Buscar todas lojas do mesmo owner (grupo)
      const data = await listTenantsByOwner(currentTenant.owner_id);
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



