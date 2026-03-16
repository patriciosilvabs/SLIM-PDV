import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  limit,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
  type CollectionReference,
  type QueryConstraint,
} from 'firebase/firestore';
import { firestore } from '@/integrations/firebase/client';

export type CategoryDoc = {
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  tenant_id: string;
};

export type CustomerDoc = {
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
};

export type TableDoc = {
  number: number;
  capacity: number;
  status?: 'available' | 'occupied' | 'reserved' | 'bill_requested';
  position_x?: number;
  position_y?: number;
  created_at?: string;
  tenant_id: string;
};

export type IngredientDoc = {
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  created_at: string;
  updated_at: string;
  tenant_id: string;
};

export type ProductDoc = {
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  preparation_time: number;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  is_featured: boolean | null;
  is_promotion: boolean | null;
  promotion_price: number | null;
  label: string | null;
  print_sector_id: string | null;
  tenant_id: string;
};

export type PrintSectorDoc = {
  name: string;
  description: string | null;
  printer_name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  icon: string | null;
  color: string | null;
  created_at: string | null;
  tenant_id: string;
};

export type PaymentDoc = {
  order_id: string;
  cash_register_id: string | null;
  payment_method: 'cash' | 'credit_card' | 'debit_card' | 'pix';
  amount: number;
  received_by: string | null;
  is_partial: boolean;
  created_at: string;
  tenant_id: string;
};

export type ProductExtraDoc = {
  name: string;
  price: number;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  tenant_id: string;
};

export type ProductExtraLinkDoc = {
  product_id: string;
  extra_id: string;
  created_at: string | null;
  tenant_id: string;
};

export type ProductVariationDoc = {
  product_id: string;
  name: string;
  description: string | null;
  price_modifier: number | null;
  is_active: boolean | null;
  tenant_id: string;
};

export type ProductIngredientDoc = {
  product_id: string;
  ingredient_id: string;
  quantity: number;
  tenant_id: string;
};

export type CashRegisterDoc = {
  opened_by: string;
  closed_by: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  tenant_id: string;
};

export type CashMovementDoc = {
  cash_register_id: string;
  movement_type: 'withdrawal' | 'supply';
  amount: number;
  reason: string;
  created_by: string | null;
  created_at: string;
  tenant_id: string;
};

export type OrderReopenDoc = {
  order_id: string;
  table_id: string | null;
  previous_status: string;
  new_status: string;
  reopened_by: string | null;
  reopened_at: string;
  reason: string | null;
  order_type: string | null;
  customer_name: string | null;
  total_value: number | null;
  tenant_id: string;
};

export type TableSwitchDoc = {
  order_id: string;
  from_table_id: string | null;
  to_table_id: string | null;
  switched_by: string | null;
  switched_at: string;
  tenant_id: string;
};

export type PrintQueueDoc = {
  print_type: 'kitchen_ticket' | 'customer_receipt' | 'cancellation_ticket' | 'kitchen_ticket_sector';
  data: Record<string, unknown>;
  status: 'pending' | 'printed' | 'failed';
  created_by: string | null;
  created_at: string;
  printed_at: string | null;
  printed_by_device: string | null;
  tenant_id: string;
};

export type ScheduledAnnouncementDoc = {
  name: string;
  file_path: string;
  schedule_type: 'once' | 'daily' | 'weekly';
  scheduled_time: string;
  scheduled_days: number[];
  scheduled_date: string | null;
  is_active: boolean;
  target_screens: string[];
  volume: number;
  created_by: string | null;
  created_at: string;
  last_played_at: string | null;
  trigger_type: 'scheduled' | 'condition';
  condition_type:
    | 'orders_in_production'
    | 'orders_pending'
    | 'orders_total_active'
    | 'avg_wait_time'
    | 'max_wait_time'
    | 'delayed_orders_count'
    | null;
  condition_threshold: number;
  condition_comparison: 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'equals';
  cooldown_minutes: number;
  delay_threshold_minutes: number;
  tenant_id: string;
};

export type UnmappedSaleDoc = {
  order_id: string;
  order_item_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  tenant_id: string;
};

export type ProductionApiKeyDoc = {
  api_key: string;
  name: string;
  is_active: boolean;
  permissions: {
    demand: boolean;
    ingredients: boolean;
    targets: boolean;
    webhook: boolean;
  };
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
  tenant_id: string;
};

export type ProductionApiLogDoc = {
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  request_body: unknown;
  response_summary: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  tenant_id: string;
};

export type CardapioWebIntegrationDoc = {
  api_token: string;
  webhook_secret: string | null;
  store_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
};

export type CardapioWebProductMappingDoc = {
  cardapioweb_item_id: number;
  cardapioweb_item_name: string;
  local_product_id: string | null;
  local_variation_id: string | null;
  created_at: string;
  tenant_id: string;
};

export type CardapioWebLogDoc = {
  event_type: string;
  external_order_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
  tenant_id: string;
};

export type IngredientDailyTargetDoc = {
  ingredient_id: string;
  day_of_week: number;
  target_quantity: number;
  created_at: string;
  updated_at: string;
  tenant_id: string;
};

export type ProductionShipmentDoc = {
  from_tenant_id: string;
  to_tenant_id: string;
  ingredient_id: string;
  quantity: number;
  shipped_by: string | null;
  shipped_at: string;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
  tenant_id: string;
};

export type StockMovementDoc = {
  ingredient_id: string;
  movement_type: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  tenant_id: string;
  created_at: string;
};

export type OrderDocLite = {
  status: string;
  total: number;
  subtotal?: number | null;
  discount?: number | null;
  created_at: string;
  created_by?: string | null;
  is_draft?: boolean;
  delivered_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  customer_name?: string | null;
  table_id?: string | null;
  order_type?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  tenant_id: string;
};

export type OrderItemDocLite = {
  order_id: string;
  product_id?: string | null;
  variation_id?: string | null;
  added_by?: string | null;
  quantity: number;
  unit_price?: number;
  total_price: number;
  notes?: string | null;
  status?: string;
  current_station_id?: string | null;
  current_device_id?: string | null;
  station_status?: 'waiting' | 'in_progress' | 'completed' | 'done' | null;
  station_started_at?: string | null;
  station_completed_at?: string | null;
  served_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancelled_station_id?: string | null;
  cancelled_device_id?: string | null;
  cancelled_station_status?: string | null;
  claimed_by_device_id?: string | null;
  claimed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  tenant_id: string;
};

export type OrderItemExtraDoc = {
  order_item_id: string;
  extra_name: string;
  price: number;
  extra_id?: string | null;
  kds_category?: string | null;
  tenant_id: string;
};

export type OrderItemSubItemDoc = {
  order_item_id: string;
  sub_item_index: number;
  notes: string | null;
  tenant_id: string;
};

export type OrderItemSubItemExtraDoc = {
  sub_item_id: string;
  group_id: string | null;
  group_name: string;
  option_id: string | null;
  option_name: string;
  price: number;
  quantity: number;
  tenant_id: string;
  kds_category?: string | null;
};

export type OrderItemCancellationDoc = {
  order_item_id: string;
  order_id: string;
  table_id: string | null;
  station_id?: string | null;
  device_id?: string | null;
  product_name: string;
  variation_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_type: string | null;
  table_number: number | null;
  customer_name: string | null;
  cancellation_reason: string;
  cancelled_by: string;
  tenant_id: string;
};

export type KdsGlobalSettingsDoc = {
  border_keywords?: string[];
  tenant_id: string;
};

export type KdsStationLogDoc = {
  order_item_id: string;
  station_id: string;
  action: 'entered' | 'started' | 'completed' | 'skipped';
  performed_by: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
  tenant_id: string;
};

export type CustomSoundDoc = {
  user_id: string;
  name: string;
  sound_type: string;
  file_path: string;
  created_at: string;
  tenant_id: string;
};

export type KdsStationDoc = {
  name: string;
  station_type: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
};

export type KdsDeviceDoc = {
  device_id: string;
  name: string;
  station_id: string | null;
  stage_type?: 'prep_start' | 'item_assembly' | 'assembly' | 'oven_expedite' | 'order_status' | 'custom';
  display_order?: number | null;
  is_terminal?: boolean;
  operation_mode: string;
  routing_mode?: 'default' | 'keywords';
  routing_keywords?: string[];
  is_entry_device?: boolean;
  next_device_ids?: string[];
  next_device_id?: string | null;
  last_seen_at: string;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  tenant_id: string;
};

const DEFAULT_KDS_DEVICE_STAGE_COLOR = '#3B82F6';
const DEFAULT_KDS_DEVICE_STAGE_ICON = 'ChefHat';

function normalizeKdsDeviceStageType(
  value: unknown,
  fallback: KdsDeviceDoc['stage_type'] = 'custom'
): NonNullable<KdsDeviceDoc['stage_type']> {
  const normalized = String(value || '').trim();
  switch (normalized) {
    case 'prep_start':
    case 'item_assembly':
    case 'assembly':
    case 'oven_expedite':
    case 'order_status':
    case 'custom':
      return normalized;
    default:
      return fallback;
  }
}

function normalizeKdsDeviceDisplayOrder(value: unknown, fallback = 1): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.trunc(numeric));
}

function normalizeKdsDeviceNextIds(
  value: unknown,
  fallback?: unknown,
  isTerminal = false
): string[] {
  if (isTerminal) return [];

  if (Array.isArray(value)) {
    const nextIds = value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (nextIds.length) {
      return Array.from(new Set(nextIds));
    }
  }

  const legacyId = fallback ? String(fallback).trim() : '';
  return legacyId ? [legacyId] : [];
}

function getInternalDeviceStageId(deviceDocId: string) {
  return `device-stage-${deviceDocId}`;
}

export type ReservationDoc = {
  table_id: string;
  customer_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
  created_by: string | null;
  tenant_id: string;
};

export type GlobalSettingDoc = {
  key: string;
  value: unknown;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

export type UserPermissionDoc = {
  user_id: string;
  permission: string;
  granted: boolean;
  granted_by: string | null;
  tenant_id: string;
  created_at: string;
};

export type ComplementGroupDoc = {
  name: string;
  description: string | null;
  selection_type: 'single' | 'multiple' | 'multiple_repeat';
  is_required: boolean | null;
  min_selections: number | null;
  max_selections: number | null;
  visibility: string | null;
  channels: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
  price_calculation_type: 'sum' | 'average' | 'highest' | 'lowest' | null;
  applies_per_unit: boolean | null;
  unit_count: number | null;
  flavor_modal_enabled: boolean | null;
  flavor_modal_channels: string[] | null;
  flavor_options: unknown[] | null;
  applicable_flavor_counts: number[] | null;
  kds_category: 'flavor' | 'border' | 'complement';
  created_at: string | null;
  updated_at: string | null;
  tenant_id: string;
};

export type ComplementOptionDoc = {
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  cost_price: number | null;
  internal_code: string | null;
  pdv_code: string | null;
  auto_calculate_cost: boolean | null;
  enable_stock_control: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  tenant_id: string;
};

export type ComplementGroupOptionDoc = {
  group_id: string;
  option_id: string;
  price_override: number | null;
  max_quantity: number | null;
  sort_order: number | null;
  created_at: string | null;
  tenant_id: string;
};

export type ComplementOptionIngredientDoc = {
  complement_option_id: string;
  ingredient_id: string;
  quantity: number;
  tenant_id: string;
  created_at: string | null;
};

export type ProductComplementGroupDoc = {
  product_id: string;
  group_id: string;
  skip_flavor_modal?: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  tenant_id: string;
};

export type TenantMemberDoc = {
  user_id: string;
  tenant_id: string;
  is_owner: boolean;
  created_at: string;
};

export type UserRoleDoc = {
  user_id: string;
  role: 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'kds';
  tenant_id: string | null;
  created_at: string;
};

export type ProfileDoc = {
  name: string;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TenantDoc = {
  id: string;
  name: string;
  slug: string;
  owner_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TenantInvitationDoc = {
  tenant_id: string;
  email: string;
  role: UserRoleDoc['role'];
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type PlatformAdminDoc = {
  user_id: string | null;
  email: string;
  created_by: string | null;
  created_at: string;
};

export type SubscriptionPlanDoc = {
  name: string;
  price_monthly: number;
  created_at: string;
  updated_at?: string | null;
};

export type SubscriptionDoc = {
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at?: string | null;
};

function tenantCollection<T>(tenantId: string, name: string): CollectionReference<T> {
  return collection(firestore, 'tenants', tenantId, name) as CollectionReference<T>;
}

export async function listCategories(tenantId: string): Promise<Array<CategoryDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<CategoryDoc>(tenantId, 'categories'), orderBy('sort_order', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCategory(tenantId: string, payload: Omit<CategoryDoc, 'created_at' | 'tenant_id'>): Promise<CategoryDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<CategoryDoc>(tenantId, 'categories'), {
    ...payload,
    created_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CategoryDoc) };
}

export async function listPrintSectors(tenantId: string): Promise<Array<PrintSectorDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<PrintSectorDoc>(tenantId, 'print_sectors'));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as PrintSectorDoc) }))
    .sort((a, b) => {
      const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
}

export async function createPrintSector(
  tenantId: string,
  payload: Omit<PrintSectorDoc, 'tenant_id' | 'created_at'>
): Promise<PrintSectorDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<PrintSectorDoc>(tenantId, 'print_sectors'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as PrintSectorDoc) };
}

