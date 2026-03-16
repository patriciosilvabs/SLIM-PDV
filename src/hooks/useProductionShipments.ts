import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import {
  confirmProductionShipmentReceipt,
  createProductionShipment,
  createStockMovement,
  getIngredientById,
  listProductionShipments,
  updateIngredient,
} from '@/lib/firebaseTenantCrud';

export interface ProductionShipment {
  id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  ingredient_id: string;
  quantity: number;
  shipped_by: string | null;
  shipped_at: string;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
}

export interface ShipmentWithDetails extends ProductionShipment {
  from_tenant?: { name: string };
  to_tenant?: { name: string };
  ingredient?: { name: string; unit: string };
  shipper?: { name: string };
  receiver?: { name: string };
}

export function useProductionShipments(options: { direction?: 'sent' | 'received' | 'all'; ingredientId?: string; limit?: number } = {}) {
  const { tenant } = useTenant();
  const { direction = 'all', ingredientId, limit = 50 } = options;

  return useQuery({
    queryKey: ['production-shipments', tenant?.id, direction, ingredientId, limit],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return (await listProductionShipments(tenant.id, { direction, ingredientId, max: limit })) as ShipmentWithDetails[];
    },
    enabled: !!tenant?.id,
  });
}

export function useProductionShipmentMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { user } = useAuth();

  const createShipment = useMutation({
    mutationFn: async ({
      toTenantId,
      ingredientId,
      quantity,
      notes,
    }: {
      toTenantId: string;
      ingredientId: string;
      quantity: number;
      notes?: string;
    }) => {
      if (!tenant?.id) throw new Error('Tenant nao encontrado');
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const shipment = await createProductionShipment(tenant.id, {
        from_tenant_id: tenant.id,
        to_tenant_id: toTenantId,
        ingredient_id: ingredientId,
        quantity,
        shipped_by: user.id,
        notes: notes ?? null,
      });

      const ingredient = await getIngredientById(toTenantId, ingredientId);
      if (!ingredient) return shipment;

      const previousStock = ingredient.current_stock || 0;
      const newStock = previousStock + quantity;

      await createStockMovement(toTenantId, {
        ingredient_id: ingredientId,
        movement_type: 'entry',
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        notes: `Recebimento de producao - Envio #${shipment.id}`,
      });

      await updateIngredient(toTenantId, ingredientId, {
        current_stock: newStock,
        updated_at: new Date().toISOString(),
      });

      return shipment;
    },
    onSuccess: () => {
      toast({ title: 'Envio registrado', description: 'Producao enviada e estoque atualizado' });
      queryClient.invalidateQueries({ queryKey: ['production-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-production-demand'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar envio', description: error.message, variant: 'destructive' });
    },
  });

  const confirmReceipt = useMutation({
    mutationFn: async (shipmentId: string) => {
      if (!tenant?.id) throw new Error('Tenant nao encontrado');
      if (!user?.id) throw new Error('Usuario nao autenticado');
      return await confirmProductionShipmentReceipt(tenant.id, shipmentId, user.id);
    },
    onSuccess: () => {
      toast({ title: 'Recebimento confirmado' });
      queryClient.invalidateQueries({ queryKey: ['production-shipments'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao confirmar recebimento', description: error.message, variant: 'destructive' });
    },
  });

  return { createShipment, confirmReceipt };
}

