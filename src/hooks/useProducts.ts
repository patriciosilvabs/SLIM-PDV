import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  preparation_time: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  category?: { name: string };
  // New fields
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  is_featured: boolean | null;
  is_promotion: boolean | null;
  promotion_price: number | null;
  label: string | null;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(name)')
        .order('sort_order', { ascending: true })
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar produto', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto excluído!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateSortOrder = useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number }>) => {
      for (const item of items) {
        const { error } = await supabase
          .from('products')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao reordenar', description: error.message, variant: 'destructive' });
    },
  });

  return { createProduct, updateProduct, deleteProduct, updateSortOrder };
}