export async function updatePrintSector(
  tenantId: string,
  id: string,
  payload: Partial<PrintSectorDoc>
): Promise<PrintSectorDoc & { id: string }> {
  const ref = doc(tenantCollection<PrintSectorDoc>(tenantId, 'print_sectors'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as PrintSectorDoc) };
}

export async function deletePrintSector(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<PrintSectorDoc>(tenantId, 'print_sectors'), id));
}

export async function listProducts(
  tenantId: string,
  includeInactive = false
): Promise<
  Array<
    (ProductDoc & { id: string }) & {
      category?: { name: string };
      print_sector?: { id: string; name: string; printer_name: string | null; icon: string; color: string } | null;
    }
  >
> {
  const [productsSnap, categories, printSectorsSnap] = await Promise.all([
    getDocs(tenantCollection<ProductDoc>(tenantId, 'products')),
    listCategories(tenantId),
    getDocs(tenantCollection<PrintSectorDoc>(tenantId, 'print_sectors')),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const printSectorById = new Map(printSectorsSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as PrintSectorDoc) }]));

  const all = productsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
    .filter((p) => includeInactive || p.is_available)
    .map((p) => ({
      ...p,
      category: p.category_id ? { name: categoryById.get(p.category_id)?.name || '' } : undefined,
      print_sector: p.print_sector_id
        ? (() => {
            const sector = printSectorById.get(p.print_sector_id);
            if (!sector) return null;
            return {
              id: sector.id,
              name: sector.name,
              printer_name: sector.printer_name ?? null,
              icon: sector.icon ?? '',
              color: sector.color ?? '',
            };
          })()
        : null,
    }));

  return all.sort((a, b) => {
    const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

export async function createProduct(
  tenantId: string,
  payload: Omit<ProductDoc, 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<ProductDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<ProductDoc>(tenantId, 'products'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductDoc) };
}

export async function updateProduct(
  tenantId: string,
  id: string,
  payload: Partial<ProductDoc>
): Promise<ProductDoc & { id: string }> {
  const ref = doc(tenantCollection<ProductDoc>(tenantId, 'products'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductDoc) };
}

export async function deleteProduct(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ProductDoc>(tenantId, 'products'), id));
}

export async function listOrderReopens(
  tenantId: string,
  options?: { startDateIso?: string; endDateIso?: string; userId?: string; max?: number }
): Promise<Array<OrderReopenDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('reopened_at', 'desc')];
  if (options?.startDateIso) {
    constraints.push(where('reopened_at', '>=', options.startDateIso));
  }
  if (options?.endDateIso) {
    constraints.push(where('reopened_at', '<=', options.endDateIso));
  }
  if (options?.userId) {
    constraints.push(where('reopened_by', '==', options.userId));
  }
  constraints.push(limit(options?.max ?? 500));
  const snap = await getDocs(query(tenantCollection<OrderReopenDoc>(tenantId, 'order_reopens'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderReopenDoc) }));
}

export async function createOrderReopen(
  tenantId: string,
  payload: Omit<OrderReopenDoc, 'tenant_id' | 'reopened_at'> & { reopened_at?: string }
): Promise<OrderReopenDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<OrderReopenDoc>(tenantId, 'order_reopens'), {
    ...payload,
    reopened_at: payload.reopened_at ?? new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as OrderReopenDoc) };
}

export async function createTableSwitch(
  tenantId: string,
  payload: Omit<TableSwitchDoc, 'tenant_id' | 'switched_at'> & { switched_at?: string }
): Promise<TableSwitchDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<TableSwitchDoc>(tenantId, 'table_switches'), {
    ...payload,
    switched_at: payload.switched_at ?? new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as TableSwitchDoc) };
}

export async function listTableSwitches(
  tenantId: string,
  options?: { startDateIso?: string; endDateIso?: string; userId?: string; max?: number }
): Promise<Array<TableSwitchDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('switched_at', 'desc')];
  if (options?.startDateIso) constraints.push(where('switched_at', '>=', options.startDateIso));
  if (options?.endDateIso) constraints.push(where('switched_at', '<=', options.endDateIso));
  if (options?.userId) constraints.push(where('switched_by', '==', options.userId));
  constraints.push(limit(options?.max ?? 100));
  const snap = await getDocs(query(tenantCollection<TableSwitchDoc>(tenantId, 'table_switches'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TableSwitchDoc) }));
}

export async function listOrderItemTotalsByOrder(
  tenantId: string,
  orderId: string
): Promise<Array<{ id: string; total_price: number | null }>> {
  const snap = await getDocs(
    query(tenantCollection<{ order_id: string; total_price: number | null }>(tenantId, 'order_items'), where('order_id', '==', orderId))
  );
  return snap.docs.map((d) => ({ id: d.id, total_price: (d.data().total_price ?? null) as number | null }));
}

export async function deleteOrderItemCascade(tenantId: string, itemId: string): Promise<void> {
  const orderItemRef = doc(tenantCollection<Record<string, unknown>>(tenantId, 'order_items'), itemId);
  await deleteDoc(orderItemRef);

  const extrasSnap = await getDocs(
    query(tenantCollection<{ order_item_id: string }>(tenantId, 'order_item_extras'), where('order_item_id', '==', itemId))
  );
  await Promise.all(extrasSnap.docs.map((d) => deleteDoc(d.ref)));

  const subItemsSnap = await getDocs(
    query(tenantCollection<{ order_item_id: string }>(tenantId, 'order_item_sub_items'), where('order_item_id', '==', itemId))
  );
  const subItemIds = subItemsSnap.docs.map((d) => d.id);
  await Promise.all(subItemsSnap.docs.map((d) => deleteDoc(d.ref)));

  for (const subItemId of subItemIds) {
    const subExtrasSnap = await getDocs(
      query(
        tenantCollection<{ sub_item_id: string }>(tenantId, 'order_item_sub_item_extras'),
        where('sub_item_id', '==', subItemId)
      )
    );
    await Promise.all(subExtrasSnap.docs.map((d) => deleteDoc(d.ref)));
  }
}

export async function getOrderTableIdByOrderId(tenantId: string, orderId: string): Promise<string | null> {
  const snap = await getDoc(doc(tenantCollection<{ table_id: string | null }>(tenantId, 'orders'), orderId));
  if (!snap.exists()) return null;
  return (snap.data().table_id ?? null) as string | null;
}

export async function listPendingPrintJobs(tenantId: string): Promise<Array<PrintQueueDoc & { id: string }>> {
  const snap = await getDocs(
    query(
      tenantCollection<PrintQueueDoc>(tenantId, 'print_queue'),
      where('status', '==', 'pending'),
      orderBy('created_at', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PrintQueueDoc) }));
}

export async function createPrintJob(
  tenantId: string,
  payload: Omit<PrintQueueDoc, 'tenant_id' | 'status' | 'created_at' | 'printed_at' | 'printed_by_device'>
): Promise<PrintQueueDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<PrintQueueDoc>(tenantId, 'print_queue'), {
    print_type: payload.print_type,
    data: payload.data,
    status: 'pending',
    created_by: payload.created_by ?? null,
    created_at: new Date().toISOString(),
    printed_at: null,
    printed_by_device: null,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as PrintQueueDoc) };
}

export async function updatePrintJobStatus(
  tenantId: string,
  jobId: string,
  status: PrintQueueDoc['status'],
  options?: { printed_by_device?: string | null }
): Promise<void> {
  const ref = doc(tenantCollection<PrintQueueDoc>(tenantId, 'print_queue'), jobId);
  await updateDoc(ref, {
    status,
    printed_at: status === 'printed' ? new Date().toISOString() : null,
    printed_by_device: status === 'printed' ? (options?.printed_by_device ?? null) : null,
  });
}

export async function listActiveScheduledAnnouncements(
  tenantId: string
): Promise<Array<ScheduledAnnouncementDoc & { id: string }>> {
  const snap = await getDocs(
    query(
      tenantCollection<ScheduledAnnouncementDoc>(tenantId, 'scheduled_announcements'),
      where('is_active', '==', true),
      orderBy('scheduled_time', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ScheduledAnnouncementDoc) }));
}

export async function createScheduledAnnouncement(
  tenantId: string,
  payload: Omit<ScheduledAnnouncementDoc, 'tenant_id' | 'created_at' | 'last_played_at'>
): Promise<ScheduledAnnouncementDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<ScheduledAnnouncementDoc>(tenantId, 'scheduled_announcements'), {
    ...payload,
    created_at: now,
    last_played_at: null,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ScheduledAnnouncementDoc) };
}

export async function updateScheduledAnnouncement(
  tenantId: string,
  id: string,
  payload: Partial<ScheduledAnnouncementDoc>
): Promise<void> {
  await updateDoc(doc(tenantCollection<ScheduledAnnouncementDoc>(tenantId, 'scheduled_announcements'), id), payload);
}

export async function deleteScheduledAnnouncement(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ScheduledAnnouncementDoc>(tenantId, 'scheduled_announcements'), id));
}

export async function setScheduledAnnouncementLastPlayed(tenantId: string, id: string): Promise<void> {
  await updateScheduledAnnouncement(tenantId, id, { last_played_at: new Date().toISOString() });
}

export async function listUnmappedSales(
  tenantId: string,
  options?: { onlyUnresolved?: boolean; limit?: number }
): Promise<Array<UnmappedSaleDoc & { id: string }>> {
  const onlyUnresolved = options?.onlyUnresolved ?? true;
  const max = options?.limit ?? 100;
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc'), limit(max)];
  if (onlyUnresolved) {
    constraints.unshift(where('resolved', '==', false));
  }
  const snap = await getDocs(query(tenantCollection<UnmappedSaleDoc>(tenantId, 'unmapped_sales'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as UnmappedSaleDoc) }));
}

export async function countUnresolvedUnmappedSales(tenantId: string): Promise<number> {
  const snap = await getDocs(
    query(tenantCollection<UnmappedSaleDoc>(tenantId, 'unmapped_sales'), where('resolved', '==', false))
  );
  return snap.size;
}

export async function resolveUnmappedSale(tenantId: string, saleId: string, userId: string): Promise<UnmappedSaleDoc & { id: string }> {
  const ref = doc(tenantCollection<UnmappedSaleDoc>(tenantId, 'unmapped_sales'), saleId);
  await updateDoc(ref, {
    resolved: true,
    resolved_at: new Date().toISOString(),
    resolved_by: userId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as UnmappedSaleDoc) };
}

export async function resolveAllUnmappedSales(tenantId: string, userId: string): Promise<void> {
  const snap = await getDocs(
    query(tenantCollection<UnmappedSaleDoc>(tenantId, 'unmapped_sales'), where('resolved', '==', false))
  );
  const now = new Date().toISOString();
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, {
        resolved: true,
        resolved_at: now,
        resolved_by: userId,
      })
    )
  );
}

export async function listProductionApiKeys(tenantId: string): Promise<Array<ProductionApiKeyDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<ProductionApiKeyDoc>(tenantId, 'production_api_keys'), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductionApiKeyDoc) }));
}

export async function listProductionApiLogs(
  tenantId: string,
  max = 100
): Promise<Array<ProductionApiLogDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<ProductionApiLogDoc>(tenantId, 'production_api_logs'), orderBy('created_at', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductionApiLogDoc) }));
}

export async function createProductionApiKey(
  tenantId: string,
  payload: Omit<ProductionApiKeyDoc, 'tenant_id' | 'created_at' | 'last_used_at' | 'is_active'>
): Promise<ProductionApiKeyDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductionApiKeyDoc>(tenantId, 'production_api_keys'), {
    ...payload,
    is_active: true,
    last_used_at: null,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductionApiKeyDoc) };
}

