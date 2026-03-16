import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import { createCategory as createCategoryFs, listCategories, updateCategory as updateCategoryFs } from '@/lib/firebaseTenantCrud';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useCategories() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listCategories(tenantId)) as Category[];
    },
    enabled: !!tenantId,
  });
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createCategory = useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'created_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return createCategoryFs(tenantId, category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar categoria', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...category }: Partial<Category> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return updateCategoryFs(tenantId, id, category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar categoria', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateCategoryFs(tenantId, id, { is_active: false });
      return { softDeleted: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria desativada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao desativar categoria', description: error.message, variant: 'destructive' });
    },
  });

  const updateSortOrder = useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number }>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      for (const item of items) {
        await updateCategoryFs(tenantId, item.id, { sort_order: item.sort_order });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao reordenar', description: error.message, variant: 'destructive' });
    },
  });

  return { createCategory, updateCategory, deleteCategory, updateSortOrder };
}
