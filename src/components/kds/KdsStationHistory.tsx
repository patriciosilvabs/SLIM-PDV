import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { backendClient } from '@/integrations/backend/client';
import { getStoredKdsDeviceAuth, hasActiveKdsDeviceSession } from '@/lib/kdsDeviceSession';
import {
  listKdsStationLogs,
  listOrderItemsByIds,
  listOrdersByIds,
  listProducts,
  listProductVariations,
  listTables,
} from '@/lib/firebaseTenantCrud';

interface KdsStationHistoryProps {
  stationId: string;
  stationColor: string;
  tenantId?: string | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  order_item_id: string;
  order_item: {
    id: string;
    quantity: number;
    notes: string | null;
    order_id: string;
    product: { name: string } | null;
    variation: { name: string } | null;
    order: {
      id: string;
      order_type: string;
      customer_name: string | null;
      table: { number: number } | null;
    } | null;
  } | null;
}

export function KdsStationHistory({ stationId, stationColor, tenantId }: KdsStationHistoryProps) {
  const isDeviceSession = hasActiveKdsDeviceSession();
  const deviceAuth = getStoredKdsDeviceAuth();
  const queryEnabled = !!tenantId;

  const { data: historyEntries = [], isLoading } = useQuery({
    queryKey: ['kds-station-history', tenantId, stationId, isDeviceSession ? deviceAuth?.deviceId : 'user'],
    queryFn: async () => {
      if (!tenantId) return [];

      if (isDeviceSession && deviceAuth?.deviceId && deviceAuth.tenantId === tenantId) {
        const { data, error } = await backendClient.functions.invoke('kds-data', {
          body: {
            action: 'get_station_history',
            device_id: deviceAuth.deviceId,
            tenant_id: tenantId,
            station_id: stationId,
            limit: 30,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return (data?.history || []) as HistoryEntry[];
      }

      const logs = await listKdsStationLogs(tenantId, {
        stationId,
        action: 'completed',
        limitCount: 30,
      });
      const orderedLogs = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const orderItems = await listOrderItemsByIds(tenantId, orderedLogs.map((entry) => entry.order_item_id));
      const orders = await listOrdersByIds(
        tenantId,
        [...new Set(orderItems.map((item) => item.order_id).filter(Boolean))]
      );
      const [products, variations, tables] = await Promise.all([
        listProducts(tenantId, true),
        listProductVariations(tenantId),
        listTables(tenantId),
      ]);

      const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));
      const orderMap = new Map(orders.map((order) => [order.id, order]));
      const productMap = new Map(products.map((product) => [product.id, product]));
      const variationMap = new Map(variations.map((variation) => [variation.id, variation]));
      const tableMap = new Map(tables.map((table) => [table.id, table]));

      return orderedLogs.map((entry) => {
        const orderItem = orderItemMap.get(entry.order_item_id);
        const order = orderItem ? orderMap.get(orderItem.order_id) : null;
        const table = order?.table_id ? tableMap.get(order.table_id) : null;

        return {
          id: entry.id,
          action: entry.action,
          created_at: entry.created_at,
          order_item_id: entry.order_item_id,
          order_item: orderItem ? {
            id: orderItem.id,
            quantity: Number(orderItem.quantity || 1),
            notes: orderItem.notes || null,
            order_id: orderItem.order_id,
            product: orderItem.product_id ? { name: productMap.get(orderItem.product_id)?.name || 'Produto' } : null,
            variation: orderItem.variation_id ? { name: variationMap.get(orderItem.variation_id)?.name || '' } : null,
            order: order ? {
              id: order.id,
              order_type: order.order_type || 'dine_in',
              customer_name: order.customer_name || null,
              table: table ? { number: table.number } : null,
            } : null,
          } : null,
        };
      }) as HistoryEntry[];
    },
    refetchInterval: queryEnabled ? 15000 : false,
    enabled: queryEnabled,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (historyEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2" />
        <p>Nenhum histÃ³rico recente</p>
      </div>
    );
  }

  const getOrderLabel = (entry: HistoryEntry) => {
    const order = entry.order_item?.order;
    if (!order) return 'â€”';
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃƒO';
    return `MESA ${order.table?.number || '?'}`;
  };

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2">
        {historyEntries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
          >
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {entry.order_item?.quantity || 1}x {entry.order_item?.product?.name || 'Produto'}
                </span>
                {entry.order_item?.variation?.name && (
                  <span className="text-xs text-muted-foreground">({entry.order_item.variation.name})</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] h-4">
                  {getOrderLabel(entry)}
                </Badge>
                {entry.order_item?.order?.customer_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    {entry.order_item.order.customer_name}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}




