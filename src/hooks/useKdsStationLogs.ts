import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useKdsStations } from './useKdsStations';
import { useTenant } from './useTenant';
import {
  createKdsStationLog,
  listKdsStationLogs,
  listOrderItemsByOrderIds,
  listOrdersByStatusAndDateRange,
} from '@/lib/firebaseTenantCrud';

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

export interface StationMetrics {
  stationId: string;
  stationName: string;
  stationColor: string;
  totalCompleted: number;
  averageSeconds: number;
  averageMinutes: number;
  minSeconds: number;
  maxSeconds: number;
  currentQueue: number;
  inProgress: number;
}

export interface PerformanceDataPoint {
  hour: string;
  stationId: string;
  avgSeconds: number;
  count: number;
}

export interface BottleneckInfo {
  stationId: string;
  stationName: string;
  stationColor: string;
  avgTime: number;
  queueSize: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

export function useKdsStationLogs() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

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
      if (!tenantId) throw new Error('Tenant nao encontrado');
      return await createKdsStationLog(tenantId, {
        order_item_id: orderItemId,
        station_id: stationId,
        action,
        performed_by: user?.id || null,
        duration_seconds: durationSeconds || null,
        notes: notes || null,
      });
    },
  });

  const useItemLogs = (orderItemId: string) => {
    return useQuery({
      queryKey: ['kds-station-logs', tenantId, orderItemId],
      queryFn: async () => {
        if (!tenantId) return [];
        return (await listKdsStationLogs(tenantId, { orderItemId })) as KdsStationLog[];
      },
      enabled: !!tenantId && !!orderItemId,
    });
  };

  const useStationMetrics = (stationId: string) => {
    return useQuery({
      queryKey: ['kds-station-metrics', tenantId, stationId],
      queryFn: async () => {
        if (!tenantId) {
          return {
            totalCompleted: 0,
            averageSeconds: 0,
            minSeconds: 0,
            maxSeconds: 0,
            averageMinutes: 0,
          };
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const logs = (await listKdsStationLogs(tenantId, {
          stationId,
          action: 'completed',
          createdAfter: yesterday.toISOString(),
        })) as KdsStationLog[];

        const durations = logs.map((l) => l.duration_seconds).filter((d): d is number => d !== null);
        const averageSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
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
      enabled: !!tenantId && !!stationId,
      staleTime: 1000 * 60 * 5,
    });
  };

  return {
    logAction,
    useItemLogs,
    useStationMetrics,
  };
}

export function useAllStationsMetrics(enabled: boolean = true, tenantIdOverride?: string | null) {
  const { activeStations } = useKdsStations({ enabled, tenantIdOverride });
  const { tenantId } = useTenant();
  const effectiveTenantId = tenantIdOverride || tenantId;

  return useQuery({
    queryKey: ['kds-all-stations-metrics', activeStations.map((s) => s.id), effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [logs, activeOrders] = await Promise.all([
        listKdsStationLogs(effectiveTenantId, {
          action: 'completed',
          createdAfter: yesterday.toISOString(),
        }),
        listOrdersByStatusAndDateRange(effectiveTenantId, {
          statuses: ['pending', 'preparing', 'ready'],
        }),
      ]);

      const activeOrderIds = activeOrders.filter((order) => !('is_draft' in order) || !(order as { is_draft?: boolean }).is_draft).map((order) => order.id);
      const items = await listOrderItemsByOrderIds(effectiveTenantId, activeOrderIds);
      const visibleItems = items.filter((item) => item.current_station_id && item.station_status !== 'done');

      const metrics: StationMetrics[] = activeStations.map((station) => {
        const stationLogs = logs.filter((log) => log.station_id === station.id);
        const durations = stationLogs.map((log) => log.duration_seconds).filter((d): d is number => d !== null);
        const averageSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
        const queueItems = visibleItems.filter((item) => item.current_station_id === station.id && item.station_status === 'waiting');
        const inProgressItems = visibleItems.filter((item) => item.current_station_id === station.id && item.station_status === 'in_progress');

        return {
          stationId: station.id,
          stationName: station.name,
          stationColor: station.color,
          totalCompleted: stationLogs.length,
          averageSeconds,
          averageMinutes: Math.round(averageSeconds / 60),
          minSeconds: durations.length > 0 ? Math.min(...durations) : 0,
          maxSeconds: durations.length > 0 ? Math.max(...durations) : 0,
          currentQueue: queueItems.length,
          inProgress: inProgressItems.length,
        };
      });

      return metrics;
    },
    enabled: enabled && activeStations.length > 0 && !!effectiveTenantId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });
}

export function useStationPerformanceHistory() {
  const { activeStations } = useKdsStations();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['kds-performance-history', tenantId, activeStations.map((s) => s.id)],
    queryFn: async () => {
      if (!tenantId) return { dataPoints: [], stations: activeStations };

      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const logs = (await listKdsStationLogs(tenantId, {
        action: 'completed',
        createdAfter: sixHoursAgo.toISOString(),
      })) as KdsStationLog[];

      const hourlyData: Record<string, Record<string, { total: number; count: number }>> = {};

      logs.forEach((log) => {
        const hour =
          new Date(log.created_at)
            .toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
            .split(':')[0] + ':00';

        if (!hourlyData[hour]) hourlyData[hour] = {};
        if (!hourlyData[hour][log.station_id]) {
          hourlyData[hour][log.station_id] = { total: 0, count: 0 };
        }

        if (log.duration_seconds) {
          hourlyData[hour][log.station_id].total += log.duration_seconds;
          hourlyData[hour][log.station_id].count += 1;
        }
      });

      const dataPoints: PerformanceDataPoint[] = [];
      Object.entries(hourlyData).forEach(([hour, stations]) => {
        Object.entries(stations).forEach(([stationId, data]) => {
          dataPoints.push({
            hour,
            stationId,
            avgSeconds: data.count > 0 ? Math.round(data.total / data.count) : 0,
            count: data.count,
          });
        });
      });

      return {
        dataPoints,
        stations: activeStations,
      };
    },
    enabled: activeStations.length > 0 && !!tenantId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useBottleneckAnalysis(customThresholds?: {
  defaultMaxQueueSize: number;
  defaultMaxTimeRatio: number;
  stationOverrides: Record<string, { maxQueueSize?: number; maxTimeRatio?: number; alertsEnabled?: boolean }>;
}, enabled: boolean = true, tenantIdOverride?: string | null) {
  const { data: metrics } = useAllStationsMetrics(enabled, tenantIdOverride);

  const thresholds = customThresholds ?? {
    defaultMaxQueueSize: 5,
    defaultMaxTimeRatio: 1.5,
    stationOverrides: {},
  };

  return useQuery({
    queryKey: ['kds-bottleneck-analysis', metrics, thresholds],
    queryFn: async () => {
      if (!metrics || metrics.length === 0) return [];

      const avgAllStations = metrics.reduce((sum, m) => sum + m.averageSeconds, 0) / metrics.length;
      const bottlenecks: BottleneckInfo[] = [];

      metrics.forEach((m) => {
        const stationOverride = thresholds.stationOverrides[m.stationId];
        if (stationOverride?.alertsEnabled === false) return;

        const maxQueueSize = stationOverride?.maxQueueSize ?? thresholds.defaultMaxQueueSize;
        const maxTimeRatio = stationOverride?.maxTimeRatio ?? thresholds.defaultMaxTimeRatio;

        let severity: BottleneckInfo['severity'] = 'low';
        let reason = '';

        const timeRatio = avgAllStations > 0 ? m.averageSeconds / avgAllStations : 0;
        const timeExcessRatio = timeRatio / maxTimeRatio;
        if (timeExcessRatio > 1.4) {
          severity = 'critical';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da media (limite: ${Math.round((maxTimeRatio - 1) * 100)}%)`;
        } else if (timeExcessRatio > 1.15) {
          severity = 'high';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da media`;
        } else if (timeRatio > maxTimeRatio) {
          severity = 'medium';
          reason = `Tempo ${Math.round((timeRatio - 1) * 100)}% acima da media`;
        }

        const queueExcessRatio = m.currentQueue / maxQueueSize;
        if (queueExcessRatio > 1.6) {
          severity = 'critical';
          reason = `Fila com ${m.currentQueue} itens (limite: ${maxQueueSize})`;
        } else if (queueExcessRatio > 1.2) {
          if (severity !== 'critical') severity = 'high';
          reason = reason || `Fila com ${m.currentQueue} itens`;
        } else if (m.currentQueue > maxQueueSize) {
          if (severity === 'low') severity = 'medium';
          reason = reason || `Fila com ${m.currentQueue} itens`;
        }

        if (severity !== 'low') {
          bottlenecks.push({
            stationId: m.stationId,
            stationName: m.stationName,
            stationColor: m.stationColor,
            avgTime: m.averageSeconds,
            queueSize: m.currentQueue,
            severity,
            reason,
          });
        }
      });

      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      return bottlenecks;
    },
    enabled: enabled && !!metrics && metrics.length > 0,
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 10,
  });
}


