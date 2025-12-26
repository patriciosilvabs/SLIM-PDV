import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get request data
    const { email, password, name, role, tenant_id } = await req.json();

    // Validate required fields
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['admin', 'cashier', 'waiter', 'kitchen', 'kds'];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating user: ${email} with role: ${role}`);

    // Create user with admin API
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name },
    });

    if (userError) {
      console.error('Error creating user:', userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;
    console.log(`User created with ID: ${userId}`);

    // Profile is created automatically via trigger, but update name if needed
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ name })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the request, profile might be created by trigger
    }

    // Assign role with tenant_id
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role, tenant_id: tenant_id || null });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `User created but failed to assign role: ${roleError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add user to tenant_members if tenant_id provided
    if (tenant_id) {
      const { error: memberError } = await supabaseAdmin
        .from('tenant_members')
        .insert({ user_id: userId, tenant_id, is_owner: false, joined_at: new Date().toISOString() });

      if (memberError) {
        console.error('Error adding to tenant:', memberError);
      }
    }

    console.log(`Role ${role} assigned to user ${userId}`);

    // If role is 'kds', automatically assign KDS permissions
    if (role === 'kds') {
      const kdsPermissions = ['kds_view', 'kds_change_status'];
      for (const permission of kdsPermissions) {
        const { error: permError } = await supabaseAdmin
          .from('user_permissions')
          .insert({ user_id: userId, permission, granted: true, tenant_id: tenant_id || null });
        
        if (permError) {
          console.error(`Error assigning permission ${permission}:`, permError);
        } else {
          console.log(`Permission ${permission} assigned to user ${userId}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email, name, role } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
