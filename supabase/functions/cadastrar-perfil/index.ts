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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // Generate placeholder email
    const timestamp = Date.now();
    const sanitized = nome.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
    const placeholderEmail = `placeholder.${sanitized}.${timestamp}@sistema.local`;

    // Generate new UUID for profile
    const newId = crypto.randomUUID();

    // Insert profile using service role (bypasses RLS)
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newId,
        nome: nome,
        email: placeholderEmail,
        ativo: true,
      })
      .select("id, nome")
      .single();

    if (insertError) {
      console.error("Erro ao criar perfil:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If coordenacao_id provided, add as member
    if (coordenacao_id && newProfile?.id) {
      const { error: membroError } = await supabaseAdmin
        .from("membros_coordenacao")
        .insert({
          coordenacao_id: coordenacao_id,
          usuario_id: newProfile.id,
          cargo: cargo || "Membro",
        });

      if (membroError) {
        console.error("Erro ao vincular à coordenação:", membroError);
        // Profile was created, just log the membership error
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: newProfile 
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
