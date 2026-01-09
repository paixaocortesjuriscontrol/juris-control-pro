import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConviteRequest {
  clienteId: string;
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Verify user is admin/coordinator
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin or coordinator
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdminOrCoord = roles?.some(r => r.role === "admin" || r.role === "coordenador");
    if (!isAdminOrCoord) {
      throw new Error("Apenas administradores podem enviar convites");
    }

    const { clienteId, email }: ConviteRequest = await req.json();

    if (!clienteId || !email) {
      throw new Error("clienteId e email são obrigatórios");
    }

    // Get client info
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      throw new Error("Cliente não encontrado");
    }

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from("convites_cliente")
      .select("id, status")
      .eq("cliente_id", clienteId)
      .eq("email", email)
      .eq("status", "pendente")
      .single();

    if (existingInvite) {
      throw new Error("Já existe um convite pendente para este e-mail");
    }

    // Create invitation
    const { data: convite, error: conviteError } = await supabase
      .from("convites_cliente")
      .insert({
        cliente_id: clienteId,
        email,
        enviado_por: user.id,
      })
      .select()
      .single();

    if (conviteError) {
      console.error("Error creating invitation:", conviteError);
      throw new Error("Erro ao criar convite");
    }

    // Build signup URL
    const baseUrl = "https://juriscontrol.adv.br";
    const signupUrl = `${baseUrl}/cliente/cadastro?token=${convite.token}`;

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "JurisControl <noreply@juriscontrol.adv.br>",
      to: [email],
      subject: "Convite para acessar o Portal do Cliente - JurisControl",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: #d4af37; margin: 0; font-size: 24px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #d4af37; color: #1a365d; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ JurisControl</h1>
            </div>
            <div class="content">
              <h2>Olá!</h2>
              <p>Você foi convidado(a) para acessar o <strong>Portal do Cliente</strong> do JurisControl.</p>
              <p>Através do portal, você poderá:</p>
              <ul>
                <li>Acompanhar seus processos em tempo real</li>
                <li>Visualizar as últimas movimentações</li>
                <li>Consultar informações detalhadas</li>
              </ul>
              <p style="text-align: center;">
                <a href="${signupUrl}" class="button">Criar minha conta</a>
              </p>
              <p style="font-size: 13px; color: #666;">
                Este convite expira em 7 dias. Caso não consiga clicar no botão, copie e cole o link abaixo no seu navegador:
              </p>
              <p style="font-size: 12px; word-break: break-all; color: #888;">
                ${signupUrl}
              </p>
            </div>
            <div class="footer">
              <p>Este e-mail foi enviado pelo escritório em nome de ${cliente.nome}.</p>
              <p>© ${new Date().getFullYear()} JurisControl. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      // Delete the invite if email fails
      await supabase.from("convites_cliente").delete().eq("id", convite.id);
      throw new Error("Erro ao enviar e-mail. Verifique se o domínio está validado no Resend.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso",
        conviteId: convite.id 
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
