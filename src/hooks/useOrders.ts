import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendClient } from '@/integrations/backend/client';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';
import { useTenant } from './useTenant';
import {
  countOrderItemsAtDevice,
  createOrder,
  createOrderItem,
  createOrderItemCancellation,
  createOrderItemExtras,
  createOrderItemSubExtras,
  createOrderItemSubItems,
  deleteOrderItemCascade,
  getOrderById,
  getOrderItemById,
  listKdsStations,
  listKdsDevices,
  listOrderItemExtrasByItemIds,
  listOrderItemsByIds,
  listOrderItemsByOrderIds,
  listOrderItemsByOrderId,
  listOrderItemSubExtrasBySubItemIds,
  listOrderItemSubItemsByItemIds,
  listOrderItemTotalsByOrder,
  listOrdersByStatusAndDateRange,
  listProductVariations,
  listProducts,
  listProfilesByIds,
  listTables,
  updateOrderById,
  updateOrderItemById,
} from '@/lib/firebaseTenantCrud';

const recentlyMovedItems = new Map<string, number>();
const KDS_DEVICE_ONLINE_WINDOW_MS = 30 * 1000;

export function markItemAsRecentlyMoved(itemId: string) {
  recentlyMovedItems.set(itemId, Date.now());
  setTimeout(() => recentlyMovedItems.delete(itemId), 5000);
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItemStation {
  id: string;
  name: string;
  station_type: string;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
}

export interface OrderItemSubExtra {
  id: string;
  group_name: string;
  option_name: string;
  price: number;
  quantity: number;
}

export interface OrderItemSubItem {
  id: string;
  sub_item_index: number;
  notes: string | null;
  sub_extras: OrderItemSubExtra[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  added_by?: string | null;
  current_station_id?: string | null;
  current_device_id?: string | null;
  station_status?: 'waiting' | 'in_progress' | 'completed' | 'done' | null;
  served_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancelled_station_id?: string | null;
  cancelled_device_id?: string | null;
  cancelled_station_status?: string | null;
  claimed_by_device_id?: string | null;
  claimed_at?: string | null;
  current_device_name?: string | null;
  next_device_name?: string | null;
  next_device_station_type?: string | null;
  product?: { name: string; image_url: string | null };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number; kds_category?: string }[] | null;
  current_station?: OrderItemStation | null;
  added_by_profile?: { name: string } | null;
  sub_items?: OrderItemSubItem[] | null;
}

export interface Order {
  id: string;
  table_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  party_size?: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ready_at?: string | null;
  served_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  status_before_cancellation?: OrderStatus | null;
  is_draft?: boolean;
  table?: { number: number } | null;
  order_items?: OrderItem[];
  created_by_profile?: { name: string } | null;
}

function canAssignItemToKds(item: {
  status?: string | null;
  served_at?: string | null;
  cancelled_at?: string | null;
  station_status?: string | null;
}) {
  if (item.cancelled_at || item.served_at) return false;
  if (item.status === 'cancelled' || item.status === 'delivered') return false;
  if (item.station_status === 'completed' || item.station_status === 'done') return false;
  return true;
}

function isDeviceOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < KDS_DEVICE_ONLINE_WINDOW_MS;
}

type ResolvedRoutingDevice = {
  id: string;
  device_id: string;
  name: string;
  station_id: string;
  station_type: string | null;
  routing_mode: 'default' | 'keywords';
  routing_keywords: string[];
  is_entry_device: boolean;
  next_device_ids: string[];
  next_device_id: string | null;
  last_seen_at: string | null;
  is_active: boolean;
};

function normalizeRoutingMode(value: unknown): 'default' | 'keywords' {
  return value === 'keywords' ? 'keywords' : 'default';
}

