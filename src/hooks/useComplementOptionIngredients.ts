import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';

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
    queryKey: ['complement-option-ingredients', optionId],
    queryFn: async () => {
      if (!optionId) return [];
      
      const { data, error } = await supabase
        .from('complement_option_ingredients')
        .select(`
          *,
          ingredient:ingredients(id, name, unit)
        `)
        .eq('complement_option_id', optionId)
        .order('created_at');
      
      if (error) throw error;
      return data as ComplementOptionIngredient[];
    },
    enabled: !!optionId && !!tenantId
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
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: result, error } = await supabase
        .from('complement_option_ingredients')
        .insert({
          complement_option_id: data.complement_option_id,
          ingredient_id: data.ingredient_id,
          quantity: data.quantity,
          tenant_id: tenantId
        })
        .select(`
          *,
          ingredient:ingredients(id, name, unit)
        `)
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['complement-option-ingredients', variables.complement_option_id] 
      });
      toast({ title: 'Ingrediente adicionado' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao adicionar ingrediente', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const updateIngredient = useMutation({
    mutationFn: async (data: { 
      id: string; 
      quantity: number;
      complement_option_id: string;
    }) => {
      const { data: result, error } = await supabase
        .from('complement_option_ingredients')
        .update({ quantity: data.quantity })
        .eq('id', data.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['complement-option-ingredients', variables.complement_option_id] 
      });
      toast({ title: 'Quantidade atualizada' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao atualizar', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const removeIngredient = useMutation({
    mutationFn: async (data: { id: string; complement_option_id: string }) => {
      const { error } = await supabase
        .from('complement_option_ingredients')
        .delete()
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['complement-option-ingredients', variables.complement_option_id] 
      });
      toast({ title: 'Ingrediente removido' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao remover', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  return { addIngredient, updateIngredient, removeIngredient };
}
