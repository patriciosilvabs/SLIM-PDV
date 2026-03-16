import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useCallback, useEffect, useRef } from 'react';
import type { Order, OrderItem, OrderStatus } from './useOrders';

interface DeviceAuth {
  deviceId: string;
  deviceName: string;
  stationId: string | null;
  tenantId: string | null;
}

interface KdsDataResult {
  orders: Order[];
  settings: any;
  stations: any[];
  device?: {
    id: string;
    device_id: string;
    name: string;
    station_id: string | null;
    tenant_id?: string | null;
  } | null;
}

async function fetchKdsData(deviceAuth: DeviceAuth, action: string, extra: Record<string, any> = {}) {
  const { data, error } = await backendClient.functions.invoke('kds-data', {
    body: {
      action,
      device_id: deviceAuth.deviceId,
      tenant_id: deviceAuth.tenantId,
      ...extra,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Hook that fetches KDS data via function endpoint for device-only authentication.
 * Bypasses user-session restrictions because dedicated devices do not use the regular app auth flow.
 */
export function useKdsDeviceData(deviceAuth: DeviceAuth | null) {
  const queryClient = useQueryClient();
  const isDeviceMode = !!deviceAuth?.tenantId && !!deviceAuth?.deviceId;

  // Fetch all data (orders + settings + stations) in one call
  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
    queryFn: async () => {
      if (!deviceAuth) return null;
      const result = await fetchKdsData(deviceAuth, 'get_all', {
        statuses: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
      });
      return result as KdsDataResult;
    },
    enabled: isDeviceMode,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 300,
  });

  useEffect(() => {
    if (!isDeviceMode) return;

    const handleForegroundRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refetch();
    };

    document.addEventListener('visibilitychange', handleForegroundRefresh);
    window.addEventListener('focus', handleForegroundRefresh);
    window.addEventListener('online', handleForegroundRefresh);

    return () => {
      document.removeEventListener('visibilitychange', handleForegroundRefresh);
      window.removeEventListener('focus', handleForegroundRefresh);
      window.removeEventListener('online', handleForegroundRefresh);
    };
  }, [isDeviceMode, refetch]);

  // Mutations for device mode
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'update_order_status', {
        order_id: orderId,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const updateItemStation = useMutation({
    mutationFn: async ({ itemId, stationId, stationStatus }: { itemId: string; stationId?: string; stationStatus?: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'update_item_station', {
        item_id: itemId,
        station_id: stationId,
        station_status: stationStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const claimItem = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'claim_item', {
        item_id: itemId,
      });
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId] });
      const previous = queryClient.getQueryData(['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId]);
      const now = new Date().toISOString();

      queryClient.setQueryData(
        ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
        (old: KdsDataResult | null | undefined) => {
          if (!old) return old;
          return {
            ...old,
            orders: old.orders.map((order: any) => ({
              ...order,
              order_items: order.order_items?.map((item: any) =>
                item.id === itemId
                  ? {
                      ...item,
                      current_device_id: deviceAuth?.deviceId ?? item.current_device_id,
                      station_status: 'in_progress',
                      station_started_at: item.station_started_at ?? now,
                      claimed_by_device_id: deviceAuth?.deviceId ?? item.claimed_by_device_id,
                      claimed_at: now,
                    }
                  : item
              ),
            })),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
          context.previous
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const finalizeOrderFromStatus = useMutation({
    mutationFn: async ({
      orderId,
      orderType,
      currentStationId,
    }: {
      orderId: string;
      orderType?: string;
      currentStationId?: string;
    }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'finalize_order_from_status', {
        order_id: orderId,
        order_type: orderType,
        current_station_id: currentStationId,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  // Smart move: routes item to next station with load balancing
  const smartMoveItem = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'smart_move_item', {
        item_id: itemId,
        current_station_id: currentStationId,
      });
    },
    // Optimistic update: remove item from current station immediately
    onMutate: async ({ itemId, currentStationId }) => {
      await queryClient.cancelQueries({ queryKey: ['kds-device-data'] });
      const previous = queryClient.getQueryData(['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId]);

      queryClient.setQueryData(
        ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
        (old: KdsDataResult | null | undefined) => {
          if (!old) return old;
          return {
            ...old,
            orders: old.orders.map((order: any) => ({
              ...order,
              order_items: order.order_items?.map((item: any) =>
                item.id === itemId
                  ? { ...item, current_station_id: '__moving__', station_status: 'moving' }
                  : item
              ),
            })),
          };
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['kds-device-data', deviceAuth?.deviceId, deviceAuth?.tenantId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-device-data'] });
    },
  });

  const logStation = useMutation({
    mutationFn: async (params: { order_item_id: string; station_id: string; action: string; duration_seconds?: number; notes?: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'log_station', params);
    },
  });

  return {
    orders: (allData?.orders || []) as Order[],
    settings: allData?.settings || null,
    stations: allData?.stations || [],
    device: allData?.device || null,
    isLoading,
    refetch,
    updateOrderStatus,
    finalizeOrderFromStatus,
    updateItemStation,
    claimItem,
    smartMoveItem,
    logStation,
    isDeviceMode,
  };
}

