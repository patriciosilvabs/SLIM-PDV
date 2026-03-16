import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import {
  listComplementGroupOptions,
  listGroupsForProduct,
} from '@/lib/firebaseTenantCrud';

export interface GroupWithOptions {
  id: string;
  name: string;
  description: string | null;
  selection_type: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  applies_per_unit: boolean;
  unit_count: number;
  price_calculation_type: string;
  visibility: string;
  channels: string[];
  applicable_flavor_counts: number[] | null;
  kds_category: 'flavor' | 'border' | 'complement';
  options: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    price_override: number | null;
    max_quantity: number;
    image_url: string | null;
  }[];
}

function normalizeSelectionType(selectionType: string | null | undefined) {
  if (selectionType === 'multiple_with_repetition') {
    return 'multiple_repeat';
  }

  if (selectionType === 'single' || selectionType === 'multiple' || selectionType === 'multiple_repeat') {
    return selectionType;
  }

  return 'single';
}

export function useProductComplements(
  productId: string | undefined,
  channel?: 'counter' | 'delivery' | 'table'
) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-complements', tenantId, productId, channel],
    queryFn: async (): Promise<GroupWithOptions[]> => {
      if (!tenantId || !productId) return [];

      const linkedGroups = await listGroupsForProduct(tenantId, productId);
      if (!linkedGroups.length) return [];

      const filteredGroups = linkedGroups
        .map((link) => link.group)
        .filter((group) => {
          if (group.is_active !== true) return false;
          if (!channel || !group.channels) return true;
          return group.channels.includes(channel);
        });

      const result: GroupWithOptions[] = await Promise.all(
        filteredGroups.map(async (group) => {
          const groupOptions = await listComplementGroupOptions(tenantId, group.id);
          const options = groupOptions
            .filter((go) => go.option.is_active === true)
            .map((go) => ({
              id: go.option.id,
              name: go.option.name,
              description: null,
              price: go.option.price,
              price_override: go.price_override,
              max_quantity: go.max_quantity ?? 1,
              image_url: null,
            }));

          return {
            id: group.id,
            name: group.name,
            description: group.description,
            selection_type: normalizeSelectionType(group.selection_type),
            is_required: group.is_required ?? false,
            min_selections: group.min_selections ?? 0,
            max_selections: group.max_selections ?? 1,
            applies_per_unit: group.applies_per_unit ?? false,
            unit_count: group.unit_count ?? 1,
            price_calculation_type: group.price_calculation_type ?? 'sum',
            visibility: group.visibility ?? 'visible',
            channels: group.channels ?? ['delivery', 'counter', 'table'],
            applicable_flavor_counts: group.applicable_flavor_counts ?? null,
            kds_category: group.kds_category ?? 'complement',
            options,
          } as GroupWithOptions;
        })
      );

      const orderMap = new Map(linkedGroups.map((link) => [link.group_id, link.sort_order ?? 0]));
      return result.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    },
    enabled: !!tenantId && !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