export async function updateProductionApiKey(
  tenantId: string,
  id: string,
  payload: Partial<ProductionApiKeyDoc>
): Promise<void> {
  await updateDoc(doc(tenantCollection<ProductionApiKeyDoc>(tenantId, 'production_api_keys'), id), payload);
}

export async function deleteProductionApiKey(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ProductionApiKeyDoc>(tenantId, 'production_api_keys'), id));
}

export async function getCardapioWebIntegration(
  tenantId: string
): Promise<(CardapioWebIntegrationDoc & { id: string }) | null> {
  const snap = await getDocs(query(tenantCollection<CardapioWebIntegrationDoc>(tenantId, 'cardapioweb_integrations'), limit(1)));
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as CardapioWebIntegrationDoc) };
}

export async function upsertCardapioWebIntegration(
  tenantId: string,
  payload: {
    api_token: string;
    webhook_secret: string | null;
    store_id: string | null;
    is_active: boolean;
  },
  integrationId?: string
): Promise<CardapioWebIntegrationDoc & { id: string }> {
  const now = new Date().toISOString();
  if (integrationId) {
    const ref = doc(tenantCollection<CardapioWebIntegrationDoc>(tenantId, 'cardapioweb_integrations'), integrationId);
    await updateDoc(ref, { ...payload, updated_at: now });
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() as CardapioWebIntegrationDoc) };
  }

  const ref = await addDoc(tenantCollection<CardapioWebIntegrationDoc>(tenantId, 'cardapioweb_integrations'), {
    ...payload,
    last_sync_at: null,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CardapioWebIntegrationDoc) };
}

export async function deleteCardapioWebIntegration(tenantId: string, integrationId: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<CardapioWebIntegrationDoc>(tenantId, 'cardapioweb_integrations'), integrationId));
}

export async function listCardapioWebMappings(tenantId: string): Promise<Array<CardapioWebProductMappingDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<CardapioWebProductMappingDoc>(tenantId, 'cardapioweb_product_mappings'), orderBy('cardapioweb_item_name', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardapioWebProductMappingDoc) }));
}

export async function updateCardapioWebMapping(
  tenantId: string,
  mappingId: string,
  payload: { local_product_id: string | null; local_variation_id: string | null }
): Promise<void> {
  await updateDoc(doc(tenantCollection<CardapioWebProductMappingDoc>(tenantId, 'cardapioweb_product_mappings'), mappingId), payload);
}

export async function deleteCardapioWebMapping(tenantId: string, mappingId: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<CardapioWebProductMappingDoc>(tenantId, 'cardapioweb_product_mappings'), mappingId));
}

export async function listCardapioWebLogs(
  tenantId: string,
  limitCount = 50
): Promise<Array<CardapioWebLogDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<CardapioWebLogDoc>(tenantId, 'cardapioweb_logs'), orderBy('created_at', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardapioWebLogDoc) }));
}

export async function listIngredientDailyTargets(
  tenantId: string,
  dayOfWeek?: number
): Promise<Array<IngredientDailyTargetDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('day_of_week', 'asc')];
  if (dayOfWeek !== undefined) constraints.push(where('day_of_week', '==', dayOfWeek));
  const snap = await getDocs(query(tenantCollection<IngredientDailyTargetDoc>(tenantId, 'ingredient_daily_targets'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IngredientDailyTargetDoc) }));
}

export async function upsertIngredientDailyTarget(
  tenantId: string,
  payload: { ingredient_id: string; day_of_week: number; target_quantity: number }
): Promise<IngredientDailyTargetDoc & { id: string }> {
  const existing = await getDocs(
    query(
      tenantCollection<IngredientDailyTargetDoc>(tenantId, 'ingredient_daily_targets'),
      where('ingredient_id', '==', payload.ingredient_id),
      where('day_of_week', '==', payload.day_of_week),
      limit(1)
    )
  );
  const now = new Date().toISOString();
  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    await updateDoc(ref, { target_quantity: payload.target_quantity, updated_at: now });
    const snap = await getDoc(ref);
    return { id: snap.id, ...(snap.data() as IngredientDailyTargetDoc) };
  }

  const ref = await addDoc(tenantCollection<IngredientDailyTargetDoc>(tenantId, 'ingredient_daily_targets'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as IngredientDailyTargetDoc) };
}

export async function copyIngredientDailyTargets(
  tenantId: string,
  fromDay: number,
  toDay: number
): Promise<number> {
  const source = await getDocs(
    query(tenantCollection<IngredientDailyTargetDoc>(tenantId, 'ingredient_daily_targets'), where('day_of_week', '==', fromDay))
  );
  if (source.empty) return 0;
  await Promise.all(
    source.docs.map((d) =>
      upsertIngredientDailyTarget(tenantId, {
        ingredient_id: d.data().ingredient_id,
        day_of_week: toDay,
        target_quantity: d.data().target_quantity,
      })
    )
  );
  return source.docs.length;
}

export async function deleteIngredientDailyTarget(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<IngredientDailyTargetDoc>(tenantId, 'ingredient_daily_targets'), id));
}

export async function listProductionShipments(
  tenantId: string,
  options?: { direction?: 'sent' | 'received' | 'all'; ingredientId?: string; max?: number }
): Promise<Array<ProductionShipmentDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('shipped_at', 'desc'), limit(options?.max ?? 50)];
  if (options?.direction === 'sent') constraints.push(where('from_tenant_id', '==', tenantId));
  if (options?.direction === 'received') constraints.push(where('to_tenant_id', '==', tenantId));
  if (options?.ingredientId) constraints.push(where('ingredient_id', '==', options.ingredientId));
  const snap = await getDocs(query(tenantCollection<ProductionShipmentDoc>(tenantId, 'production_shipments'), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductionShipmentDoc) }));
  if (!options?.direction || options.direction === 'all') {
    rows = rows.filter((r) => r.from_tenant_id === tenantId || r.to_tenant_id === tenantId);
  }
  return rows;
}

export async function createProductionShipment(
  tenantId: string,
  payload: Omit<ProductionShipmentDoc, 'tenant_id' | 'shipped_at' | 'received_at' | 'received_by'>
): Promise<ProductionShipmentDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductionShipmentDoc>(tenantId, 'production_shipments'), {
    ...payload,
    shipped_at: new Date().toISOString(),
    received_at: null,
    received_by: null,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductionShipmentDoc) };
}

export async function confirmProductionShipmentReceipt(
  tenantId: string,
  shipmentId: string,
  userId: string
): Promise<ProductionShipmentDoc & { id: string }> {
  const ref = doc(tenantCollection<ProductionShipmentDoc>(tenantId, 'production_shipments'), shipmentId);
  await updateDoc(ref, { received_at: new Date().toISOString(), received_by: userId });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductionShipmentDoc) };
}

export async function createStockMovement(
  tenantId: string,
  payload: Omit<StockMovementDoc, 'tenant_id' | 'created_at'>
): Promise<void> {
  await addDoc(tenantCollection<StockMovementDoc>(tenantId, 'stock_movements'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
}

export async function listStockMovements(
  tenantId: string,
  limitCount = 50
): Promise<Array<(StockMovementDoc & { id: string; created_by?: string | null }) & { ingredient?: { name: string; unit: string } }>> {
  const [snap, ingredients] = await Promise.all([
    getDocs(query(tenantCollection<StockMovementDoc & { created_by?: string | null }>(tenantId, 'stock_movements'), orderBy('created_at', 'desc'), limit(limitCount))),
    listIngredients(tenantId),
  ]);
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return snap.docs.map((d) => {
    const row = { id: d.id, ...(d.data() as StockMovementDoc & { created_by?: string | null }) };
    const ingredient = ingredientMap.get(row.ingredient_id);
    return {
      ...row,
      ingredient: ingredient ? { name: ingredient.name, unit: ingredient.unit } : undefined,
    };
  });
}

export async function listOrdersByStatusAndDateRange(
  tenantId: string,
  options: {
    statuses?: string[];
    startIso?: string;
    endIso?: string;
    createdBy?: string;
    fields?: Array<keyof OrderDocLite | 'id'>;
  }
): Promise<Array<OrderDocLite & { id: string }>> {
  const constraints: QueryConstraint[] = [];
  if (options.statuses?.length === 1) constraints.push(where('status', '==', options.statuses[0]));
  if (options.startIso) constraints.push(where('created_at', '>=', options.startIso));
  if (options.endIso) constraints.push(where('created_at', '<=', options.endIso));
  if (options.createdBy) constraints.push(where('created_by', '==', options.createdBy));
  constraints.push(orderBy('created_at', 'desc'));
  const snap = await getDocs(query(tenantCollection<OrderDocLite>(tenantId, 'orders'), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDocLite) }));
  if (options.statuses && options.statuses.length > 1) {
    const allowed = new Set(options.statuses);
    rows = rows.filter((r) => allowed.has(r.status));
  }
  return rows;
}

export async function listRecentOrders(
  tenantId: string,
  limitCount = 100
): Promise<Array<OrderDocLite & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<OrderDocLite>(tenantId, 'orders'), orderBy('created_at', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDocLite) }));
}

export async function listOrdersByIds(
  tenantId: string,
  orderIds: string[]
): Promise<Array<OrderDocLite & { id: string }>> {
  if (!orderIds.length) return [];
  const uniqueIds = [...new Set(orderIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const all: Array<OrderDocLite & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderDocLite>(tenantId, 'orders'), where('__name__', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDocLite) })));
  }
  return all;
}

export async function listCancelledOrders(
  tenantId: string,
  options: {
    cancelledStartIso?: string;
    cancelledEndIso?: string;
    reasonContains?: string;
    cancelledBy?: string;
    max?: number;
  } = {}
): Promise<Array<OrderDocLite & { id: string }>> {
  const snap = await getDocs(
    query(
      tenantCollection<OrderDocLite>(tenantId, 'orders'),
      where('status', '==', 'cancelled'),
      orderBy('cancelled_at', 'desc'),
      ...(options.max ? [limit(options.max)] : [])
    )
  );

  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDocLite) }));

  if (options.cancelledStartIso) {
    rows = rows.filter((row) => Boolean(row.cancelled_at) && row.cancelled_at! >= options.cancelledStartIso!);
  }
  if (options.cancelledEndIso) {
    rows = rows.filter((row) => Boolean(row.cancelled_at) && row.cancelled_at! <= options.cancelledEndIso!);
  }
  if (options.reasonContains) {
    const needle = options.reasonContains.toLowerCase();
    rows = rows.filter((row) => (row.cancellation_reason || '').toLowerCase().includes(needle));
  }
  if (options.cancelledBy) {
    rows = rows.filter((row) => row.cancelled_by === options.cancelledBy);
  }

  return rows;
}

export async function getOrderById(
  tenantId: string,
  orderId: string
): Promise<(OrderDocLite & { id: string }) | null> {
  const snap = await getDoc(doc(tenantCollection<OrderDocLite>(tenantId, 'orders'), orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as OrderDocLite) };
}

export async function updateOrderById(
  tenantId: string,
  orderId: string,
  payload: Partial<OrderDocLite>
): Promise<void> {
  await updateDoc(doc(tenantCollection<OrderDocLite>(tenantId, 'orders'), orderId), payload);
}

export async function createOrder(
  tenantId: string,
  payload: Omit<OrderDocLite, 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<OrderDocLite & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<OrderDocLite>(tenantId, 'orders'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as OrderDocLite) };
}

export async function listOrderItemsByOrderIds(
  tenantId: string,
  orderIds: string[]
): Promise<Array<OrderItemDocLite & { id: string }>> {
  if (!orderIds.length) return [];
  const uniqueIds = [...new Set(orderIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));
  const all: Array<OrderItemDocLite & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), where('order_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemDocLite) })));
  }
  return all;
}

export async function getOrderItemById(
  tenantId: string,
  itemId: string
): Promise<(OrderItemDocLite & { id: string }) | null> {
  const snap = await getDoc(doc(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as OrderItemDocLite) };
}

export async function listOrderItemsByOrderId(
  tenantId: string,
  orderId: string
): Promise<Array<OrderItemDocLite & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), where('order_id', '==', orderId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemDocLite) }));
}

export async function listRecentOrderItems(
  tenantId: string,
  limitCount = 300
): Promise<Array<OrderItemDocLite & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), orderBy('updated_at', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemDocLite) }));
}

export async function listOrderItemsByIds(
  tenantId: string,
  itemIds: string[]
): Promise<Array<OrderItemDocLite & { id: string }>> {
  if (!itemIds.length) return [];
  const uniqueIds = [...new Set(itemIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const all: Array<OrderItemDocLite & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), where('__name__', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemDocLite) })));
  }
  return all;
}

