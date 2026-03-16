import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import {
  listComplementGroups,
  listProductComplementLinksByGroupIds,
} from '@/lib/firebaseTenantCrud';
import type { FlavorOption } from './useComplementGroups';

export interface PizzaProductConfig {
  maxFlavors: number;
  flavorModalEnabled: boolean;
  flavorModalChannels: string[];
  flavorOptions: FlavorOption[];
}

export function usePizzaProducts() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['pizza-products', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return { pizzaProductIds: new Set<string>(), maxFlavorsMap: new Map<string, number>(), configMap: new Map<string, PizzaProductConfig>() };
      }

      const activeGroups = await listComplementGroups(tenantId, false);
      const perUnitGroups = activeGroups.filter((g) => g.applies_per_unit === true);

      if (!perUnitGroups.length) {
        return { pizzaProductIds: new Set<string>(), maxFlavorsMap: new Map<string, number>(), configMap: new Map<string, PizzaProductConfig>() };
      }

      const groupConfigMap = new Map(
        perUnitGroups.map((g) => [
          g.id,
          {
            unitCount: g.unit_count ?? 2,
            flavorModalEnabled: g.flavor_modal_enabled ?? true,
            flavorModalChannels: g.flavor_modal_channels ?? ['delivery', 'counter', 'table'],
            flavorOptions: (g.flavor_options ?? []) as FlavorOption[],
          },
        ])
      );

      const productGroups = await listProductComplementLinksByGroupIds(
        tenantId,
        perUnitGroups.map((g) => g.id)
      );

      const pizzaProductIds = new Set<string>();
      const maxFlavorsMap = new Map<string, number>();
      const configMap = new Map<string, PizzaProductConfig>();

      const perUnitGroupById = new Map(perUnitGroups.map((g) => [g.id, g]));
      const productGroupsMap = new Map<string, typeof perUnitGroups>();

      for (const pg of productGroups) {
        const group = perUnitGroupById.get(pg.group_id);
        if (!group) continue;
        if (pg.skip_flavor_modal) continue;

        const existing = productGroupsMap.get(pg.product_id) || [];
        existing.push(group);
        productGroupsMap.set(pg.product_id, existing);
      }

      for (const [productId, linkedGroups] of productGroupsMap) {
        if (!linkedGroups.length) continue;
        pizzaProductIds.add(productId);

        const availableCounts = new Set<number>();
        for (const g of linkedGroups) {
          const applicable = g.applicable_flavor_counts;
          if (applicable && applicable.length > 0) applicable.forEach((c) => availableCounts.add(c));
          else availableCounts.add(g.unit_count ?? 1);
        }

        const baseConfig = groupConfigMap.get(linkedGroups[0].id)!;
        const filteredFlavorOptions = baseConfig.flavorOptions.filter((opt) => availableCounts.has(opt.count));
        const maxUnitCount = Math.max(...linkedGroups.map((g) => g.unit_count ?? 1));

        maxFlavorsMap.set(productId, maxUnitCount);

        const channels = new Set<string>();
        for (const g of linkedGroups) {
          const cfg = groupConfigMap.get(g.id);
          cfg?.flavorModalChannels.forEach((c) => channels.add(c));
        }

        configMap.set(productId, {
          maxFlavors: maxUnitCount,
          flavorModalEnabled: baseConfig.flavorModalEnabled,
          flavorModalChannels: Array.from(channels),
          flavorOptions: filteredFlavorOptions,
        });
      }

      return { pizzaProductIds, maxFlavorsMap, configMap };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
