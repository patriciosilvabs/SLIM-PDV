import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CARDAPIOWEB_API_URL = 'https://integracao.cardapioweb.com/api/partner/v1';

interface CardapioWebOrder {
  id: number;
  display_id: number;
  merchant_id: number;
  status: string;
  order_type: string;
  order_timing: string;
  sales_channel: string;
  customer_origin: string | null;
  table_number: string | null;
  estimated_time: number | null;
  cancellation_reason: string | null;
  fiscal_document: string | null;
  observation: string | null;
  delivery_fee: number;
  service_fee: number;
  additional_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
  schedule: {
    scheduled_date_time_start: string;
    scheduled_date_time_end: string;
  } | null;
  customer: {
    id: number;
    name: string;
    phone: string;
  } | null;
  delivery_address: {
    street: string;
    number: string | null;
    neighborhood: string;
    complement: string | null;
    reference: string | null;
    postal_code: string | null;
    city: string;
    state: string;
    latitude: string | null;
    longitude: string | null;
  } | null;
  items: Array<{
    item_id: number;
    order_item_id: number;
    external_code: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    kind: string;
    status: string;
    observation: string | null;
    options: Array<{
      option_id: number;
      external_code: string | null;
      name: string;
      quantity: number;
      unit_price: number;
      option_group_id: number;
      option_group_name: string;
    }>;
  }>;
  payments: Array<{
    total: number;
    payment_method: string;
    payment_type: string;
    status: string;
    change_for: number | null;
  }>;
}

// Map CardápioWeb status to local status
function mapStatus(cwStatus: string): string {
  const statusMap: Record<string, string> = {
    'waiting_confirmation': 'pending',
    'pending_payment': 'pending',
    'pending_online_payment': 'pending',
    'scheduled_confirmed': 'pending',
    'confirmed': 'preparing',
    'ready': 'ready',
    'released': 'ready',
    'waiting_to_catch': 'ready',
    'delivered': 'delivered',
    'canceling': 'cancelled',
    'canceled': 'cancelled',
    'closed': 'delivered',
  };
  return statusMap[cwStatus] || 'pending';
}

// Map CardápioWeb order type to local type
function mapOrderType(cwType: string): string {
  const typeMap: Record<string, string> = {
    'delivery': 'delivery',
    'takeout': 'takeaway',
    'onsite': 'takeaway',
    'closed_table': 'table',
  };
  return typeMap[cwType] || 'takeaway';
}

