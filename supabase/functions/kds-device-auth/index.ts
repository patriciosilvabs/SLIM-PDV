import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash using Web Crypto API (SHA-256 with salt)
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...params } = await req.json();

    if (action === "register") {
      // Register a new device with username/password
      const { username, password, name, station_id, tenant_id } = params;

      if (!username || !password || !name || !tenant_id) {
        return new Response(
          JSON.stringify({ error: "username, password, name e tenant_id são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if username already exists for this tenant
      const { data: existing } = await supabase
        .from("kds_devices")
        .select("id")
        .eq("username", username)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Nome de usuário já existe para esta loja" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const salt = await generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const deviceId = crypto.randomUUID();

      const { data: device, error } = await supabase
        .from("kds_devices")
        .insert({
          device_id: deviceId,
          name,
          username,
          password_hash: salt + ":" + passwordHash,
          station_id: station_id || null,
          tenant_id,
          operation_mode: "production_line",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, device }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login") {
      // Login with username/password
      const { username, password, tenant_id } = params;

      if (!username || !password || !tenant_id) {
        return new Response(
          JSON.stringify({ error: "username, password e tenant_id são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: device, error } = await supabase
        .from("kds_devices")
        .select("*")
        .eq("username", username)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (error) throw error;

      if (!device || !device.password_hash) {
        return new Response(
          JSON.stringify({ error: "Credenciais inválidas" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [salt, storedHash] = device.password_hash.split(":");
      const inputHash = await hashPassword(password, salt);

      if (inputHash !== storedHash) {
        return new Response(
          JSON.stringify({ error: "Credenciais inválidas" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_seen_at
      await supabase
        .from("kds_devices")
        .update({ last_seen_at: new Date().toISOString(), is_active: true })
        .eq("id", device.id);

      return new Response(
        JSON.stringify({ success: true, device: { ...device, password_hash: undefined } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_password") {
      const { device_id, new_password } = params;

      if (!device_id || !new_password) {
        return new Response(
          JSON.stringify({ error: "device_id e new_password são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const salt = await generateSalt();
      const passwordHash = await hashPassword(new_password, salt);

      const { error } = await supabase
        .from("kds_devices")
        .update({ password_hash: salt + ":" + passwordHash })
        .eq("id", device_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
