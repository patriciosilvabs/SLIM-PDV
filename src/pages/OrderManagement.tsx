import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog';
import { KdsReadOnlyOrderCard } from '@/components/kds/KdsReadOnlyOrderCard';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Package, ChefHat, CheckCircle2, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type KanbanColumn = 'pending' | 'preparing' | 'ready' | 'delivered';

interface KanbanColumnConfig {
  id: KanbanColumn;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const columns: KanbanColumnConfig[] = [
  { 
    id: 'pending', 
    title: 'NOVO', 
    icon: <Package className="h-5 w-5" />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30'
  },
  { 
    id: 'preparing', 
    title: 'EM PRODUÇÃO', 
    icon: <ChefHat className="h-5 w-5" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30'
  },
  { 
    id: 'ready', 
    title: 'PRONTO', 
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 border-green-500/30'
  },
  { 
    id: 'delivered', 
    title: 'ENTREGUE', 
    icon: <PackageCheck className="h-5 w-5" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-muted-foreground/30'
  },
];

export default function OrderManagement() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const queryClient = useQueryClient();
  const previousOrdersRef = useRef<Order[]>([]);

  // Cancel order state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const canCancelOrder = hasPermission('orders_cancel');

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

  // Group orders by status
  const getOrdersByStatus = (status: KanbanColumn) => {
    return filteredOrders.filter(order => order.status === status);
  };

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((column) => {
            const columnOrders = getOrdersByStatus(column.id);
            
            return (
              <Card key={column.id} className={cn("border-2", column.bgColor)}>
                <CardHeader className="pb-3">
                  <CardTitle className={cn("flex items-center gap-2 text-lg", column.color)}>
                    {column.icon}
                    {column.title}
                    <Badge variant="secondary" className="ml-auto">
                      {columnOrders.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    {columnOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum pedido</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {columnOrders.map((order) => (
                          <KdsReadOnlyOrderCard
                            key={order.id}
                            order={order}
                            onMarkDelivered={handleMarkDelivered}
                            onCancel={handleOpenCancelDialog}
                            canCancel={canCancelOrder}
                            isDelivering={isDelivering}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
