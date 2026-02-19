import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FlavorOption } from './useComplementGroups';

export interface PizzaProductConfig {
  maxFlavors: number;
  flavorModalEnabled: boolean;
  flavorModalChannels: string[];
  flavorOptions: FlavorOption[];
}

/**
 * Returns a Set of product IDs that have complement groups with applies_per_unit = true,
 * plus a map of product_id -> PizzaProductConfig with full flavor modal configuration.
 */
export function usePizzaProducts() {
  return useQuery({
    queryKey: ['pizza-products'],
    queryFn: async () => {
      // Get all complement groups with applies_per_unit = true
      const { data: perUnitGroups, error: groupsError } = await supabase
        .from('complement_groups')
        .select('id, unit_count, flavor_modal_enabled, flavor_modal_channels, flavor_options')
        .eq('is_active', true)
        .eq('applies_per_unit', true);

      if (groupsError) throw groupsError;
      if (!perUnitGroups || perUnitGroups.length === 0) {
        return { pizzaProductIds: new Set<string>(), maxFlavorsMap: new Map<string, number>(), configMap: new Map<string, PizzaProductConfig>() };
      }

      const groupIds = perUnitGroups.map(g => g.id);
      const groupConfigMap = new Map(perUnitGroups.map(g => [g.id, {
        unitCount: g.unit_count ?? 2,
        flavorModalEnabled: g.flavor_modal_enabled ?? true,
        flavorModalChannels: g.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
        flavorOptions: (g.flavor_options ?? []) as unknown as FlavorOption[],
      }]));

      // Get product links for these groups
      const { data: productGroups, error: pgError } = await supabase
        .from('product_complement_groups')
        .select('product_id, group_id, skip_flavor_modal')
        .in('group_id', groupIds);

      if (pgError) throw pgError;

      const pizzaProductIds = new Set<string>();
      const maxFlavorsMap = new Map<string, number>();
      const configMap = new Map<string, PizzaProductConfig>();

      for (const pg of productGroups || []) {
        const groupConfig = groupConfigMap.get(pg.group_id);
        if (!groupConfig) continue;

        // Skip if this specific product has skip_flavor_modal = true
        if (pg.skip_flavor_modal) continue;

        pizzaProductIds.add(pg.product_id);
        
        const unitCount = groupConfig.unitCount;
        const current = maxFlavorsMap.get(pg.product_id) ?? 0;
        if (unitCount > current) {
          maxFlavorsMap.set(pg.product_id, unitCount);
          configMap.set(pg.product_id, {
            maxFlavors: unitCount,
            flavorModalEnabled: groupConfig.flavorModalEnabled,
            flavorModalChannels: groupConfig.flavorModalChannels,
            flavorOptions: groupConfig.flavorOptions,
          });
        }
      }

      return { pizzaProductIds, maxFlavorsMap, configMap };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