// Format address as string
function formatAddress(addr: CardapioWebOrder['delivery_address']): string {
  if (!addr) return '';
  const parts = [
    addr.street,
    addr.number,
    addr.neighborhood,
    addr.complement,
    addr.city,
    addr.state,
  ].filter(Boolean);
  return parts.join(', ');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { start_date, end_date } = await req.json();

    console.log('[CardápioWeb Sync] Starting sync for period:', start_date, 'to', end_date);

    // Get authorization header to find user's tenant
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('[CardápioWeb Sync] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: tenantMember } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantMember) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantMember.tenant_id;

    // Get integration config
    const { data: integration, error: integrationError } = await supabase
      .from('cardapioweb_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('[CardápioWeb Sync] No integration found');
      return new Response(
        JSON.stringify({ error: 'Integration not configured or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch orders from CardápioWeb API with date filter
    // The API endpoint typically supports query params for filtering
    let apiUrl = `${CARDAPIOWEB_API_URL}/orders`;
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (params.toString()) {
      apiUrl += `?${params.toString()}`;
    }

    console.log('[CardápioWeb Sync] Fetching orders from:', apiUrl);

    const ordersResponse = await fetch(apiUrl, {
      headers: {
        'X-API-KEY': integration.api_token,
        'Accept': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('[CardápioWeb Sync] API error:', errorText);
      return new Response(
        JSON.stringify({ error: `CardápioWeb API error: ${ordersResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData = await ordersResponse.json();
    const orders: CardapioWebOrder[] = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);

    console.log('[CardápioWeb Sync] Found', orders.length, 'orders from API');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Get product mappings
    const { data: mappings } = await supabase
      .from('cardapioweb_product_mappings')
      .select('*')
      .eq('tenant_id', tenantId);

    const mappingMap = new Map(
      (mappings || []).map(m => [m.cardapioweb_item_id, m])
    );

    for (const order of orders) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('external_source', 'cardapioweb')
          .eq('external_order_id', String(order.id))
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existingOrder) {
          console.log('[CardápioWeb Sync] Order already exists:', order.id);
          skipped++;
          continue;
        }

        // Calculate totals
        const subtotal = order.items.reduce((sum, item) => sum + item.total_price, 0);
        const total = order.total;

        // Create local order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            tenant_id: tenantId,
            order_type: mapOrderType(order.order_type),
            status: mapStatus(order.status),
            customer_name: order.customer?.name || null,
            customer_phone: order.customer?.phone || null,
            customer_address: order.delivery_address ? formatAddress(order.delivery_address) : null,
            notes: order.observation,
            subtotal,
            total,
            discount: 0,
            external_source: 'cardapioweb',
            external_order_id: String(order.id),
            external_display_id: String(order.display_id),
            delivery_fee: order.delivery_fee,
            payment_method: order.payments[0]?.payment_method || null,
            payment_status: order.payments[0]?.status || null,
            scheduled_for: order.schedule?.scheduled_date_time_start || null,
            is_draft: false,
            created_at: order.created_at,
          })
          .select()
          .single();

        if (orderError) {
          console.error('[CardápioWeb Sync] Error creating order:', orderError);
          errors++;
          continue;
        }

        // Create order items
        for (const item of order.items) {
          const mapping = mappingMap.get(item.item_id);

          const optionsTotal = item.options.reduce((sum, opt) => sum + (opt.unit_price * opt.quantity), 0);
          const unitPrice = item.unit_price + optionsTotal;

          const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .insert({
              tenant_id: tenantId,
              order_id: newOrder.id,
              product_id: mapping?.local_product_id || null,
              variation_id: mapping?.local_variation_id || null,
              quantity: item.quantity,
              unit_price: unitPrice,
              total_price: item.total_price,
              notes: item.observation,
              status: mapStatus(order.status) === 'delivered' ? 'delivered' : 'pending',
            })
            .select()
            .single();

          if (itemError) {
            console.error('[CardápioWeb Sync] Error creating order item:', itemError);
            continue;
          }

          // Create extras for options
          if (item.options.length > 0 && orderItem) {
            const extras = item.options.map(opt => ({
              tenant_id: tenantId,
              order_item_id: orderItem.id,
              extra_name: `${opt.option_group_name}: ${opt.name}`,
              price: opt.unit_price * opt.quantity,
            }));

            await supabase.from('order_item_extras').insert(extras);
          }

          // Upsert product mapping if not exists
          if (!mapping) {
            await supabase.from('cardapioweb_product_mappings').upsert({
              tenant_id: tenantId,
              cardapioweb_item_id: item.item_id,
              cardapioweb_item_name: item.name,
            }, {
              onConflict: 'tenant_id,cardapioweb_item_id',
            });
          }
        }

        imported++;
        console.log('[CardápioWeb Sync] Imported order:', order.id, '-> local:', newOrder.id);

      } catch (error) {
        console.error('[CardápioWeb Sync] Error processing order:', order.id, error);
        errors++;
      }
    }

    // Update last_sync_at
    await supabase
      .from('cardapioweb_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Log the sync
    await supabase.from('cardapioweb_logs').insert({
      tenant_id: tenantId,
      event_type: 'MANUAL_SYNC',
      payload: { start_date, end_date, imported, skipped, errors },
      status: errors === 0 ? 'success' : 'partial',
    });

    console.log('[CardápioWeb Sync] Completed. Imported:', imported, 'Skipped:', skipped, 'Errors:', errors);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors,
        total: orders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[CardápioWeb Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
