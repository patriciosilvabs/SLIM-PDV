import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface KdsStationLog {
  id: string;
  order_item_id: string;
  station_id: string;
  action: 'entered' | 'started' | 'completed' | 'skipped';
  performed_by: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export function useKdsStationLogs() {
  const { user } = useAuth();

  // Registrar ação no log
  const logAction = useMutation({
    mutationFn: async ({
      orderItemId,
      stationId,
      action,
      durationSeconds,
      notes,
    }: {
      orderItemId: string;
      stationId: string;
      action: KdsStationLog['action'];
      durationSeconds?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('kds_station_logs')
        .insert({
          order_item_id: orderItemId,
          station_id: stationId,
          action,
          performed_by: user?.id,
          duration_seconds: durationSeconds,
          notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Buscar logs de um item específico
  const useItemLogs = (orderItemId: string) => {
    return useQuery({
      queryKey: ['kds-station-logs', orderItemId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('kds_station_logs')
          .select('*')
          .eq('order_item_id', orderItemId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data as KdsStationLog[];
      },
      enabled: !!orderItemId,
    });
  };

  // Buscar métricas por praça (últimas 24h)
  const useStationMetrics = (stationId: string) => {
    return useQuery({
      queryKey: ['kds-station-metrics', stationId],
      queryFn: async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data, error } = await supabase
          .from('kds_station_logs')
          .select('*')
          .eq('station_id', stationId)
          .eq('action', 'completed')
          .gte('created_at', yesterday.toISOString());

        if (error) throw error;

        const logs = data as KdsStationLog[];
        const durations = logs
          .map(l => l.duration_seconds)
          .filter((d): d is number => d !== null);

        const averageSeconds = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        const minSeconds = durations.length > 0 ? Math.min(...durations) : 0;
        const maxSeconds = durations.length > 0 ? Math.max(...durations) : 0;

        return {
          totalCompleted: logs.length,
          averageSeconds,
          minSeconds,
          maxSeconds,
          averageMinutes: Math.round(averageSeconds / 60),
        };
      },
      enabled: !!stationId,
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  };

  return {
    logAction,
    useItemLogs,
    useStationMetrics,
  };
}
