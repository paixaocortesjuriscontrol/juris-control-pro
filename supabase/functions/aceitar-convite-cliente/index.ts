import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AceitarConviteRequest {
  token: string;
  senha: string;
  nome?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, senha, nome }: AceitarConviteRequest = await req.json();

    if (!token || !senha) {
      throw new Error("Token e senha são obrigatórios");
    }

    if (senha.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }

    // Get invitation
    const { data: convite, error: conviteError } = await supabase
      .from("convites_cliente")
      .select("*, cliente:clientes(id, nome)")
      .eq("token", token)
      .single();

    if (conviteError || !convite) {
      throw new Error("Convite não encontrado ou inválido");
    }

    if (convite.status !== "pendente") {
      throw new Error("Este convite já foi utilizado ou expirou");
    }

    if (new Date(convite.expira_em) < new Date()) {
      // Mark as expired
      await supabase
        .from("convites_cliente")
        .update({ status: "expirado" })
        .eq("id", convite.id);
      throw new Error("Este convite expirou. Solicite um novo convite ao escritório.");
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === convite.email);

    let userId: string;

    if (userExists) {
      // User exists, just link to client
      userId = userExists.id;
      
      // Check if already linked
      const { data: existingLink } = await supabase
        .from("clientes_usuarios")
        .select("id")
        .eq("user_id", userId)
        .eq("cliente_id", convite.cliente_id)
        .single();

      if (existingLink) {
        throw new Error("Este usuário já está vinculado a este cliente");
      }
    } else {
      // Create new user
      const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
        email: convite.email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome: nome || convite.cliente?.nome || convite.email.split("@")[0],
          is_cliente: true,
        },
      });

      if (userError) {
        console.error("Error creating user:", userError);
        throw new Error("Erro ao criar usuário: " + userError.message);
      }

      userId = newUser.user.id;

      // Create profile
      await supabase.from("profiles").upsert({
        id: userId,
        nome: nome || convite.cliente?.nome || convite.email.split("@")[0],
        email: convite.email,
        ativo: true,
      });

      // Add client role
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: "cliente",
      });
    }

    // Link user to client
    const { error: linkError } = await supabase
      .from("clientes_usuarios")
      .insert({
        user_id: userId,
        cliente_id: convite.cliente_id,
        ativo: true,
      });

    if (linkError) {
      console.error("Error linking user to client:", linkError);
      throw new Error("Erro ao vincular usuário ao cliente");
    }

    // Mark invitation as accepted
    await supabase
      .from("convites_cliente")
      .update({ 
        status: "aceito",
        aceito_em: new Date().toISOString(),
      })
      .eq("id", convite.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conta criada com sucesso! Você pode fazer login agora.",
        email: convite.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