export async function countOrderItemsAtStation(
  tenantId: string,
  stationId: string,
  statuses?: string[]
): Promise<number> {
  const snap = await getDocs(
    query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), where('current_station_id', '==', stationId))
  );
  const rows = snap.docs.map((d) => d.data() as OrderItemDocLite);
  if (!statuses?.length) return rows.length;
  const allowed = new Set(statuses);
  return rows.filter((row) => row.station_status && allowed.has(row.station_status)).length;
}

export async function countOrderItemsAtDevice(
  tenantId: string,
  deviceId: string,
  statuses?: string[]
): Promise<number> {
  const snap = await getDocs(
    query(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), where('current_device_id', '==', deviceId))
  );
  const rows = snap.docs
    .map((d) => d.data() as OrderItemDocLite)
    .filter((row) => !row.cancelled_at && !row.served_at);
  if (!statuses?.length) return rows.length;
  const allowed = new Set(statuses);
  return rows.filter((row) => row.station_status && allowed.has(row.station_status)).length;
}

type InitialRoutingDevice = {
  device_id: string;
  station_id: string;
  stage_type: NonNullable<KdsDeviceDoc['stage_type']>;
  display_order: number;
  is_terminal: boolean;
  routing_mode: 'default' | 'keywords';
  routing_keywords: string[];
  is_entry_device: boolean;
  next_device_ids: string[];
  next_device_id: string | null;
  last_seen_at: string | null;
  is_active: boolean;
};

function isInitialRoutingDeviceOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < 30 * 1000;
}

function normalizeInitialRoutingMode(value: unknown): 'default' | 'keywords' {
  return value === 'keywords' ? 'keywords' : 'default';
}

function normalizeInitialRoutingKeywords(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function normalizeInitialNextDeviceIds(value: unknown, fallback?: unknown): string[] {
  if (Array.isArray(value)) {
    const nextIds = value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (nextIds.length) {
      return Array.from(new Set(nextIds));
    }
  }

  const legacyId = fallback ? String(fallback).trim() : '';
  return legacyId ? [legacyId] : [];
}

function inferInitialEntryDevice(stationType?: string | null) {
  return stationType === 'item_assembly' || stationType === 'prep_start' || stationType === 'assembly';
}

function resolveInitialRoutingDevices(
  devices: Array<KdsDeviceDoc & { id: string }>,
  stationMap: Map<string, KdsStationDoc & { id: string }>
): InitialRoutingDevice[] {
  return devices
    .filter((device) => device.is_active !== false && !!device.station_id)
    .map((device) => {
      const stationType = device.station_id ? stationMap.get(device.station_id)?.station_type ?? null : null;
      const stageType = normalizeKdsDeviceStageType(device.stage_type, normalizeKdsDeviceStageType(stationType));
      const isTerminal = device.is_terminal === true;
      const nextDeviceIds = isTerminal
        ? []
        : normalizeInitialNextDeviceIds(device.next_device_ids, device.next_device_id);
      return {
        device_id: device.device_id,
        station_id: device.station_id!,
        stage_type: stageType,
        display_order: normalizeKdsDeviceDisplayOrder(
          device.display_order,
          normalizeKdsDeviceDisplayOrder(stationMap.get(device.station_id!)?.sort_order, 1)
        ),
        is_terminal: isTerminal,
        routing_mode: normalizeInitialRoutingMode(device.routing_mode),
        routing_keywords: normalizeInitialRoutingKeywords(device.routing_keywords),
        is_entry_device:
          typeof device.is_entry_device === 'boolean'
            ? Boolean(device.is_entry_device)
            : inferInitialEntryDevice(stationType),
        next_device_ids: nextDeviceIds,
        next_device_id: nextDeviceIds[0] || null,
        last_seen_at: device.last_seen_at || null,
        is_active: device.is_active !== false,
      };
    });
}

function buildInitialRoutingText(item: Pick<OrderItemDocLite, 'notes'>) {
  return String(item.notes || '').toLowerCase().trim();
}

function sortInitialStationsByOrder(stations: Array<KdsStationDoc & { id: string }>) {
  return [...stations]
    .filter((station) => station.is_active !== false && !station.deleted_at)
    .sort((left, right) => normalizeKdsDeviceDisplayOrder(left.sort_order, 0) - normalizeKdsDeviceDisplayOrder(right.sort_order, 0));
}

function getInitialEntryStationsForItem(
  stations: Array<KdsStationDoc & { id: string }>,
  hasBorder: boolean
) {
  const sortedStations = sortInitialStationsByOrder(stations);
  const nonTerminalStations = sortedStations.filter((station) => station.station_type !== 'order_status');
  if (!nonTerminalStations.length) return [] as Array<KdsStationDoc & { id: string }>;

  if (hasBorder) {
    const borderStations = nonTerminalStations.filter((station) => station.station_type === 'item_assembly');
    const selectedStations = borderStations.length ? borderStations : nonTerminalStations;
    const firstOrder = normalizeKdsDeviceDisplayOrder(selectedStations[0]?.sort_order, 0);
    return selectedStations.filter((station) => normalizeKdsDeviceDisplayOrder(station.sort_order, 0) === firstOrder);
  }

  const nonBorderStations = nonTerminalStations.filter((station) => station.station_type !== 'item_assembly');
  const prepStartStations = nonBorderStations.filter((station) => station.station_type === 'prep_start');
  const selectedStations = prepStartStations.length ? prepStartStations : nonBorderStations;
  const firstOrder = normalizeKdsDeviceDisplayOrder(selectedStations[0]?.sort_order, 0);
  return selectedStations.filter((station) => normalizeKdsDeviceDisplayOrder(station.sort_order, 0) === firstOrder);
}

function getInitialCandidateDevicesForStations(
  stations: Array<KdsStationDoc & { id: string }>,
  allDevices: InitialRoutingDevice[],
  onlineDevices: InitialRoutingDevice[]
) {
  const stationIds = new Set(stations.map((station) => station.id));
  const onlineCandidates = onlineDevices.filter((device) => stationIds.has(device.station_id));
  if (onlineCandidates.length) {
    return onlineCandidates;
  }

  return allDevices.filter((device) => stationIds.has(device.station_id));
}

function filterInitialEntryDevices(devices: InitialRoutingDevice[], itemRoutingText: string) {
  const entryDevices = devices.filter((device) => device.is_entry_device);
  if (!entryDevices.length) return [] as InitialRoutingDevice[];

  const keywordDevices = entryDevices.filter(
    (device) =>
      device.routing_mode === 'keywords' &&
      device.routing_keywords.length > 0 &&
      device.routing_keywords.some((keyword) => itemRoutingText.includes(keyword))
  );
  if (keywordDevices.length) {
    return keywordDevices;
  }

  return entryDevices.filter(
    (device) => device.routing_mode !== 'keywords' || device.routing_keywords.length === 0
  );
}

function getInitialFallbackDevicesFromEntryNextSteps(
  allDevices: InitialRoutingDevice[],
  onlineDevices: InitialRoutingDevice[]
) {
  const entryDevices = allDevices.filter((device) => device.is_entry_device);
  const fallbackNextIds = Array.from(new Set(entryDevices.flatMap((device) => device.next_device_ids).filter(Boolean)));
  if (!fallbackNextIds.length) return [] as InitialRoutingDevice[];

  const allFallbackDevices = fallbackNextIds
    .map((deviceId) => allDevices.find((device) => device.device_id === deviceId) ?? null)
    .filter((device): device is InitialRoutingDevice => !!device);
  if (!allFallbackDevices.length) return [] as InitialRoutingDevice[];

  const onlineFallbackIds = new Set(onlineDevices.map((device) => device.device_id));
  const onlineFallbackDevices = allFallbackDevices.filter((device) => onlineFallbackIds.has(device.device_id));
  return onlineFallbackDevices.length ? onlineFallbackDevices : allFallbackDevices;
}

function getInitialCandidateDevices(
  allDevices: InitialRoutingDevice[],
  onlineDevices: InitialRoutingDevice[],
  itemRoutingText: string
) {
  const onlineCandidates = filterInitialEntryDevices(onlineDevices, itemRoutingText);
  if (onlineCandidates.length) {
    return onlineCandidates;
  }

  const allCandidates = filterInitialEntryDevices(allDevices, itemRoutingText);
  if (allCandidates.length) {
    return allCandidates;
  }

  const fallbackNextDevices = getInitialFallbackDevicesFromEntryNextSteps(allDevices, onlineDevices);
  if (fallbackNextDevices.length) {
    return fallbackNextDevices;
  }

  return onlineDevices.length ? onlineDevices : allDevices;
}

function isActiveOrderItemForRouting(item: OrderItemDocLite) {
  if (item.cancelled_at || item.served_at) return false;
  if (item.status === 'cancelled' || item.status === 'delivered') return false;
  if (item.station_status === 'completed' || item.station_status === 'done') return false;
  return true;
}

async function getPreferredOrderDeviceForCandidates(
  tenantId: string,
  orderId: string,
  candidateDeviceIds: Set<string>,
  excludeItemId: string
) {
  const existingItems = await listOrderItemsByOrderId(tenantId, orderId);
  for (const item of existingItems) {
    if (item.id === excludeItemId) continue;
    if (!isActiveOrderItemForRouting(item)) continue;
    const currentDeviceId = item.current_device_id || null;
    if (currentDeviceId && candidateDeviceIds.has(currentDeviceId)) {
      return currentDeviceId;
    }
  }
  return null;
}

async function assignInitialKdsDeviceToOrderItem(
  tenantId: string,
  itemId: string,
  payload: Omit<OrderItemDocLite, 'tenant_id' | 'created_at'>
) {
  if (payload.current_device_id || payload.current_station_id) return;

  const order = await getOrderById(tenantId, payload.order_id);
  if (!order) return;
  if (order.status === 'ready' || order.status === 'delivered' || order.status === 'cancelled') return;

  const [stations, devices] = await Promise.all([
    listKdsStations(tenantId),
    listKdsDevices(tenantId),
  ]);

  const stationMap = new Map(stations.map((station) => [station.id, station]));
  const activeStations = sortInitialStationsByOrder(stations);
  const allDevices = resolveInitialRoutingDevices(devices, stationMap).filter((device) => stationMap.has(device.station_id));
  if (!allDevices.length) return;

  const onlineDevices = allDevices.filter((device) => isInitialRoutingDeviceOnline(device.last_seen_at));
  const candidateStations = getInitialEntryStationsForItem(
    activeStations,
    buildInitialRoutingText(payload).includes('border') || buildInitialRoutingText(payload).includes('borda')
  );
  const candidateDevices = getInitialCandidateDevicesForStations(candidateStations, allDevices, onlineDevices);
  if (!candidateDevices.length) return;

  const preferredDeviceId = await getPreferredOrderDeviceForCandidates(
    tenantId,
    payload.order_id,
    new Set(candidateDevices.map((device) => device.device_id)),
    itemId
  );

  let selectedDevice = preferredDeviceId
    ? candidateDevices.find((device) => device.device_id === preferredDeviceId) ?? null
    : null;

  if (!selectedDevice) {
    const deviceLoads = await Promise.all(
      candidateDevices.map(async (device) => ({
        deviceId: device.device_id,
        load: await countOrderItemsAtDevice(tenantId, device.device_id, ['waiting', 'in_progress']),
      }))
    );

    deviceLoads.sort((left, right) => {
      if (left.load !== right.load) return left.load - right.load;
      return left.deviceId.localeCompare(right.deviceId);
    });

    const selectedDeviceId = deviceLoads[0]?.deviceId ?? null;
    selectedDevice = selectedDeviceId
      ? candidateDevices.find((device) => device.device_id === selectedDeviceId) ?? null
      : null;
  }

  if (!selectedDevice) return;

  await updateOrderItemById(tenantId, itemId, {
    current_station_id: selectedDevice.station_id,
    current_device_id: selectedDevice.device_id,
    station_status: 'waiting',
    station_started_at: null,
    station_completed_at: null,
    claimed_by_device_id: null,
    claimed_at: null,
    updated_at: new Date().toISOString(),
  });
}

export async function createOrderItem(
  tenantId: string,
  payload: Omit<OrderItemDocLite, 'tenant_id' | 'created_at'>
): Promise<OrderItemDocLite & { id: string }> {
  const createdAt = new Date().toISOString();
  const ref = await addDoc(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), {
    ...payload,
    created_at: createdAt,
    tenant_id: tenantId,
  });
  await assignInitialKdsDeviceToOrderItem(tenantId, ref.id, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as OrderItemDocLite) };
}

