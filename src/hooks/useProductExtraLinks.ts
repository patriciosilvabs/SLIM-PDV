import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  linkProductExtra,
  listExtrasForProduct,
  listProductExtraLinks,
  replaceProductsForExtra,
  unlinkProductExtra,
} from '@/lib/firebaseTenantCrud';

export interface ProductExtraLink {
  id: string;
  product_id: string;
  extra_id: string;
  created_at: string | null;
}

export function useProductExtraLinks(extraId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-extra-links', tenantId, extraId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listProductExtraLinks(tenantId, extraId)) as ProductExtraLink[];
    },
    enabled: !!tenantId,
  });
}

export function useExtrasForProduct(productId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['extras-for-product', tenantId, productId],
    queryFn: async () => {
      if (!tenantId || !productId) return [];
      return await listExtrasForProduct(tenantId, productId);
    },
    enabled: !!tenantId && !!productId,
  });
}

export function useProductExtraLinksMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const linkExtra = useMutation({
    mutationFn: async ({ productId, extraId }: { productId: string; extraId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await linkProductExtra(tenantId, productId, extraId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' });
    },
  });

  const unlinkExtra = useMutation({
    mutationFn: async ({ productId, extraId }: { productId: string; extraId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await unlinkProductExtra(tenantId, productId, extraId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    },
  });

  const setLinkedProducts = useMutation({
    mutationFn: async ({ extraId, productIds }: { extraId: string; productIds: string[] }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await replaceProductsForExtra(tenantId, extraId, productIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extra-links'] });
      queryClient.invalidateQueries({ queryKey: ['extras-for-product'] });
      toast({ title: 'Vinculos atualizados' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar vinculos', description: error.message, variant: 'destructive' });
    },
  });

  return { linkExtra, unlinkExtra, setLinkedProducts };
}
