import { useQuery } from '@tanstack/react-query';
import { endOfDay, format, startOfDay, subDays, differenceInDays } from 'date-fns';
import { listOrdersByStatusAndDateRange, listPaymentsByOrderIds, listProfilesByIds } from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface KPIData {
  revenue: number;
  orders: number;
  averageTicket: number;
  revenueVariation: number;
  ordersVariation: number;
  ticketVariation: number;
}

export interface HourlyData {
  hour: string;
  currentPeriod: number;
  previousPeriod: number;
}

export interface RevenueDetails {
  productsTotal: number;
  serviceCharge: number;
  discountsTotal: number;
  netRevenue: number;
}

export interface SegmentData {
  segment: string;
  revenue: number;
  orders: number;
  averageTicket: number;
  percentage: number;
}

export interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  revenue: number;
  orders: number;
}

const getPreviousPeriod = (dateRange: DateRange): DateRange => {
  const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
  return {
    start: subDays(dateRange.start, daysDiff),
    end: subDays(dateRange.end, daysDiff),
  };
};

const calcVariation = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const listDeliveredOrders = async (
  tenantId: string,
  dateRange: DateRange,
  orderType?: string
) => {
  const orders = await listOrdersByStatusAndDateRange(tenantId, {
    statuses: ['delivered'],
    startIso: startOfDay(dateRange.start).toISOString(),
    endIso: endOfDay(dateRange.end).toISOString(),
  });

  if (orderType && orderType !== 'all') {
    return orders.filter((o) => o.order_type === orderType);
  }

  return orders;
};

export const usePerformanceKPIs = (dateRange: DateRange, filters?: { orderType?: string; paymentMethod?: string }) => {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['performance-kpis', tenant?.id, dateRange, filters],
    queryFn: async (): Promise<KPIData> => {
      if (!tenant?.id) {
        return {
          revenue: 0,
          orders: 0,
          averageTicket: 0,
          revenueVariation: 0,
          ordersVariation: 0,
          ticketVariation: 0,
        };
      }

      const previousPeriod = getPreviousPeriod(dateRange);

      let [currentOrders, previousOrders] = await Promise.all([
        listDeliveredOrders(tenant.id, dateRange, filters?.orderType),
        listDeliveredOrders(tenant.id, previousPeriod, filters?.orderType),
      ]);

      if (filters?.paymentMethod && filters.paymentMethod !== 'all') {
        const [currentPayments, previousPayments] = await Promise.all([
          listPaymentsByOrderIds(tenant.id, currentOrders.map((o) => o.id)),
          listPaymentsByOrderIds(tenant.id, previousOrders.map((o) => o.id)),
        ]);

        const currentAllowed = new Set(
          currentPayments
            .filter((p) => p.payment_method === (filters.paymentMethod as 'cash' | 'credit_card' | 'debit_card' | 'pix'))
            .map((p) => p.order_id)
        );
        const previousAllowed = new Set(
          previousPayments
            .filter((p) => p.payment_method === (filters.paymentMethod as 'cash' | 'credit_card' | 'debit_card' | 'pix'))
            .map((p) => p.order_id)
        );

        currentOrders = currentOrders.filter((o) => currentAllowed.has(o.id));
        previousOrders = previousOrders.filter((o) => previousAllowed.has(o.id));
      }

      const currentRevenue = currentOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const currentCount = currentOrders.length;
      const currentTicket = currentCount > 0 ? currentRevenue / currentCount : 0;

      const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const previousCount = previousOrders.length;
      const previousTicket = previousCount > 0 ? previousRevenue / previousCount : 0;

      return {
        revenue: currentRevenue,
        orders: currentCount,
        averageTicket: currentTicket,
        revenueVariation: calcVariation(currentRevenue, previousRevenue),
        ordersVariation: calcVariation(currentCount, previousCount),
        ticketVariation: calcVariation(currentTicket, previousTicket),
      };
    },
    enabled: !!tenant?.id,
  });
};

export const useHourlyRevenue = (dateRange: DateRange, groupBy: 'hour' | 'day' = 'hour') => {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['hourly-revenue', tenant?.id, dateRange, groupBy],
    queryFn: async (): Promise<HourlyData[]> => {
      if (!tenant?.id) return [];
      const previousPeriod = getPreviousPeriod(dateRange);

      const [currentOrders, previousOrders] = await Promise.all([
        listDeliveredOrders(tenant.id, dateRange),
        listDeliveredOrders(tenant.id, previousPeriod),
      ]);

      if (groupBy === 'hour') {
        const hourlyData: HourlyData[] = [];
        for (let i = 0; i < 24; i++) {
          const hourLabel = `${i.toString().padStart(2, '0')}h`;

          const currentHourTotal = currentOrders
            .filter((o) => new Date(o.created_at).getHours() === i)
            .reduce((sum, o) => sum + Number(o.total || 0), 0);

          const previousHourTotal = previousOrders
            .filter((o) => new Date(o.created_at).getHours() === i)
            .reduce((sum, o) => sum + Number(o.total || 0), 0);

          hourlyData.push({
            hour: hourLabel,
            currentPeriod: currentHourTotal,
            previousPeriod: previousHourTotal,
          });
        }
        return hourlyData;
      }

      const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
      const dailyData: HourlyData[] = [];

      for (let i = 0; i < daysDiff; i++) {
        const currentDay = subDays(dateRange.end, daysDiff - 1 - i);
        const previousDay = subDays(previousPeriod.end, daysDiff - 1 - i);
        const dayLabel = format(currentDay, 'dd/MM');

        const currentDayKey = format(currentDay, 'yyyy-MM-dd');
        const previousDayKey = format(previousDay, 'yyyy-MM-dd');

        const currentDayTotal = currentOrders
          .filter((o) => format(new Date(o.created_at), 'yyyy-MM-dd') === currentDayKey)
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        const previousDayTotal = previousOrders
          .filter((o) => format(new Date(o.created_at), 'yyyy-MM-dd') === previousDayKey)
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        dailyData.push({
          hour: dayLabel,
          currentPeriod: currentDayTotal,
          previousPeriod: previousDayTotal,
        });
      }

      return dailyData;
    },
    enabled: !!tenant?.id,
  });
};

