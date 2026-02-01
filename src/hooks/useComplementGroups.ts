import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

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
  created_at: string | null;
  updated_at: string | null;
}

export function useComplementGroups(includeInactive = false) {
  return useQuery({
    queryKey: ['complement-groups', { includeInactive }],
    queryFn: async () => {
      let query = supabase
        .from('complement_groups')
        .select('*')
        .order('sort_order')
        .order('name');
      
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ComplementGroup[];
    }
  });
}

export function useComplementGroupsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createGroup = useMutation({
    mutationFn: async (group: Omit<ComplementGroup, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('complement_groups')
        .insert({ ...group, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      toast({ title: 'Grupo de complemento criado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar grupo', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, ...group }: Partial<ComplementGroup> & { id: string }) => {
      const { data, error } = await supabase
        .from('complement_groups')
        .update(group)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      toast({ title: 'Grupo atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      console.log('[deleteGroup] Starting soft delete for id:', id);
      // Usar soft delete direto para evitar problemas de FK e RLS
      const { error, data } = await supabase
        .from('complement_groups')
        .update({ is_active: false })
        .eq('id', id)
        .select();
      
      console.log('[deleteGroup] Result:', { error, data });
      if (error) throw error;
      return { softDeleted: true };
    },
    onSuccess: () => {
      console.log('[deleteGroup] Success - invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      toast({ title: 'Grupo desativado com sucesso!' });
    },
    onError: (error) => {
      console.error('[deleteGroup] Error:', error);
      toast({ title: 'Erro ao desativar grupo', description: error.message, variant: 'destructive' });
    }
  });

  return { createGroup, updateGroup, deleteGroup };
}
