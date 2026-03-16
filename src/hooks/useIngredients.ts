import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import { createIngredient, createStockMovement, getIngredientById, listIngredients, updateIngredient } from '@/lib/firebaseTenantCrud';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  created_at: string;
  updated_at: string;
}

export function useIngredients() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['ingredients', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listIngredients(tenantId)) as Ingredient[];
    },
    enabled: !!tenantId,
  });
}

export function useLowStockIngredients() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['ingredients', tenantId, 'low-stock'],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = (await listIngredients(tenantId)) as Ingredient[];
      return data.filter((i) => i.current_stock <= i.min_stock);
    },
    enabled: !!tenantId,
  });
}

export function useIngredientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createIngredientMutation = useMutation({
    mutationFn: async (ingredient: Omit<Ingredient, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createIngredient(tenantId, ingredient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Ingrediente criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngredientMutation = useMutation({
    mutationFn: async ({ id, ...ingredient }: Partial<Ingredient> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateIngredient(tenantId, id, ingredient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Ingrediente atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const addStockMovement = useMutation({
    mutationFn: async ({
      ingredient_id,
      movement_type,
      quantity,
      notes,
    }: {
      ingredient_id: string;
      movement_type: 'entry' | 'exit' | 'adjustment';
      quantity: number;
      notes?: string;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');

      const ingredient = await getIngredientById(tenantId, ingredient_id);
      if (!ingredient) throw new Error('Ingrediente nao encontrado');

      const previousStock = Number(ingredient.current_stock);
      let newStock = previousStock;

      if (movement_type === 'entry') newStock = previousStock + quantity;
      else if (movement_type === 'exit') newStock = previousStock - quantity;
      else newStock = quantity;

      const { data: userData } = await backendClient.auth.getUser();
      await createStockMovement(tenantId, {
        ingredient_id,
        movement_type,
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        notes: notes || null,
        created_by: userData.user?.id || null,
      } as never);
      await updateIngredient(tenantId, ingredient_id, { current_stock: newStock });

      return { previousStock, newStock };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      toast({ title: 'Estoque atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar estoque', description: error.message, variant: 'destructive' });
    },
  });

  return { createIngredient: createIngredientMutation, updateIngredient: updateIngredientMutation, addStockMovement };
}

