import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  createProductVariation,
  deleteProductVariation,
  listProductVariations,
  updateProductVariation,
} from '@/lib/firebaseTenantCrud';

export interface ProductVariation {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price_modifier: number | null;
  is_active: boolean | null;
}

export function useProductVariations(productId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-variations', tenantId, productId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listProductVariations(tenantId, productId)) as ProductVariation[];
    },
    enabled: !!tenantId,
  });
}

export function useProductVariationsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createVariation = useMutation({
    mutationFn: async (variation: { product_id: string; name: string; description?: string; price_modifier?: number; is_active?: boolean }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createProductVariation(tenantId, {
        ...variation,
        description: variation.description ?? null,
        price_modifier: variation.price_modifier ?? 0,
        is_active: variation.is_active ?? true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variacao criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar variacao', description: error.message, variant: 'destructive' });
    },
  });

  const updateVariation = useMutation({
    mutationFn: async ({ id, ...variation }: { id: string; name?: string; description?: string; price_modifier?: number; is_active?: boolean }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateProductVariation(tenantId, id, variation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variacao atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteVariation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteProductVariation(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast({ title: 'Variacao excluida com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir variacao', description: error.message, variant: 'destructive' });
    },
  });

  return { createVariation, updateVariation, deleteVariation };
}
