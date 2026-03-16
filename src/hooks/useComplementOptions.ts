import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import {
  createComplementOption,
  deleteComplementOption,
  listComplementOptions,
  updateComplementOption,
} from '@/lib/firebaseTenantCrud';

export interface ComplementOption {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  auto_calculate_cost: boolean | null;
  enable_stock_control: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useComplementOptions(includeInactive = false) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['complement-options', tenantId, { includeInactive }],
    queryFn: async () => {
      if (!tenantId) return [];
      const data = await listComplementOptions(tenantId, includeInactive);
      return data as ComplementOption[];
    },
    enabled: !!tenantId,
  });
}

export function useComplementOptionsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createOption = useMutation({
    mutationFn: async (option: Omit<ComplementOption, 'id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createComplementOption(tenantId, option);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opcao criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar opcao', description: error.message, variant: 'destructive' });
    },
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, ...option }: Partial<ComplementOption> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateComplementOption(tenantId, id, option);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opcao atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteComplementOption(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Opcao excluida com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir opcao', description: error.message, variant: 'destructive' });
    },
  });

  return { createOption, updateOption, deleteOption };
}
