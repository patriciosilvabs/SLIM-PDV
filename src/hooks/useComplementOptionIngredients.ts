import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import {
  createComplementOptionIngredient,
  deleteComplementOptionIngredient,
  listComplementOptionIngredients,
  updateComplementOptionIngredient,
} from '@/lib/firebaseTenantCrud';

export interface ComplementOptionIngredient {
  id: string;
  complement_option_id: string;
  ingredient_id: string;
  quantity: number;
  tenant_id: string;
  created_at: string | null;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
  };
}

export function useComplementOptionIngredients(optionId: string | null | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['complement-option-ingredients', tenantId, optionId],
    queryFn: async () => {
      if (!tenantId || !optionId) return [];
      return (await listComplementOptionIngredients(tenantId, optionId)) as ComplementOptionIngredient[];
    },
    enabled: !!optionId && !!tenantId,
  });
}

export function useComplementOptionIngredientMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const addIngredient = useMutation({
    mutationFn: async (data: {
      complement_option_id: string;
      ingredient_id: string;
      quantity: number;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createComplementOptionIngredient(tenantId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['complement-option-ingredients', tenantId, variables.complement_option_id],
      });
      toast({ title: 'Ingrediente adicionado' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar ingrediente',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async (data: {
      id: string;
      quantity: number;
      complement_option_id: string;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateComplementOptionIngredient(tenantId, data.id, { quantity: data.quantity });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['complement-option-ingredients', tenantId, variables.complement_option_id],
      });
      toast({ title: 'Quantidade atualizada' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (data: { id: string; complement_option_id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteComplementOptionIngredient(tenantId, data.id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['complement-option-ingredients', tenantId, variables.complement_option_id],
      });
      toast({ title: 'Ingrediente removido' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return { addIngredient, updateIngredient, removeIngredient };
}
