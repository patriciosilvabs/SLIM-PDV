import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Button } from '@/components/ui/button';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { KdsProductionLineReadOnly } from '@/components/kds/KdsProductionLineReadOnly';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function OrderManagement() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const queryClient = useQueryClient();
  const previousOrdersRef = useRef<Order[]>([]);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);

  // Filter only takeaway and delivery orders (not dine_in)
  const filteredOrders = orders.filter(
    order => order.order_type === 'takeaway' || order.order_type === 'delivery'
  );

  // Detect status changes from KDS (kitchen)
  useEffect(() => {
    if (previousOrdersRef.current.length > 0) {
      orders.forEach(order => {
        const prevOrder = previousOrdersRef.current.find(o => o.id === order.id);
        if (prevOrder && prevOrder.status !== order.status) {
          if (order.status === 'ready' && prevOrder.status === 'preparing') {
            toast.success(`✅ Pedido #${order.id.slice(-4).toUpperCase()} pronto na cozinha!`, { duration: 5000 });
          } else if (order.status === 'preparing' && prevOrder.status === 'pending') {
            toast.info(`🍳 Pedido #${order.id.slice(-4).toUpperCase()} em preparo`);
          }
        }
      });
    }
    previousOrdersRef.current = [...orders];
  }, [orders]);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('order-management-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('orders_view')) {
    return <AccessDenied permission="orders_view" />;
  }

  // Handle marking order as delivered (only for takeaway orders)
  const handleMarkDelivered = async (orderId: string) => {
    try {
      setIsDelivering(true);
      await updateOrder.mutateAsync({ id: orderId, status: 'delivered', delivered_at: new Date().toISOString() });
      toast.success('Pedido marcado como entregue!');
    } catch (error) {
      toast.error('Erro ao atualizar status do pedido');
    } finally {
      setIsDelivering(false);
    }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!selectedOrderToCancel) return;
    
    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
          status_before_cancellation: selectedOrderToCancel.status,
        })
        .eq('id', selectedOrderToCancel.id);
      
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido cancelado', { description: `Motivo: ${reason}` });
      setCancelDialogOpen(false);
      setSelectedOrderToCancel(null);
    } catch (error) {
      toast.error('Erro ao cancelar pedido');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenCancelDialog = (order: Order) => {
    setSelectedOrderToCancel(order);
    setCancelDialogOpen(true);
  };

  return (
    <PDVLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Pedidos</h1>
            <p className="text-muted-foreground">Pedidos de Balcão e Delivery (visualização)</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <KdsProductionLineReadOnly
          orders={filteredOrders}
          isLoading={isLoading}
          onMarkDelivered={handleMarkDelivered}
          onCancelOrder={handleOpenCancelDialog}
          isMarkingDelivered={isDelivering}
        />
      </div>

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelOrder}
        orderInfo={selectedOrderToCancel ? 
          `Pedido #${selectedOrderToCancel.id.slice(-4).toUpperCase()} - ${
            selectedOrderToCancel.order_type === 'delivery' ? 'Delivery' : 'Balcão'
          }${selectedOrderToCancel.customer_name ? ` - ${selectedOrderToCancel.customer_name}` : ''}` 
          : undefined
        }
        isLoading={isCancelling}
      />
    </PDVLayout>
  );
}