export async function updateOrderItemById(
  tenantId: string,
  itemId: string,
  payload: Partial<OrderItemDocLite>
): Promise<void> {
  await updateDoc(doc(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), itemId), payload);
}

export async function deleteOrderItemById(tenantId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<OrderItemDocLite>(tenantId, 'order_items'), itemId));
}

export async function listOrderItemExtrasByItemIds(
  tenantId: string,
  itemIds: string[]
): Promise<Array<OrderItemExtraDoc & { id: string }>> {
  if (!itemIds.length) return [];
  const uniqueIds = [...new Set(itemIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));
  const all: Array<OrderItemExtraDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderItemExtraDoc>(tenantId, 'order_item_extras'), where('order_item_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemExtraDoc) })));
  }
  return all;
}

export async function createOrderItemExtras(
  tenantId: string,
  extras: Omit<OrderItemExtraDoc, 'tenant_id'>[]
): Promise<Array<OrderItemExtraDoc & { id: string }>> {
  const created: Array<OrderItemExtraDoc & { id: string }> = [];
  for (const extra of extras) {
    const ref = await addDoc(tenantCollection<OrderItemExtraDoc>(tenantId, 'order_item_extras'), {
      ...extra,
      tenant_id: tenantId,
    });
    const snap = await getDoc(ref);
    created.push({ id: snap.id, ...(snap.data() as OrderItemExtraDoc) });
  }
  return created;
}

export async function listOrderItemSubItemsByItemIds(
  tenantId: string,
  itemIds: string[]
): Promise<Array<OrderItemSubItemDoc & { id: string }>> {
  if (!itemIds.length) return [];
  const uniqueIds = [...new Set(itemIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));
  const all: Array<OrderItemSubItemDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderItemSubItemDoc>(tenantId, 'order_item_sub_items'), where('order_item_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemSubItemDoc) })));
  }
  return all;
}

export async function createOrderItemSubItems(
  tenantId: string,
  subItems: Omit<OrderItemSubItemDoc, 'tenant_id'>[]
): Promise<Array<OrderItemSubItemDoc & { id: string }>> {
  const created: Array<OrderItemSubItemDoc & { id: string }> = [];
  for (const subItem of subItems) {
    const ref = await addDoc(tenantCollection<OrderItemSubItemDoc>(tenantId, 'order_item_sub_items'), {
      ...subItem,
      tenant_id: tenantId,
    });
    const snap = await getDoc(ref);
    created.push({ id: snap.id, ...(snap.data() as OrderItemSubItemDoc) });
  }
  return created;
}

export async function listOrderItemSubExtrasBySubItemIds(
  tenantId: string,
  subItemIds: string[]
): Promise<Array<OrderItemSubItemExtraDoc & { id: string }>> {
  if (!subItemIds.length) return [];
  const uniqueIds = [...new Set(subItemIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));
  const all: Array<OrderItemSubItemExtraDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<OrderItemSubItemExtraDoc>(tenantId, 'order_item_sub_item_extras'), where('sub_item_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemSubItemExtraDoc) })));
  }
  return all;
}

export async function createOrderItemSubExtras(
  tenantId: string,
  extras: Omit<OrderItemSubItemExtraDoc, 'tenant_id'>[]
): Promise<Array<OrderItemSubItemExtraDoc & { id: string }>> {
  const created: Array<OrderItemSubItemExtraDoc & { id: string }> = [];
  for (const extra of extras) {
    const ref = await addDoc(tenantCollection<OrderItemSubItemExtraDoc>(tenantId, 'order_item_sub_item_extras'), {
      ...extra,
      tenant_id: tenantId,
    });
    const snap = await getDoc(ref);
    created.push({ id: snap.id, ...(snap.data() as OrderItemSubItemExtraDoc) });
  }
  return created;
}

export async function createOrderItemCancellation(
  tenantId: string,
  payload: Omit<OrderItemCancellationDoc, 'tenant_id'>
): Promise<void> {
  await addDoc(tenantCollection<OrderItemCancellationDoc>(tenantId, 'order_item_cancellations'), {
    ...payload,
    tenant_id: tenantId,
  });
}

export async function listOrderItemCancellations(
  tenantId: string,
  limitCount = 500
): Promise<Array<OrderItemCancellationDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<OrderItemCancellationDoc>(tenantId, 'order_item_cancellations'), orderBy('cancelled_at', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderItemCancellationDoc) }));
}

export async function getKdsGlobalSettings(tenantId: string): Promise<(KdsGlobalSettingsDoc & { id: string }) | null> {
  const snap = await getDocs(query(tenantCollection<KdsGlobalSettingsDoc>(tenantId, 'kds_global_settings'), limit(1)));
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as KdsGlobalSettingsDoc) };
}

export async function upsertKdsGlobalSettings(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const existing = await getKdsGlobalSettings(tenantId);
  if (existing?.id) {
    await updateDoc(doc(tenantCollection<KdsGlobalSettingsDoc>(tenantId, 'kds_global_settings'), existing.id), {
      ...payload,
      tenant_id: tenantId,
    });
    return;
  }

  await addDoc(tenantCollection<KdsGlobalSettingsDoc>(tenantId, 'kds_global_settings'), {
    ...payload,
    tenant_id: tenantId,
  } as KdsGlobalSettingsDoc);
}

export async function createKdsStationLog(
  tenantId: string,
  payload: Omit<KdsStationLogDoc, 'tenant_id' | 'created_at'>
): Promise<KdsStationLogDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<KdsStationLogDoc>(tenantId, 'kds_station_logs'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as KdsStationLogDoc) };
}

export async function listKdsStationLogs(
  tenantId: string,
  options: {
    orderItemId?: string;
    stationId?: string;
    action?: KdsStationLogDoc['action'];
    createdAfter?: string;
    limitCount?: number;
  } = {}
): Promise<Array<KdsStationLogDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'asc')];
  if (options.orderItemId) constraints.push(where('order_item_id', '==', options.orderItemId));
  if (options.stationId) constraints.push(where('station_id', '==', options.stationId));
  if (options.action) constraints.push(where('action', '==', options.action));
  if (options.createdAfter) constraints.push(where('created_at', '>=', options.createdAfter));
  if (options.limitCount) constraints.push(limit(options.limitCount));
  const snap = await getDocs(query(tenantCollection<KdsStationLogDoc>(tenantId, 'kds_station_logs'), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as KdsStationLogDoc) }));
}

export async function listCustomSounds(tenantId: string): Promise<Array<CustomSoundDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<CustomSoundDoc>(tenantId, 'custom_sounds'), orderBy('created_at', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomSoundDoc) }));
}

export async function createCustomSound(
  tenantId: string,
  payload: Omit<CustomSoundDoc, 'tenant_id' | 'created_at'>
): Promise<CustomSoundDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<CustomSoundDoc>(tenantId, 'custom_sounds'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CustomSoundDoc) };
}

export async function deleteCustomSound(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<CustomSoundDoc>(tenantId, 'custom_sounds'), id));
}

export async function updateCategory(tenantId: string, id: string, payload: Partial<CategoryDoc>): Promise<CategoryDoc & { id: string }> {
  const ref = doc(tenantCollection<CategoryDoc>(tenantId, 'categories'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CategoryDoc) };
}

export async function listCustomers(tenantId: string): Promise<Array<CustomerDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<CustomerDoc>(tenantId, 'customers'), orderBy('last_order_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function searchCustomers(tenantId: string, term: string): Promise<Array<CustomerDoc & { id: string }>> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];
  const all = await listCustomers(tenantId);
  return all
    .filter((c) => c.name.toLowerCase().includes(normalized) || (c.phone || '').toLowerCase().includes(normalized))
    .slice(0, 5);
}

export async function createCustomer(
  tenantId: string,
  payload: Pick<CustomerDoc, 'name' | 'phone' | 'address' | 'notes'>
): Promise<CustomerDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<CustomerDoc>(tenantId, 'customers'), {
    name: payload.name,
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    notes: payload.notes ?? null,
    total_orders: 0,
    total_spent: 0,
    last_order_at: null,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CustomerDoc) };
}

export async function updateCustomer(tenantId: string, id: string, payload: Partial<CustomerDoc>): Promise<CustomerDoc & { id: string }> {
  const ref = doc(tenantCollection<CustomerDoc>(tenantId, 'customers'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CustomerDoc) };
}

export async function updateCustomerStats(tenantId: string, id: string, orderTotal: number): Promise<CustomerDoc & { id: string }> {
  const ref = doc(tenantCollection<CustomerDoc>(tenantId, 'customers'), id);
  await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Cliente nao encontrado');
    }
    const current = snap.data() as CustomerDoc;
    tx.update(ref, {
      total_orders: (current.total_orders || 0) + 1,
      total_spent: (current.total_spent || 0) + orderTotal,
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CustomerDoc) };
}

export async function findOrCreateCustomer(
  tenantId: string,
  payload: { name?: string; phone?: string; address?: string }
): Promise<(CustomerDoc & { id: string }) | null> {
  if (!payload.phone && !payload.name) return null;

  if (payload.phone) {
    const byPhone = await getDocs(
      query(tenantCollection<CustomerDoc>(tenantId, 'customers'), where('phone', '==', payload.phone), ...([] as QueryConstraint[]))
    );
    if (!byPhone.empty) {
      const existing = byPhone.docs[0];
      return { id: existing.id, ...(existing.data() as CustomerDoc) };
    }
  }

  return createCustomer(tenantId, {
    name: payload.name || 'Cliente',
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    notes: null,
  });
}

export async function listTables(tenantId: string): Promise<Array<TableDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<TableDoc>(tenantId, 'tables'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => (a.number || 0) - (b.number || 0));
}

export async function createTable(
  tenantId: string,
  payload: Omit<TableDoc, 'tenant_id' | 'created_at'>
): Promise<TableDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<TableDoc>(tenantId, 'tables'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as TableDoc) };
}

export async function updateTable(tenantId: string, id: string, payload: Partial<TableDoc>): Promise<TableDoc & { id: string }> {
  const ref = doc(tenantCollection<TableDoc>(tenantId, 'tables'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as TableDoc) };
}

export async function deleteTable(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<TableDoc>(tenantId, 'tables'), id));
}

export async function createInitialTables(tenantId: string, amount = 10): Promise<void> {
  const tasks: Promise<TableDoc & { id: string }>[] = [];
  for (let i = 0; i < amount; i += 1) {
    tasks.push(
      createTable(tenantId, {
        number: i + 1,
        capacity: 4,
        status: 'available',
        position_x: 0,
        position_y: 0,
      })
    );
  }
  await Promise.all(tasks);
}

export async function listIngredients(tenantId: string): Promise<Array<IngredientDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<IngredientDoc>(tenantId, 'ingredients'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getIngredientById(tenantId: string, id: string): Promise<(IngredientDoc & { id: string }) | null> {
  const snap = await getDoc(doc(tenantCollection<IngredientDoc>(tenantId, 'ingredients'), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as IngredientDoc) };
}

export async function createIngredient(
  tenantId: string,
  payload: Omit<IngredientDoc, 'tenant_id' | 'created_at' | 'updated_at'>
): Promise<IngredientDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<IngredientDoc>(tenantId, 'ingredients'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as IngredientDoc) };
}

export async function updateIngredient(
  tenantId: string,
  id: string,
  payload: Partial<IngredientDoc>
): Promise<IngredientDoc & { id: string }> {
  const ref = doc(tenantCollection<IngredientDoc>(tenantId, 'ingredients'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as IngredientDoc) };
}

export async function listPaymentsByCashRegister(tenantId: string, cashRegisterId: string): Promise<Array<PaymentDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<PaymentDoc>(tenantId, 'payments'), where('cash_register_id', '==', cashRegisterId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listPaymentsByOrderIds(tenantId: string, orderIds: string[]): Promise<Array<PaymentDoc & { id: string }>> {
  if (orderIds.length === 0) return [];
  const uniqueIds = [...new Set(orderIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }
  const all: Array<PaymentDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<PaymentDoc>(tenantId, 'payments'), where('order_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

export async function listPaymentsByOrder(tenantId: string, orderId: string): Promise<Array<PaymentDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<PaymentDoc>(tenantId, 'payments'), where('order_id', '==', orderId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPayment(
  tenantId: string,
  payload: Omit<PaymentDoc, 'tenant_id' | 'created_at'>
): Promise<PaymentDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<PaymentDoc>(tenantId, 'payments'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as PaymentDoc) };
}

export async function listProductExtras(tenantId: string): Promise<Array<ProductExtraDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<ProductExtraDoc>(tenantId, 'product_extras'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function createProductExtra(
  tenantId: string,
  payload: Omit<ProductExtraDoc, 'tenant_id' | 'created_at'>
): Promise<ProductExtraDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductExtraDoc>(tenantId, 'product_extras'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductExtraDoc) };
}

export async function updateProductExtra(
  tenantId: string,
  id: string,
  payload: Partial<ProductExtraDoc>
): Promise<ProductExtraDoc & { id: string }> {
  const ref = doc(tenantCollection<ProductExtraDoc>(tenantId, 'product_extras'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductExtraDoc) };
}

export async function deleteProductExtra(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ProductExtraDoc>(tenantId, 'product_extras'), id));
}