function normalizeRoutingKeywords(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function normalizeNextDeviceIds(value: unknown, fallback?: unknown): string[] {
  if (Array.isArray(value)) {
    const nextIds = value
      .map((deviceId) => String(deviceId || '').trim())
      .filter(Boolean);
    if (nextIds.length) {
      return Array.from(new Set(nextIds));
    }
  }

  const legacyId = fallback ? String(fallback).trim() : '';
  return legacyId ? [legacyId] : [];
}

function inferLegacyEntryDevice(stationType?: string | null) {
  return stationType === 'item_assembly' || stationType === 'prep_start' || stationType === 'assembly';
}

function resolveRoutingDevices(
  devices: Array<{
    id: string;
    device_id: string;
    name: string;
    station_id: string | null;
    routing_mode?: 'default' | 'keywords';
    routing_keywords?: string[];
    is_entry_device?: boolean;
    next_device_ids?: string[];
    next_device_id?: string | null;
    last_seen_at: string;
    is_active: boolean;
  }>,
  stationMap: Map<string, { station_type: string }>
): ResolvedRoutingDevice[] {
  return devices
    .filter((device) => device.is_active !== false && !!device.station_id)
    .map((device) => {
      const stationType = device.station_id ? stationMap.get(device.station_id)?.station_type ?? null : null;
      const nextDeviceIds = normalizeNextDeviceIds(device.next_device_ids, device.next_device_id);
      return {
        id: device.id,
        device_id: device.device_id,
        name: device.name,
        station_id: device.station_id!,
        station_type: stationType,
        routing_mode: normalizeRoutingMode(device.routing_mode),
        routing_keywords: normalizeRoutingKeywords(device.routing_keywords),
        is_entry_device:
          typeof device.is_entry_device === 'boolean'
            ? Boolean(device.is_entry_device)
            : inferLegacyEntryDevice(stationType),
        next_device_ids: nextDeviceIds,
        next_device_id: nextDeviceIds[0] || null,
        last_seen_at: device.last_seen_at || null,
        is_active: device.is_active !== false,
      };
    });
}

function sortStationsByFlow<T extends { sort_order?: number | null; is_active?: boolean | null }>(stations: T[]) {
  return [...stations]
    .filter((station) => station.is_active !== false)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function getEntryStationsForOrderItem<T extends { id: string; station_type: string; sort_order?: number | null; is_active?: boolean | null }>(
  stations: T[],
  hasBorder: boolean
) {
  const sortedStations = sortStationsByFlow(stations);
  const nonTerminalStations = sortedStations.filter((station) => station.station_type !== 'order_status');
  if (!nonTerminalStations.length) return [] as T[];

  if (hasBorder) {
    const borderStations = nonTerminalStations.filter((station) => station.station_type === 'item_assembly');
    const selectedStations = borderStations.length ? borderStations : nonTerminalStations;
    const firstOrder = selectedStations[0]?.sort_order ?? 0;
    return selectedStations.filter((station) => (station.sort_order ?? 0) === firstOrder);
  }

  const nonBorderStations = nonTerminalStations.filter((station) => station.station_type !== 'item_assembly');
  const prepStartStations = nonBorderStations.filter((station) => station.station_type === 'prep_start');
  const selectedStations = prepStartStations.length ? prepStartStations : nonBorderStations;
  const firstOrder = selectedStations[0]?.sort_order ?? 0;
  return selectedStations.filter((station) => (station.sort_order ?? 0) === firstOrder);
}

function getNextStationsForOrderItem<T extends { id: string; station_type: string; sort_order?: number | null; is_active?: boolean | null }>(
  stations: T[],
  currentStationId: string,
  orderType?: string | null
) {
  const sortedStations = sortStationsByFlow(stations);
  const currentStation = sortedStations.find((station) => station.id === currentStationId);
  if (!currentStation) return [] as T[];

  const currentOrder = currentStation.sort_order ?? 0;
  let candidates = sortedStations.filter((station) => (station.sort_order ?? 0) > currentOrder);
  if (currentStation.station_type === 'order_status') {
    if (orderType !== 'dine_in') return [] as T[];
    candidates = candidates.filter((station) => station.station_type === 'order_status');
  }

  if (!candidates.length) return [] as T[];
  const nextOrder = candidates[0]?.sort_order ?? 0;
  return candidates.filter((station) => (station.sort_order ?? 0) === nextOrder);
}

function getCandidateDevicesForStations(
  stations: Array<{ id: string }>,
  allDevices: ResolvedRoutingDevice[],
  onlineDevices: ResolvedRoutingDevice[]
) {
  const stationIds = new Set(stations.map((station) => station.id));
  const onlineCandidates = onlineDevices.filter((device) => stationIds.has(device.station_id));
  if (onlineCandidates.length) {
    return onlineCandidates;
  }

  return allDevices.filter((device) => stationIds.has(device.station_id));
}

function buildItemRoutingText(params: {
  item: Pick<OrderItem, 'notes'> | { notes?: string | null };
  extras?: Array<{ extra_name?: string | null; kds_category?: string | null }>;
  subExtras?: Array<{ option_name?: string | null; kds_category?: string | null }>;
}) {
  const extrasText = (params.extras ?? [])
    .map((extra) => `${extra.extra_name || ''} ${extra.kds_category || ''}`.trim())
    .join(' ');
  const subExtrasText = (params.subExtras ?? [])
    .map((extra) => `${extra.option_name || ''} ${extra.kds_category || ''}`.trim())
    .join(' ');
  const explicitBorder = [...(params.extras ?? []), ...(params.subExtras ?? [])].some(
    (extra) => extra.kds_category === 'border'
  );

  return `${params.item.notes || ''} ${extrasText} ${subExtrasText} ${explicitBorder ? 'border borda' : ''}`
    .toLowerCase()
    .trim();
}

function filterEntryDevicesForItem(devices: ResolvedRoutingDevice[], itemRoutingText: string) {
  const entryDevices = devices.filter((device) => device.is_entry_device);
  if (!entryDevices.length) return [] as ResolvedRoutingDevice[];

  const keywordDevices = entryDevices.filter(
    (device) =>
      device.routing_mode === 'keywords' &&
      device.routing_keywords.length > 0 &&
      device.routing_keywords.some((keyword) => itemRoutingText.includes(keyword))
  );
  if (keywordDevices.length) {
    return keywordDevices;
  }

  const defaultDevices = entryDevices.filter(
    (device) => device.routing_mode !== 'keywords' || device.routing_keywords.length === 0
  );
  return defaultDevices;
}

function getFallbackDevicesFromEntryNextSteps(
  allDevices: ResolvedRoutingDevice[],
  onlineDevices: ResolvedRoutingDevice[]
) {
  const entryDevices = allDevices.filter((device) => device.is_entry_device);
  const fallbackNextIds = Array.from(new Set(entryDevices.flatMap((device) => device.next_device_ids).filter(Boolean)));
  if (!fallbackNextIds.length) return [] as ResolvedRoutingDevice[];

  const allFallbackDevices = fallbackNextIds
    .map((deviceId) => allDevices.find((device) => device.device_id === deviceId) ?? null)
    .filter((device): device is ResolvedRoutingDevice => !!device);
  if (!allFallbackDevices.length) return [] as ResolvedRoutingDevice[];

  const onlineFallbackIds = new Set(onlineDevices.map((device) => device.device_id));
  const onlineFallbackDevices = allFallbackDevices.filter((device) => onlineFallbackIds.has(device.device_id));
  return onlineFallbackDevices.length ? onlineFallbackDevices : allFallbackDevices;
}

function getCandidateEntryDevices(
  allDevices: ResolvedRoutingDevice[],
  onlineDevices: ResolvedRoutingDevice[],
  itemRoutingText: string
) {
  const onlineCandidates = filterEntryDevicesForItem(onlineDevices, itemRoutingText);
  if (onlineCandidates.length) {
    return onlineCandidates;
  }

  const allCandidates = filterEntryDevicesForItem(allDevices, itemRoutingText);
  if (allCandidates.length) {
    return allCandidates;
  }

  const fallbackNextDevices = getFallbackDevicesFromEntryNextSteps(allDevices, onlineDevices);
  if (fallbackNextDevices.length) {
    return fallbackNextDevices;
  }

  return onlineDevices.length ? onlineDevices : allDevices;
}

function pickLeastBusyDevice(
  devices: Array<{ device_id: string }>,
  deviceLoadCounts: Map<string, number>,
  preferredDeviceId?: string | null,
  increment = true
) {
  if (!devices.length) return null;

  if (preferredDeviceId && devices.some((device) => device.device_id === preferredDeviceId)) {
    return preferredDeviceId;
  }

  const selected = [...devices].sort((left, right) => {
    const leftLoad = deviceLoadCounts.get(left.device_id) ?? 0;
    const rightLoad = deviceLoadCounts.get(right.device_id) ?? 0;
    if (leftLoad !== rightLoad) return leftLoad - rightLoad;
    return left.device_id.localeCompare(right.device_id);
  })[0];

  if (!selected) return null;

  if (increment) {
    deviceLoadCounts.set(selected.device_id, (deviceLoadCounts.get(selected.device_id) ?? 0) + 1);
  }

  return selected.device_id;
}

async function pickInitialDeviceAssignmentForItem(params: {
  tenantId: string;
  item: OrderItem;
  orderId: string;
  orderStatus: OrderStatus;
  allDevices: ResolvedRoutingDevice[];
  onlineDevices: ResolvedRoutingDevice[];
  stations: Array<{ id: string; station_type: string; sort_order?: number | null; is_active?: boolean | null }>;
  extras?: Array<{ extra_name?: string | null; kds_category?: string | null }>;
  subExtras?: Array<{ option_name?: string | null; kds_category?: string | null }>;
}) {
  if (!canAssignItemToKds(params.item)) return null;
  if (params.orderStatus === 'ready' || params.orderStatus === 'delivered' || params.orderStatus === 'cancelled') {
    return null;
  }

  const itemRoutingText = buildItemRoutingText({
    item: params.item,
    extras: params.extras,
    subExtras: params.subExtras,
  });
  const candidateStations = getEntryStationsForOrderItem(
    params.stations,
    itemRoutingText.includes('border') || itemRoutingText.includes('borda')
  );
  const candidateDevices = getCandidateDevicesForStations(candidateStations, params.allDevices, params.onlineDevices);
  if (!candidateDevices.length) {
    return null;
  }

  const deviceLoads = await Promise.all(
    candidateDevices.map(async (device) => ({
      deviceId: device.device_id,
      load: await countOrderItemsAtDevice(params.tenantId, device.device_id, ['waiting', 'in_progress']),
    }))
  );
  deviceLoads.sort((left, right) => {
    if (left.load !== right.load) return left.load - right.load;
    return left.deviceId.localeCompare(right.deviceId);
  });

  const selectedDeviceId = deviceLoads[0]?.deviceId ?? null;
  const selectedDevice = selectedDeviceId
    ? candidateDevices.find((device) => device.device_id === selectedDeviceId) ?? null
    : null;
  if (!selectedDevice) {
    return null;
  }

  return {
    deviceId: selectedDevice.device_id,
    stationId: selectedDevice.station_id,
  };
}

async function ensureOrderItemKdsState(tenantId: string, orderId: string, itemId: string) {
  const [order, item, stations, devices] = await Promise.all([
    getOrderById(tenantId, orderId),
    getOrderItemById(tenantId, itemId),
    listKdsStations(tenantId),
    listKdsDevices(tenantId),
  ]);

  if (!order || !item) return;

  const [extras, subItems] = await Promise.all([
    listOrderItemExtrasByItemIds(tenantId, [itemId]),
    listOrderItemSubItemsByItemIds(tenantId, [itemId]),
  ]);
  const subExtras = await listOrderItemSubExtrasBySubItemIds(tenantId, subItems.map((subItem) => subItem.id));

  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const allDevices = resolveRoutingDevices(devices, stationMap);
  const onlineDevices = allDevices.filter((device) => isDeviceOnline(device.last_seen_at));
  const activeStations = sortStationsByFlow(stations);
  const currentDevice = item.current_device_id
    ? allDevices.find((device) => device.device_id === item.current_device_id) ?? null
    : null;
  const currentStation =
    (item.current_station_id ? stationMap.get(item.current_station_id) ?? null : null) ??
    (currentDevice?.station_id ? stationMap.get(currentDevice.station_id) ?? null : null);
  const shouldReassignOfflineDevice =
    !!currentStation &&
    item.station_status === 'waiting' &&
    !item.station_started_at &&
    !item.station_completed_at &&
    (!currentDevice || !isDeviceOnline(currentDevice.last_seen_at));
  const shouldAssignInitialRoute = !currentStation || !item.station_status;

  const initialAssignment = shouldAssignInitialRoute
    ? await pickInitialDeviceAssignmentForItem({
        tenantId,
        item,
        orderId,
        orderStatus: (order.status as OrderStatus) || 'pending',
        allDevices,
        onlineDevices,
        stations: activeStations,
        extras,
        subExtras,
      })
    : null;
  const reassignedStationDevice = shouldReassignOfflineDevice
    ? (() => {
        const candidateDevices = getCandidateDevicesForStations([currentStation], allDevices, onlineDevices);
        return candidateDevices.length ? candidateDevices : null;
      })()
    : null;

  const reassignedDeviceId = reassignedStationDevice
    ? (await Promise.all(
        reassignedStationDevice.map(async (device) => ({
          deviceId: device.device_id,
          load: await countOrderItemsAtDevice(tenantId, device.device_id, ['waiting', 'in_progress']),
        }))
      )).sort((left, right) => {
        if (left.load !== right.load) return left.load - right.load;
        return left.deviceId.localeCompare(right.deviceId);
      })[0]?.deviceId ?? null
    : null;
  const reassignedDevice = reassignedDeviceId
    ? reassignedStationDevice?.find((device) => device.device_id === reassignedDeviceId) ?? null
    : null;

  const targetDeviceId = shouldAssignInitialRoute
    ? initialAssignment?.deviceId ?? null
    : shouldReassignOfflineDevice
      ? reassignedDevice?.device_id ?? null
      : currentDevice?.device_id ?? item.current_device_id ?? null;
  const targetStationId = shouldAssignInitialRoute
    ? initialAssignment?.stationId ?? null
    : shouldReassignOfflineDevice
      ? reassignedDevice?.station_id ?? currentStation?.id ?? null
      : currentDevice?.station_id ?? item.current_station_id ?? null;

  const now = new Date().toISOString();

  if (
    (targetStationId && (item.current_station_id !== targetStationId || item.current_device_id !== targetDeviceId || !item.station_status)) ||
    (!targetStationId && (item.current_station_id || item.current_device_id))
  ) {
    await updateOrderItemById(tenantId, itemId, {
      current_station_id: targetStationId,
      current_device_id: targetDeviceId,
      station_status: 'waiting',
      station_started_at: null,
      station_completed_at: null,
      claimed_by_device_id: null,
      claimed_at: null,
      updated_at: now,
    });
  }

  if (order.status === 'ready' || order.status === 'delivered') {
    await updateOrderById(tenantId, orderId, {
      status: 'preparing',
      ready_at: null,
      delivered_at: null,
      updated_at: now,
    });
  }
}

async function buildOrders(tenantId: string, statuses?: OrderStatus[]): Promise<Order[]> {
  const ordersRaw = await listOrdersByStatusAndDateRange(tenantId, { statuses });
  if (!ordersRaw.length) return [];

  const [tables, itemsRaw, products, variations, stations, devices] = await Promise.all([
    listTables(tenantId),
    listOrderItemsByOrderIds(tenantId, ordersRaw.map((o) => o.id)),
    listProducts(tenantId, true),
    listProductVariations(tenantId),
    listKdsStations(tenantId),
    listKdsDevices(tenantId),
  ]);

  const itemIds = itemsRaw.map((i) => i.id);
  const [extrasRaw, subItemsRaw] = await Promise.all([
    listOrderItemExtrasByItemIds(tenantId, itemIds),
    listOrderItemSubItemsByItemIds(tenantId, itemIds),
  ]);
  const subExtrasRaw = await listOrderItemSubExtrasBySubItemIds(
    tenantId,
    subItemsRaw.map((s) => s.id)
  );

  const createdByIds = ordersRaw.map((o) => o.created_by).filter(Boolean) as string[];
  const addedByIds = itemsRaw.map((i) => i.added_by).filter(Boolean) as string[];
  const profiles = await listProfilesByIds([...new Set([...createdByIds, ...addedByIds])]);

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variationMap = new Map(variations.map((v) => [v.id, v]));
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const activeStations = sortStationsByFlow(stations);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const orderStatusById = new Map(ordersRaw.map((order) => [order.id, order.status as OrderStatus]));
  const orderTypeById = new Map(ordersRaw.map((order) => [order.id, order.order_type as OrderType]));
  const resolvedDevices = resolveRoutingDevices(devices, stationMap);
  const onlineDevices = resolvedDevices.filter((device) => isDeviceOnline(device.last_seen_at));
  const resolvedDeviceMap = new Map(resolvedDevices.map((device) => [device.device_id, device]));
  const extrasByItemId = new Map<string, Array<{ extra_name: string; price: number; kds_category?: string }>>();
  const subItemsByItemId = new Map<string, OrderItemSubItem[]>();
  const subExtrasBySubItemId = new Map<string, OrderItemSubExtra[]>();
  const deviceLoadCounts = new Map<string, number>();

  resolvedDevices.forEach((device) => {
    deviceLoadCounts.set(device.device_id, 0);
  });

  extrasRaw.forEach((extra) => {
    const current = extrasByItemId.get(extra.order_item_id) || [];
    current.push({
      extra_name: extra.extra_name,
      price: Number(extra.price || 0),
      kds_category: extra.kds_category || undefined,
    });
    extrasByItemId.set(extra.order_item_id, current);
  });

  subExtrasRaw.forEach((extra) => {
    const current = subExtrasBySubItemId.get(extra.sub_item_id) || [];
    current.push({
      id: extra.id,
      group_name: extra.group_name,
      option_name: extra.option_name,
      price: Number(extra.price || 0),
      quantity: Number(extra.quantity || 0),
    });
    subExtrasBySubItemId.set(extra.sub_item_id, current);
  });

  subItemsRaw.forEach((subItem) => {
    const current = subItemsByItemId.get(subItem.order_item_id) || [];
    current.push({
      id: subItem.id,
      sub_item_index: Number(subItem.sub_item_index || 0),
      notes: subItem.notes || null,
      sub_extras: subExtrasBySubItemId.get(subItem.id) || [],
    });
    subItemsByItemId.set(subItem.order_item_id, current);
  });

  const itemsByOrderId = new Map<string, OrderItem[]>();
  itemsRaw.forEach((item) => {
    if (!item.current_device_id) return;
    if (!canAssignItemToKds(item)) return;
    if (item.station_status !== 'waiting' && item.station_status !== 'in_progress') return;
    if (!deviceLoadCounts.has(item.current_device_id)) return;
    deviceLoadCounts.set(item.current_device_id, (deviceLoadCounts.get(item.current_device_id) ?? 0) + 1);
  });

  for (const item of itemsRaw) {
    const current = itemsByOrderId.get(item.order_id) || [];
    const product = item.product_id ? productMap.get(item.product_id) : null;
    const variation = item.variation_id ? variationMap.get(item.variation_id) : null;
    const orderStatus = orderStatusById.get(item.order_id) || 'pending';
    const itemSubItems = subItemsByItemId.get(item.id) || [];
    const subExtras = itemSubItems.flatMap((subItem) => subExtrasBySubItemId.get(subItem.id) || []);
    const normalizedItemStatus = item.cancelled_at
      ? 'cancelled'
      : item.served_at
        ? 'delivered'
        : ((item.status as OrderStatus) || 'pending');
    const currentDevice = item.current_device_id ? resolvedDeviceMap.get(item.current_device_id) ?? null : null;
    const currentStationId = currentDevice?.station_id ?? item.current_station_id ?? null;
    const originalStation = currentStationId ? stationMap.get(currentStationId) : null;
    const shouldReassignSameStationDevice =
      !!originalStation &&
      item.station_status === 'waiting' &&
      normalizedItemStatus !== 'cancelled' &&
      normalizedItemStatus !== 'delivered' &&
      (!currentDevice || !isDeviceOnline(currentDevice.last_seen_at));
    const stationCandidateDevices = shouldReassignSameStationDevice
      ? getCandidateDevicesForStations([originalStation], resolvedDevices, onlineDevices)
      : [];
    const reboundDeviceId = stationCandidateDevices.length
      ? pickLeastBusyDevice(stationCandidateDevices, deviceLoadCounts, currentDevice?.device_id)
      : null;
    const reboundDevice = reboundDeviceId ? resolvedDeviceMap.get(reboundDeviceId) ?? null : null;
    const initialAssignment =
      !currentStationId
        ? await pickInitialDeviceAssignmentForItem({
        tenantId,
        item: {
          ...item,
          current_station_id: currentStationId,
          notes: item.notes || null,
          status: normalizedItemStatus,
          station_status: item.station_status || null,
          served_at: item.served_at || null,
          cancelled_at: item.cancelled_at || null,
        } as OrderItem,
        orderId: item.order_id,
        orderStatus,
        allDevices: resolvedDevices,
        onlineDevices,
        stations: activeStations,
        extras: extrasByItemId.get(item.id),
        subExtras,
      })
        : null;
    const resolvedDeviceId =
      reboundDevice?.device_id ??
      currentDevice?.device_id ??
      initialAssignment?.deviceId ??
      null;
    const resolvedCurrentDevice = resolvedDeviceId ? resolvedDeviceMap.get(resolvedDeviceId) ?? null : null;
    const resolvedStationId =
      resolvedCurrentDevice?.station_id ??
      currentStationId ??
      initialAssignment?.stationId ??
      null;
    const station = resolvedStationId ? stationMap.get(resolvedStationId) : null;
    const nextStations = resolvedStationId
      ? getNextStationsForOrderItem(activeStations, resolvedStationId, orderTypeById.get(item.order_id) || 'dine_in')
      : [];
    const nextStation = nextStations[0] ?? null;
    const nextStationNames = nextStations
      .map((candidateStation) => candidateStation.name || null)
      .filter((name): name is string => !!name);
    const addedByProfile = item.added_by ? profileMap.get(item.added_by) : null;

    current.push({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id || null,
      variation_id: item.variation_id || null,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      notes: item.notes || null,
      status: normalizedItemStatus,
      created_at: item.created_at || '',
      added_by: item.added_by || null,
      current_station_id: resolvedStationId || null,
      current_device_id: resolvedDeviceId,
      station_status: item.station_status || (resolvedStationId ? 'waiting' : null),
      served_at: item.served_at || null,
      cancelled_at: item.cancelled_at || null,
      cancelled_by: item.cancelled_by || null,
      cancellation_reason: item.cancellation_reason || null,
      cancelled_station_id: (item as { cancelled_station_id?: string | null }).cancelled_station_id || null,
      cancelled_device_id: (item as { cancelled_device_id?: string | null }).cancelled_device_id || null,
      cancelled_station_status: (item as { cancelled_station_status?: string | null }).cancelled_station_status || null,
      claimed_by_device_id: (item as { claimed_by_device_id?: string | null }).claimed_by_device_id || null,
      claimed_at: (item as { claimed_at?: string | null }).claimed_at || null,
      current_device_name: resolvedCurrentDevice?.name ?? null,
      next_device_name:
        nextStationNames.length > 1 ? `Balanceado: ${nextStationNames.join(', ')}` : nextStation?.name ?? null,
      next_device_station_type: nextStation?.station_type ?? null,
      product: product ? { name: product.name, image_url: product.image_url || null } : undefined,
      variation: variation ? { name: variation.name } : null,
      extras: extrasByItemId.get(item.id) || [],
      current_station: station
        ? {
            id: station.id,
            name: station.name,
            station_type: station.station_type,
            color: station.color || null,
            icon: station.icon || null,
            sort_order: station.sort_order ?? null,
          }
        : null,
      added_by_profile: addedByProfile ? { name: addedByProfile.name } : null,
      sub_items: subItemsByItemId.get(item.id) || [],
    });
    itemsByOrderId.set(item.order_id, current);
  }

  return ordersRaw.map((order) => {
    const table = order.table_id ? tableMap.get(order.table_id) : null;
    const createdByProfile = order.created_by ? profileMap.get(order.created_by) : null;
    return {
      id: order.id,
      table_id: order.table_id || null,
      order_type: (order.order_type as OrderType) || 'dine_in',
      status: order.status as OrderStatus,
      customer_name: order.customer_name || null,
      customer_phone: (order as { customer_phone?: string | null }).customer_phone || null,
      customer_address: (order as { customer_address?: string | null }).customer_address || null,
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      total: Number(order.total || 0),
      notes: order.notes || null,
      party_size: (order as { party_size?: number | null }).party_size ?? null,
      created_by: order.created_by || null,
      created_at: order.created_at || '',
      updated_at: order.updated_at || '',
      ready_at: (order as { ready_at?: string | null }).ready_at || null,
      served_at: (order as { served_at?: string | null }).served_at || null,
      delivered_at: order.delivered_at || null,
      cancelled_at: order.cancelled_at || null,
      cancelled_by: order.cancelled_by || null,
      cancellation_reason: order.cancellation_reason || null,
      status_before_cancellation: ((order as { status_before_cancellation?: OrderStatus | null }).status_before_cancellation) || null,
      is_draft: (order as { is_draft?: boolean }).is_draft,
      table: table ? { number: table.number } : null,
      order_items: itemsByOrderId.get(order.id) || [],
      created_by_profile: createdByProfile ? { name: createdByProfile.name } : null,
    } as Order;
  });
}

async function recalculateOrderTotals(tenantId: string, orderId: string) {
  const [totals, order] = await Promise.all([
    listOrderItemTotalsByOrder(tenantId, orderId),
    getOrderById(tenantId, orderId),
  ]);
  const subtotal = totals.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const discount = Number(order?.discount || 0);
  const total = subtotal - discount;
  await updateOrderById(tenantId, orderId, {
    subtotal,
    total,
    updated_at: new Date().toISOString(),
  });
}

export function useOrders(status?: OrderStatus[], options?: { enabled?: boolean }) {
  const { tenantId } = useTenant();
  const statusKey = status?.join(',');
  const stableStatus = useMemo(() => status, [statusKey]);
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ['orders', tenantId, stableStatus],
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!tenantId) return [];
      return await buildOrders(tenantId, stableStatus);
    },
    enabled: enabled && !!tenantId,
  });
}

