import { useQuery } from '@tanstack/react-query';
import { listCancelledOrders, listProfilesByIds, listTables } from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export interface CancellationRecord {
  id: string;
  order_id: string;
  order_type: string | null;
  table_number?: number | null;
  customer_name: string | null;
  total: number | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_by_name?: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

export interface CancellationFilters {
  dateFrom?: Date;
  dateTo?: Date;
  reason?: string;
  cancelledBy?: string;
}

export function useCancellationHistory(filters: CancellationFilters) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['cancellation-history', tenant?.id, filters],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let cancelledEndIso: string | undefined;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        cancelledEndIso = end.toISOString();
      }

      const [orders, tables] = await Promise.all([
        listCancelledOrders(tenant.id, {
          cancelledStartIso: filters.dateFrom?.toISOString(),
          cancelledEndIso,
          reasonContains: filters.reason,
          cancelledBy: filters.cancelledBy,
          max: 1000,
        }),
        listTables(tenant.id),
      ]);

      const filtered = orders.filter((o) => Boolean(o.cancellation_reason));
      const tableById = new Map(tables.map((t) => [t.id, t.number]));

      const userIds = [...new Set(filtered.map((o) => o.cancelled_by).filter(Boolean) as string[])];
      const profiles = userIds.length > 0 ? await listProfilesByIds(userIds) : [];
      const profilesMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

      return filtered.map((order): CancellationRecord => ({
        id: order.id,
        order_id: order.id,
        order_type: order.order_type || null,
        table_number: order.table_id ? tableById.get(order.table_id) || null : null,
        customer_name: order.customer_name || null,
        total: order.total || 0,
        cancellation_reason: order.cancellation_reason || null,
        cancelled_by: order.cancelled_by || null,
        cancelled_by_name: order.cancelled_by ? profilesMap[order.cancelled_by] || null : null,
        cancelled_at: order.cancelled_at || null,
        created_at: order.created_at || null,
      }));
    },
    enabled: !!tenant?.id,
  });
}

export function useCancellationSummary(records: CancellationRecord[]) {
  const totalCancellations = records.length;
  const totalValue = records.reduce((sum, r) => sum + (r.total || 0), 0);

  const reasonCounts = records.reduce((acc, r) => {
    const reason = r.cancellation_reason || 'Nao informado';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const mostCommonReason = sortedReasons[0]?.[0] || 'N/A';

  const userCounts = records.reduce((acc, r) => {
    const user = r.cancelled_by_name || 'Desconhecido';
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalCancellations,
    totalValue,
    mostCommonReason,
    reasonBreakdown: sortedReasons,
    userBreakdown: Object.entries(userCounts).sort(([, a], [, b]) => b - a),
  };
}
