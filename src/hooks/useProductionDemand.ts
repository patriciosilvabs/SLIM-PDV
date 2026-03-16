import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { listIngredientDailyTargets, listIngredients, listTenants } from '@/lib/firebaseTenantCrud';

export interface ProductionDemandItem {
  tenant_id: string;
  store_name: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  day_of_week: number;
  ideal_stock: number;
  current_stock: number;
  to_produce: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface UseProductionDemandOptions {
  tenantId?: string;
  date?: Date;
  enableRealtime?: boolean;
}

export function useProductionDemand(options: UseProductionDemandOptions = {}) {
  const { tenant } = useTenant();
  const { tenantId, date, enableRealtime = true } = options;

  const effectiveTenantId = tenantId || tenant?.id;
  const dayOfWeek = date ? date.getDay() : new Date().getDay();

  return useQuery({
    queryKey: ['production-demand', effectiveTenantId, dayOfWeek],
    queryFn: async () => {
      if (!effectiveTenantId) return [];

      const [targets, ingredients] = await Promise.all([
        listIngredientDailyTargets(effectiveTenantId, dayOfWeek),
        listIngredients(effectiveTenantId),
      ]);

      const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
      return targets
        .map((target) => {
          const ingredient = ingredientMap.get(target.ingredient_id);
          if (!ingredient) return null;
          const currentStock = Number(ingredient.current_stock || 0);
          const idealStock = Number(target.target_quantity || 0);
          const toProduce = Math.max(idealStock - currentStock, 0);
          const status: ProductionDemandItem['status'] =
            toProduce <= 0 ? 'ok' : currentStock <= 0 ? 'critical' : 'warning';
          return {
            tenant_id: effectiveTenantId,
            store_name: tenant?.name || 'Loja',
            ingredient_id: target.ingredient_id,
            ingredient_name: ingredient.name,
            unit: ingredient.unit,
            day_of_week: target.day_of_week,
            ideal_stock: idealStock,
            current_stock: currentStock,
            to_produce: toProduce,
            status,
          };
        })
        .filter(Boolean) as ProductionDemandItem[];
    },
    enabled: !!effectiveTenantId,
    refetchInterval: enableRealtime ? 30000 : false,
  });
}

export function useConsolidatedProductionDemand(options: { enableRealtime?: boolean } = {}) {
  const { enableRealtime = true } = options;

  return useQuery({
    queryKey: ['consolidated-production-demand'],
    queryFn: async () => {
      const tenants = await listTenants();
      const demandByTenant = await Promise.all(
        tenants.map(async (tenant) => {
          const [ingredients, targets] = await Promise.all([
            listIngredients(tenant.id),
            Promise.all([0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => listIngredientDailyTargets(tenant.id, dayOfWeek))),
          ]);

          const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

          return targets.flat().map((target) => {
            const ingredient = ingredientMap.get(target.ingredient_id);
            if (!ingredient) return null;

            const currentStock = Number(ingredient.current_stock || 0);
            const idealStock = Number(target.target_quantity || 0);
            const toProduce = Math.max(idealStock - currentStock, 0);
            const status: ProductionDemandItem['status'] =
              toProduce <= 0 ? 'ok' : currentStock <= 0 ? 'critical' : 'warning';

            return {
              tenant_id: tenant.id,
              store_name: tenant.name || 'Loja',
              ingredient_id: target.ingredient_id,
              ingredient_name: ingredient.name,
              unit: ingredient.unit,
              day_of_week: target.day_of_week,
              ideal_stock: idealStock,
              current_stock: currentStock,
              to_produce: toProduce,
              status,
            } satisfies ProductionDemandItem;
          });
        })
      );

      return demandByTenant.flat().filter(Boolean) as ProductionDemandItem[];
    },
    refetchInterval: enableRealtime ? 30000 : false,
  });
}

export function useProductionDemandSummary() {
  const { data: demand, ...rest } = useConsolidatedProductionDemand();

  const summary = {
    totalItems: demand?.length || 0,
    criticalCount: demand?.filter((d) => d.status === 'critical').length || 0,
    warningCount: demand?.filter((d) => d.status === 'warning').length || 0,
    okCount: demand?.filter((d) => d.status === 'ok').length || 0,
    totalToProduceByIngredient: {} as Record<string, { name: string; unit: string; total: number }>,
    byStore: {} as Record<string, ProductionDemandItem[]>,
  };

  if (demand) {
    for (const item of demand) {
      if (!summary.byStore[item.store_name]) summary.byStore[item.store_name] = [];
      summary.byStore[item.store_name].push(item);

      if (!summary.totalToProduceByIngredient[item.ingredient_id]) {
        summary.totalToProduceByIngredient[item.ingredient_id] = {
          name: item.ingredient_name,
          unit: item.unit,
          total: 0,
        };
      }
      summary.totalToProduceByIngredient[item.ingredient_id].total += item.to_produce;
    }
  }

  return { summary, ...rest };
}
