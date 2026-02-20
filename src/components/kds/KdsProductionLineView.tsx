import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useKdsWorkflow } from '@/hooks/useKdsWorkflow';
import { KdsStationCard } from './KdsStationCard';
import { KdsOrderStatusCard } from './KdsOrderStatusCard';
import { cn } from '@/lib/utils';
import { Factory, Circle, CheckCircle, Clock, Hourglass } from 'lucide-react';
import type { Order as UseOrdersOrder } from '@/hooks/useOrders';

// Extend the order item type with optional station fields
interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  current_station_id?: string | null;
  station_status?: string;
  station_started_at?: string | null;
  created_at: string;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number }>;
  served_at?: string | null;
}

interface Order {
  id: string;
  status: string;
  customer_name: string | null;
  table?: { number: number } | null;
  order_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  order_items?: OrderItem[];
}

interface KdsProductionLineViewProps {
  orders: UseOrdersOrder[];
  isLoading: boolean;
  overrideTenantId?: string | null;
}

export function KdsProductionLineView({ orders, isLoading, overrideTenantId }: KdsProductionLineViewProps) {
  const { activeStations, productionStations, orderStatusStation, isLoading: stationsLoading } = useKdsStations();
  const { settings } = useKdsSettings(overrideTenantId);
  const { 
    moveItemToNextStation,
    skipItemToNextStation,
    finalizeOrderFromStatus,
    serveItem
  } = useKdsWorkflow();

  // Cast orders to local type for internal use
  const typedOrders = orders as unknown as Order[];

  // Filtrar pedidos - mostra pedidos que têm itens com praça atribuída (pending, preparing, ready)
  const filteredOrders = useMemo(() => {
    // Excluir pedidos em rascunho primeiro
    const nonDraftOrders = typedOrders.filter(o => (o as any).is_draft !== true);

    if (!settings.assignedStationId) {
      // Se não tiver praça atribuída, mostra pedidos que têm itens nas praças (pending, preparing, ready)
      return nonDraftOrders.filter(o => {
        // Sempre inclui se está em preparing ou ready
        if (o.status === 'preparing' || o.status === 'ready') return true;
        // Para pending, só inclui se algum item já tem current_station_id
        if (o.status === 'pending') {
          return o.order_items?.some(item => item.current_station_id !== null);
        }
        return false;
      });
    }

    // Filtrar pedidos que têm itens nesta praça
    return nonDraftOrders.filter(order => {
      return order.order_items?.some(
        item => item.current_station_id === settings.assignedStationId
      );
    });
  }, [typedOrders, settings.assignedStationId]);

  // Pedidos no buffer (aguardando - sem current_station_id ou com status pendente sem praça)
  const bufferOrders = useMemo(() => {
    const nonDraftOrders = typedOrders.filter(o => (o as any).is_draft !== true);
    return nonDraftOrders.filter(order => {
      if (order.status === 'pending') {
        // Pedido pending que não tem nenhum item com station
        const hasStationItems = order.order_items?.some(item => item.current_station_id !== null);
        return !hasStationItems && (order.order_items?.length ?? 0) > 0;
      }
      return false;
    });
  }, [typedOrders]);

  // Agrupar itens por praça
  const itemsByStation = useMemo(() => {
    const map = new Map<string, { order: Order; items: OrderItem[] }[]>();
    
    activeStations.forEach(station => {
      map.set(station.id, []);
    });

    filteredOrders.forEach(order => {
      order.order_items?.forEach(item => {
        if (item.current_station_id && map.has(item.current_station_id)) {
          const stationItems = map.get(item.current_station_id)!;
          const existingEntry = stationItems.find(e => e.order.id === order.id);
          
          if (existingEntry) {
            existingEntry.items.push(item);
          } else {
            stationItems.push({ order, items: [item] });
          }
        }
      });
    });

    return map;
  }, [filteredOrders, activeStations]);

  // Praça atual baseada na configuração do dispositivo
  const currentStation = settings.assignedStationId 
    ? activeStations.find(s => s.id === settings.assignedStationId)
    : null;

  const handleMoveToNext = (itemId: string, stationId: string) => {
    moveItemToNextStation.mutate({ itemId, currentStationId: stationId });
  };

  const handleSkipItem = (itemId: string, stationId: string) => {
    skipItemToNextStation.mutate({ itemId, currentStationId: stationId });
  };

  const handleFinalizeOrder = (orderId: string) => {
    finalizeOrderFromStatus.mutate(orderId);
  };

  const handleServeItem = (itemId: string) => {
    serveItem.mutate(itemId);
  };

  // Pedidos prontos na estação de status (ou com todos itens em order_status)
  const readyOrdersInStatus = useMemo(() => {
    if (!orderStatusStation) return [];
    
    return filteredOrders
      .filter(order => {
        // Pedido já está ready
        if (order.status === 'ready') return true;
        
        // OU todos os itens estão na estação order_status (pedido deveria ser ready)
        const allItemsInOrderStatus = order.order_items?.every(
          item => item.current_station_id === orderStatusStation.id || item.station_status === 'done'
        );
        return allItemsInOrderStatus && (order.order_items?.length ?? 0) > 0;
      })
      .map(order => {
        const itemsInStation = order.order_items?.filter(
          item => item.current_station_id === orderStatusStation.id
        ) || [];
        
        // Se não houver itens na estação (já foram done), mostrar todos os itens
        if (itemsInStation.length === 0) {
          return { order, items: order.order_items || [] };
        }
        
        return { order, items: itemsInStation };
      })
      .filter(entry => entry.items.length > 0);
  }, [filteredOrders, orderStatusStation]);

  if (stationsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (activeStations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Factory className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">Nenhuma praça configurada</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Configure praças de produção em Configurações → Praças
        </p>
      </div>
    );
  }

  // Se tiver praça atribuída, mostra apenas ela
  if (currentStation) {
    const stationOrders = itemsByStation.get(currentStation.id) || [];
    const stationIndex = activeStations.findIndex(s => s.id === currentStation.id);
    const isFirstStation = stationIndex === 0;
    const isLastStation = stationIndex === activeStations.length - 1;

    return (
      <div className="h-full flex flex-col">
        {/* Header da praça */}
        <div 
          className="flex items-center gap-3 p-4 mb-4 rounded-lg"
          style={{ backgroundColor: currentStation.color + '15' }}
        >
          <div 
            className="h-10 w-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: currentStation.color + '30' }}
          >
            <Circle className="h-5 w-5" style={{ color: currentStation.color, fill: currentStation.color }} />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: currentStation.color }}>
              {currentStation.name}
            </h2>
            <p className="text-sm text-muted-foreground">{currentStation.description}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {stationOrders.reduce((acc, o) => acc + o.items.length, 0)} itens
          </Badge>
        </div>

        {/* Itens nesta praça */}
        <ScrollArea className="flex-1">
          {stationOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Circle className="h-8 w-8 mb-2" style={{ color: currentStation.color }} />
              <p>Nenhum item nesta praça</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stationOrders.map(({ order, items }) => (
                <KdsStationCard
                  key={`${order.id}-${currentStation.id}`}
                  order={order}
                  items={items}
                  stationColor={currentStation.color}
                  stationName={currentStation.name}
                  stationType={currentStation.station_type}
                  isFirstStation={isFirstStation}
                  isLastStation={isLastStation}
                  onMoveToNext={(itemId) => handleMoveToNext(itemId, currentStation.id)}
                  onSkipItem={(itemId) => handleSkipItem(itemId, currentStation.id)}
                  isProcessing={moveItemToNextStation.isPending}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Visão geral de todas as praças (quando não tem praça atribuída)
  return (
    <div className="space-y-6">
      {/* Buffer de Espera */}
      {bufferOrders.length > 0 && (
        <div className="p-4 rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Hourglass className="h-5 w-5 text-amber-600 animate-pulse" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Buffer de Espera
            </span>
            <Badge variant="secondary" className="ml-auto">
              {bufferOrders.length} pedido{bufferOrders.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bufferOrders.map((order) => (
              <div key={order.id} className="p-3 bg-background rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{order.id.slice(-4).toUpperCase()}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {order.order_type === 'delivery' ? 'DELIVERY' : 
                     order.order_type === 'takeaway' ? 'BALCÃO' : 
                     `MESA ${order.table?.number || '?'}`}
                  </Badge>
                </div>
                {order.customer_name && (
                  <p className="text-sm font-medium truncate">{order.customer_name}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {order.order_items?.length || 0} itens aguardando
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Colunas por praça de produção */}
      <div className={cn(
        "grid gap-6",
        orderStatusStation 
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" 
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {productionStations.map((station, idx) => {
          const stationOrders = itemsByStation.get(station.id) || [];
          const totalItems = stationOrders.reduce((acc, o) => acc + o.items.length, 0);
          const isFirstStation = idx === 0;
          const isLastStation = idx === productionStations.length - 1;

          return (
            <div key={station.id}>
              <div 
                className="flex items-center gap-2 mb-3 p-2 rounded-lg"
                style={{ backgroundColor: station.color + '15' }}
              >
                <div 
                  className="h-6 w-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: station.color + '30' }}
                >
                  <Circle className="h-3 w-3" style={{ color: station.color, fill: station.color }} />
                </div>
                <span className="font-semibold text-sm">{station.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {totalItems}
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-320px)]">
                {stationOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum item
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stationOrders.map(({ order, items }) => (
                      <KdsStationCard
                        key={`${order.id}-${station.id}`}
                        order={order}
                        items={items}
                        stationColor={station.color}
                        stationName={station.name}
                        stationType={station.station_type}
                        isFirstStation={isFirstStation}
                        isLastStation={isLastStation}
                        onMoveToNext={(itemId) => handleMoveToNext(itemId, station.id)}
                        onSkipItem={(itemId) => handleSkipItem(itemId, station.id)}
                        isProcessing={moveItemToNextStation.isPending}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        })}

        {/* Coluna de Status do Pedido */}
        {orderStatusStation && (
          <div>
            <div 
              className="flex items-center gap-2 mb-3 p-2 rounded-lg"
              style={{ backgroundColor: orderStatusStation.color + '15' }}
            >
              <div 
                className="h-6 w-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: orderStatusStation.color + '30' }}
              >
                <CheckCircle className="h-3 w-3" style={{ color: orderStatusStation.color }} />
              </div>
              <span className="font-semibold text-sm">{orderStatusStation.name}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {readyOrdersInStatus.length}
              </Badge>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              {readyOrdersInStatus.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Nenhum pedido pronto
                </div>
              ) : (
                <div className="space-y-3">
                  {readyOrdersInStatus.map(({ order, items }) => (
                    <KdsOrderStatusCard
                      key={order.id}
                      order={order}
                      items={items}
                      stationColor={orderStatusStation.color}
                      onFinalize={handleFinalizeOrder}
                      onServeItem={handleServeItem}
                      isProcessing={finalizeOrderFromStatus.isPending || serveItem.isPending}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
