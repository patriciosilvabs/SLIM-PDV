import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAudioNotification } from './useAudioNotification';
import { useKdsSettings } from './useKdsSettings';
import { differenceInMinutes } from 'date-fns';
import { resolveCurrentTenantId } from '@/lib/tenantResolver';
import { listOrderItemsByOrderIds, listOrdersByStatusAndDateRange } from '@/lib/firebaseTenantCrud';

export function useItemDelayAlert(enabled: boolean = true, tenantIdOverride?: string | null) {
  const { playItemDelayAlertSound } = useAudioNotification({
    enableRemote: enabled,
    tenantIdOverride,
  });
  const { settings } = useKdsSettings(tenantIdOverride, { enableTenantQuery: enabled });
  const lastAlertRef = useRef<number>(0);
  const alertCooldownMs = 60000;

  const { data: activeItems } = useQuery({
    queryKey: ['kds-active-items-for-alert'],
    queryFn: async () => {
      const tenantId = await resolveCurrentTenantId();
      if (!tenantId) return [];

      const activeOrders = await listOrdersByStatusAndDateRange(tenantId, {
        statuses: ['pending', 'preparing', 'ready'],
      });
      const orderIds = activeOrders.filter((order) => !order.is_draft).map((order) => order.id);
      if (!orderIds.length) return [];

      const items = await listOrderItemsByOrderIds(tenantId, orderIds);
      return items.filter((item) => item.current_station_id && item.station_status === 'waiting');
    },
    refetchInterval: 30000,
    enabled: enabled && settings.delayAlertEnabled,
  });

  useEffect(() => {
    if (!enabled || !settings.delayAlertEnabled || !activeItems?.length) return;

    const now = Date.now();
    const delayThreshold = settings.delayAlertMinutes;

    const hasDelayedItems = activeItems.some((item) => {
      const refTime = item.station_started_at || item.created_at;
      if (!refTime) return false;
      const elapsed = differenceInMinutes(new Date(), new Date(refTime));
      return elapsed >= delayThreshold;
    });

    if (hasDelayedItems && now - lastAlertRef.current > alertCooldownMs) {
      playItemDelayAlertSound();
      lastAlertRef.current = now;
    }
  }, [activeItems, enabled, settings.delayAlertEnabled, settings.delayAlertMinutes, playItemDelayAlertSound]);

  return null;
}
