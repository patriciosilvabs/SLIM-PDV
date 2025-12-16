import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, getHours, getDay } from 'date-fns';

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
        end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function useSalesReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['sales-report', range, customStart?.toISOString(), customEnd?.toISOString(), employeeId],
    queryFn: async (): Promise<SalesReportData> => {
      // Get orders in range that are delivered
      let ordersQuery = supabase
        .from('orders')
        .select('id, total, created_at')
        .eq('status', 'delivered')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      if (employeeId) {
        ordersQuery = ordersQuery.eq('created_by', employeeId);
      }
      
      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      // Get payments for these orders
      const orderIds = orders?.map(o => o.id) || [];
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, payment_method, order_id')
        .in('order_id', orderIds.length > 0 ? orderIds : ['none']);
      
      if (paymentsError) throw paymentsError;

      // Calculate totals
      const totalSales = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Group by payment method
      const paymentMethodMap = new Map<string, { amount: number; count: number }>();
      payments?.forEach(p => {
        const current = paymentMethodMap.get(p.payment_method) || { amount: 0, count: 0 };
        paymentMethodMap.set(p.payment_method, {
          amount: current.amount + Number(p.amount),
          count: current.count + 1
        });
      });
      const salesByPaymentMethod = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count
      }));

      // Group by day
      const dayMap = new Map<string, { amount: number; count: number }>();
      orders?.forEach(o => {
        const date = format(new Date(o.created_at), 'yyyy-MM-dd');
        const current = dayMap.get(date) || { amount: 0, count: 0 };
        dayMap.set(date, {
          amount: current.amount + Number(o.total),
          count: current.count + 1
        });
      });
      const salesByDay = Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalSales,
        totalOrders,
        averageTicket,
        salesByPaymentMethod,
        salesByDay
      };
    },
  });
}

export function useProductsReport(range: DateRange, customStart?: Date, customEnd?: Date, employeeId?: string) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['products-report', range, customStart?.toISOString(), customEnd?.toISOString(), employeeId],
    queryFn: async (): Promise<ProductReportData[]> => {
      // Get orders in range
      let ordersQuery = supabase
        .from('orders')
        .select('id')
        .eq('status', 'delivered')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      if (employeeId) {
        ordersQuery = ordersQuery.eq('created_by', employeeId);
      }
      
      const { data: orders, error: ordersError } = await ordersQuery;
      
      if (ordersError) throw ordersError;

      const orderIds = orders?.map(o => o.id) || [];
      if (orderIds.length === 0) return [];

      // Get order items with products
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          total_price,
          product:products(id, name, category:categories(name))
        `)
        .in('order_id', orderIds);
      
      if (itemsError) throw itemsError;

      // Aggregate by product
      const productMap = new Map<string, ProductReportData>();
      items?.forEach(item => {
        if (!item.product) return;
        const productId = item.product.id;
        const current = productMap.get(productId) || {
          id: productId,
          name: item.product.name,
          category: item.product.category?.name || null,
          quantitySold: 0,
          totalRevenue: 0
        };
        productMap.set(productId, {
          ...current,
          quantitySold: current.quantitySold + item.quantity,
          totalRevenue: current.totalRevenue + Number(item.total_price)
        });
      });

      return Array.from(productMap.values())
        .sort((a, b) => b.quantitySold - a.quantitySold);
    },
  });
}

export function usePeakHoursAnalysis(range: DateRange, customStart?: Date, customEnd?: Date) {
  const { start, end } = getDateRange(range, customStart, customEnd);
  
  return useQuery({
    queryKey: ['peak-hours', range, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: async (): Promise<PeakHoursData[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total')
        .eq('status', 'delivered')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      if (error) throw error;

      // Group by hour and day of week
      const heatMap = new Map<string, { count: number; sales: number }>();
      orders?.forEach(order => {
        const date = new Date(order.created_at);
        const hour = getHours(date);
        const dayOfWeek = getDay(date);
        const key = `${dayOfWeek}-${hour}`;
        const current = heatMap.get(key) || { count: 0, sales: 0 };
        heatMap.set(key, {
          count: current.count + 1,
          sales: current.sales + Number(order.total)
        });
      });

      return Array.from(heatMap.entries()).map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          hour,
          dayOfWeek,
          orderCount: data.count,
          totalSales: data.sales
        };
      });
    },
  });
}

export function useCashRegisterHistory() {
  return useQuery({
    queryKey: ['cash-register-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers')
        .select(`
          *,
          opened_by_profile:profiles!cash_registers_opened_by_fkey(name),
          closed_by_profile:profiles!cash_registers_closed_by_fkey(name)
        `)
        .order('opened_at', { ascending: false })
        .limit(50);
      
      if (error) {
        // Fallback without profile joins if foreign keys don't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('cash_registers')
          .select('*')
          .order('opened_at', { ascending: false })
          .limit(50);
        
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
  });
}

export function useCashMovements(cashRegisterId?: string) {
  return useQuery({
    queryKey: ['cash-movements', cashRegisterId],
    queryFn: async () => {
      let query = supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (cashRegisterId) {
        query = query.eq('cash_register_id', cashRegisterId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!cashRegisterId,
  });
}
