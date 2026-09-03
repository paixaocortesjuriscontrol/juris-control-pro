import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COORDENACAO_SANTANDER_CIVEL = "968631d0-6659-46f1-b45d-899892cb0121";
const SENHA_PADRAO = "@Juriscontrol2026";

interface Membro {
  nome: string;
  cargo: string;
  email: string;
}

const LISTA: Membro[] = [
  { nome: "Abel Rabelo", cargo: "Estagiário", email: "abel.rabelo@paixaocortes.adv.br" },
  { nome: "Aline Rodrigues", cargo: "Assistente", email: "aline.rodrigues@paixaocortes.adv.br" },
  { nome: "Geovana Farias", cargo: "Advogada", email: "geovana.farias@paixaocortes.adv.br" },
  { nome: "Giulia Soares", cargo: "Assistente", email: "giulia.soares@paixaocortes.adv.br" },
  { nome: "Guilherme Leal", cargo: "Advogado", email: "guilherme.leal@paixaocortes.adv.br" },
  { nome: "Ívina Carneiro", cargo: "Advogada", email: "ivina.carneiro@paixaocortes.adv.br" },
  { nome: "Isaac Silva", cargo: "Estagiário", email: "isaac.silva@paixaocortes.adv.br" },
  { nome: "Jéssica Ferreira", cargo: "Assistente", email: "jessica.ferreira@paixaocortes.adv.br" },
  { nome: "Juliana Silva", cargo: "Estagiária", email: "juliana.silva@paixaocortes.adv.br" },
  { nome: "Luca Azevedo", cargo: "Advogado", email: "luca.azevedo@paixaocortes.adv.br" },
  { nome: "Luiza Cavalcante", cargo: "Assistente", email: "luiza.cavalcante@paixaocortes.adv.br" },
  { nome: "Raabe Almeida", cargo: "Estagiária", email: "raabe.almeida@paixaocortes.adv.br" },
  { nome: "Rebeca Guedes", cargo: "Estagiária", email: "rebeca.guedes@paixaocortes.adv.br" },
  { nome: "Sanny Alves", cargo: "Assistente", email: "sanny.alves@paixaocortes.adv.br" },
];

function roleDoCargo(cargo: string): string {
  const c = cargo.toLowerCase();
  if (c.startsWith("estagi")) return "estagiario";
  if (c.startsWith("assistente")) return "assistente";
  if (c.startsWith("advogad")) return "advogado";
  return "assistente";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Autorização: token interno de setup OU JWT de administrador
    const setupToken = Deno.env.get("SETUP_TOKEN_SANTANDER_CIVEL");
    const headerToken = req.headers.get("x-setup-token");
    const autorizadoPorToken = !!setupToken && headerToken === setupToken;

    if (!autorizadoPorToken) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user }, error: authError } = await admin.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleAdmin } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const criados: string[] = [];
    const existentes: string[] = [];
    const vinculados: string[] = [];
    const erros: { email: string; erro: string }[] = [];

    for (const m of LISTA) {
      try {
        // 1) já existe perfil com esse e-mail?
        const { data: perfil } = await admin
          .from("profiles")
          .select("id")
          .eq("email", m.email)
          .maybeSingle();

        let userId = perfil?.id as string | undefined;

        if (!userId) {
          const { data: authData, error: createError } = await admin.auth.admin.createUser({
            email: m.email,
            password: SENHA_PADRAO,
            email_confirm: true,
            user_metadata: { nome: m.nome },
          });

          if (createError || !authData?.user?.id) {
            // pode já existir no auth sem perfil espelhado
            const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const found = list?.users?.find((u) => u.email?.toLowerCase() === m.email);
            if (!found) {
              erros.push({ email: m.email, erro: createError?.message || "falha ao criar" });
              continue;
            }
            userId = found.id;
            existentes.push(m.email);
          } else {
            userId = authData.user.id;
            criados.push(m.email);
          }
        } else {
          existentes.push(m.email);
        }

        // 2) perfil (trigger normalmente cria) — garante nome/email/ativo
        const { data: perfilAtual } = await admin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();

        if (perfilAtual) {
          await admin
            .from("profiles")
            .update({ nome: m.nome, email: m.email, ativo: true })
            .eq("id", userId);
        } else {
          await admin
            .from("profiles")
            .insert({ id: userId, nome: m.nome, email: m.email, ativo: true });
        }

        // 3) papel de acesso
        const role = roleDoCargo(m.cargo);
        const { data: rolesAtuais } = await admin
          .from("user_roles")
          .select("id, role")
          .eq("user_id", userId);

        if (!rolesAtuais || rolesAtuais.length === 0) {
          await admin.from("user_roles").insert({ user_id: userId, role });
        } else if (!rolesAtuais.some((r) => r.role === role)) {
          await admin.from("user_roles").update({ role }).eq("id", rolesAtuais[0].id);
        }

        // 4) vínculo com a coordenação (sem duplicar)
        const { data: membro } = await admin
          .from("membros_coordenacao")
          .select("id")
          .eq("coordenacao_id", COORDENACAO_SANTANDER_CIVEL)
          .eq("usuario_id", userId)
          .maybeSingle();

        if (!membro) {
          const { error: memberError } = await admin
            .from("membros_coordenacao")
            .insert({
              coordenacao_id: COORDENACAO_SANTANDER_CIVEL,
              usuario_id: userId,
              cargo: m.cargo,
            });
          if (memberError) {
            erros.push({ email: m.email, erro: `vínculo: ${memberError.message}` });
          } else {
            vinculados.push(m.email);
          }
        }
      } catch (e) {
        erros.push({ email: m.email, erro: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: LISTA.length,
        criados,
        existentes,
        vinculados,
        erros,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
