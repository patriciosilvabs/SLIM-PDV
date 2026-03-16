import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from './useTenant';
import {
  createProduct as createProductDoc,
  deleteProduct as deleteProductDoc,
  listProducts,
  updateProduct as updateProductDoc,
} from '@/lib/firebaseTenantCrud';

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
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  is_featured: boolean | null;
  is_promotion: boolean | null;
  promotion_price: number | null;
  label: string | null;
  print_sector_id: string | null;
  print_sector?: { id: string; name: string; printer_name: string | null; icon: string; color: string } | null;
}

export function useProducts(includeInactive = false) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['products', tenantId, { includeInactive }],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      return (await listProducts(tenantId, includeInactive)) as Product[];
    },
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createProduct = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');

      return await createProductDoc(tenantId, {
        category_id: product.category_id ?? null,
        name: product.name,
        description: product.description ?? null,
        price: Number(product.price || 0),
        image_url: product.image_url ?? null,
        is_available: product.is_available ?? true,
        preparation_time: Number(product.preparation_time || 0),
        sort_order: product.sort_order ?? null,
        cost_price: product.cost_price ?? null,
        internal_code: product.internal_code ?? null,
        pdv_code: product.pdv_code ?? null,
        is_featured: product.is_featured ?? false,
        is_promotion: product.is_promotion ?? false,
        promotion_price: product.promotion_price ?? null,
        label: product.label ?? null,
        print_sector_id: product.print_sector_id ?? null,
      });
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
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateProductDoc(tenantId, id, product as any);
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
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteProductDoc(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto excluido com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateSortOrder = useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number }>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      for (const item of items) {
        await updateProductDoc(tenantId, item.id, { sort_order: item.sort_order });
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

