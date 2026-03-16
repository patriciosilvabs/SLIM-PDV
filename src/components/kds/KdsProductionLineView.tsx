import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKdsStations, type KdsStation } from '@/hooks/useKdsStations';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { useKdsWorkflow } from '@/hooks/useKdsWorkflow';
import { KdsStationCard } from './KdsStationCard';
import { KdsOrderStatusCard } from './KdsOrderStatusCard';
import { KdsStationHistory } from './KdsStationHistory';
import { cn } from '@/lib/utils';
import { Factory, Circle, CheckCircle, Clock, Hourglass, History } from 'lucide-react';
import type { Order as UseOrdersOrder } from '@/hooks/useOrders';

// Extend the order item type with optional station fields
interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  current_device_id?: string | null;
  current_station_id?: string | null;
  station_status?: string;
  station_started_at?: string | null;
  created_at: string;
  product?: { name: string } | null;
  variation?: { name: string } | null;
  extras?: Array<{ extra_name: string; price: number }>;
  served_at?: string | null;
  cancelled_at?: string | null;
  next_device_name?: string | null;
  next_device_station_type?: string | null;
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

interface OverrideSettings {
  assignedStationId?: string | null;
  highlightSpecialBorders?: boolean;
  borderKeywords?: string[];
  showPartySize?: boolean;
  showWaiterName?: boolean;
  compactMode?: boolean;
  timerGreenMinutes?: number;
  timerYellowMinutes?: number;
}

interface KdsProductionLineViewProps {
  orders: UseOrdersOrder[];
  isLoading: boolean;
  overrideTenantId?: string | null;
  overrideStations?: any[];
  deviceStageName?: string | null;
  singleDeviceId?: string | null;
  forceSingleStationView?: boolean;
  overrideSettings?: OverrideSettings;
  overrideWorkflow?: {
    startItemAtStation: { mutate: (params: { itemId: string; stationId: string }) => void; isPending: boolean };
    moveItemToNextStation: { mutate: (params: { itemId: string; currentStationId: string }) => void; isPending: boolean };
    skipItemToNextStation: { mutate: (params: { itemId: string; currentStationId: string }) => void };
    finalizeOrderFromStatus: { mutate: (params: { orderId: string; orderType?: string; currentStationId?: string }) => void; isPending: boolean };
    serveItem: { mutate: (itemId: string) => void; isPending: boolean };
  };
}