export function useOrderMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { tenantId } = useTenant();

  const createOrderMutation = useMutation({
    mutationFn: async (order: Partial<Order>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data: userData } = await backendClient.auth.getUser();
      return await createOrder(tenantId, {
        status: order.status || 'pending',
        total: Number(order.total || 0),
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount || 0),
        created_by: userData.user?.id || null,
        table_id: order.table_id || null,
        order_type: order.order_type || 'dine_in',
        notes: order.notes || null,
        customer_name: order.customer_name || null,
        customer_phone: order.customer_phone || null,
        customer_address: order.customer_address || null,
        party_size: order.party_size ?? null,
        ready_at: order.ready_at || null,
        served_at: order.served_at || null,
        delivered_at: order.delivered_at || null,
        cancelled_at: order.cancelled_at || null,
        cancelled_by: order.cancelled_by || null,
        cancellation_reason: order.cancellation_reason || null,
        status_before_cancellation: order.status_before_cancellation || null,
        is_draft: order.is_draft || false,
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast({ title: 'Pedido criado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, ...order }: Partial<Order> & { id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateOrderById(tenantId, id, { ...(order as Partial<Record<keyof Order, unknown>>), updated_at: new Date().toISOString() } as never);
      return await getOrderById(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const addOrderItem = useMutation({
    mutationFn: async (item: Omit<OrderItem, 'id' | 'created_at' | 'product' | 'added_by' | 'added_by_profile'>) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const { data: userData } = await backendClient.auth.getUser();
      const created = await createOrderItem(tenantId, {
        ...item,
        added_by: userData.user?.id || null,
      });
      await ensureOrderItemKdsState(tenantId, item.order_id, created.id);
      await recalculateOrderTotals(tenantId, item.order_id);
      return (await getOrderItemById(tenantId, created.id)) ?? created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar item', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderItem = useMutation({
    mutationFn: async ({ id, order_id, ...item }: Partial<OrderItem> & { id: string; order_id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await updateOrderItemById(tenantId, id, item as never);
      await recalculateOrderTotals(tenantId, order_id);
      return await getOrderItemById(tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrderItem = useMutation({
    mutationFn: async ({ id, order_id }: { id: string; order_id: string }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      await deleteOrderItemCascade(tenantId, id);
      await recalculateOrderTotals(tenantId, order_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const addOrderItemExtras = useMutation({
    mutationFn: async (extras: { order_item_id: string; extra_name: string; price: number; extra_id?: string | null; kds_category?: string }[]) => {
      if (extras.length === 0) return [];
      if (!tenantId) throw new Error('Tenant nao encontrado');
      const created = await createOrderItemExtras(tenantId, extras);
      const orderItemIds = [...new Set(extras.map((extra) => extra.order_item_id))];
      const items = await listOrderItemsByIds(tenantId, orderItemIds);
      await Promise.all(
        items.map((item) => ensureOrderItemKdsState(tenantId, item.order_id, item.id))
      );
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar complementos', description: error.message, variant: 'destructive' });
    },
  });

  const addOrderItemSubItems = useMutation({
    mutationFn: async (params: {
      order_item_id: string;
      sub_items: {
        sub_item_index: number;
        notes?: string | null;
        extras: {
          group_id?: string | null;
          group_name: string;
          option_id?: string | null;
          option_name: string;
          price: number;
          quantity: number;
          kds_category?: string;
        }[];
      }[];
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');
      if (params.sub_items.length === 0) return [];

      const insertedSubItems = await createOrderItemSubItems(
        tenantId,
        params.sub_items.map((si) => ({
          order_item_id: params.order_item_id,
          sub_item_index: si.sub_item_index,
          notes: si.notes || null,
        }))
      );

      const extrasToInsert = insertedSubItems.flatMap((insertedSubItem) => {
        const originalSubItem = params.sub_items.find((si) => si.sub_item_index === insertedSubItem.sub_item_index);
        if (!originalSubItem) return [];
        return originalSubItem.extras.map((extra) => ({
          sub_item_id: insertedSubItem.id,
          group_id: extra.group_id || null,
          group_name: extra.group_name,
          option_id: extra.option_id || null,
          option_name: extra.option_name,
          price: extra.price,
          quantity: extra.quantity,
          kds_category: extra.kds_category || 'complement',
        }));
      });

      if (extrasToInsert.length > 0) {
        await createOrderItemSubExtras(tenantId, extrasToInsert);
      }

      const orderItem = await getOrderItemById(tenantId, params.order_item_id);
      if (orderItem) {
        await ensureOrderItemKdsState(tenantId, orderItem.order_id, orderItem.id);
      }

      return insertedSubItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar sub-items', description: error.message, variant: 'destructive' });
    },
  });

  const cancelOrderItem = useMutation({
    mutationFn: async (params: {
      itemId: string;
      orderId: string;
      reason: string;
      cancelledBy: string;
    }) => {
      if (!tenantId) throw new Error('Tenant nao encontrado');

      const [item, order, products, variations, tables] = await Promise.all([
        getOrderItemById(tenantId, params.itemId),
        getOrderById(tenantId, params.orderId),
        listProducts(tenantId, true),
        listProductVariations(tenantId),
        listTables(tenantId),
      ]);

      if (!item) throw new Error('Item nao encontrado');
      if (!order) throw new Error('Pedido nao encontrado');

      const productMap = new Map(products.map((p) => [p.id, p]));
      const variationMap = new Map(variations.map((v) => [v.id, v]));
      const tableMap = new Map(tables.map((t) => [t.id, t]));

      await updateOrderItemById(tenantId, params.itemId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: params.cancelledBy,
        cancellation_reason: params.reason,
        cancelled_station_id: item.current_station_id || null,
        cancelled_device_id: item.current_device_id || null,
        cancelled_station_status: item.station_status || null,
        current_station_id: null,
        current_device_id: null,
        claimed_by_device_id: null,
        claimed_at: null,
        station_status: null,
        updated_at: new Date().toISOString(),
      });

      await createOrderItemCancellation(tenantId, {
        order_item_id: params.itemId,
        order_id: params.orderId,
        table_id: order.table_id || null,
        station_id: item.current_station_id || null,
        device_id: item.current_device_id || null,
        product_name: item.product_id ? productMap.get(item.product_id)?.name || 'Produto' : 'Produto',
        variation_name: item.variation_id ? variationMap.get(item.variation_id)?.name || null : null,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.total_price || 0),
        order_type: order.order_type || null,
        table_number: order.table_id ? tableMap.get(order.table_id)?.number || null : null,
        customer_name: order.customer_name || null,
        cancellation_reason: params.reason,
        cancelled_by: params.cancelledBy,
      });

      const newSubtotal = Number(order.subtotal || 0) - Number(item.total_price || 0);
      const newTotal = newSubtotal - Number(order.discount || 0);
      await updateOrderById(tenantId, params.orderId, {
        subtotal: newSubtotal,
        total: newTotal,
        updated_at: new Date().toISOString(),
      });

      const wasInProduction = item.station_status !== 'done' && !item.served_at;

      return {
        success: true,
        wasInProduction,
        itemData: {
          productName: item.product_id ? productMap.get(item.product_id)?.name || 'Produto' : 'Produto',
          variationName: item.variation_id ? variationMap.get(item.variation_id)?.name || null : null,
          quantity: Number(item.quantity || 1),
          notes: item.notes || null,
        },
        orderData: {
          orderType: order.order_type || 'dine_in',
          tableNumber: order.table_id ? tableMap.get(order.table_id)?.number || null : null,
          customerName: order.customer_name || null,
        },
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Item cancelado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cancelar item', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createOrder: createOrderMutation,
    updateOrder: updateOrderMutation,
    addOrderItem,
    addOrderItemExtras,
    addOrderItemSubItems,
    updateOrderItem,
    deleteOrderItem,
    cancelOrderItem,
  };
}
