import { useQuery } from '@tanstack/react-query';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  getHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import {
  listCashMovements,
  listCashRegisters,
  listOrderItemsByOrderIds,
  listOrdersByStatusAndDateRange,
  listPaymentsByOrderIds,
  listProducts,
  listProfilesByIds,
} from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface SalesReportData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  salesByPaymentMethod: { method: string; amount: number; count: number }[];
  salesByDay: { date: string; amount: number; count: number }[];
}

interface ProductReportData {
  id: string;
  name: string;
  category: string | null;
  quantitySold: number;
  totalRevenue: number;
}

interface PeakHoursData {
  hour: number;
  dayOfWeek: number;
  orderCount: number;
  totalSales: number;
}

export function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
      return {
        start: customStart ? startOfDay(customStart) : startOfDay(now),
        end: customEnd ? endOfDay(customEnd) : endOfDay(now),
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function useSalesReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string) {
  const { tenant } = useTenant();
  const { start, end } = getDateRange(range, customStart, customEnd);

  return useQuery({
    queryKey: ['sales-report', tenant?.id, range, customStart?.toISOString(), customEnd?.toISOString(), employeeId],
    queryFn: async (): Promise<SalesReportData> => {
      if (!tenant?.id) {
        return { totalSales: 0, totalOrders: 0, averageTicket: 0, salesByPaymentMethod: [], salesByDay: [] };
      }

      const orders = await listOrdersByStatusAndDateRange(tenant.id, {
        statuses: ['delivered'],
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        createdBy: employeeId,
      });
      const payments = await listPaymentsByOrderIds(
        tenant.id,
        orders.map((o) => o.id)
      );

      const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = orders.length;
      const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

      const paymentMethodMap = new Map<string, { amount: number; count: number }>();
      payments.forEach((p) => {
        const current = paymentMethodMap.get(p.payment_method) || { amount: 0, count: 0 };
        paymentMethodMap.set(p.payment_method, {
          amount: current.amount + Number(p.amount),
          count: current.count + 1,
        });
      });
      const salesByPaymentMethod = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count,
      }));

      const dayMap = new Map<string, { amount: number; count: number }>();
      orders.forEach((o) => {
        const date = format(new Date(o.created_at), 'yyyy-MM-dd');
        const current = dayMap.get(date) || { amount: 0, count: 0 };
        dayMap.set(date, { amount: current.amount + Number(o.total), count: current.count + 1 });
      });
      const salesByDay = Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalSales, totalOrders, averageTicket, salesByPaymentMethod, salesByDay };
    },
    enabled: !!tenant?.id,
  });
}

export function useProductsReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string) {
  const { tenant } = useTenant();
  const { start, end } = getDateRange(range, customStart, customEnd);

  return useQuery({
    queryKey: ['products-report', tenant?.id, range, customStart?.toISOString(), customEnd?.toISOString(), employeeId],
    queryFn: async (): Promise<ProductReportData[]> => {
      if (!tenant?.id) return [];
      const orders = await listOrdersByStatusAndDateRange(tenant.id, {
        statuses: ['delivered'],
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        createdBy: employeeId,
      });
      const orderIds = orders.map((o) => o.id);
      if (!orderIds.length) return [];

      const [items, products] = await Promise.all([listOrderItemsByOrderIds(tenant.id, orderIds), listProducts(tenant.id, true)]);
      const productMap = new Map(products.map((p) => [p.id, p]));

      const agg = new Map<string, ProductReportData>();
      items.forEach((item) => {
        if (!item.product_id) return;
        const product = productMap.get(item.product_id);
        if (!product) return;
        const current = agg.get(item.product_id) || {
          id: item.product_id,
          name: product.name,
          category: product.category?.name || null,
          quantitySold: 0,
          totalRevenue: 0,
        };
        agg.set(item.product_id, {
          ...current,
          quantitySold: current.quantitySold + Number(item.quantity || 0),
          totalRevenue: current.totalRevenue + Number(item.total_price || 0),
        });
      });

      return Array.from(agg.values()).sort((a, b) => b.quantitySold - a.quantitySold);
    },
    enabled: !!tenant?.id,
  });
}

