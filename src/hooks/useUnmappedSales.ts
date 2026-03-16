import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import {
  countUnresolvedUnmappedSales,
  listUnmappedSales,
  resolveAllUnmappedSales,
  resolveUnmappedSale as resolveUnmappedSaleDoc,
} from '@/lib/firebaseTenantCrud';

export interface UnmappedSale {
  id: string;
  tenant_id: string;
  order_id: string;
  order_item_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export function useUnmappedSales(options: { onlyUnresolved?: boolean; limit?: number } = {}) {
  const { tenant } = useTenant();
  const { onlyUnresolved = true, limit = 100 } = options;

  return useQuery({
    queryKey: ['unmapped-sales', tenant?.id, onlyUnresolved, limit],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return (await listUnmappedSales(tenant.id, { onlyUnresolved, limit })) as UnmappedSale[];
    },
    enabled: !!tenant?.id,
  });
}

export function useUnmappedSalesCount() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['unmapped-sales-count', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return 0;
      return await countUnresolvedUnmappedSales(tenant.id);
    },
    enabled: !!tenant?.id,
  });
}

export function useUnmappedSalesMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const resolveUnmappedSale = useMutation({
    mutationFn: async ({ tenantId, saleId }: { tenantId: string; saleId: string }) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');
      return await resolveUnmappedSaleDoc(tenantId, saleId, user.id);
    },
    onSuccess: () => {
      toast({ title: 'Item marcado como resolvido' });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales-count'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao resolver item', description: error.message, variant: 'destructive' });
    },
  });

  const resolveAll = useMutation({
    mutationFn: async (tenantId: string) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');
      await resolveAllUnmappedSales(tenantId, user.id);
    },
    onSuccess: () => {
      toast({ title: 'Todos os itens foram resolvidos' });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped-sales-count'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao resolver itens', description: error.message, variant: 'destructive' });
    },
  });

  return {
    resolveUnmappedSale,
    resolveAll,
  };
}

