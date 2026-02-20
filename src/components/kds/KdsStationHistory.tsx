import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { data: historyEntries = [], isLoading } = useQuery({
    queryKey: ['kds-station-history', stationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kds_station_logs')
        .select(`
          id, action, created_at, order_item_id,
          order_item:order_items!kds_station_logs_order_item_id_fkey(
            id, quantity, notes, order_id,
            product:products(name),
            variation:product_variations(name)
          )
        `)
        .eq('station_id', stationId)
        .eq('action', 'completed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Fetch order info for each unique order_id
      const orderIds = [...new Set((data || [])
        .map((d: any) => d.order_item?.order_id)
        .filter(Boolean))];

      let ordersMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_type, customer_name, table:tables(number)')
          .in('id', orderIds);

        if (orders) {
          ordersMap = orders.reduce((acc: any, o: any) => {
            acc[o.id] = o;
            return acc;
          }, {});
        }
      }

      return (data || []).map((entry: any) => ({
        ...entry,
        order_item: entry.order_item ? {
          ...entry.order_item,
          order: entry.order_item.order_id ? ordersMap[entry.order_item.order_id] || null : null,
        } : null,
      })) as HistoryEntry[];
    },
    refetchInterval: 15000, // Refresh every 15s
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
        <p>Nenhum histórico recente</p>
      </div>
    );
  }

  const getOrderLabel = (entry: HistoryEntry) => {
    const order = entry.order_item?.order;
    if (!order) return '—';
    if (order.order_type === 'delivery') return 'DELIVERY';
    if (order.order_type === 'takeaway') return 'BALCÃO';
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
