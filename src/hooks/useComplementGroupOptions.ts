import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  addComplementOptionToGroup,
  listComplementGroupOptions,
  removeComplementOptionFromGroup,
  replaceComplementGroupOptions,
  updateComplementGroupOption,
} from '@/lib/firebaseTenantCrud';

export interface ComplementGroupOption {
  id: string;
  group_id: string;
  option_id: string;
  price_override: number | null;
  max_quantity: number | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface OptionWithConfig {
  option_id: string;
  max_quantity?: number;
  price_override?: number | null;
  sort_order?: number;
}

export interface GroupOptionWithDetails extends ComplementGroupOption {
  option: {
    id: string;
    name: string;
    price: number;
    is_active: boolean | null;
  };
}

export function useComplementGroupOptions(groupId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['complement-group-options', tenantId, groupId],
    queryFn: async () => {
      if (!tenantId || !groupId) return [];
      const data = await listComplementGroupOptions(tenantId, groupId);
      return data as GroupOptionWithDetails[];
    },
    enabled: !!groupId && !!tenantId,
  });
}

export function useComplementGroupOptionsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const addOptionToGroup = useMutation({
    mutationFn: async (link: { group_id: string; option_id: string; price_override?: number; sort_order?: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await addComplementOptionToGroup(tenantId, link);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar opcao', description: error.message, variant: 'destructive' });
    },
  });

  const removeOptionFromGroup = useMutation({
    mutationFn: async ({ groupId, optionId }: { groupId: string; optionId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await removeComplementOptionFromGroup(tenantId, groupId, optionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover opcao', description: error.message, variant: 'destructive' });
    },
  });

  const updateGroupOption = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; price_override?: number | null; sort_order?: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateComplementGroupOption(tenantId, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const setGroupOptions = useMutation({
    mutationFn: async ({ groupId, options }: { groupId: string; options: OptionWithConfig[] }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await replaceComplementGroupOptions(tenantId, groupId, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar opcoes', description: error.message, variant: 'destructive' });
    },
  });

  return { addOptionToGroup, removeOptionFromGroup, updateGroupOption, setGroupOptions };
}
