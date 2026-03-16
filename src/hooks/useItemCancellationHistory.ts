import { useQuery } from '@tanstack/react-query';
import { listOrderItemCancellations, listProfilesByIds } from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export interface ItemCancellationRecord {
  id: string;
  order_item_id: string;
  order_id: string;
  product_name: string;
  variation_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_type: string | null;
  table_number: number | null;
  customer_name: string | null;
  cancellation_reason: string;
  cancelled_by: string | null;
  cancelled_by_name?: string | null;
  cancelled_at: string;
}

export interface ItemCancellationFilters {
  dateFrom?: Date;
  dateTo?: Date;
  reason?: string;
  cancelledBy?: string;
}

export function useItemCancellationHistory(filters: ItemCancellationFilters) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['item-cancellation-history', tenant?.id, filters],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let data = await listOrderItemCancellations(tenant.id, 1000);
      if (filters.dateFrom) {
        data = data.filter((record) => record.cancelled_at >= filters.dateFrom!.toISOString());
      }
      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        data = data.filter((record) => record.cancelled_at <= endOfDay.toISOString());
      }
      if (filters.reason) {
        const needle = filters.reason.toLowerCase();
        data = data.filter((record) => (record.cancellation_reason || '').toLowerCase().includes(needle));
      }
      if (filters.cancelledBy) {
        data = data.filter((record) => record.cancelled_by === filters.cancelledBy);
      }

      const userIds = [...new Set(data.map((record) => record.cancelled_by).filter(Boolean) as string[])];
      const profiles = userIds.length > 0 ? await listProfilesByIds(userIds) : [];
      const profilesMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.name]));

      return data.map((record): ItemCancellationRecord => ({
        id: record.id,
        order_item_id: record.order_item_id,
        order_id: record.order_id,
        product_name: record.product_name,
        variation_name: record.variation_name,
        quantity: record.quantity,
        unit_price: record.unit_price,
        total_price: record.total_price,
        order_type: record.order_type,
        table_number: record.table_number,
        customer_name: record.customer_name,
        cancellation_reason: record.cancellation_reason,
        cancelled_by: record.cancelled_by,
        cancelled_by_name: record.cancelled_by ? profilesMap[record.cancelled_by] || null : null,
        cancelled_at: record.cancelled_at,
      }));
    },
    enabled: !!tenant?.id,
  });
}

export function useItemCancellationSummary(records: ItemCancellationRecord[]) {
  const totalCancellations = records.length;
  const totalValue = records.reduce((sum, r) => sum + (r.total_price || 0), 0);
  const totalQuantity = records.reduce((sum, r) => sum + (r.quantity || 0), 0);

  const productCounts = records.reduce((acc, r) => {
    const product = r.product_name || 'Desconhecido';
    acc[product] = (acc[product] || 0) + r.quantity;
    return acc;
  }, {} as Record<string, number>);

  const sortedProducts = Object.entries(productCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const mostCancelledProduct = sortedProducts[0]?.[0] || 'N/A';

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
    totalQuantity,
    mostCancelledProduct,
    mostCommonReason,
    productBreakdown: sortedProducts,
    reasonBreakdown: sortedReasons,
    userBreakdown: Object.entries(userCounts).sort(([, a], [, b]) => b - a),
  };
}
