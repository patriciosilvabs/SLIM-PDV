import { useQuery } from '@tanstack/react-query';
import { PaymentMethod } from '@/hooks/useCashRegister';
import { listOrdersByStatusAndDateRange, listPaymentsByOrderIds, listTables } from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export interface ClosingRecord {
  id: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  table_number: number | null;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  payments: {
    payment_method: PaymentMethod;
    amount: number;
  }[];
}

export interface ClosingHistoryFilters {
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  customStart?: Date;
  customEnd?: Date;
  paymentMethod?: PaymentMethod | 'all';
  minValue?: number;
  maxValue?: number;
  orderType?: 'all' | 'dine_in' | 'takeaway' | 'delivery';
}

function getDateRange(range: ClosingHistoryFilters['dateRange'], customStart?: Date, customEnd?: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart, end: now };
    }
    case 'month': {
      const monthStart = new Date(today);
      monthStart.setDate(monthStart.getDate() - 30);
      return { start: monthStart, end: now };
    }
    case 'custom':
      return {
        start: customStart || today,
        end: customEnd || now,
      };
    default:
      return { start: today, end: now };
  }
}

export function useClosingHistory(filters: ClosingHistoryFilters) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['closing-history', tenant?.id, filters],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { start, end } = getDateRange(filters.dateRange, filters.customStart, filters.customEnd);

      const [ordersRaw, tables] = await Promise.all([
        listOrdersByStatusAndDateRange(tenant.id, {
          statuses: ['delivered'],
          startIso: start.toISOString(),
          endIso: end.toISOString(),
        }),
        listTables(tenant.id),
      ]);

      let orders = ordersRaw;
      if (filters.orderType && filters.orderType !== 'all') {
        orders = orders.filter((o) => o.order_type === filters.orderType);
      }
      if (filters.minValue !== undefined && filters.minValue > 0) {
        orders = orders.filter((o) => Number(o.total || 0) >= filters.minValue!);
      }
      if (filters.maxValue !== undefined && filters.maxValue > 0) {
        orders = orders.filter((o) => Number(o.total || 0) <= filters.maxValue!);
      }
      if (!orders.length) return [];

      const payments = await listPaymentsByOrderIds(
        tenant.id,
        orders.map((o) => o.id)
      );
      const tableById = new Map(tables.map((t) => [t.id, t.number]));

      const result: ClosingRecord[] = orders
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((order) => {
          const orderPayments = payments.filter((p) => p.order_id === order.id);
          return {
            id: order.id,
            order_type: (order.order_type as 'dine_in' | 'takeaway' | 'delivery') || 'dine_in',
            table_number: order.table_id ? tableById.get(order.table_id) || null : null,
            customer_name: order.customer_name || null,
            subtotal: Number(order.subtotal || 0),
            discount: Number(order.discount || 0),
            total: Number(order.total || 0),
            created_at: order.created_at,
            payments: orderPayments.map((p) => ({
              payment_method: p.payment_method as PaymentMethod,
              amount: Number(p.amount || 0),
            })),
          };
        });

      if (filters.paymentMethod && filters.paymentMethod !== 'all') {
        return result.filter((r) => r.payments.some((p) => p.payment_method === filters.paymentMethod));
      }

      return result;
    },
    enabled: !!tenant?.id,
  });
}

export function useClosingHistorySummary(data: ClosingRecord[] | undefined) {
  if (!data || data.length === 0) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      averageTicket: 0,
      totalDiscounts: 0,
      byPaymentMethod: {} as Record<PaymentMethod, number>,
    };
  }

  const totalRevenue = data.reduce((sum, r) => sum + r.total, 0);
  const totalOrders = data.length;
  const averageTicket = totalRevenue / totalOrders;
  const totalDiscounts = data.reduce((sum, r) => sum + r.discount, 0);

  const byPaymentMethod: Record<PaymentMethod, number> = {
    cash: 0,
    credit_card: 0,
    debit_card: 0,
    pix: 0,
  };

  data.forEach((record) => {
    record.payments.forEach((payment) => {
      byPaymentMethod[payment.payment_method] += payment.amount;
    });
  });

  return {
    totalRevenue,
    totalOrders,
    averageTicket,
    totalDiscounts,
    byPaymentMethod,
  };
}
