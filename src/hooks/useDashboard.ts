import { useQuery } from '@tanstack/react-query';
import {
  listIngredients,
  listOrderItemsByOrderIds,
  listOrdersByStatusAndDateRange,
  listProducts,
  listProfilesByIds,
  listTables,
} from '@/lib/firebaseTenantCrud';
import { useTenant } from './useTenant';

export interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  averageTicket: number;
  openTables: number;
  pendingOrders: number;
  lowStockItems: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

const isoStartDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

export function useDashboardStats() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['dashboard-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return {
          todaySales: 0,
          todayOrders: 0,
          averageTicket: 0,
          openTables: 0,
          pendingOrders: 0,
          lowStockItems: 0,
        } as DashboardStats;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayOrders, tables, pendingOrders, ingredients] = await Promise.all([
        listOrdersByStatusAndDateRange(tenantId, {
          startIso: todayStart.toISOString(),
        }).then((orders) => orders.filter((o) => o.status !== 'cancelled')),
        listTables(tenantId),
        listOrdersByStatusAndDateRange(tenantId, {
          statuses: ['pending', 'preparing'],
        }),
        listIngredients(tenantId),
      ]);

      const totalSales = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const orderCount = todayOrders.length;
      const lowStock = ingredients.filter((i) => Number(i.current_stock) <= Number(i.min_stock)).length;

      return {
        todaySales: totalSales,
        todayOrders: orderCount,
        averageTicket: orderCount > 0 ? totalSales / orderCount : 0,
        openTables: tables.filter((t) => t.status === 'occupied').length,
        pendingOrders: pendingOrders.length,
        lowStockItems: lowStock,
      } as DashboardStats;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

export function useTopProducts(days: number = 7) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['top-products', tenantId, days],
    queryFn: async () => {
      if (!tenantId) return [];

      const orders = await listOrdersByStatusAndDateRange(tenantId, {
        statuses: ['delivered'],
        startIso: isoStartDaysAgo(days),
      });
      const orderIds = orders.map((o) => o.id);
      if (!orderIds.length) return [];

      const [items, products] = await Promise.all([
        listOrderItemsByOrderIds(tenantId, orderIds),
        listProducts(tenantId, true),
      ]);
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      const productAgg = new Map<string, { quantity: number; revenue: number }>();
      items.forEach((item) => {
        if (!item.product_id) return;
        const name = productMap.get(item.product_id) || 'Desconhecido';
        const current = productAgg.get(name) || { quantity: 0, revenue: 0 };
        productAgg.set(name, {
          quantity: current.quantity + Number(item.quantity || 0),
          revenue: current.revenue + Number(item.total_price || 0),
        });
      });

      return Array.from(productAgg.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5) as TopProduct[];
    },
    enabled: !!tenantId,
  });
}

export function useSalesChart(days: number = 7) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['sales-chart', tenantId, days],
    queryFn: async () => {
      if (!tenantId) return [];
      const orders = await listOrdersByStatusAndDateRange(tenantId, {
        startIso: isoStartDaysAgo(days),
      });
      const activeOrders = orders.filter((o) => o.status !== 'cancelled');

      const dayMap = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        dayMap.set(key, 0);
      }

      activeOrders.forEach((order) => {
        const date = new Date(order.created_at);
        const key = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
        dayMap.set(key, (dayMap.get(key) || 0) + Number(order.total || 0));
      });

      return Array.from(dayMap.entries())
        .map(([name, value]) => ({ name, value }))
        .reverse();
    },
    enabled: !!tenantId,
  });
}

export interface TopWaiter {
  id: string;
  name: string;
  itemCount: number;
  totalRevenue: number;
}

export function useTopWaiters(days: number = 7) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['top-waiters', tenantId, days],
    queryFn: async () => {
      if (!tenantId) return [];

      const orders = await listOrdersByStatusAndDateRange(tenantId, {
        statuses: ['delivered'],
        startIso: isoStartDaysAgo(days),
      });
      const orderIds = orders.map((o) => o.id);
      if (!orderIds.length) return [];

      const items = await listOrderItemsByOrderIds(tenantId, orderIds);
      const deliveredItems = items.filter((item) => item.added_by);

      const waiterIds = [...new Set(deliveredItems.map((i) => i.added_by).filter(Boolean))] as string[];
      if (!waiterIds.length) return [];

      const profiles = await listProfilesByIds(waiterIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));

      const waiterMap = new Map<string, { itemCount: number; revenue: number }>();
      deliveredItems.forEach((item) => {
        if (!item.added_by) return;
        const existing = waiterMap.get(item.added_by) || { itemCount: 0, revenue: 0 };
        waiterMap.set(item.added_by, {
          itemCount: existing.itemCount + Number(item.quantity || 0),
          revenue: existing.revenue + Number(item.total_price || 0),
        });
      });

      return Array.from(waiterMap.entries())
        .map(([id, data]) => ({
          id,
          name: profileMap.get(id) || 'Desconhecido',
          itemCount: data.itemCount,
          totalRevenue: data.revenue,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5) as TopWaiter[];
    },
    enabled: !!tenantId,
  });
}
