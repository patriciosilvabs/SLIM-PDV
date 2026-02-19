import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a Set of product IDs that have complement groups with applies_per_unit = true,
 * plus a map of product_id -> max unit_count from those groups.
 */
export function usePizzaProducts() {
  return useQuery({
    queryKey: ['pizza-products'],
    queryFn: async () => {
      // Get all complement groups with applies_per_unit = true
      const { data: perUnitGroups, error: groupsError } = await supabase
        .from('complement_groups')
        .select('id, unit_count')
        .eq('is_active', true)
        .eq('applies_per_unit', true);

      if (groupsError) throw groupsError;
      if (!perUnitGroups || perUnitGroups.length === 0) {
        return { pizzaProductIds: new Set<string>(), maxFlavorsMap: new Map<string, number>() };
      }

      const groupIds = perUnitGroups.map(g => g.id);
      const groupUnitCountMap = new Map(perUnitGroups.map(g => [g.id, g.unit_count ?? 2]));

      // Get product links for these groups
      const { data: productGroups, error: pgError } = await supabase
        .from('product_complement_groups')
        .select('product_id, group_id')
        .in('group_id', groupIds);

      if (pgError) throw pgError;

      const pizzaProductIds = new Set<string>();
      const maxFlavorsMap = new Map<string, number>();

      for (const pg of productGroups || []) {
        pizzaProductIds.add(pg.product_id);
        const unitCount = groupUnitCountMap.get(pg.group_id) ?? 2;
        const current = maxFlavorsMap.get(pg.product_id) ?? 0;
        if (unitCount > current) {
          maxFlavorsMap.set(pg.product_id, unitCount);
        }
      }

      return { pizzaProductIds, maxFlavorsMap };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
