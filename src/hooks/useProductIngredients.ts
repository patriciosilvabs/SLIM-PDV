import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  addProductIngredient,
  listProductIngredients,
  listProducts,
  removeProductIngredient,
  updateProductIngredient,
} from '@/lib/firebaseTenantCrud';

export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
    cost_per_unit: number;
  };
}

export interface ProductWithIngredients {
  id: string;
  name: string;
  price: number;
  ingredients: ProductIngredient[];
  productionCost: number;
}

export function useProductIngredients(productId?: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-ingredients', tenantId, productId],
    queryFn: async () => {
      if (!tenantId || !productId) return [];
      return (await listProductIngredients(tenantId, productId)) as ProductIngredient[];
    },
    enabled: !!tenantId && !!productId,
  });
}

export function useAllProductsWithIngredients() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['products-with-ingredients', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const products = await listProducts(tenantId, true);
      const ingredients = await listProductIngredients(tenantId);

      const productsWithIngredients: ProductWithIngredients[] = products.map((product) => {
        const productIngredients = ingredients.filter((i) => i.product_id === product.id) || [];
        const productionCost = productIngredients.reduce((sum, pi) => {
          const costPerUnit = pi.ingredient?.cost_per_unit || 0;
          return sum + costPerUnit * pi.quantity;
        }, 0);

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          ingredients: productIngredients as ProductIngredient[],
          productionCost,
        };
      });

      return productsWithIngredients;
    },
    enabled: !!tenantId,
  });
}

export function useProductIngredientMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const addIngredient = useMutation({
    mutationFn: async ({ product_id, ingredient_id, quantity }: { product_id: string; ingredient_id: string; quantity: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await addProductIngredient(tenantId, { product_id, ingredient_id, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Ingrediente adicionado a ficha tecnica!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar ingrediente', description: error.message, variant: 'destructive' });
    },
  });

  const updateIngredientMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await updateProductIngredient(tenantId, id, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Quantidade atualizada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await removeProductIngredient(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products-with-ingredients'] });
      toast({ title: 'Ingrediente removido da ficha tecnica!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  return { addIngredient, updateIngredient: updateIngredientMutation, removeIngredient };
}

