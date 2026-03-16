import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import {
  createComplementGroup,
  deleteComplementGroup,
  listComplementGroups,
  updateComplementGroup,
} from '@/lib/firebaseTenantCrud';

export interface FlavorOption {
  count: number;
  label: string;
  description: string;
}

export interface ComplementGroup {
  id: string;
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple' | 'multiple_repeat';
  is_required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
  visibility: string | null;
  channels: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
  price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest' | null;
  applies_per_unit: boolean | null;
  unit_count: number | null;
  flavor_modal_enabled: boolean | null;
  flavor_modal_channels: string[] | null;
  flavor_options: FlavorOption[] | null;
  applicable_flavor_counts: number[] | null;
  kds_category: 'flavor' | 'border' | 'complement';
  created_at: string | null;
  updated_at: string | null;
}

export function useComplementGroups(includeInactive = false) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['complement-groups', tenantId, { includeInactive }],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await listComplementGroups(tenantId, includeInactive);
      return (data ?? []).map((d) => ({
        ...d,
        flavor_options: (d.flavor_options ?? []) as FlavorOption[],
      })) as ComplementGroup[];
    },
    enabled: !!tenantId,
  });
}

export function useComplementGroupsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createGroup = useMutation({
    mutationFn: async (group: Omit<ComplementGroup, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createComplementGroup(tenantId, group);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo de complemento criado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar grupo', description: error.message, variant: 'destructive' });
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...group }: Partial<ComplementGroup> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateComplementGroup(tenantId, id, group);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteComplementGroup(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['product-complements'] });
      toast({ title: 'Grupo excluido com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir grupo', description: error.message, variant: 'destructive' });
    },
  });

  return { createGroup, updateGroup, deleteGroup };
}
