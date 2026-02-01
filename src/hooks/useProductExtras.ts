import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export function useProductExtras() {
  return useQuery({
    queryKey: ['product-extras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_extras')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ProductExtra[];
    }
  });
}

export function useProductExtrasMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const createExtra = useMutation({
    mutationFn: async (extra: { name: string; price: number; description?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('product_extras')
        .insert({ ...extra, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      toast({ title: 'Complemento criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar complemento', description: error.message, variant: 'destructive' });
    }
  });

  const updateExtra = useMutation({
    mutationFn: async ({ id, ...extra }: { id: string; name?: string; price?: number; description?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('product_extras')
        .update(extra)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      toast({ title: 'Complemento atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  });

  const deleteExtra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_extras')
        .delete()
        .eq('id', id);
      
      if (error) {
        if (error.code === '23503') {
          const { error: softDeleteError } = await supabase
            .from('product_extras')
            .update({ is_active: false })
            .eq('id', id);
          
          if (softDeleteError) throw softDeleteError;
          return { softDeleted: true };
        }
        throw error;
      }
      return { softDeleted: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-extras'] });
      if (result?.softDeleted) {
        toast({ title: 'Extra desativado', description: 'Não foi possível excluir pois está vinculado a pedidos.' });
      } else {
        toast({ title: 'Complemento removido' });
      }
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  });

  return { createExtra, updateExtra, deleteExtra };
}
