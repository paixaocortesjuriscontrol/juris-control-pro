import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerfilInput {
  nome: string;
  coordenacao_id?: string;
  cargo?: string;
}

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

    const { perfis }: { perfis: PerfilInput[] } = await req.json();

    if (!perfis || !Array.isArray(perfis) || perfis.length === 0) {
      return new Response(JSON.stringify({ error: "Array de perfis é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit batch size for safety
    if (perfis.length > 100) {
      return new Response(JSON.stringify({ error: "Máximo de 100 perfis por lote" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados: Record<string, string> = {}; // Map nome -> id
    const erros: string[] = [];

    // Process all profiles in parallel (but with concurrency limit)
    const CONCURRENCY = 10;
    
    for (let i = 0; i < perfis.length; i += CONCURRENCY) {
      const batch = perfis.slice(i, i + CONCURRENCY);
      
      const promises = batch.map(async (perfil) => {
        const { nome, coordenacao_id, cargo } = perfil;
        
        if (!nome) {
          erros.push(`Nome vazio ignorado`);
          return;
        }

        const nomeNormalizado = nome.trim();
        const nomeUpper = nomeNormalizado.toUpperCase();

        // Check if profile already exists (case-insensitive)
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, nome")
          .ilike("nome", nomeNormalizado)
          .limit(1)
          .single();

        if (existingProfile) {
          // Profile exists - ensure they're a member of the coordination
          if (coordenacao_id) {
            const { data: existingMember } = await supabaseAdmin
              .from("membros_coordenacao")
              .select("id")
              .eq("coordenacao_id", coordenacao_id)
              .eq("usuario_id", existingProfile.id)
              .maybeSingle();

            if (!existingMember) {
              await supabaseAdmin
                .from("membros_coordenacao")
                .insert({
                  coordenacao_id: coordenacao_id,
                  usuario_id: existingProfile.id,
                  cargo: cargo || "Membro",
                });
            }
          }
          resultados[nomeUpper] = existingProfile.id;
          return;
        }

        // Generate placeholder email with timestamp for uniqueness
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const sanitized = nomeNormalizado.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
        const placeholderEmail = `placeholder.${sanitized}.${timestamp}.${randomSuffix}@sistema.local`;
        
        // Generate a random password
        const placeholderPassword = crypto.randomUUID() + crypto.randomUUID();

        // Create user in auth.users
        const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: placeholderEmail,
          password: placeholderPassword,
          email_confirm: true,
          user_metadata: {
            nome: nomeNormalizado,
            is_placeholder: true,
          },
        });

        if (createUserError || !authData?.user?.id) {
          erros.push(`Erro ao criar ${nomeNormalizado}: ${createUserError?.message || "Falha desconhecida"}`);
          return;
        }

        const newUserId = authData.user.id;

        // Update/create profile
        const { data: existingProfileCheck } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", newUserId)
          .single();

        if (existingProfileCheck) {
          await supabaseAdmin
            .from("profiles")
            .update({
              nome: nomeNormalizado,
              email: placeholderEmail,
              ativo: true,
            })
            .eq("id", newUserId);
        } else {
          await supabaseAdmin
            .from("profiles")
            .insert({
              id: newUserId,
              nome: nomeNormalizado,
              email: placeholderEmail,
              ativo: true,
            });
        }

        // Add to coordination if provided
        if (coordenacao_id) {
          const { data: existingMember } = await supabaseAdmin
            .from("membros_coordenacao")
            .select("id")
            .eq("coordenacao_id", coordenacao_id)
            .eq("usuario_id", newUserId)
            .single();

          if (!existingMember) {
            await supabaseAdmin
              .from("membros_coordenacao")
              .insert({
                coordenacao_id: coordenacao_id,
                usuario_id: newUserId,
                cargo: cargo || "Membro",
              });
          }
        }

        resultados[nomeUpper] = newUserId;
      });

      await Promise.all(promises);
    }

    console.log(`Lote processado: ${Object.keys(resultados).length} perfis criados/encontrados, ${erros.length} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resultados, // Map of nome (uppercase) -> id
        erros,
        total: Object.keys(resultados).length,
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
