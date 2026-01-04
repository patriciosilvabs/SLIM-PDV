import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
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
    const body = await req.json();
    const webhookToken = req.headers.get('x-webhook-token');

    console.log('[CardápioWeb Webhook] Received event:', JSON.stringify(body));

    const { event, data } = body;
    const { merchant_id, order_id } = data || {};

    if (!merchant_id || !order_id) {
      console.error('[CardápioWeb Webhook] Missing merchant_id or order_id');
      return new Response(
        JSON.stringify({ error: 'Missing merchant_id or order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find integration by store_id (merchant_id)
    const { data: integration, error: integrationError } = await supabase
      .from('cardapioweb_integrations')
      .select('*')
      .eq('store_id', String(merchant_id))
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError) {
      console.error('[CardápioWeb Webhook] Error finding integration:', integrationError);
      throw integrationError;
    }

    if (!integration) {
      console.error('[CardápioWeb Webhook] No active integration found for merchant_id:', merchant_id);
      return new Response(
        JSON.stringify({ error: 'No integration found for this merchant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate webhook token if configured
    if (integration.webhook_secret && webhookToken !== integration.webhook_secret) {
      console.error('[CardápioWeb Webhook] Invalid webhook token');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the webhook event
    await supabase.from('cardapioweb_logs').insert({
      tenant_id: integration.tenant_id,
      event_type: event,
      external_order_id: String(order_id),
      payload: body,
      status: 'processing',
    });

    if (event === 'ORDER_CREATED') {
      // Fetch full order details from CardápioWeb API
      const orderResponse = await fetch(
        `${CARDAPIOWEB_API_URL}/orders/${order_id}`,
        {
          headers: {
            'X-API-KEY': integration.api_token,
            'Accept': 'application/json',
          },
        }
      );

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('[CardápioWeb Webhook] Error fetching order:', errorText);
        throw new Error(`Failed to fetch order: ${orderResponse.status}`);
      }

      const order: CardapioWebOrder = await orderResponse.json();
      console.log('[CardápioWeb Webhook] Fetched order details:', JSON.stringify(order));

      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('external_source', 'cardapioweb')
        .eq('external_order_id', String(order_id))
        .eq('tenant_id', integration.tenant_id)
        .maybeSingle();

      if (existingOrder) {
        console.log('[CardápioWeb Webhook] Order already exists:', existingOrder.id);
        return new Response(
          JSON.stringify({ success: true, message: 'Order already exists', order_id: existingOrder.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate totals
      const subtotal = order.items.reduce((sum, item) => sum + item.total_price, 0);
      const total = order.total;

      // Create local order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: integration.tenant_id,
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
        })
        .select()
        .single();

      if (orderError) {
        console.error('[CardápioWeb Webhook] Error creating order:', orderError);
        throw orderError;
      }

      console.log('[CardápioWeb Webhook] Created order:', newOrder.id);

      // Get product mappings for this tenant
      const { data: mappings } = await supabase
        .from('cardapioweb_product_mappings')
        .select('*')
        .eq('tenant_id', integration.tenant_id);

      const mappingMap = new Map(
        (mappings || []).map(m => [m.cardapioweb_item_id, m])
      );

      // Create order items
      for (const item of order.items) {
        const mapping = mappingMap.get(item.item_id);

        // Calculate item price including options
        const optionsTotal = item.options.reduce((sum, opt) => sum + (opt.unit_price * opt.quantity), 0);
        const unitPrice = item.unit_price + optionsTotal;

        const { data: orderItem, error: itemError } = await supabase
          .from('order_items')
          .insert({
            tenant_id: integration.tenant_id,
            order_id: newOrder.id,
            product_id: mapping?.local_product_id || null,
            variation_id: mapping?.local_variation_id || null,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: item.total_price,
            notes: item.observation,
            status: 'pending',
          })
          .select()
          .single();

        if (itemError) {
          console.error('[CardápioWeb Webhook] Error creating order item:', itemError);
          continue;
        }

        // Create order item extras for options
        if (item.options.length > 0) {
          const extras = item.options.map(opt => ({
            tenant_id: integration.tenant_id,
            order_item_id: orderItem.id,
            extra_name: `${opt.option_group_name}: ${opt.name}`,
            price: opt.unit_price * opt.quantity,
          }));

          const { error: extrasError } = await supabase
            .from('order_item_extras')
            .insert(extras);

          if (extrasError) {
            console.error('[CardápioWeb Webhook] Error creating extras:', extrasError);
          }
        }

        // If no mapping, store the item info for later mapping
        if (!mapping) {
          await supabase.from('cardapioweb_product_mappings').upsert({
            tenant_id: integration.tenant_id,
            cardapioweb_item_id: item.item_id,
            cardapioweb_item_name: item.name,
          }, {
            onConflict: 'tenant_id,cardapioweb_item_id',
          });
        }
      }

      // Update log status
      await supabase
        .from('cardapioweb_logs')
        .update({ status: 'success' })
        .eq('external_order_id', String(order_id))
        .eq('tenant_id', integration.tenant_id)
        .eq('event_type', 'ORDER_CREATED');

      console.log('[CardápioWeb Webhook] Order created successfully:', newOrder.id);

      return new Response(
        JSON.stringify({ success: true, order_id: newOrder.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (event === 'ORDER_STATUS_UPDATED') {
      const newStatus = data.new_status;

      // Find existing order
      const { data: existingOrder, error: findError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('external_source', 'cardapioweb')
        .eq('external_order_id', String(order_id))
        .eq('tenant_id', integration.tenant_id)
        .maybeSingle();

      if (findError || !existingOrder) {
        console.error('[CardápioWeb Webhook] Order not found for status update:', order_id);
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mappedStatus = mapStatus(newStatus);

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: mappedStatus,
          ...(mappedStatus === 'cancelled' ? { 
            cancellation_reason: data.cancellation_reason || 'Cancelado pelo CardápioWeb',
            cancelled_at: new Date().toISOString(),
          } : {}),
          ...(mappedStatus === 'delivered' ? { 
            delivered_at: new Date().toISOString(),
          } : {}),
        })
        .eq('id', existingOrder.id);

      if (updateError) {
        console.error('[CardápioWeb Webhook] Error updating order status:', updateError);
        throw updateError;
      }

      // Update log status
      await supabase
        .from('cardapioweb_logs')
        .update({ status: 'success' })
        .eq('external_order_id', String(order_id))
        .eq('tenant_id', integration.tenant_id)
        .eq('event_type', 'ORDER_STATUS_UPDATED');

      console.log('[CardápioWeb Webhook] Order status updated:', existingOrder.id, '->', mappedStatus);

      return new Response(
        JSON.stringify({ success: true, order_id: existingOrder.id, new_status: mappedStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown event
    console.log('[CardápioWeb Webhook] Unknown event:', event);
    return new Response(
      JSON.stringify({ success: true, message: 'Event ignored' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[CardápioWeb Webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
