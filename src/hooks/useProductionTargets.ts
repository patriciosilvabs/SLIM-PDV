import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  copyIngredientDailyTargets,
  deleteIngredientDailyTarget,
  listIngredientDailyTargets,
  listIngredients,
  upsertIngredientDailyTarget,
} from '@/lib/firebaseTenantCrud';

export interface IngredientDailyTarget {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  day_of_week: number;
  target_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface TargetWithIngredient extends IngredientDailyTarget {
  ingredient: {
    id: string;
    name: string;
    unit: string;
    current_stock: number | null;
  };
}

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const;
export const FULL_DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'] as const;

export function useProductionTargets(ingredientId?: string) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['production-targets', tenant?.id, ingredientId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const [targets, ingredients] = await Promise.all([
        listIngredientDailyTargets(tenant.id),
        listIngredients(tenant.id),
      ]);
      const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
      const filtered = ingredientId ? targets.filter((t) => t.ingredient_id === ingredientId) : targets;
      return filtered
        .map((t) => ({
          ...t,
          ingredient: (() => {
            const i = ingredientMap.get(t.ingredient_id);
            if (!i) return { id: t.ingredient_id, name: 'Ingrediente', unit: '', current_stock: null };
            return { id: i.id, name: i.name, unit: i.unit, current_stock: i.current_stock };
          })(),
        }))
        .sort((a, b) => a.day_of_week - b.day_of_week) as TargetWithIngredient[];
    },
    enabled: !!tenant?.id,
  });
}

export function useProductionTargetsGrid() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['production-targets-grid', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return { ingredients: [], targetsMap: {} };
      const [ingredients, targets] = await Promise.all([listIngredients(tenant.id), listIngredientDailyTargets(tenant.id)]);
      const targetsMap: Record<string, Record<number, IngredientDailyTarget>> = {};
      for (const target of targets) {
        if (!targetsMap[target.ingredient_id]) targetsMap[target.ingredient_id] = {};
        targetsMap[target.ingredient_id][target.day_of_week] = target as IngredientDailyTarget;
      }
      return { ingredients: ingredients || [], targetsMap };
    },
    enabled: !!tenant?.id,
  });
}

export function useProductionTargetMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  const upsertTarget = useMutation({
    mutationFn: async ({
      ingredientId,
      dayOfWeek,
      targetQuantity,
    }: {
      ingredientId: string;
      dayOfWeek: number;
      targetQuantity: number;
    }) => {
      if (!tenant?.id) throw new Error('Tenant nao encontrado');
      return await upsertIngredientDailyTarget(tenant.id, {
        ingredient_id: ingredientId,
        day_of_week: dayOfWeek,
        target_quantity: targetQuantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar meta', description: error.message, variant: 'destructive' });
    },
  });

  const copyDayTargets = useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      if (!tenant?.id) throw new Error('Tenant nao encontrado');
      const count = await copyIngredientDailyTargets(tenant.id, fromDay, toDay);
      if (!count) throw new Error('Nenhuma meta encontrada no dia de origem');
      return count;
    },
    onSuccess: (count, { fromDay, toDay }) => {
      toast({
        title: 'Metas copiadas',
        description: `${count} metas copiadas de ${FULL_DAY_NAMES[fromDay]} para ${FULL_DAY_NAMES[toDay]}`,
      });
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao copiar metas', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTarget = useMutation({
    mutationFn: async (targetId: string) => {
      if (!tenant?.id) throw new Error('Tenant nao encontrado');
      await deleteIngredientDailyTarget(tenant.id, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-targets'] });
      queryClient.invalidateQueries({ queryKey: ['production-targets-grid'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover meta', description: error.message, variant: 'destructive' });
    },
  });

  return { upsertTarget, copyDayTargets, deleteTarget };
}

