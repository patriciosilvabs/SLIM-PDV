import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface MonthlyRevenueData {
  month: string;
  monthNum: number;
  currentYear: number;
  lastYear: number;
  variation: number;
}

export function useMonthlyRevenue(months: number = 6) {
  return useQuery({
    queryKey: ['monthly-revenue', months],
    queryFn: async () => {
      const now = new Date();
      const data: MonthlyRevenueData[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const currentDate = subMonths(now, i);
        const lastYearDate = subMonths(currentDate, 12);

        // Current year data
        const currentStart = startOfMonth(currentDate);
        const currentEnd = endOfMonth(currentDate);

        const { data: currentOrders } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', currentStart.toISOString())
          .lte('created_at', currentEnd.toISOString())
          .eq('status', 'delivered');

        // Last year data
        const lastStart = startOfMonth(lastYearDate);
        const lastEnd = endOfMonth(lastYearDate);

        const { data: lastOrders } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', lastStart.toISOString())
          .lte('created_at', lastEnd.toISOString())
          .eq('status', 'delivered');

        const currentYear = currentOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
        const lastYear = lastOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
