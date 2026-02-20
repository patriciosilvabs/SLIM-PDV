import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, device_id, tenant_id } = body;

    if (!device_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "device_id e tenant_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate device belongs to tenant
    const { data: device, error: deviceError } = await supabase
      .from("kds_devices")
      .select("id, tenant_id, is_active")
      .eq("device_id", device_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (deviceError) throw deviceError;

    if (!device) {
      return new Response(
        JSON.stringify({ error: "Dispositivo não encontrado ou não pertence ao tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update heartbeat
    await supabase
      .from("kds_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    if (action === "get_orders") {
      const statuses = body.statuses || ["pending", "preparing", "ready", "delivered", "cancelled"];
      
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          *,
          table:tables(number),
          order_items(
            *,
            added_by,
            product:products(name, image_url),
            variation:product_variations(name),
            extras:order_item_extras(extra_name, price, kds_category),
            current_station:kds_stations(id, name, station_type, color, icon, sort_order),
            sub_items:order_item_sub_items(
              id, sub_item_index, notes,
              sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity, kds_category)
            )
          )
        `)
        .eq("tenant_id", tenant_id)
        .in("status", statuses)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch profiles for created_by and added_by
      const createdByIds = (orders || []).map((o: any) => o.created_by).filter(Boolean);
      const addedByIds = (orders || []).flatMap((o: any) =>
        (o.order_items || []).map((item: any) => item.added_by).filter(Boolean)
      );
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", allUserIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {});
        }
      }

      const ordersWithProfiles = (orders || []).map((order: any) => ({
        ...order,
        created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          added_by_profile: item.added_by ? profilesMap[item.added_by] || null : null,
        })),
      }));

      return new Response(
        JSON.stringify({ orders: ordersWithProfiles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_settings") {
      const { data: settings, error } = await supabase
        .from("kds_global_settings")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ settings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_stations") {
      const { data: stations, error } = await supabase
        .from("kds_stations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ stations }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_all") {
      // Fetch orders, settings, and stations in parallel
      const statuses = body.statuses || ["pending", "preparing", "ready", "delivered", "cancelled"];
      
      const [ordersResult, settingsResult, stationsResult] = await Promise.all([
        supabase
          .from("orders")
          .select(`
            *,
            table:tables(number),
            order_items(
              *,
              added_by,
              product:products(name, image_url),
              variation:product_variations(name),
              extras:order_item_extras(extra_name, price, kds_category),
              current_station:kds_stations(id, name, station_type, color, icon, sort_order),
              sub_items:order_item_sub_items(
                id, sub_item_index, notes,
                sub_extras:order_item_sub_item_extras(id, group_name, option_name, price, quantity, kds_category)
              )
            )
          `)
          .eq("tenant_id", tenant_id)
          .in("status", statuses)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("kds_global_settings")
          .select("*")
          .eq("tenant_id", tenant_id)
          .maybeSingle(),
        supabase
          .from("kds_stations")
          .select("*")
          .eq("tenant_id", tenant_id)
          .order("sort_order", { ascending: true }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (stationsResult.error) throw stationsResult.error;

      // Fetch profiles
      const orders = ordersResult.data || [];
      const createdByIds = orders.map((o: any) => o.created_by).filter(Boolean);
      const addedByIds = orders.flatMap((o: any) =>
        (o.order_items || []).map((item: any) => item.added_by).filter(Boolean)
      );
      const allUserIds = [...new Set([...createdByIds, ...addedByIds])];
      let profilesMap: Record<string, { name: string }> = {};

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", allUserIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc: any, p: any) => {
            acc[p.id] = { name: p.name };
            return acc;
          }, {});
        }
      }

      const ordersWithProfiles = orders.map((order: any) => ({
        ...order,
        created_by_profile: order.created_by ? profilesMap[order.created_by] || null : null,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          added_by_profile: item.added_by ? profilesMap[item.added_by] || null : null,
        })),
      }));

      return new Response(
        JSON.stringify({
          orders: ordersWithProfiles,
          settings: settingsResult.data,
          stations: stationsResult.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_item_station") {
      const { item_id, station_id, station_status } = body;
      
      if (!item_id) {
        return new Response(
          JSON.stringify({ error: "item_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: any = {};
      if (station_id !== undefined) updates.current_station_id = station_id;
      if (station_status !== undefined) updates.station_status = station_status;
      if (station_status === 'in_progress') updates.station_started_at = new Date().toISOString();
      if (station_status === 'completed') updates.station_completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("order_items")
        .update(updates)
        .eq("id", item_id)
        .eq("tenant_id", tenant_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_order_status") {
      const { order_id, status } = body;
      
      if (!order_id || !status) {
        return new Response(
          JSON.stringify({ error: "order_id e status são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", order_id)
        .eq("tenant_id", tenant_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "log_station") {
      const { order_item_id, station_id, action: logAction, duration_seconds, notes } = body;
      
      const { error } = await supabase
        .from("kds_station_logs")
        .insert({
          order_item_id,
          station_id,
          action: logAction,
          duration_seconds,
          notes,
          tenant_id,
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
