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
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Store, Truck, Clock, Package, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Format time display in hours after 60 minutes
const formatTimeDisplay = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes} min`;
};

type KanbanColumn = 'pending' | 'preparing' | 'ready';

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
    icon: <Clock className="h-5 w-5" />,
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
];

export default function OrderManagement() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const queryClient = useQueryClient();
  const previousOrdersRef = useRef<Order[]>([]);
  const handledStatusChangesRef = useRef<Set<string>>(new Set());

  // Cancel order state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
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
          // Check if this change was made externally (e.g., by KDS)
          const changeKey = `${order.id}-${order.status}`;
          if (!handledStatusChangesRef.current.has(changeKey)) {
            if (order.status === 'ready' && prevOrder.status === 'preparing') {
              toast.success(`✅ Pedido #${order.id.slice(-4).toUpperCase()} pronto na cozinha!`, { duration: 5000 });
            } else if (order.status === 'preparing' && prevOrder.status === 'pending') {
              toast.info(`🍳 Pedido #${order.id.slice(-4).toUpperCase()} em preparo`);
            }
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

  const handleStatusChange = async (orderId: string, newStatus: KanbanColumn) => {
    try {
      handledStatusChangesRef.current.add(`${orderId}-${newStatus}`);
      await updateOrder.mutateAsync({ id: orderId, status: newStatus });
      toast.success(`Pedido movido para ${columns.find(c => c.id === newStatus)?.title}`);
    } catch (error) {
      toast.error('Erro ao atualizar status do pedido');
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

  const getTimeInfo = (createdAt: string | null) => {
    if (!createdAt) return { text: '--', color: 'text-muted-foreground' };
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    const timeText = formatTimeDisplay(minutes);
    
    if (minutes < 10) return { text: timeText, color: 'text-green-500' };
    if (minutes < 20) return { text: timeText, color: 'text-yellow-500' };
    return { text: timeText, color: 'text-red-500' };
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const isDelivery = order.order_type === 'delivery';
    const timeInfo = getTimeInfo(order.created_at);
    
    return (
      <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">#{order.id.slice(-4).toUpperCase()}</span>
              {isDelivery ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                  <Truck className="h-3 w-3 mr-1" />
                  Delivery
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                  <Store className="h-3 w-3 mr-1" />
                  Balcão
                </Badge>
              )}
            </div>
            <span className={cn("text-sm font-medium flex items-center gap-1", timeInfo.color)}>
              <Clock className="h-3 w-3" />
              {timeInfo.text}
            </span>
          </div>
          
          {order.customer_name && (
            <p className="text-sm font-medium mb-2">{order.customer_name}</p>
          )}
          
          <div className="border-t border-border pt-2 mt-2">
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {order.order_items?.slice(0, 4).map((item: any, idx) => (
                <div key={idx} className="text-xs">
                  <p className="text-muted-foreground font-medium">
                    {item.quantity}x {item.product?.name || 'Produto'}
                    {item.variation?.name && ` (${item.variation.name})`}
                  </p>
                  {/* Sabores/Complementos */}
                  {item.extras && item.extras.length > 0 && (
                    <p className="text-muted-foreground/70 pl-2">
                      {item.extras.map((e: any) => 
                        e.extra_name.split(': ').slice(1).join(': ')
                      ).join(', ')}
                    </p>
                  )}
                  {/* Observações */}
                  {item.notes && (
                    <p className="text-amber-600/80 pl-2 italic">📝 {item.notes}</p>
                  )}
                </div>
              ))}
              {order.order_items && order.order_items.length > 4 && (
                <p className="text-xs text-muted-foreground">
                  +{order.order_items.length - 4} itens...
                </p>
              )}
            </div>
          </div>
          
          <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
            <span className="font-bold text-primary">
              R$ {(order.total || 0).toFixed(2)}
            </span>
            {canCancelOrder && order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrderToCancel(order);
                  setCancelDialogOpen(true);
                }}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PDVLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Pedidos</h1>
            <p className="text-muted-foreground">Pedidos de Balcão e Delivery</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      columnOrders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                      ))
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
