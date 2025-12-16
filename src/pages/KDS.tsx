import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrders, useOrderMutations, Order } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, UtensilsCrossed, Store, Truck, Clock, Play, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function KDS() {
  const { data: orders = [], isLoading, refetch } = useOrders();
  const { updateOrder } = useOrderMutations();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing'>('all');

  // Filter active orders (pending and preparing)
  const activeOrders = orders.filter(
    order => order.status === 'pending' || order.status === 'preparing'
  );

  const filteredOrders = filter === 'all' 
    ? activeOrders 
    : activeOrders.filter(order => order.status === filter);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('kds-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleStartPreparation = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ id: orderId, status: 'preparing' });
      toast.success('Preparo iniciado!');
    } catch (error) {
      toast.error('Erro ao iniciar preparo');
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await updateOrder.mutateAsync({ id: orderId, status: 'ready' });
      toast.success('Pedido marcado como pronto!');
    } catch (error) {
      toast.error('Erro ao marcar pedido como pronto');
    }
  };

  const getOrderOrigin = (order: Order) => {
    if (order.order_type === 'delivery') {
      return { icon: Truck, label: 'DELIVERY', color: 'text-purple-500 bg-purple-500/10' };
    }
    if (order.order_type === 'takeaway') {
      return { icon: Store, label: 'BALCÃO', color: 'text-orange-500 bg-orange-500/10' };
    }
    return { 
      icon: UtensilsCrossed, 
      label: `MESA ${order.table?.number || '?'}`, 
      color: 'text-blue-500 bg-blue-500/10' 
    };
  };

  const getTimeInfo = (createdAt: string | null) => {
    if (!createdAt) return { text: '--', color: 'text-muted-foreground', bgColor: '' };
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    
    if (minutes < 10) return { text: `${minutes} min`, color: 'text-green-500', bgColor: 'bg-green-500/10' };
    if (minutes < 20) return { text: `${minutes} min`, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    return { text: `${minutes} min`, color: 'text-red-500', bgColor: 'bg-red-500/10 animate-pulse' };
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const origin = getOrderOrigin(order);
    const timeInfo = getTimeInfo(order.created_at);
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';
    const OriginIcon = origin.icon;

    return (
      <Card className={cn(
        "transition-all",
        isPending && "border-yellow-500/50 bg-yellow-500/5",
        isPreparing && "border-blue-500/50 bg-blue-500/5"
      )}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={cn("py-1.5 px-3 text-sm font-bold", origin.color)}>
                <OriginIcon className="h-4 w-4 mr-1.5" />
                {origin.label}
              </Badge>
              <span className="text-xl font-bold">#{order.id.slice(-4).toUpperCase()}</span>
            </div>
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full", timeInfo.bgColor)}>
              <Clock className={cn("h-4 w-4", timeInfo.color)} />
              <span className={cn("font-bold", timeInfo.color)}>{timeInfo.text}</span>
            </div>
          </div>

          {/* Customer info */}
          {order.customer_name && (
            <p className="text-sm text-muted-foreground mb-2">
              Cliente: <span className="font-medium text-foreground">{order.customer_name}</span>
            </p>
          )}

          {/* Items */}
          <div className="border rounded-lg p-3 bg-background/50 mb-4">
            <div className="space-y-2">
              {order.order_items?.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="font-bold text-lg text-primary min-w-[2rem]">{item.quantity}x</span>
                  <div className="flex-1">
                    <p className="font-medium">{item.product?.name || 'Produto'}</p>
                    {item.notes && (
                      <p className="text-xs text-yellow-600 mt-1">📝 {item.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order notes */}
          {order.notes && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Obs:</strong> {order.notes}
              </p>
            </div>
          )}

          {/* Status badge and actions */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={cn(
                "text-sm py-1 px-3",
                isPending && "border-yellow-500 text-yellow-500",
                isPreparing && "border-blue-500 text-blue-500"
              )}
            >
              {isPending ? '⏳ PENDENTE' : '🔵 PREPARANDO'}
            </Badge>

            <div className="flex gap-2">
              {isPending && (
                <Button 
                  onClick={() => handleStartPreparation(order.id)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Preparo
                </Button>
              )}
              {isPreparing && (
                <Button 
                  onClick={() => handleMarkReady(order.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Pedido Pronto
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;
  const preparingCount = activeOrders.filter(o => o.status === 'preparing').length;

  return (
    <PDVLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">KDS - Cozinha</h1>
            <p className="text-muted-foreground">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} ativo{activeOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({activeOrders.length})
            </Button>
            <Button 
              variant={filter === 'pending' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('pending')}
              className={filter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              Pendentes ({pendingCount})
            </Button>
            <Button 
              variant={filter === 'preparing' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('preparing')}
              className={filter === 'preparing' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Preparando ({preparingCount})
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Orders Grid */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <UtensilsCrossed className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Nenhum pedido ativo</p>
              <p className="text-sm">Novos pedidos aparecerão aqui automaticamente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-4">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </PDVLayout>
  );
}
