import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  linkGroupToProduct,
  listGroupsForProduct,
  listProductComplementGroups,
  replaceGroupsForProduct,
  replaceProductsForGroup,
  unlinkGroupFromProduct,
} from '@/lib/firebaseTenantCrud';

export interface ProductComplementGroup {
  id: string;
  product_id: string;
  group_id: string;
  sort_order: number | null;
  created_at: string | null;
}

export function useProductComplementGroups(groupId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-complement-groups', tenantId, groupId],
    queryFn: async () => {
      if (!tenantId || !groupId) return [];
      return await listProductComplementGroups(tenantId, groupId);
    },
    enabled: !!groupId && !!tenantId,
  });
}

export function useGroupsForProduct(productId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['groups-for-product', tenantId, productId],
    queryFn: async () => {
      if (!tenantId || !productId) return [];
      return await listGroupsForProduct(tenantId, productId);
    },
    enabled: !!productId && !!tenantId,
  });
}

export function useProductComplementGroupsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const linkGroupToProductMutation = useMutation({
    mutationFn: async (link: { product_id: string; group_id: string; sort_order?: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await linkGroupToProduct(tenantId, link);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao vincular grupo', description: error.message, variant: 'destructive' });
    },
  });

  const unlinkGroupFromProductMutation = useMutation({
    mutationFn: async ({ productId, groupId }: { productId: string; groupId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await unlinkGroupFromProduct(tenantId, productId, groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    },
  });

  const setProductGroups = useMutation({
    mutationFn: async ({ groupId, productIds }: { groupId: string; productIds: string[] }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await replaceProductsForGroup(tenantId, groupId, productIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar produtos', description: error.message, variant: 'destructive' });
    },
  });

  const setGroupsForProduct = useMutation({
    mutationFn: async ({ productId, groupIds }: { productId: string; groupIds: string[] }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await replaceGroupsForProduct(tenantId, productId, groupIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar grupos', description: error.message, variant: 'destructive' });
    },
  });

  return {
    linkGroupToProduct: linkGroupToProductMutation,
    unlinkGroupFromProduct: unlinkGroupFromProductMutation,
    setProductGroups,
    setGroupsForProduct,
  };
}
