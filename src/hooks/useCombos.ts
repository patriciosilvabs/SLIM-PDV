import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  combo_price: number;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useCombos() {
  return useQuery({
    queryKey: ['combos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combos')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Combo[];
    }
  });
}

export function useComboMutations() {
  const queryClient = useQueryClient();

  const createCombo = useMutation({
    mutationFn: async (combo: { 
      name: string; 
      description?: string; 
      image_url?: string;
      original_price: number;
      combo_price: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('combos')
        .insert(combo)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar combo', description: error.message, variant: 'destructive' });
    }
  });

  const updateCombo = useMutation({
    mutationFn: async ({ id, ...combo }: Partial<Combo> & { id: string }) => {
      const { data, error } = await supabase
        .from('combos')
        .update(combo)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCombo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('combos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo removido' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });

  return { createCombo, updateCombo, deleteCombo };
}