export const useRevenueDetails = (dateRange: DateRange) => {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['revenue-details', tenant?.id, dateRange],
    queryFn: async (): Promise<RevenueDetails> => {
      if (!tenant?.id) {
        return { productsTotal: 0, serviceCharge: 0, discountsTotal: 0, netRevenue: 0 };
      }

      const ordersData = await listDeliveredOrders(tenant.id, dateRange);

      const productsTotal = ordersData.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
      const discountsTotal = ordersData.reduce((sum, o) => sum + Number(o.discount || 0), 0);
      const netRevenue = ordersData.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const serviceCharge = netRevenue - (productsTotal - discountsTotal);

      return {
        productsTotal,
        serviceCharge: Math.max(0, serviceCharge),
        discountsTotal,
        netRevenue,
      };
    },
    enabled: !!tenant?.id,
  });
};

export const useSegmentAnalysis = (
  dateRange: DateRange,
  segmentBy: 'payment' | 'orderType' | 'channel' = 'payment'
) => {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['segment-analysis', tenant?.id, dateRange, segmentBy],
    queryFn: async (): Promise<SegmentData[]> => {
      if (!tenant?.id) return [];
      const ordersData = await listDeliveredOrders(tenant.id, dateRange);
      const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total || 0), 0);

      if (segmentBy === 'payment') {
        const payments = await listPaymentsByOrderIds(
          tenant.id,
          ordersData.map((o) => o.id)
        );

        const paymentMap = new Map<string, { revenue: number; orders: Set<string> }>();

        payments.forEach((p) => {
          const method = p.payment_method;
          if (!paymentMap.has(method)) {
            paymentMap.set(method, { revenue: 0, orders: new Set() });
          }
          const entry = paymentMap.get(method)!;
          entry.revenue += Number(p.amount || 0);
          entry.orders.add(p.order_id);
        });

        const methodLabels: Record<string, string> = {
          cash: 'Dinheiro',
          credit_card: 'Cartao de Credito',
          debit_card: 'Cartao de Debito',
          pix: 'PIX',
        };

        return Array.from(paymentMap.entries())
          .map(([method, data]) => ({
            segment: methodLabels[method] || method,
            revenue: data.revenue,
            orders: data.orders.size,
            averageTicket: data.orders.size > 0 ? data.revenue / data.orders.size : 0,
            percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      }

      const typeMap = new Map<string, { revenue: number; count: number }>();
      ordersData.forEach((o) => {
        const type = o.order_type || 'dine_in';
        if (!typeMap.has(type)) {
          typeMap.set(type, { revenue: 0, count: 0 });
        }
        const entry = typeMap.get(type)!;
        entry.revenue += Number(o.total || 0);
        entry.count += 1;
      });

      const typeLabels: Record<string, string> = {
        dine_in: 'Mesa',
        takeaway: 'Balcao',
        delivery: 'Delivery',
      };

      return Array.from(typeMap.entries())
        .map(([type, data]) => ({
          segment: typeLabels[type] || type,
          revenue: data.revenue,
          orders: data.count,
          averageTicket: data.count > 0 ? data.revenue / data.count : 0,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    },
    enabled: !!tenant?.id,
  });
};

export const useEmployeePerformance = (dateRange: DateRange) => {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['employee-performance', tenant?.id, dateRange],
    queryFn: async (): Promise<{ dineIn: EmployeePerformance[]; delivery: EmployeePerformance[] }> => {
      if (!tenant?.id) return { dineIn: [], delivery: [] };

      const ordersData = await listDeliveredOrders(tenant.id, dateRange);
      const userIds = [...new Set(ordersData.map((o) => o.created_by).filter(Boolean))] as string[];
      const profiles = await listProfilesByIds(userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));

      const dineInMap = new Map<string, { revenue: number; count: number; name: string }>();
      const deliveryMap = new Map<string, { revenue: number; count: number; name: string }>();

      ordersData.forEach((o) => {
        if (!o.created_by) return;
        const map = o.order_type === 'dine_in' ? dineInMap : deliveryMap;
        const employeeName = profileMap.get(o.created_by) || 'Desconhecido';

        if (!map.has(o.created_by)) {
          map.set(o.created_by, { revenue: 0, count: 0, name: employeeName });
        }
        const entry = map.get(o.created_by)!;
        entry.revenue += Number(o.total || 0);
        entry.count += 1;
      });

      const toPerformanceArray = (map: Map<string, { revenue: number; count: number; name: string }>): EmployeePerformance[] => {
        return Array.from(map.entries())
          .map(([id, data]) => ({
            employeeId: id,
            employeeName: data.name,
            revenue: data.revenue,
            orders: data.count,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      };

      return {
        dineIn: toPerformanceArray(dineInMap),
        delivery: toPerformanceArray(deliveryMap),
      };
    },
    enabled: !!tenant?.id,
  });
};
