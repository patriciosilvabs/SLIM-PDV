import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  createProductExtra,
  deleteProductExtra,
  listProductExtras,
  updateProductExtra,
} from '@/lib/firebaseTenantCrud';

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export function useProductExtras() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-extras', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listProductExtras(tenantId)) as ProductExtra[];
    },
    enabled: !!tenantId,
  });
}

export function useProductExtrasMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createExtra = useMutation({
    mutationFn: async (extra: { name: string; price: number; description?: string; is_active?: boolean }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createProductExtra(tenantId, {
        ...extra,
        description: extra.description ?? null,
        is_active: extra.is_active ?? true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      toast({ title: 'Complemento criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar complemento', description: error.message, variant: 'destructive' });
    },
  });

  const updateExtra = useMutation({
    mutationFn: async ({ id, ...extra }: { id: string; name?: string; price?: number; description?: string; is_active?: boolean }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateProductExtra(tenantId, id, extra);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      toast({ title: 'Complemento atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteExtra = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteProductExtra(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      toast({ title: 'Complemento excluido com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir complemento', description: error.message, variant: 'destructive' });
    },
  });

  return { createExtra, updateExtra, deleteExtra };
}
