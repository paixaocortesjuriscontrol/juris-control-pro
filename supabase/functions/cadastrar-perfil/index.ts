import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin or coordinator
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "coordenador"])
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { nome, coordenacao_id, cargo } = await req.json();

    if (!nome) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate placeholder email with timestamp for uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitized = nome.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
    const placeholderEmail = `placeholder.${sanitized}.${timestamp}.${randomSuffix}@sistema.local`;
    
    // Generate a random password (user won't use it - it's a placeholder account)
    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID();

    // First, create the user in auth.users using Admin API
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: placeholderEmail,
      password: placeholderPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        nome: nome,
        is_placeholder: true,
      },
    });

    if (createUserError) {
      console.error("Erro ao criar usuário auth:", createUserError);
      return new Response(JSON.stringify({ error: createUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Falha ao criar usuário no auth" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Now update the profile that was auto-created by the trigger (or create if not exists)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", newUserId)
      .single();

    let profileResult;
    
    if (existingProfile) {
      // Update the existing profile
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          nome: nome,
          email: placeholderEmail,
          ativo: true,
        })
        .eq("id", newUserId)
        .select("id, nome")
        .single();
      
      if (error) {
        console.error("Erro ao atualizar perfil:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profileResult = data;
    } else {
      // Create the profile (shouldn't happen if trigger exists, but just in case)
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: newUserId,
          nome: nome,
          email: placeholderEmail,
          ativo: true,
        })
        .select("id, nome")
        .single();
      
      if (error) {
        console.error("Erro ao criar perfil:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      profileResult = data;
    }

    // If coordenacao_id provided, add as member
    if (coordenacao_id && profileResult?.id) {
      // Check if already a member
      const { data: existingMember } = await supabaseAdmin
        .from("membros_coordenacao")
        .select("id")
        .eq("coordenacao_id", coordenacao_id)
        .eq("usuario_id", profileResult.id)
        .single();

      if (!existingMember) {
        const { error: membroError } = await supabaseAdmin
          .from("membros_coordenacao")
          .insert({
            coordenacao_id: coordenacao_id,
            usuario_id: profileResult.id,
            cargo: cargo || "Membro",
          });

        if (membroError) {
          console.error("Erro ao vincular à coordenação:", membroError);
          // Profile was created, just log the membership error
        }
      }
    }

    console.log(`Perfil criado com sucesso: ${nome} (${newUserId})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: profileResult 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