export function KdsProductionLineView({
  orders,
  isLoading,
  overrideTenantId,
  overrideStations,
  deviceStageName,
  singleDeviceId,
  forceSingleStationView = false,
  overrideSettings,
  overrideWorkflow,
}: KdsProductionLineViewProps) {
  const { activeStations: hookActiveStations, productionStations: hookProductionStations, orderStatusStation: hookOrderStatusStation, isLoading: stationsLoading } = useKdsStations();
  const { settings: hookSettings } = useKdsSettings(overrideTenantId);
  const hookWorkflow = useKdsWorkflow();

  // Use overrideSettings when provided (device-only mode bypasses RLS)
  const settings = useMemo(() => {
    if (!overrideSettings) return hookSettings;
    return { ...hookSettings, ...overrideSettings };
  }, [hookSettings, overrideSettings]);

  const sortStationsByOrder = (stations: any[]) =>
    [...stations].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));

  // Use override stations if provided (device-only mode), otherwise use hook data
  const hasOverrideStations = overrideStations && overrideStations.length > 0;
  const activeStations = hasOverrideStations
    ? sortStationsByOrder(overrideStations.filter((s: any) => s.is_active))
    : sortStationsByOrder(hookActiveStations);
  const productionStations = hasOverrideStations
    ? sortStationsByOrder(overrideStations.filter((s: any) => s.is_active && s.station_type !== 'order_status'))
    : sortStationsByOrder(hookProductionStations);
  // All order_status stations (for general view multi-column dispatch)
  const allOrderStatusStations = hasOverrideStations
    ? sortStationsByOrder(overrideStations.filter((s: any) => s.is_active && s.station_type === 'order_status'))
    : sortStationsByOrder(activeStations.filter(s => s.station_type === 'order_status'));
  const orderStatusStation = allOrderStatusStations[0] || null;

  // Use override workflow if provided (device-only mode)
  const workflow = overrideWorkflow || {
    startItemAtStation: hookWorkflow.startItemAtStation,
    moveItemToNextStation: hookWorkflow.moveItemToNextStation,
    skipItemToNextStation: hookWorkflow.skipItemToNextStation,
    finalizeOrderFromStatus: hookWorkflow.finalizeOrderFromStatus,
    serveItem: hookWorkflow.serveItem,
  };

  // Cast orders to local type for internal use
  const typedOrders = orders as unknown as Order[];
  const nonDraftOrders = useMemo(
    () => typedOrders.filter((order) => (order as any).is_draft !== true),
    [typedOrders]
  );
  const scopedOrders = useMemo(() => {
    if (!forceSingleStationView || !singleDeviceId) {
      return nonDraftOrders;
    }

    return nonDraftOrders
      .map((order) => ({
        ...order,
        order_items: (order.order_items || []).filter((item) => item.current_device_id === singleDeviceId),
      }))
      .filter((order) => (order.order_items?.length ?? 0) > 0);
  }, [forceSingleStationView, nonDraftOrders, singleDeviceId]);

  // Filtrar pedidos - mostra pedidos que tÃªm itens com praÃ§a atribuÃ­da (pending, preparing, ready)
  const filteredOrders = useMemo(() => {
    const ordersToFilter = scopedOrders;
    if (!settings.assignedStationId) {
      return ordersToFilter.filter(o => {
        if (o.status === 'preparing' || o.status === 'ready') return true;
        if (o.status === 'pending') {
          return o.order_items?.some(item => item.current_station_id !== null);
        }
        return false;
      });
    }
    return ordersToFilter.filter(order => {
      return order.order_items?.some(
        item => item.current_station_id === settings.assignedStationId
      );
    });
  }, [scopedOrders, settings.assignedStationId]);

  // Pedidos no buffer (aguardando - sem current_station_id ou com status pendente sem praÃ§a)
  const bufferOrders = useMemo(() => {
    if (forceSingleStationView) {
      return [];
    }
    return nonDraftOrders.filter(order => {
      if (order.status === 'pending') {
        const hasStationItems = order.order_items?.some(item => item.current_station_id !== null);
        return !hasStationItems && (order.order_items?.length ?? 0) > 0;
      }
      return false;
    });
  }, [forceSingleStationView, nonDraftOrders]);

  // Explodir itens individualmente por praÃ§a (cada item = 1 card separado)
  const itemsByStation = useMemo(() => {
    const map = new Map<string, { order: Order; items: OrderItem[]; totalOrderItems: number }[]>();
    
    activeStations.forEach(station => {
      map.set(station.id, []);
    });

    filteredOrders.forEach(order => {
      // Conta total de itens ativos do pedido nesta praÃ§a (para exibir "Item X de Y")
      const allActiveItems = order.order_items?.filter(i => i.status !== 'cancelled' && !i.cancelled_at) || [];
      
      order.order_items?.forEach(item => {
        if (item.current_station_id && map.has(item.current_station_id)) {
          const stationItems = map.get(item.current_station_id)!;
          // Cada item gera um card separado (para distribuiÃ§Ã£o entre bancadas)
          stationItems.push({ order, items: [item], totalOrderItems: allActiveItems.length });
        }
      });
    });

    return map;
  }, [filteredOrders, activeStations]);

  // PraÃ§a atual baseada na configuraÃ§Ã£o do dispositivo
  // Busca primeiro em activeStations, depois em overrideStations como fallback
  const currentStationId = settings.assignedStationId || (
    forceSingleStationView && singleDeviceId
      ? scopedOrders
          .flatMap((order) => order.order_items || [])
          .find((item) => item.current_device_id === singleDeviceId && item.current_station_id)?.current_station_id || null
      : null
  );
  const currentStation = currentStationId
    ? (activeStations.find(s => s.id === currentStationId)
       || overrideStations?.find((s: any) => s.id === currentStationId)
       || null)
    : null;

  const handleMoveToNext = (itemId: string, stationId: string, orderType?: string) => {
    workflow.moveItemToNextStation.mutate({ itemId, currentStationId: stationId, orderType });
  };

  const handleStartItem = (itemId: string, stationId: string) => {
    workflow.startItemAtStation.mutate({ itemId, stationId });
  };

  const handleSkipItem = (itemId: string, stationId: string) => {
    workflow.skipItemToNextStation.mutate({ itemId, currentStationId: stationId });
  };

  const handleFinalizeOrder = (orderId: string, orderType?: string) => {
    // Determine which order_status station the order is currently at
    const order = filteredOrders.find(o => o.id === orderId);
    const currentStationId = order?.order_items?.find(
      item => item.current_station_id && orderStatusStationIds.includes(item.current_station_id)
    )?.current_station_id || orderStatusStation?.id;
    
    workflow.finalizeOrderFromStatus.mutate({ orderId, orderType, currentStationId });
  };

  // IDs de todas as estaÃ§Ãµes order_status
  const orderStatusStationIds = useMemo(() => {
    const allOrderStatusStations = activeStations.filter(s => s.station_type === 'order_status');
    return allOrderStatusStations.map(s => s.id);
  }, [activeStations]);

  const handleServeItem = (itemId: string) => {
    workflow.serveItem.mutate(itemId);
  };

  const getNextStation = (stationId: string) => {
    const currentStation = activeStations.find((station) => station.id === stationId);
    if (!currentStation) return null;
    return (
      activeStations
        .filter((station) => (station.sort_order ?? 0) > (currentStation.sort_order ?? 0))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ?? null
    );
  };

  const resolveCardFlow = (
    item: OrderItem | undefined,
    fallbackNextStation: KdsStation | null
  ) => {
    const itemNextName = item?.next_device_name ?? null;
    const itemNextType = item?.next_device_station_type ?? null;
    const hasDeviceScopedFlow = !!item?.current_device_id;

    if (hasDeviceScopedFlow) {
      return {
        isLastStation: !itemNextName && !itemNextType,
        nextStationName: itemNextName,
        nextStationType: itemNextType,
      };
    }

    return {
      isLastStation: !fallbackNextStation,
      nextStationName: itemNextName || fallbackNextStation?.name || null,
      nextStationType: itemNextType || fallbackNextStation?.station_type || null,
    };
  };

  // Pedidos no despacho - per station map for general view (all order_status stations)
  const readyOrdersByStation = useMemo(() => {
    const result = new Map<string, { order: Order; items: OrderItem[] }[]>();
    
    for (const station of allOrderStatusStations) {
      const stationOrders = filteredOrders
        .filter(order => {
          const items = order.order_items || [];
          const activeItems = items.filter(i => i.status !== 'cancelled' && !i.cancelled_at);
          if (activeItems.length === 0) return false;
          return activeItems.some(item => item.current_station_id === station.id);
        })
        .map(order => {
          const activeItems = (order.order_items || []).filter(i => i.status !== 'cancelled' && !i.cancelled_at);
          return { order, items: activeItems };
        })
        .filter(entry => entry.items.length > 0);
      
      result.set(station.id, stationOrders);
    }
    
    return result;
  }, [filteredOrders, allOrderStatusStations]);

  // For assigned station view (single station)
  const readyOrdersInStatus = useMemo(() => {
    const targetStationId = (currentStation?.station_type === 'order_status')
      ? currentStation.id
      : orderStatusStation?.id;
    
    if (!targetStationId) return [];
    return readyOrdersByStation.get(targetStationId) || [];
  }, [readyOrdersByStation, currentStation, orderStatusStation]);

  if ((hasOverrideStations ? false : stationsLoading) || isLoading) {
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
        <h3 className="font-semibold text-lg">Nenhum dispositivo de fluxo configurado</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Configure os dispositivos do fluxo em Configuracoes / Dispositivos
        </p>
      </div>
    );
  }

  if (forceSingleStationView && !currentStation) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border bg-muted/30">
          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
            <Circle className="h-5 w-5 text-primary fill-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">{deviceStageName || 'Dispositivo KDS'}</h2>
            <p className="text-sm text-muted-foreground">Esta tela mostra somente a fila deste dispositivo.</p>
          </div>
          <Badge variant="outline" className="ml-auto">0 itens</Badge>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
          <Circle className="h-8 w-8 mb-2 text-primary" />
          <p>Nenhum item nesta etapa</p>
        </div>
      </div>
    );
  }

  // Se tiver praÃ§a atribuÃ­da, mostra apenas ela
  if (currentStation) {
    const stationOrders = itemsByStation.get(currentStation.id) || [];
    // Recalculate from filtered orders if not in map (station from overrideStations)
    const effectiveStationOrders = stationOrders.length > 0 ? stationOrders : (() => {
      const result: { order: Order; items: OrderItem[]; totalOrderItems: number }[] = [];
      filteredOrders.forEach(order => {
        const allActiveItems = order.order_items?.filter(i => i.status !== 'cancelled' && !i.cancelled_at) || [];
        const stationItems = order.order_items?.filter(item => item.current_station_id === currentStation.id) || [];
        // Explodir: cada item vira um card separado
        stationItems.forEach(item => {
          result.push({ order, items: [item], totalOrderItems: allActiveItems.length });
        });
      });
      return result;
    })();
    const stationIndex = activeStations.findIndex(s => s.id === currentStation.id);
    const isFirstStation = stationIndex <= 0;
    const nextStation = getNextStation(currentStation.id);
    const displayStageName = deviceStageName || currentStation.name;

    const isOrderStatusStation = currentStation.station_type === 'order_status';

    return (
      <div className="h-full flex flex-col">
        {/* Header da praÃ§a */}
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
              {displayStageName}
            </h2>
            <p className="text-sm text-muted-foreground">{currentStation.description}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            {effectiveStationOrders.reduce((acc, o) => acc + o.items.length, 0)} itens
          </Badge>
        </div>

        {isOrderStatusStation ? (
          <Tabs defaultValue="ativos" className="flex-1 flex flex-col">
            <TabsList className="w-fit mb-3">
              <TabsTrigger value="ativos" className="gap-1.5">
                <Circle className="h-3.5 w-3.5" />
                Ativos
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                HistÃ³rico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ativos" className="flex-1 mt-0">
              <ScrollArea className="flex-1">
                {readyOrdersInStatus.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Circle className="h-8 w-8 mb-2" style={{ color: currentStation.color }} />
                    <p>Nenhum pedido no despacho</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {readyOrdersInStatus.map(({ order, items }) => (
                      <KdsOrderStatusCard
                        key={order.id}
                        order={order}
                        items={items}
                        stationColor={currentStation.color}
                        orderStatusStationId={currentStation.id}
                        onFinalize={handleFinalizeOrder}
                        onServeItem={handleServeItem}
                        isProcessing={workflow.finalizeOrderFromStatus.isPending || workflow.serveItem.isPending}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="historico" className="flex-1 mt-0">
              <KdsStationHistory
                stationId={currentStation.id}
                stationColor={currentStation.color}
                tenantId={overrideTenantId}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="flex-1">
            {effectiveStationOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Circle className="h-8 w-8 mb-2" style={{ color: currentStation.color }} />
                <p>Nenhum item nesta etapa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveStationOrders.map(({ order, items, totalOrderItems }) => (
                  (() => {
                    const cardFlow = resolveCardFlow(items[0], nextStation);
                    return (
                  <KdsStationCard
                    key={`${items[0]?.id}-${currentStation.id}`}
                    order={order}
                    items={items}
                    stationColor={currentStation.color}
                    stationName={displayStageName}
                    stationType={currentStation.station_type}
                    isFirstStation={isFirstStation}
                    isLastStation={cardFlow.isLastStation}
                    nextStationName={cardFlow.nextStationName}
                    nextStationType={cardFlow.nextStationType}
                    onStartItem={(itemId) => handleStartItem(itemId, currentStation.id)}
                    onMoveToNext={(itemId, orderType) => handleMoveToNext(itemId, currentStation.id, orderType)}
                    onSkipItem={(itemId) => handleSkipItem(itemId, currentStation.id)}
                    isProcessing={workflow.startItemAtStation.isPending || workflow.moveItemToNextStation.isPending}
                    overrideSettings={overrideSettings}
                    totalOrderItems={totalOrderItems}
                  />
                    );
                  })()
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    );
  }

  // VisÃ£o geral de todas as praÃ§as (quando nÃ£o tem praÃ§a atribuÃ­da)
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
                     order.order_type === 'takeaway' ? 'BALCÃƒO' : 
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

      {/* Colunas por praÃ§a de produÃ§Ã£o */}
      <div className={cn(
        "grid gap-6",
        allOrderStatusStations.length > 0
          ? `grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(productionStations.length + allOrderStatusStations.length, 6)}`
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}
      style={{ gridTemplateColumns: `repeat(${Math.min(productionStations.length + allOrderStatusStations.length, 6)}, minmax(0, 1fr))` }}
      >
        {productionStations.map((station, idx) => {
          const stationOrders = itemsByStation.get(station.id) || [];
          const totalItems = stationOrders.reduce((acc, o) => acc + o.items.length, 0);
          const isFirstStation = idx === 0;
          const nextStation = getNextStation(station.id);

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
                    {stationOrders.map(({ order, items, totalOrderItems }) => (
                      (() => {
                        const cardFlow = resolveCardFlow(items[0], nextStation);
                        return (
                      <KdsStationCard
                        key={`${items[0]?.id}-${station.id}`}
                        order={order}
                        items={items}
                        stationColor={station.color}
                        stationName={station.name}
                        stationType={station.station_type}
                        isFirstStation={isFirstStation}
                        isLastStation={cardFlow.isLastStation}
                        nextStationName={cardFlow.nextStationName}
                        nextStationType={cardFlow.nextStationType}
                        onStartItem={(itemId) => handleStartItem(itemId, station.id)}
                        onMoveToNext={(itemId, orderType) => handleMoveToNext(itemId, station.id, orderType)}
                        onSkipItem={(itemId) => handleSkipItem(itemId, station.id)}
                        isProcessing={workflow.startItemAtStation.isPending || workflow.moveItemToNextStation.isPending}
                        overrideSettings={overrideSettings}
                        totalOrderItems={totalOrderItems}
                      />
                        );
                      })()
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        })}

        {/* Colunas de Despacho (todas as estaÃ§Ãµes order_status) */}
        {allOrderStatusStations.map((dispatchStation) => {
          const stationOrders = readyOrdersByStation.get(dispatchStation.id) || [];
          return (
            <div key={dispatchStation.id}>
              <div 
                className="flex items-center gap-2 mb-3 p-2 rounded-lg"
                style={{ backgroundColor: dispatchStation.color + '15' }}
              >
                <div 
                  className="h-6 w-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: dispatchStation.color + '30' }}
                >
                  <CheckCircle className="h-3 w-3" style={{ color: dispatchStation.color }} />
                </div>
                <span className="font-semibold text-sm">{dispatchStation.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {stationOrders.length}
                </Badge>
              </div>

              <Tabs defaultValue="ativos" className="flex flex-col">
                <TabsList className="w-fit mb-3">
                  <TabsTrigger value="ativos" className="gap-1.5 text-xs">
                    <Circle className="h-3 w-3" />
                    Ativos
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="gap-1.5 text-xs">
                    <History className="h-3 w-3" />
                    HistÃ³rico
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="ativos" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    {stationOrders.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        Nenhum pedido pronto
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stationOrders.map(({ order, items }) => (
                          <KdsOrderStatusCard
                            key={order.id}
                            order={order}
                            items={items}
                            stationColor={dispatchStation.color}
                            orderStatusStationId={dispatchStation.id}
                            onFinalize={handleFinalizeOrder}
                            onServeItem={handleServeItem}
                            isProcessing={workflow.finalizeOrderFromStatus.isPending || workflow.serveItem.isPending}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="historico" className="mt-0">
                  <KdsStationHistory
                    stationId={dispatchStation.id}
                    stationColor={dispatchStation.color}
                    tenantId={overrideTenantId}
                  />
                </TabsContent>
              </Tabs>
            </div>
          );
        })}
      </div>
    </div>
  );
}




