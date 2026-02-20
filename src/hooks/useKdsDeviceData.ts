import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
}

async function fetchKdsData(deviceAuth: DeviceAuth, action: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke('kds-data', {
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
 * Hook that fetches KDS data via edge function for device-only authentication.
 * Bypasses RLS since devices don't have a Supabase user session.
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
    refetchInterval: 5000, // Poll every 5 seconds since no realtime without session
    staleTime: 2000,
  });

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

  // Smart move: routes item to next station with load balancing
  const smartMoveItem = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      if (!deviceAuth) throw new Error('No device auth');
      return fetchKdsData(deviceAuth, 'smart_move_item', {
        item_id: itemId,
        current_station_id: currentStationId,
      });
    },
    onSuccess: () => {
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
    isLoading,
    refetch,
    updateOrderStatus,
    updateItemStation,
    smartMoveItem,
    logStation,
    isDeviceMode,
  };
}
