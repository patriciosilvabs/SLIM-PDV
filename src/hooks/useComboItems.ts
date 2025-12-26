import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
}

export function useComboItems(comboId?: string) {
  return useQuery({
    queryKey: ['combo-items', comboId],
    queryFn: async () => {
      let query = supabase
        .from('combo_items')
        .select('*');
      
      if (comboId) {
        query = query.eq('combo_id', comboId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ComboItem[];
    },
    enabled: !!comboId || comboId === undefined
  });
}

export function useComboItemsMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const addComboItem = useMutation({
    mutationFn: async (item: { 
      combo_id: string; 
      product_id: string; 
      variation_id?: string | null;
      quantity?: number;
    }) => {
      const { data, error } = await supabase
        .from('combo_items')
        .insert({ ...item, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-items'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    }
  });

  const updateComboItem = useMutation({
    mutationFn: async ({ id, ...item }: Partial<ComboItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('combo_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-items'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar item', description: error.message, variant: 'destructive' });
    }
  });

  const removeComboItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('combo_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-items'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover item', description: error.message, variant: 'destructive' });
    }
  });

  const setComboItems = useMutation({
    mutationFn: async ({ comboId, items }: { 
      comboId: string; 
      items: Array<{ product_id: string; variation_id?: string | null; quantity: number }> 
    }) => {
      // Remove existing items
      const { error: deleteError } = await supabase
        .from('combo_items')
        .delete()
        .eq('combo_id', comboId);
      
      if (deleteError) throw deleteError;

      // Insert new items
      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from('combo_items')
          .insert(items.map(item => ({ ...item, combo_id: comboId, tenant_id: tenantId })));
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-items'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar itens', description: error.message, variant: 'destructive' });
    }
  });

  return { addComboItem, updateComboItem, removeComboItem, setComboItems };
}
