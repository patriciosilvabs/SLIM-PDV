import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useKdsStations } from './useKdsStations';
import { useKdsStationLogs } from './useKdsStationLogs';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { markItemAsRecentlyMoved } from './useOrders';
import {
  countOrderItemsAtDevice,
  countOrderItemsAtStation,
  getKdsGlobalSettings,
  getOrderItemById,
  listKdsDevices,
  listOrderItemExtrasByItemIds,
  listOrderItemsByOrderId,
  listOrderItemSubExtrasBySubItemIds,
  listOrderItemSubItemsByItemIds,
  updateOrderById,
  updateOrderItemById,
} from '@/lib/firebaseTenantCrud';

const KDS_DEVICE_ONLINE_WINDOW_MS = 30 * 1000;

function sortStationsByOrder<T extends { sort_order?: number | null; is_active?: boolean }>(stations: T[]): T[] {
  return [...stations]
    .filter((station) => station.is_active !== false)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function getStationsAtFirstOrder<T extends { sort_order?: number | null }>(stations: T[]): T[] {
  if (stations.length === 0) return [];
  const firstOrder = stations[0].sort_order ?? 0;
  return stations.filter((station) => (station.sort_order ?? 0) === firstOrder);
}

function getEntryStationsForItem<T extends { station_type: string; sort_order?: number | null; is_active?: boolean }>(
  stations: T[],
  hasBorder: boolean
): T[] {
  const sortedStations = sortStationsByOrder(stations);
  const nonTerminalStations = sortedStations.filter((station) => station.station_type !== 'order_status');
  if (nonTerminalStations.length === 0) return [];

  if (hasBorder) {
    const borderStations = nonTerminalStations.filter((station) => station.station_type === 'item_assembly');
    return getStationsAtFirstOrder(borderStations.length > 0 ? borderStations : nonTerminalStations);
  }

  const nonBorderStations = nonTerminalStations.filter((station) => station.station_type !== 'item_assembly');
  const prepStartStations = nonBorderStations.filter((station) => station.station_type === 'prep_start');
  const preferredStations = prepStartStations.length > 0 ? prepStartStations : nonBorderStations;
  return getStationsAtFirstOrder(preferredStations.length > 0 ? preferredStations : nonTerminalStations);
}

interface OrderItem {
  id: string;
  order_id: string;
  current_station_id: string | null;
  station_status: string;
  station_started_at: string | null;
  station_completed_at: string | null;
  product?: { name: string } | null;
  quantity: number;
}

interface OrderData {
  id: string;
  order_items: OrderItem[];
  [key: string]: unknown;
}

export function useKdsWorkflow() {
  const queryClient = useQueryClient();
  const { activeStations, orderStatusStation, orderStatusStations } = useKdsStations();
  const { logAction } = useKdsStationLogs();
  const { user } = useAuth();
  const { tenantId } = useTenant();

  const orderStatusStationIds = orderStatusStations?.map((s) => s.id) || [];

  const findLeastBusyDeviceForStation = async (stationId: string): Promise<string | null> => {
    if (!tenantId) return null;

    const devices = await listKdsDevices(tenantId);
    const stationDevices = devices.filter((device) => {
      if (device.is_active === false) return false;
      if (device.station_id !== stationId) return false;
      const lastSeenAt = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
      return Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt < KDS_DEVICE_ONLINE_WINDOW_MS;
    });

    if (!stationDevices.length) return null;
    if (stationDevices.length === 1) return stationDevices[0].device_id;

    let selectedDeviceId = stationDevices[0].device_id;
    let lowestLoad = Number.POSITIVE_INFINITY;

    for (const device of stationDevices) {
      const load = await countOrderItemsAtDevice(tenantId, device.device_id, ['waiting', 'in_progress']);
      if (load < lowestLoad) {
        lowestLoad = load;
        selectedDeviceId = device.device_id;
      }
    }

    return selectedDeviceId;
  };

  const getSmartNextStation = async (currentStationId: string, orderType?: string): Promise<{ id: string; type: string } | null> => {
    const sortedStations = sortStationsByOrder(activeStations);
    const currentStation = sortedStations.find((s) => s.id === currentStationId);
    if (!currentStation) {
      const next = sortedStations.find((station) => station.id !== currentStationId) ?? null;
      return next ? { id: next.id, type: next.station_type } : null;
    }

    if (currentStation.station_type === 'order_status') {
      if (orderType === 'dine_in') {
        const nextOrderStatus = sortedStations
          ?.filter((s) => s.is_active && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
          .filter((s) => s.station_type === 'order_status')
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
        if (nextOrderStatus) return { id: nextOrderStatus.id, type: 'order_status' };
        return null;
      }
      return null;
    }

    const next = sortedStations
      .filter((station) => station.is_active && (station.sort_order ?? 0) > (currentStation.sort_order ?? 0))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
    if (next) return { id: next.id, type: next.station_type };
    return null;
  };

  const moveItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId, orderType }: { itemId: string; currentStationId: string; orderType?: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const now = new Date().toISOString();
      const target = await getSmartNextStation(currentStationId, orderType);
      const targetStationId = target?.id || null;
      const targetDeviceId = targetStationId ? await findLeastBusyDeviceForStation(targetStationId) : null;

      if (targetStationId) {
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: targetStationId,
          current_device_id: targetDeviceId,
          station_status: 'waiting',
          station_started_at: null,
          station_completed_at: now,
        });
      } else {
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: null,
          current_device_id: null,
          station_status: 'done',
          station_completed_at: now,
          status: 'ready',
          ready_at: now as never,
        });
      }

      Promise.all([
        logAction.mutateAsync({ orderItemId: itemId, stationId: currentStationId, action: 'completed' }).catch(() => {}),
        targetStationId
          ? logAction.mutateAsync({ orderItemId: itemId, stationId: targetStationId, action: 'entered' }).catch(() => {})
          : Promise.resolve(),
      ]);

      if (!targetStationId || target?.type === 'order_status') {
        const itemData = await getOrderItemById(tenantId, itemId);
        if (itemData?.order_id) {
          const allItems = await listOrderItemsByOrderId(tenantId, itemData.order_id);
          const allItemsReady = allItems.every(
            (item) =>
              (item.current_station_id && orderStatusStationIds.includes(item.current_station_id)) ||
              item.station_status === 'done'
          );

          if (allItemsReady) {
            await updateOrderById(tenantId, itemData.order_id, {
              status: 'ready',
              ready_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as never);
          }
        }
      }

      return { itemId, nextStationId: targetStationId, isComplete: !targetStationId };
    },
    onMutate: async ({ itemId, currentStationId, orderType }) => {
      markItemAsRecentlyMoved(itemId);
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData(['orders']);

      const currentStation = activeStations.find((s) => s.id === currentStationId);
      let targetStationId: string | null = null;

      if (currentStation?.station_type === 'order_status') {
        if (orderType === 'dine_in') {
          const nextOrderStatus = sortStationsByOrder(orderStatusStations || [])
            ?.filter((s) => s.is_active && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
          targetStationId = nextOrderStatus?.id || null;
        }
      } else {
        const nextStation = sortStationsByOrder(activeStations)
          .filter((station) => station.is_active && (station.sort_order ?? 0) > ((currentStation?.sort_order ?? 0)))
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
        targetStationId = nextStation?.id || null;
      }

      queryClient.setQueryData(['orders'], (old: OrderData[] | undefined) => {
        if (!old) return old;
        return old.map((order) => ({
          ...order,
          order_items:
            order.order_items?.map((item: OrderItem) =>
              item.id === itemId
                ? {
                    ...item,
                    current_station_id: targetStationId,
                    station_status: targetStationId ? 'waiting' : 'done',
                    station_started_at: null,
                    status: targetStationId ? item.status : 'ready',
                    ready_at: targetStationId ? null : now,
                  }
                : item
            ) || [],
        }));
      });

      return { previousOrders };
    },
    onError: (error, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error('Erro ao mover item');
      console.error(error);
    },
    onSuccess: (result) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }, 2000);
      queryClient.invalidateQueries({ queryKey: ['kds-station-history'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
      if (result.isComplete) {
        toast.success('Item concluido!');
      }
    },
  });

  const startItemAtStation = useMutation({
    mutationFn: async ({ itemId, stationId }: { itemId: string; stationId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const now = new Date().toISOString();

      await updateOrderItemById(tenantId, itemId, {
        current_station_id: stationId,
        station_status: 'in_progress',
        station_started_at: now,
      });

      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId,
        action: 'started',
      });

      return { itemId, stationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      toast.error('Erro ao iniciar item na praca');
      console.error(error);
    },
  });

  const completeItemAtStation = useMutation({
    mutationFn: async ({ itemId, currentStationId }: { itemId: string; currentStationId: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const now = new Date().toISOString();
      const item = await getOrderItemById(tenantId, itemId);
      const durationSeconds = item?.station_started_at
        ? Math.floor((Date.now() - new Date(item.station_started_at).getTime()) / 1000)
        : null;

      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'completed',
        durationSeconds: durationSeconds || undefined,
      });

      const nextStation = await getSmartNextStation(currentStationId);
      const nextDeviceId = nextStation ? await findLeastBusyDeviceForStation(nextStation.id) : null;

      if (nextStation) {
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: nextStation.id,
          current_device_id: nextDeviceId,
          station_status: 'waiting',
          station_started_at: null,
          station_completed_at: now,
        });

        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        });

        return { itemId, nextStationId: nextStation.id, isComplete: false };
      }

      const itemData = await getOrderItemById(tenantId, itemId);
      if (orderStatusStation) {
        const orderStatusDeviceId = await findLeastBusyDeviceForStation(orderStatusStation.id);
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: orderStatusStation.id,
          current_device_id: orderStatusDeviceId,
          station_status: 'waiting',
          station_started_at: null,
          station_completed_at: now,
        });

        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: orderStatusStation.id,
          action: 'entered',
        });
      } else {
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: null,
          station_status: 'done',
          station_completed_at: now,
          status: 'ready',
          ready_at: now as never,
        });
      }

      if (itemData?.order_id) {
        const allItems = await listOrderItemsByOrderId(tenantId, itemData.order_id);
        const allItemsReady = allItems.every(
          (orderItem) =>
            (orderItem.current_station_id && orderStatusStationIds.includes(orderItem.current_station_id)) ||
            orderItem.station_status === 'done'
        );

        if (allItemsReady) {
          await updateOrderById(tenantId, itemData.order_id, {
            status: 'ready',
            ready_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never);
        }
      }

      return { itemId, nextStationId: orderStatusStation?.id || null, isComplete: !orderStatusStation };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (result.isComplete) {
        toast.success('Item concluido!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao completar item');
      console.error(error);
    },
  });

  const skipItemToNextStation = useMutation({
    mutationFn: async ({ itemId, currentStationId, reason }: { itemId: string; currentStationId: string; reason?: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await logAction.mutateAsync({
        orderItemId: itemId,
        stationId: currentStationId,
        action: 'skipped',
        notes: reason,
      });

      const nextStation = await getSmartNextStation(currentStationId);
      const nextDeviceId = nextStation ? await findLeastBusyDeviceForStation(nextStation.id) : null;
      if (nextStation) {
        await updateOrderItemById(tenantId, itemId, {
          current_station_id: nextStation.id,
          current_device_id: nextDeviceId,
          station_status: 'waiting',
          station_started_at: null,
        });

        await logAction.mutateAsync({
          orderItemId: itemId,
          stationId: nextStation.id,
          action: 'entered',
        });
      }

      return { itemId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.info('Item pulado para proxima praca');
    },
  });

  const serveItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const now = new Date().toISOString();
      const itemData = await getOrderItemById(tenantId, itemId);

      await updateOrderItemById(tenantId, itemId, {
        served_at: now,
      });

      if (itemData?.current_station_id) {
        logAction
          .mutateAsync({
            orderItemId: itemId,
            stationId: itemData.current_station_id,
            action: 'completed',
            notes: 'Item servido',
          })
          .catch(() => {});
      }

      return { itemId, servedAt: now };
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData(['orders']);

      queryClient.setQueryData(['orders'], (old: OrderData[] | undefined) => {
        if (!old) return old;
        return old.map((order) => ({
          ...order,
          order_items:
            order.order_items?.map((item: OrderItem) => (item.id === itemId ? { ...item, served_at: new Date().toISOString() } : item)) || [],
        }));
      });

      return { previousOrders };
    },
    onError: (error, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error('Erro ao marcar item como servido');
      console.error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
      toast.success('Item servido!');
    },
  });

  const finalizeOrderFromStatus = useMutation({
    mutationFn: async ({ orderId, orderType, currentStationId }: { orderId: string; orderType?: string; currentStationId?: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const now = new Date().toISOString();

      if (orderType === 'dine_in' && currentStationId) {
        const currentStation = activeStations.find((s) => s.id === currentStationId);
        if (currentStation) {
          const nextOrderStatus = orderStatusStations
            ?.filter((s) => s.is_active && s.station_type === 'order_status' && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

          if (nextOrderStatus) {
            const items = await listOrderItemsByOrderId(tenantId, orderId);
            for (const item of items) {
              if (item.current_station_id) {
                await logAction.mutateAsync({
                  orderItemId: item.id,
                  stationId: item.current_station_id,
                  action: 'completed',
                }).catch(() => {});
              }

              await updateOrderItemById(tenantId, item.id, {
                current_station_id: nextOrderStatus.id,
                current_device_id: await findLeastBusyDeviceForStation(nextOrderStatus.id),
                station_status: 'waiting',
                station_started_at: null,
                station_completed_at: now,
              });

              await logAction.mutateAsync({
                orderItemId: item.id,
                stationId: nextOrderStatus.id,
                action: 'entered',
              }).catch(() => {});
            }

            return { orderId, movedToStation: nextOrderStatus.name };
          }
        }
      }

      const items = await listOrderItemsByOrderId(tenantId, orderId);
      for (const item of items) {
        if (item.current_station_id && orderStatusStationIds.includes(item.current_station_id)) {
          await logAction.mutateAsync({
            orderItemId: item.id,
            stationId: item.current_station_id,
            action: 'completed',
          });
        }

        await updateOrderItemById(tenantId, item.id, {
          current_station_id: null,
          current_device_id: null,
          station_status: 'done',
          station_completed_at: now,
          status: 'delivered',
          served_at: item.served_at || now,
        });
      }

      await updateOrderById(tenantId, orderId, {
        status: 'delivered',
        delivered_at: now,
        updated_at: now,
      });

      return { orderId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kds-all-stations-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['kds-station-history'] });
      if ('movedToStation' in result && result.movedToStation) {
        toast.success(`Pedido movido para ${result.movedToStation}`);
      } else {
        toast.success('Pedido entregue!');
      }
    },
    onError: (error) => {
      toast.error('Erro ao finalizar pedido');
      console.error(error);
    },
  });

  const initializeOrderForProductionLine = useMutation({
    mutationFn: async (orderId: string) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      if (activeStations.length === 0) throw new Error('Nenhuma praca ativa configurada');

      const allItems = await listOrderItemsByOrderId(tenantId, orderId);
      const items = allItems.filter((item) => !item.current_station_id);
      const itemIds = items.map((item) => item.id);
      const [extras, subItems, settings] = await Promise.all([
        listOrderItemExtrasByItemIds(tenantId, itemIds),
        listOrderItemSubItemsByItemIds(tenantId, itemIds),
        getKdsGlobalSettings(tenantId),
      ]);
      const subExtras = await listOrderItemSubExtrasBySubItemIds(tenantId, subItems.map((subItem) => subItem.id));

      const borderKws = settings?.border_keywords || ['borda', 'recheada', 'chocolate', 'catupiry', 'cheddar'];
      const sortedStations = sortStationsByOrder(activeStations);
      const firstStation = sortedStations[0];
      const loadCounts: Record<string, number> = {};
      for (const station of sortedStations.filter((station) => station.station_type !== 'order_status')) {
        loadCounts[station.id] = await countOrderItemsAtStation(tenantId, station.id, ['waiting', 'in_progress']);
      }

      const extrasByItemId = new Map<string, string[]>();
      extras.forEach((extra) => {
        const current = extrasByItemId.get(extra.order_item_id) || [];
        current.push((extra.extra_name || '').toLowerCase());
        extrasByItemId.set(extra.order_item_id, current);
      });

      const subItemIdsByItemId = new Map<string, string[]>();
      subItems.forEach((subItem) => {
        const current = subItemIdsByItemId.get(subItem.order_item_id) || [];
        current.push(subItem.id);
        subItemIdsByItemId.set(subItem.order_item_id, current);
      });

      const borderTextByItemId = new Map<string, string>();
      items.forEach((item) => {
        const subItemIds = subItemIdsByItemId.get(item.id) || [];
        const borderExtras = subExtras
          .filter((extra) => subItemIds.includes(extra.sub_item_id) && extra.kds_category === 'border')
          .map((extra) => (extra.option_name || '').toLowerCase());
        const allText = [item.notes || '', ...(extrasByItemId.get(item.id) || []), ...borderExtras].join(' ').toLowerCase();
        borderTextByItemId.set(item.id, allText);
      });

      for (const item of items) {
        const combinedText = borderTextByItemId.get(item.id) || '';
        const hasBorder = borderKws.some((kw: string) => combinedText.includes(kw.toLowerCase()));

        const entryStations = getEntryStationsForItem(sortedStations, hasBorder);
        const candidateStations = entryStations.length > 0 ? entryStations : (firstStation ? [firstStation] : []);
        if (candidateStations.length === 0) continue;

        let targetStationId = candidateStations[0].id;
        let minCount = loadCounts[targetStationId] ?? Infinity;
        for (const station of candidateStations) {
          if ((loadCounts[station.id] ?? 0) < minCount) {
            minCount = loadCounts[station.id] ?? 0;
            targetStationId = station.id;
          }
        }
        loadCounts[targetStationId] = (loadCounts[targetStationId] || 0) + 1;

        await updateOrderItemById(tenantId, item.id, {
          current_station_id: targetStationId,
          current_device_id: await findLeastBusyDeviceForStation(targetStationId),
          station_status: 'waiting',
        });

        await logAction.mutateAsync({
          orderItemId: item.id,
          stationId: targetStationId,
          action: 'entered',
        }).catch(() => {});
      }

      await updateOrderById(tenantId, orderId, {
        status: 'preparing',
        updated_at: new Date().toISOString(),
      });

      return { orderId, itemCount: items.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Pedido iniciado com ${result.itemCount} itens`);
    },
    onError: (error) => {
      toast.error('Erro ao iniciar pedido');
      console.error(error);
    },
  });

  const getItemsByStation = (items: OrderItem[], stationId: string) => {
    return items.filter((item) => item.current_station_id === stationId);
  };

  const getWaitingItems = (items: OrderItem[]) => {
    return items.filter((item) => !item.current_station_id && item.station_status !== 'done');
  };

  return {
    moveItemToNextStation,
    startItemAtStation,
    completeItemAtStation,
    skipItemToNextStation,
    initializeOrderForProductionLine,
    finalizeOrderFromStatus,
    serveItem,
    getItemsByStation,
    getWaitingItems,
    orderStatusStation,
  };
}
