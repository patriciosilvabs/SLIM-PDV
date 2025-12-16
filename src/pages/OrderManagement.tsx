import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Store, Truck, Clock, Package, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const queryClient = useQueryClient();
  const previousOrdersRef = useRef<Order[]>([]);
  const handledStatusChangesRef = useRef<Set<string>>(new Set());

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

  const getTimeColor = (createdAt: string | null) => {
    if (!createdAt) return 'text-muted-foreground';
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 10) return 'text-green-500';
    if (minutes < 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const isDelivery = order.order_type === 'delivery';
    
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
            <span className={cn("text-sm font-medium flex items-center gap-1", getTimeColor(order.created_at))}>
              <Clock className="h-3 w-3" />
              {order.created_at && formatDistanceToNow(new Date(order.created_at), { locale: ptBR, addSuffix: false })}
            </span>
          </div>
          
          {order.customer_name && (
            <p className="text-sm font-medium mb-2">{order.customer_name}</p>
          )}
          
          <div className="border-t border-border pt-2 mt-2">
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {order.order_items?.slice(0, 3).map((item, idx) => (
                <p key={idx} className="text-xs text-muted-foreground">
                  {item.quantity}x {item.product?.name || 'Produto'}
                </p>
              ))}
              {order.order_items && order.order_items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{order.order_items.length - 3} itens...
                </p>
              )}
            </div>
          </div>
          
          <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
            <span className="font-bold text-primary">
              R$ {(order.total || 0).toFixed(2)}
            </span>
            <div className="flex gap-1">
              {order.status === 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleStatusChange(order.id, 'preparing')}
                >
                  Iniciar
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleStatusChange(order.id, 'ready')}
                >
                  Pronto
                </Button>
              )}
              {order.status === 'ready' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={async () => {
                    await updateOrder.mutateAsync({ id: order.id, status: 'delivered' });
                    toast.success('Pedido entregue!');
                  }}
                >
                  Entregar
                </Button>
              )}
            </div>
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
    </PDVLayout>
  );
}