export function usePeakHoursAnalysis(range: DateRange, customStart?: Date, customEnd?: Date) {
  const { tenant } = useTenant();
  const { start, end } = getDateRange(range, customStart, customEnd);

  return useQuery({
    queryKey: ['peak-hours', tenant?.id, range, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: async (): Promise<PeakHoursData[]> => {
      if (!tenant?.id) return [];
      const orders = await listOrdersByStatusAndDateRange(tenant.id, {
        statuses: ['delivered'],
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });

      const heatMap = new Map<string, { count: number; sales: number }>();
      orders.forEach((order) => {
        const date = new Date(order.created_at);
        const hour = getHours(date);
        const dayOfWeek = getDay(date);
        const key = `${dayOfWeek}-${hour}`;
        const current = heatMap.get(key) || { count: 0, sales: 0 };
        heatMap.set(key, { count: current.count + 1, sales: current.sales + Number(order.total || 0) });
      });

      return Array.from(heatMap.entries()).map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return { hour, dayOfWeek, orderCount: data.count, totalSales: data.sales };
      });
    },
    enabled: !!tenant?.id,
  });
}

export function useCashRegisterHistory() {
  const { tenant } = useTenant();
  return useQuery({
    queryKey: ['cash-register-history', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const registers = await listCashRegisters(tenant.id, 50);
      const userIds = [
        ...new Set(
          registers
            .flatMap((r) => [r.opened_by, r.closed_by])
            .filter((v): v is string => Boolean(v))
        ),
      ];
      const profiles = userIds.length ? await listProfilesByIds(userIds) : [];
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));
      return registers.map((r) => ({
        ...r,
        opened_by_profile: { name: profileMap.get(r.opened_by) || null },
        closed_by_profile: { name: r.closed_by ? profileMap.get(r.closed_by) || null : null },
      }));
    },
    enabled: !!tenant?.id,
  });
}

export function useCashMovements(cashRegisterId?: string) {
  const { tenant } = useTenant();
  return useQuery({
    queryKey: ['cash-movements', tenant?.id, cashRegisterId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return await listCashMovements(tenant.id, cashRegisterId);
    },
    enabled: !!tenant?.id && !!cashRegisterId,
  });
}

export interface WaiterReportData {
  id: string;
  name: string;
  totalItems: number;
  totalRevenue: number;
  averagePerItem: number;
  orderCount: number;
}

export function useWaiterReport(range: DateRange, customStart?: Date, customEnd?: Date) {
  const { tenant } = useTenant();
  const { start, end } = getDateRange(range, customStart, customEnd);

  return useQuery({
    queryKey: ['waiter-report', tenant?.id, range, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: async (): Promise<WaiterReportData[]> => {
      if (!tenant?.id) return [];
      const orders = await listOrdersByStatusAndDateRange(tenant.id, {
        statuses: ['delivered'],
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });
      const orderIds = orders.map((o) => o.id);
      if (!orderIds.length) return [];

      const items = await listOrderItemsByOrderIds(tenant.id, orderIds);
      const waiterItems = items.filter((i) => i.added_by);
      if (!waiterItems.length) return [];

      const waiterIds = [...new Set(waiterItems.map((i) => i.added_by as string))];
      const profiles = await listProfilesByIds(waiterIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));

      const waiterMap = new Map<string, { totalItems: number; totalRevenue: number; orders: Set<string> }>();
      waiterItems.forEach((item) => {
        const waiterId = item.added_by as string;
        const existing = waiterMap.get(waiterId) || { totalItems: 0, totalRevenue: 0, orders: new Set<string>() };
        existing.totalItems += Number(item.quantity || 0);
        existing.totalRevenue += Number(item.total_price || 0);
        existing.orders.add(item.order_id);
        waiterMap.set(waiterId, existing);
      });

      return Array.from(waiterMap.entries())
        .map(([id, data]) => ({
          id,
          name: profileMap.get(id) || 'Desconhecido',
          totalItems: data.totalItems,
          totalRevenue: data.totalRevenue,
          averagePerItem: data.totalItems > 0 ? data.totalRevenue / data.totalItems : 0,
          orderCount: data.orders.size,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
    enabled: !!tenant?.id,
  });
}