export async function listProductExtraLinks(
  tenantId: string,
  extraId?: string
): Promise<Array<ProductExtraLinkDoc & { id: string }>> {
  const base = tenantCollection<ProductExtraLinkDoc>(tenantId, 'product_extra_links');
  const snap = extraId ? await getDocs(query(base, where('extra_id', '==', extraId))) : await getDocs(base);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listExtrasForProduct(
  tenantId: string,
  productId: string
): Promise<Array<(ProductExtraLinkDoc & { id: string }) & { product_extras: ProductExtraDoc & { id: string } }>> {
  const linksSnap = await getDocs(
    query(tenantCollection<ProductExtraLinkDoc>(tenantId, 'product_extra_links'), where('product_id', '==', productId))
  );
  const links = linksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const extraIds = links.map((l) => l.extra_id);
  const extras = await listProductExtras(tenantId);
  const extrasMap = new Map(extras.map((e) => [e.id, e]));
  return links
    .map((link) => {
      const extra = extrasMap.get(link.extra_id);
      if (!extra) return null;
      return { ...link, product_extras: extra };
    })
    .filter(Boolean) as Array<(ProductExtraLinkDoc & { id: string }) & { product_extras: ProductExtraDoc & { id: string } }>;
}

export async function linkProductExtra(tenantId: string, productId: string, extraId: string): Promise<void> {
  await addDoc(tenantCollection<ProductExtraLinkDoc>(tenantId, 'product_extra_links'), {
    product_id: productId,
    extra_id: extraId,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
}

export async function unlinkProductExtra(tenantId: string, productId: string, extraId: string): Promise<void> {
  const snap = await getDocs(
    query(
      tenantCollection<ProductExtraLinkDoc>(tenantId, 'product_extra_links'),
      where('product_id', '==', productId),
      where('extra_id', '==', extraId)
    )
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function replaceProductsForExtra(tenantId: string, extraId: string, productIds: string[]): Promise<void> {
  const existing = await getDocs(
    query(tenantCollection<ProductExtraLinkDoc>(tenantId, 'product_extra_links'), where('extra_id', '==', extraId))
  );
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  await Promise.all(productIds.map((productId) => linkProductExtra(tenantId, productId, extraId)));
}

export async function listProductVariations(
  tenantId: string,
  productId?: string
): Promise<Array<ProductVariationDoc & { id: string }>> {
  const base = tenantCollection<ProductVariationDoc>(tenantId, 'product_variations');
  const snap = productId ? await getDocs(query(base, where('product_id', '==', productId))) : await getDocs(base);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function createProductVariation(
  tenantId: string,
  payload: Omit<ProductVariationDoc, 'tenant_id'>
): Promise<ProductVariationDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductVariationDoc>(tenantId, 'product_variations'), {
    ...payload,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductVariationDoc) };
}

export async function updateProductVariation(
  tenantId: string,
  id: string,
  payload: Partial<ProductVariationDoc>
): Promise<ProductVariationDoc & { id: string }> {
  const ref = doc(tenantCollection<ProductVariationDoc>(tenantId, 'product_variations'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductVariationDoc) };
}

export async function deleteProductVariation(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ProductVariationDoc>(tenantId, 'product_variations'), id));
}

export async function listProductIngredients(
  tenantId: string,
  productId?: string
): Promise<Array<(ProductIngredientDoc & { id: string }) & { ingredient: { id: string; name: string; unit: string; cost_per_unit: number } | null }>> {
  const base = tenantCollection<ProductIngredientDoc>(tenantId, 'product_ingredients');
  const snap = productId ? await getDocs(query(base, where('product_id', '==', productId))) : await getDocs(base);
  const links = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ingredients = await listIngredients(tenantId);
  const map = new Map(ingredients.map((i) => [i.id, i]));
  return links.map((l) => {
    const ingredient = map.get(l.ingredient_id);
    return {
      ...l,
      ingredient: ingredient
        ? {
            id: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
            cost_per_unit: ingredient.cost_per_unit,
          }
        : null,
    };
  });
}

export async function addProductIngredient(
  tenantId: string,
  payload: { product_id: string; ingredient_id: string; quantity: number }
): Promise<ProductIngredientDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductIngredientDoc>(tenantId, 'product_ingredients'), {
    ...payload,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductIngredientDoc) };
}

export async function updateProductIngredient(
  tenantId: string,
  id: string,
  payload: Partial<ProductIngredientDoc>
): Promise<ProductIngredientDoc & { id: string }> {
  const ref = doc(tenantCollection<ProductIngredientDoc>(tenantId, 'product_ingredients'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductIngredientDoc) };
}

export async function removeProductIngredient(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ProductIngredientDoc>(tenantId, 'product_ingredients'), id));
}

export async function getOpenCashRegister(tenantId: string): Promise<(CashRegisterDoc & { id: string }) | null> {
  const snap = await getDocs(
    query(tenantCollection<CashRegisterDoc>(tenantId, 'cash_registers'), where('status', '==', 'open'), limit(1))
  );
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as CashRegisterDoc) };
}

export async function createCashRegister(
  tenantId: string,
  payload: { opened_by: string; opening_amount: number }
): Promise<CashRegisterDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<CashRegisterDoc>(tenantId, 'cash_registers'), {
    opened_by: payload.opened_by,
    closed_by: null,
    opening_amount: payload.opening_amount,
    closing_amount: null,
    expected_amount: null,
    difference: null,
    status: 'open',
    opened_at: now,
    closed_at: null,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CashRegisterDoc) };
}

export async function getCashRegisterById(tenantId: string, id: string): Promise<(CashRegisterDoc & { id: string }) | null> {
  const snap = await getDoc(doc(tenantCollection<CashRegisterDoc>(tenantId, 'cash_registers'), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as CashRegisterDoc) };
}

export async function closeCashRegister(
  tenantId: string,
  id: string,
  payload: { closed_by: string; closing_amount: number; expected_amount: number; difference: number }
): Promise<CashRegisterDoc & { id: string }> {
  const ref = doc(tenantCollection<CashRegisterDoc>(tenantId, 'cash_registers'), id);
  await updateDoc(ref, {
    closed_by: payload.closed_by,
    closing_amount: payload.closing_amount,
    expected_amount: payload.expected_amount,
    difference: payload.difference,
    status: 'closed',
    closed_at: new Date().toISOString(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as CashRegisterDoc) };
}

export async function listCashRegisters(tenantId: string, limitCount = 50): Promise<Array<CashRegisterDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<CashRegisterDoc>(tenantId, 'cash_registers'), orderBy('opened_at', 'desc'), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCashMovement(
  tenantId: string,
  payload: { cash_register_id: string; movement_type: 'withdrawal' | 'supply'; amount: number; reason: string; created_by: string | null }
): Promise<void> {
  await addDoc(tenantCollection<CashMovementDoc>(tenantId, 'cash_movements'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
}

export async function listCashMovements(
  tenantId: string,
  cashRegisterId?: string
): Promise<Array<CashMovementDoc & { id: string }>> {
  const base = tenantCollection<CashMovementDoc>(tenantId, 'cash_movements');
  const snap = cashRegisterId
    ? await getDocs(query(base, where('cash_register_id', '==', cashRegisterId), orderBy('created_at', 'desc')))
    : await getDocs(query(base, orderBy('created_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listReservations(
  tenantId: string,
  reservationDate?: string
): Promise<Array<(ReservationDoc & { id: string }) & { table?: { number: number; capacity: number } }>> {
  const constraints: QueryConstraint[] = [orderBy('reservation_time', 'asc')];
  if (reservationDate) {
    constraints.unshift(where('reservation_date', '==', reservationDate));
  }

  const [reservationsSnap, tablesSnap] = await Promise.all([
    getDocs(query(tenantCollection<ReservationDoc>(tenantId, 'reservations'), ...constraints)),
    getDocs(tenantCollection<TableDoc>(tenantId, 'tables')),
  ]);

  const tablesMap = new Map<string, TableDoc>();
  tablesSnap.docs.forEach((t) => tablesMap.set(t.id, t.data()));

  return reservationsSnap.docs.map((d) => {
    const data = d.data();
    const table = tablesMap.get(data.table_id);
    return {
      id: d.id,
      ...data,
      table: table ? { number: table.number, capacity: table.capacity } : undefined,
    };
  });
}

export async function createReservation(
  tenantId: string,
  payload: Omit<ReservationDoc, 'created_at' | 'tenant_id'>
): Promise<ReservationDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ReservationDoc>(tenantId, 'reservations'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ReservationDoc) };
}

export async function updateReservation(
  tenantId: string,
  id: string,
  payload: Partial<ReservationDoc>
): Promise<ReservationDoc & { id: string }> {
  const ref = doc(tenantCollection<ReservationDoc>(tenantId, 'reservations'), id);
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ReservationDoc) };
}

export async function isTableAvailable(
  tenantId: string,
  tableId: string,
  reservationDate: string,
  reservationTime: string
): Promise<boolean> {
  const hour = parseInt(reservationTime.split(':')[0] || '0', 10);
  const minTime = `${String(hour).padStart(2, '0')}:00`;
  const maxTime = `${String(hour + 2).padStart(2, '0')}:00`;

  const snap = await getDocs(
    query(
      tenantCollection<ReservationDoc>(tenantId, 'reservations'),
      where('table_id', '==', tableId),
      where('reservation_date', '==', reservationDate),
      where('status', '==', 'confirmed')
    )
  );

  const collisions = snap.docs.filter((d) => {
    const t = d.data().reservation_time;
    return t >= minTime && t <= maxTime;
  });
  return collisions.length === 0;
}

export async function upsertCategory(tenantId: string, id: string, payload: CategoryDoc): Promise<void> {
  await setDoc(doc(tenantCollection<CategoryDoc>(tenantId, 'categories'), id), payload, { merge: true });
}

function sortByOrderThenName<T extends { sort_order?: number | null; name?: string | null }>(a: T, b: T): number {
  const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return (a.name || '').localeCompare(b.name || '');
}

export async function listComplementGroups(
  tenantId: string,
  includeInactive = false
): Promise<Array<ComplementGroupDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<ComplementGroupDoc>(tenantId, 'complement_groups'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const filtered = includeInactive ? rows : rows.filter((g) => g.is_active === true);
  return filtered.sort(sortByOrderThenName);
}

export async function createComplementGroup(
  tenantId: string,
  payload: Omit<ComplementGroupDoc, 'created_at' | 'updated_at' | 'tenant_id'>
): Promise<ComplementGroupDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<ComplementGroupDoc>(tenantId, 'complement_groups'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementGroupDoc) };
}

export async function updateComplementGroup(
  tenantId: string,
  id: string,
  payload: Partial<ComplementGroupDoc>
): Promise<ComplementGroupDoc & { id: string }> {
  const ref = doc(tenantCollection<ComplementGroupDoc>(tenantId, 'complement_groups'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementGroupDoc) };
}

export async function deleteComplementGroup(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ComplementGroupDoc>(tenantId, 'complement_groups'), id));
}

export async function listComplementOptions(
  tenantId: string,
  includeInactive = false
): Promise<Array<ComplementOptionDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<ComplementOptionDoc>(tenantId, 'complement_options'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const filtered = includeInactive ? rows : rows.filter((g) => g.is_active === true);
  return filtered.sort(sortByOrderThenName);
}

