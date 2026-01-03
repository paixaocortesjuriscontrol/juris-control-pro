import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem atualizar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { userId, email, password, nome, oab, telefone, filial, ativo } = body ?? {};

    if (!userId) {
      return new Response(JSON.stringify({ error: "ID do usuário é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Atualização no Auth (email/senha)
    const updateAuthData: { email?: string; password?: string } = {};

    if (typeof email === "string" && email.trim()) {
      updateAuthData.email = email.trim();
    }

    if (typeof password === "string" && password) {
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateAuthData.password = password;
    }

    // 2) Atualização no Profile (dados do app)
    const updateProfileData: Record<string, unknown> = {};

    if (typeof nome === "string") {
      updateProfileData.nome = nome.trim();
    }

    if ("oab" in body) {
      if (typeof oab === "string") updateProfileData.oab = oab.trim() || null;
      else updateProfileData.oab = oab ?? null;
    }

    if ("telefone" in body) {
      if (typeof telefone === "string") updateProfileData.telefone = telefone.trim() || null;
      else updateProfileData.telefone = telefone ?? null;
    }

    if ("filial" in body) {
      if (typeof filial === "string") updateProfileData.filial = filial.trim() || null;
      else updateProfileData.filial = filial ?? null;
    }

    if ("ativo" in body) {
      updateProfileData.ativo = !!ativo;
    }

    // Se email foi enviado, também espelha no perfil
    if (typeof email === "string" && email.trim()) {
      updateProfileData.email = email.trim();
    }

    const willUpdateAuth = Object.keys(updateAuthData).length > 0;
    const willUpdateProfile = Object.keys(updateProfileData).length > 0;

    if (!willUpdateAuth && !willUpdateProfile) {
      return new Response(JSON.stringify({ message: "Nenhuma alteração necessária" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (willUpdateAuth) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateAuthData);

      if (updateError) {
        console.error("Erro ao atualizar usuário (auth):", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (willUpdateProfile) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(updateProfileData)
        .eq("id", userId);

      if (profileError) {
        console.error("Erro ao atualizar usuário (profile):", profileError);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Usuário atualizado com sucesso",
        updated: {
          auth: willUpdateAuth,
          profile: willUpdateProfile,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
