import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { listOrdersByStatusAndDateRange } from '@/lib/firebaseTenantCrud';
import { useTenant } from '@/hooks/useTenant';

export interface MonthlyRevenueData {
  month: string;
  monthNum: number;
  currentYear: number;
  lastYear: number;
  variation: number;
}

export function useMonthlyRevenue(months: number = 6) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['monthly-revenue', tenant?.id, months],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const now = new Date();
      const data: MonthlyRevenueData[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const currentDate = subMonths(now, i);
        const lastYearDate = subMonths(currentDate, 12);

        const currentStart = startOfMonth(currentDate);
        const currentEnd = endOfMonth(currentDate);
        const lastStart = startOfMonth(lastYearDate);
        const lastEnd = endOfMonth(lastYearDate);

        const [currentOrders, lastOrders] = await Promise.all([
          listOrdersByStatusAndDateRange(tenant.id, {
            statuses: ['delivered'],
            startIso: currentStart.toISOString(),
            endIso: currentEnd.toISOString(),
          }),
          listOrdersByStatusAndDateRange(tenant.id, {
            statuses: ['delivered'],
            startIso: lastStart.toISOString(),
            endIso: lastEnd.toISOString(),
          }),
        ]);

        const currentYear = currentOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const lastYear = lastOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const variation = lastYear > 0 ? ((currentYear - lastYear) / lastYear) * 100 : 0;

        data.push({
          month: format(currentDate, 'MMM', { locale: ptBR }),
          monthNum: currentDate.getMonth(),
          currentYear,
          lastYear,
          variation,
        });
      }

      return data;
    },
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 5,
  });
}