export async function listComplementOptionsByIds(
  tenantId: string,
  optionIds: string[]
): Promise<Array<ComplementOptionDoc & { id: string }>> {
  if (optionIds.length === 0) return [];
  const uniqueIds = [...new Set(optionIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }
  const all: Array<ComplementOptionDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<ComplementOptionDoc>(tenantId, 'complement_options'), where('__name__', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

export async function createComplementOption(
  tenantId: string,
  payload: Omit<ComplementOptionDoc, 'created_at' | 'updated_at' | 'tenant_id'>
): Promise<ComplementOptionDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<ComplementOptionDoc>(tenantId, 'complement_options'), {
    ...payload,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementOptionDoc) };
}

export async function updateComplementOption(
  tenantId: string,
  id: string,
  payload: Partial<ComplementOptionDoc>
): Promise<ComplementOptionDoc & { id: string }> {
  const ref = doc(tenantCollection<ComplementOptionDoc>(tenantId, 'complement_options'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementOptionDoc) };
}

export async function deleteComplementOption(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ComplementOptionDoc>(tenantId, 'complement_options'), id));
}

export async function listComplementGroupOptions(
  tenantId: string,
  groupId: string
): Promise<Array<(ComplementGroupOptionDoc & { id: string }) & { option: { id: string; name: string; price: number; is_active: boolean | null } }>> {
  const snap = await getDocs(
    query(tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'), where('group_id', '==', groupId))
  );
  const links = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const options = await listComplementOptionsByIds(tenantId, links.map((l) => l.option_id));
  const optionMap = new Map(options.map((o) => [o.id, o]));
  return links.map((l) => {
    const option = optionMap.get(l.option_id);
    return {
      ...l,
      option: {
        id: option?.id || l.option_id,
        name: option?.name || '',
        price: option?.price || 0,
        is_active: option?.is_active ?? null,
      },
    };
  });
}

export async function listAllComplementGroupOptions(tenantId: string): Promise<Array<ComplementGroupOptionDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listComplementOptionIngredients(
  tenantId: string,
  optionId: string
): Promise<Array<(ComplementOptionIngredientDoc & { id: string }) & { ingredient?: { id: string; name: string; unit: string } }>> {
  const [snap, ingredients] = await Promise.all([
    getDocs(query(tenantCollection<ComplementOptionIngredientDoc>(tenantId, 'complement_option_ingredients'), where('complement_option_id', '==', optionId))),
    listIngredients(tenantId),
  ]);
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ComplementOptionIngredientDoc) }))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map((row) => ({
      ...row,
      ingredient: row.ingredient_id
        ? (() => {
            const ingredient = ingredientMap.get(row.ingredient_id);
            return ingredient ? { id: ingredient.id, name: ingredient.name, unit: ingredient.unit } : undefined;
          })()
        : undefined,
    }));
}

export async function createComplementOptionIngredient(
  tenantId: string,
  payload: Omit<ComplementOptionIngredientDoc, 'tenant_id' | 'created_at'>
): Promise<ComplementOptionIngredientDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ComplementOptionIngredientDoc>(tenantId, 'complement_option_ingredients'), {
    ...payload,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementOptionIngredientDoc) };
}

export async function updateComplementOptionIngredient(
  tenantId: string,
  id: string,
  payload: Partial<ComplementOptionIngredientDoc>
): Promise<void> {
  await updateDoc(doc(tenantCollection<ComplementOptionIngredientDoc>(tenantId, 'complement_option_ingredients'), id), payload);
}

export async function deleteComplementOptionIngredient(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(tenantCollection<ComplementOptionIngredientDoc>(tenantId, 'complement_option_ingredients'), id));
}

export async function addComplementOptionToGroup(
  tenantId: string,
  payload: { group_id: string; option_id: string; price_override?: number; sort_order?: number; max_quantity?: number }
): Promise<ComplementGroupOptionDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'), {
    group_id: payload.group_id,
    option_id: payload.option_id,
    price_override: payload.price_override ?? null,
    max_quantity: payload.max_quantity ?? 1,
    sort_order: payload.sort_order ?? 0,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ComplementGroupOptionDoc) };
}

export async function removeComplementOptionFromGroup(tenantId: string, groupId: string, optionId: string): Promise<void> {
  const snap = await getDocs(
    query(
      tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'),
      where('group_id', '==', groupId),
      where('option_id', '==', optionId)
    )
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function updateComplementGroupOption(
  tenantId: string,
  id: string,
  payload: Partial<ComplementGroupOptionDoc>
): Promise<void> {
  await updateDoc(doc(tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'), id), payload);
}

export async function replaceComplementGroupOptions(
  tenantId: string,
  groupId: string,
  options: Array<{ option_id: string; max_quantity?: number; price_override?: number | null; sort_order?: number }>
): Promise<void> {
  const existing = await getDocs(
    query(tenantCollection<ComplementGroupOptionDoc>(tenantId, 'complement_group_options'), where('group_id', '==', groupId))
  );
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  await Promise.all(
    options.map((opt, index) =>
      addComplementOptionToGroup(tenantId, {
        group_id: groupId,
        option_id: opt.option_id,
        max_quantity: opt.max_quantity,
        price_override: opt.price_override ?? null,
        sort_order: opt.sort_order ?? index,
      })
    )
  );
}

type ProductNameDoc = { name: string };

async function listProductsByIds(tenantId: string, ids: string[]): Promise<Array<ProductNameDoc & { id: string }>> {
  if (ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }
  const all: Array<ProductNameDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<ProductNameDoc>(tenantId, 'products'), where('__name__', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

async function listComplementGroupsByIds(
  tenantId: string,
  ids: string[]
): Promise<Array<ComplementGroupDoc & { id: string }>> {
  if (ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }
  const all: Array<ComplementGroupDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<ComplementGroupDoc>(tenantId, 'complement_groups'), where('__name__', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

export async function listProductComplementGroups(
  tenantId: string,
  groupId: string
): Promise<Array<(ProductComplementGroupDoc & { id: string }) & { product: { id: string; name: string } }>> {
  const snap = await getDocs(
    query(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), where('group_id', '==', groupId))
  );
  const links = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const products = await listProductsByIds(tenantId, links.map((l) => l.product_id));
  const productMap = new Map(products.map((p) => [p.id, p]));
  return links.map((l) => ({
    ...l,
    product: {
      id: l.product_id,
      name: productMap.get(l.product_id)?.name || '',
    },
  }));
}

export async function listAllProductComplementGroups(tenantId: string): Promise<Array<ProductComplementGroupDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listProductComplementLinksByGroupIds(
  tenantId: string,
  groupIds: string[]
): Promise<Array<ProductComplementGroupDoc & { id: string }>> {
  if (groupIds.length === 0) return [];
  const uniqueIds = [...new Set(groupIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }
  const all: Array<ProductComplementGroupDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), where('group_id', 'in', chunk))
    );
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

export async function listGroupsForProduct(
  tenantId: string,
  productId: string
): Promise<Array<(ProductComplementGroupDoc & { id: string }) & { group: ComplementGroupDoc & { id: string } }>> {
  const snap = await getDocs(
    query(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), where('product_id', '==', productId))
  );
  const links = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const groups = await listComplementGroupsByIds(tenantId, links.map((l) => l.group_id));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  return links
    .map((l) => {
      const group = groupMap.get(l.group_id);
      if (!group) return null;
      return { ...l, group };
    })
    .filter(Boolean) as Array<(ProductComplementGroupDoc & { id: string }) & { group: ComplementGroupDoc & { id: string } }>;
}

export async function linkGroupToProduct(
  tenantId: string,
  payload: { product_id: string; group_id: string; sort_order?: number }
): Promise<ProductComplementGroupDoc & { id: string }> {
  const ref = await addDoc(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), {
    product_id: payload.product_id,
    group_id: payload.group_id,
    sort_order: payload.sort_order ?? 0,
    created_at: new Date().toISOString(),
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as ProductComplementGroupDoc) };
}

export async function unlinkGroupFromProduct(tenantId: string, productId: string, groupId: string): Promise<void> {
  const snap = await getDocs(
    query(
      tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'),
      where('product_id', '==', productId),
      where('group_id', '==', groupId)
    )
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export async function replaceProductsForGroup(tenantId: string, groupId: string, productIds: string[]): Promise<void> {
  const existing = await getDocs(
    query(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), where('group_id', '==', groupId))
  );
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  await Promise.all(productIds.map((productId, index) => linkGroupToProduct(tenantId, { product_id: productId, group_id: groupId, sort_order: index })));
}

export async function replaceGroupsForProduct(tenantId: string, productId: string, groupIds: string[]): Promise<void> {
  const existing = await getDocs(
    query(tenantCollection<ProductComplementGroupDoc>(tenantId, 'product_complement_groups'), where('product_id', '==', productId))
  );
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  await Promise.all(groupIds.map((groupId, index) => linkGroupToProduct(tenantId, { product_id: productId, group_id: groupId, sort_order: index })));
}

export async function listKdsStations(tenantId: string): Promise<Array<KdsStationDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<KdsStationDoc>(tenantId, 'kds_stations'), orderBy('sort_order', 'asc')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((station) => !station.deleted_at);
}

export async function createKdsStation(
  tenantId: string,
  payload: Omit<KdsStationDoc, 'created_at' | 'updated_at' | 'tenant_id'>
): Promise<KdsStationDoc & { id: string }> {
  const now = new Date().toISOString();
  const ref = await addDoc(tenantCollection<KdsStationDoc>(tenantId, 'kds_stations'), {
    ...payload,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as KdsStationDoc) };
}

export async function updateKdsStation(
  tenantId: string,
  id: string,
  payload: Partial<KdsStationDoc>
): Promise<KdsStationDoc & { id: string }> {
  const ref = doc(tenantCollection<KdsStationDoc>(tenantId, 'kds_stations'), id);
  await updateDoc(ref, { ...payload, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as KdsStationDoc) };
}

export async function deleteKdsStation(tenantId: string, id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateKdsStation(tenantId, id, {
    is_active: false,
    deleted_at: now,
    updated_at: now,
  });
}

export async function listKdsDevices(tenantId: string): Promise<Array<KdsDeviceDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<KdsDeviceDoc>(tenantId, 'kds_devices'), orderBy('last_seen_at', 'desc')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((device) => !device.deleted_at)
    .sort((left, right) => {
    const leftOrder = normalizeKdsDeviceDisplayOrder(left.display_order, Number.MAX_SAFE_INTEGER);
    const rightOrder = normalizeKdsDeviceDisplayOrder(right.display_order, Number.MAX_SAFE_INTEGER);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
}

export async function getKdsDeviceByDeviceId(tenantId: string, deviceId: string): Promise<(KdsDeviceDoc & { id: string }) | null> {
  const snap = await getDocs(
    query(tenantCollection<KdsDeviceDoc>(tenantId, 'kds_devices'), where('device_id', '==', deviceId))
  );
  if (snap.empty) return null;
  const devices = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as KdsDeviceDoc) }));
  return devices.find((device) => !device.deleted_at) ?? devices[0] ?? null;
}

export async function createKdsDevice(
  tenantId: string,
  payload: Omit<KdsDeviceDoc, 'created_at' | 'last_seen_at' | 'is_active' | 'tenant_id'>
): Promise<KdsDeviceDoc & { id: string }> {
  const now = new Date().toISOString();
  const stageType = normalizeKdsDeviceStageType(payload.stage_type);
  const displayOrder = normalizeKdsDeviceDisplayOrder(payload.display_order, 1);
  const isTerminal = payload.is_terminal === true;
  const nextDeviceIds = normalizeKdsDeviceNextIds(payload.next_device_ids, payload.next_device_id, isTerminal);
  const ref = await addDoc(tenantCollection<KdsDeviceDoc>(tenantId, 'kds_devices'), {
    ...payload,
    stage_type: stageType,
    display_order: displayOrder,
    is_terminal: isTerminal,
    next_device_ids: nextDeviceIds,
    next_device_id: nextDeviceIds[0] || null,
    last_seen_at: now,
    is_active: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    tenant_id: tenantId,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as KdsDeviceDoc) };
}

export async function updateKdsDevice(
  tenantId: string,
  id: string,
  payload: Partial<KdsDeviceDoc>
): Promise<KdsDeviceDoc & { id: string }> {
  const ref = doc(tenantCollection<KdsDeviceDoc>(tenantId, 'kds_devices'), id);
  const isTerminal = payload.is_terminal === true;
  const nextDeviceIds =
    payload.next_device_ids !== undefined || payload.next_device_id !== undefined || payload.is_terminal !== undefined
      ? normalizeKdsDeviceNextIds(payload.next_device_ids, payload.next_device_id, isTerminal)
      : undefined;
  await updateDoc(ref, {
    ...payload,
    ...(payload.stage_type !== undefined
      ? { stage_type: normalizeKdsDeviceStageType(payload.stage_type) }
      : {}),
    ...(payload.display_order !== undefined
      ? { display_order: normalizeKdsDeviceDisplayOrder(payload.display_order) }
      : {}),
    ...(payload.is_terminal !== undefined ? { is_terminal: isTerminal } : {}),
    ...(nextDeviceIds !== undefined
      ? {
          next_device_ids: nextDeviceIds,
          next_device_id: nextDeviceIds[0] || null,
        }
      : {}),
    updated_at: new Date().toISOString(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as KdsDeviceDoc) };
}

export async function deactivateKdsDevice(tenantId: string, id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateKdsDevice(tenantId, id, {
    is_active: false,
    station_id: null,
    deleted_at: now,
    last_seen_at: now,
  });
}

export async function listGlobalSettings(tenantId: string): Promise<Array<GlobalSettingDoc & { id: string }>> {
  const snap = await getDocs(tenantCollection<GlobalSettingDoc>(tenantId, 'global_settings'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getGlobalSettingByKey(tenantId: string, key: string): Promise<(GlobalSettingDoc & { id: string }) | null> {
  const ref = doc(tenantCollection<GlobalSettingDoc>(tenantId, 'global_settings'), key);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as GlobalSettingDoc) };
}

export async function upsertGlobalSetting(tenantId: string, key: string, value: unknown): Promise<void> {
  const ref = doc(tenantCollection<GlobalSettingDoc>(tenantId, 'global_settings'), key);
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      key,
      value,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
    } as GlobalSettingDoc,
    { merge: true }
  );
}

export async function listUserPermissions(tenantId: string, userId: string): Promise<Array<UserPermissionDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<UserPermissionDoc>(tenantId, 'user_permissions'), where('user_id', '==', userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setUserPermission(
  tenantId: string,
  userId: string,
  permission: string,
  granted: boolean,
  grantedBy: string | null
): Promise<void> {
  const id = `${userId}_${permission}`;
  const ref = doc(tenantCollection<UserPermissionDoc>(tenantId, 'user_permissions'), id);
  if (!granted) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(
    ref,
    {
      user_id: userId,
      permission,
      granted: true,
      granted_by: grantedBy,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
    } as UserPermissionDoc,
    { merge: true }
  );
}

export async function replaceUserPermissions(
  tenantId: string,
  userId: string,
  permissions: Array<{ permission: string; granted: boolean }>,
  grantedBy: string | null
): Promise<void> {
  const existing = await listUserPermissions(tenantId, userId);
  await Promise.all(existing.map((p) => deleteDoc(doc(tenantCollection<UserPermissionDoc>(tenantId, 'user_permissions'), p.id))));

  const granted = permissions.filter((p) => p.granted);
  await Promise.all(granted.map((p) => setUserPermission(tenantId, userId, p.permission, true, grantedBy)));
}

export async function copyUserPermissions(
  tenantId: string,
  fromUserId: string,
  toUserId: string,
  grantedBy: string | null
): Promise<void> {
  const source = await listUserPermissions(tenantId, fromUserId);
  const permissions = source.map((p) => ({ permission: p.permission, granted: true }));
  await replaceUserPermissions(tenantId, toUserId, permissions, grantedBy);
}

function rootCollection<T>(name: string): CollectionReference<T> {
  return collection(firestore, name) as CollectionReference<T>;
}

export async function listTenantMembers(tenantId: string): Promise<Array<TenantMemberDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<TenantMemberDoc>(tenantId, 'tenant_members')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTenantMembershipsByUser(userId: string): Promise<Array<TenantMemberDoc & { id: string }>> {
  const snap = await getDocs(query(collectionGroup(firestore, 'tenant_members'), where('user_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TenantMemberDoc) }));
}

export async function getTenantMembership(
  tenantId: string,
  userId: string
): Promise<(TenantMemberDoc & { id: string }) | null> {
  const snap = await getDoc(doc(tenantCollection<TenantMemberDoc>(tenantId, 'tenant_members'), userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addTenantMember(tenantId: string, userId: string, isOwner = false): Promise<void> {
  const membership: TenantMemberDoc = {
    tenant_id: tenantId,
    user_id: userId,
    is_owner: isOwner,
    created_at: new Date().toISOString(),
  };

  await setDoc(
    doc(tenantCollection<TenantMemberDoc>(tenantId, 'tenant_members'), userId),
    membership,
    { merge: true }
  );

  // Legacy root mirror kept as best effort for backward compatibility.
  const id = `${tenantId}_${userId}`;
  try {
    await setDoc(doc(rootCollection<TenantMemberDoc>('tenant_memberships'), id), membership, { merge: true });
  } catch (error) {
    console.warn('Skipping legacy tenant_memberships mirror write', { tenantId, userId, error });
  }
}

export async function listUserRoles(tenantId: string): Promise<Array<UserRoleDoc & { id: string }>> {
  const snap = await getDocs(query(tenantCollection<UserRoleDoc>(tenantId, 'user_roles')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listUserRolesByUser(tenantId: string, userId: string): Promise<Array<UserRoleDoc & { id: string }>> {
  const snap = await getDocs(
    query(tenantCollection<UserRoleDoc>(tenantId, 'user_roles'), where('user_id', '==', userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addUserRole(
  tenantId: string,
  userId: string,
  role: UserRoleDoc['role']
): Promise<void> {
  const id = `${userId}_${role}`;
  await setDoc(
    doc(tenantCollection<UserRoleDoc>(tenantId, 'user_roles'), id),
    {
      tenant_id: tenantId,
      user_id: userId,
      role,
      created_at: new Date().toISOString(),
    } as UserRoleDoc,
    { merge: true }
  );
}

export async function removeUserRole(tenantId: string, userId: string, role: UserRoleDoc['role']): Promise<void> {
  const id = `${userId}_${role}`;
  await deleteDoc(doc(tenantCollection<UserRoleDoc>(tenantId, 'user_roles'), id));
}

export async function hasAdminRole(tenantId: string): Promise<boolean> {
  const snap = await getDocs(
    query(tenantCollection<UserRoleDoc>(tenantId, 'user_roles'), where('role', '==', 'admin'))
  );
  return !snap.empty;
}

export async function getTenantById(tenantId: string): Promise<TenantDoc | null> {
  const snap = await getDoc(doc(rootCollection<TenantDoc>('tenants'), tenantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getTenantBySlug(slug: string): Promise<TenantDoc | null> {
  const snap = await getDocs(query(rootCollection<TenantDoc>('tenants'), where('slug', '==', slug), limit(1)));
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

export async function createTenant(payload: {
  name: string;
  slug: string;
  owner_id?: string | null;
}): Promise<TenantDoc> {
  const now = new Date().toISOString();
  const ref = await addDoc(rootCollection<Omit<TenantDoc, 'id'>>('tenants'), {
    name: payload.name,
    slug: payload.slug,
    owner_id: payload.owner_id ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<TenantDoc, 'id'>) };
}

export async function updateTenant(tenantId: string, payload: Partial<Omit<TenantDoc, 'id'>>): Promise<void> {
  await updateDoc(doc(rootCollection<TenantDoc>('tenants'), tenantId), {
    ...payload,
    updated_at: new Date().toISOString(),
  });
}

export async function listTenants(): Promise<TenantDoc[]> {
  const snap = await getDocs(query(rootCollection<TenantDoc>('tenants'), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTenantsByOwner(ownerId: string): Promise<TenantDoc[]> {
  const snap = await getDocs(
    query(rootCollection<TenantDoc>('tenants'), where('owner_id', '==', ownerId), orderBy('created_at', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listPendingTenantInvitations(tenantId: string): Promise<Array<TenantInvitationDoc & { id: string }>> {
  const snap = await getDocs(
    query(
      rootCollection<TenantInvitationDoc>('tenant_invitations'),
      where('tenant_id', '==', tenantId),
      where('accepted_at', '==', null),
      orderBy('created_at', 'desc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createTenantInvitation(payload: {
  tenant_id: string;
  email: string;
  role: UserRoleDoc['role'];
  invited_by: string | null;
}): Promise<TenantInvitationDoc & { id: string }> {
  const normalizedEmail = payload.email.toLowerCase().trim();
  const existing = await getDocs(
    query(
      rootCollection<TenantInvitationDoc>('tenant_invitations'),
      where('tenant_id', '==', payload.tenant_id),
      where('email', '==', normalizedEmail),
      where('accepted_at', '==', null),
      limit(1)
    )
  );
  if (!existing.empty) {
    throw new Error('Este email ja foi convidado');
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);
  const ref = await addDoc(rootCollection<TenantInvitationDoc>('tenant_invitations'), {
    tenant_id: payload.tenant_id,
    email: normalizedEmail,
    role: payload.role,
    invited_by: payload.invited_by,
    token: crypto.randomUUID(),
    expires_at: expiresAt.toISOString(),
    accepted_at: null,
    created_at: now.toISOString(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as TenantInvitationDoc) };
}

export async function deleteTenantInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(rootCollection<TenantInvitationDoc>('tenant_invitations'), invitationId));
}

export async function getTenantInvitationByToken(token: string): Promise<(TenantInvitationDoc & { id: string }) | null> {
  const snap = await getDocs(
    query(rootCollection<TenantInvitationDoc>('tenant_invitations'), where('token', '==', token), limit(1))
  );
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as TenantInvitationDoc) };
}

export async function acceptTenantInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(rootCollection<TenantInvitationDoc>('tenant_invitations'), invitationId), {
    accepted_at: new Date().toISOString(),
  });
}

export async function listPlatformAdmins(): Promise<Array<PlatformAdminDoc & { id: string }>> {
  const snap = await getDocs(query(rootCollection<PlatformAdminDoc>('platform_admins'), orderBy('created_at', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listSubscriptionPlans(): Promise<Array<SubscriptionPlanDoc & { id: string }>> {
  const snap = await getDocs(query(rootCollection<SubscriptionPlanDoc>('subscription_plans'), orderBy('name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listSubscriptions(
  options: { tenantId?: string; status?: string; limitCount?: number } = {}
): Promise<Array<SubscriptionDoc & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];
  if (options.limitCount) constraints.push(limit(options.limitCount));

  const snap = await getDocs(query(rootCollection<SubscriptionDoc>('subscriptions'), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (options.tenantId) {
    rows = rows.filter((row) => row.tenant_id === options.tenantId);
  }
  if (options.status) {
    rows = rows.filter((row) => row.status === options.status);
  }

  return rows;
}

export async function getSubscriptionByTenant(
  tenantId: string
): Promise<(SubscriptionDoc & { id: string }) | null> {
  const rows = await listSubscriptions({ tenantId, limitCount: 100 });
  return rows[0] ?? null;
}

export async function getPlatformAdminByUserId(userId: string): Promise<(PlatformAdminDoc & { id: string }) | null> {
  const snap = await getDocs(
    query(rootCollection<PlatformAdminDoc>('platform_admins'), where('user_id', '==', userId), limit(1))
  );
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as PlatformAdminDoc) };
}

export async function getPlatformAdminByEmail(email: string): Promise<(PlatformAdminDoc & { id: string }) | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const snap = await getDocs(
    query(rootCollection<PlatformAdminDoc>('platform_admins'), where('email', '==', normalizedEmail), limit(1))
  );
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as PlatformAdminDoc) };
}

export async function createPlatformAdmin(payload: {
  email: string;
  user_id?: string | null;
  created_by?: string | null;
}): Promise<void> {
  await addDoc(rootCollection<PlatformAdminDoc>('platform_admins'), {
    email: payload.email.toLowerCase().trim(),
    user_id: payload.user_id ?? null,
    created_by: payload.created_by ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function deletePlatformAdmin(adminId: string): Promise<void> {
  await deleteDoc(doc(rootCollection<PlatformAdminDoc>('platform_admins'), adminId));
}

export async function listProfilesByIds(userIds: string[]): Promise<Array<ProfileDoc & { id: string }>> {
  if (userIds.length === 0) return [];
  const uniqueIds = [...new Set(userIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    chunks.push(uniqueIds.slice(i, i + 10));
  }

  const all: Array<ProfileDoc & { id: string }> = [];
  for (const chunk of chunks) {
    const snap = await getDocs(query(rootCollection<ProfileDoc>('profiles'), where('__name__', 'in', chunk)));
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return all;
}

export async function getProfileById(userId: string): Promise<(ProfileDoc & { id: string }) | null> {
  const snap = await getDoc(doc(rootCollection<ProfileDoc>('profiles'), userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function upsertProfile(userId: string, payload: Partial<ProfileDoc>): Promise<void> {
  await setDoc(
    doc(rootCollection<ProfileDoc>('profiles'), userId),
    {
      ...payload,
      updated_at: new Date().toISOString(),
    } as Partial<ProfileDoc>,
    { merge: true }
  );
}
