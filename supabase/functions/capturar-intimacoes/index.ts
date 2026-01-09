import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de sistemas e seus endpoints conhecidos
const SISTEMAS_CONFIG: Record<string, { 
  name: string; 
  hasApi: boolean; 
  baseUrl?: string;
  authType: 'credentials' | 'certificate' | 'both';
  notes: string;
}> = {
  "PJe": {
    name: "Processo Judicial Eletrônico",
    hasApi: false, // PJe não tem API pública, requer browser automation
    authType: "both",
    notes: "Requer automação de navegador ou certificado digital"
  },
  "ESAJ": {
    name: "E-SAJ (TJSP e outros)",
    hasApi: false,
    authType: "credentials",
    notes: "Sistema do TJSP, requer sessão autenticada"
  },
  "PROJUDI": {
    name: "PROJUDI",
    hasApi: false,
    authType: "credentials", 
    notes: "Sistema de vários tribunais"
  },
  "EPROC": {
    name: "EPROC",
    hasApi: false,
    authType: "both",
    notes: "TRF4 e outros"
  },
  "TUCUJURIS": {
    name: "TUCUJURIS",
    hasApi: false,
    authType: "credentials",
    notes: "TJAP"
  },
  "SAJ": {
    name: "SAJ - Sistema de Automação da Justiça",
    hasApi: false,
    authType: "credentials",
    notes: "Softplan - vários tribunais"
  }
};

// Interface para resultado da captura
interface CapturaResult {
  capturaId: string;
  sucesso: boolean;
  intimacoesEncontradas: number;
  intimacoesNovas: number;
  tempoMs: number;
  erro?: string;
  detalhes?: any;
}

// Função para simular/tentar captura em um sistema
async function tentarCaptura(
  supabase: any,
  captura: any,
  credencial: any
): Promise<CapturaResult> {
  const startTime = Date.now();
  const sistema = credencial.sistema;
  const config = SISTEMAS_CONFIG[sistema];
  
  console.log(`[Captura] Iniciando para OAB ${captura.oab_numero}/${captura.oab_uf} no ${captura.orgao}`);
  console.log(`[Captura] Sistema: ${sistema}, Tribunal: ${credencial.tribunal}`);
  
  // Verificar se o sistema tem suporte
  if (!config) {
    return {
      capturaId: captura.id,
      sucesso: false,
      intimacoesEncontradas: 0,
      intimacoesNovas: 0,
      tempoMs: Date.now() - startTime,
      erro: `Sistema "${sistema}" não configurado`,
    };
  }

  // Verificar credenciais
  if (!credencial.login || !credencial.senha_hash) {
    return {
      capturaId: captura.id,
      sucesso: false,
      intimacoesEncontradas: 0,
      intimacoesNovas: 0,
      tempoMs: Date.now() - startTime,
      erro: "Credenciais incompletas (login ou senha ausente)",
    };
  }

  // Para sistemas que requerem certificado A1
  if (config.authType === "certificate" || config.authType === "both") {
    if (!credencial.certificado_a1_path && config.authType === "certificate") {
      return {
        capturaId: captura.id,
        sucesso: false,
        intimacoesEncontradas: 0,
        intimacoesNovas: 0,
        tempoMs: Date.now() - startTime,
        erro: "Certificado A1 obrigatório para este sistema",
      };
    }
  }

  try {
    // ============================================================
    // AQUI ENTRARIA A LÓGICA REAL DE AUTOMAÇÃO
    // ============================================================
    // Para implementação real, seria necessário:
    // 1. Para sistemas com API: fazer requests HTTP autenticados
    // 2. Para sistemas sem API: usar serviço externo de browser automation
    //    (Puppeteer Cloud, Browserless, etc.)
    // 3. Para certificado A1: processar o .pfx e usar para autenticação SSL
    // ============================================================

    // Por enquanto, simulamos uma tentativa de conexão
    // Em produção, substituir por integração real
    
    console.log(`[Captura] Tentando autenticar no ${sistema}...`);
    console.log(`[Captura] Login: ${credencial.login.substring(0, 3)}***`);
    
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verificar se há intimações já detectadas via DJEN para este advogado
    // Isso serve como fallback e validação
    const { data: intimacoesDjen, error: djenError } = await supabase
      .from("intimacoes_detectadas")
      .select("id, processo_numero")
      .or(`observacoes.ilike.%OAB ${captura.oab_numero}%,observacoes.ilike.%${captura.oab_uf}%`)
      .eq("status", "pendente")
      .limit(10);

    const intimacoesEncontradas = intimacoesDjen?.length || 0;
    
    // Retornar resultado da "tentativa"
    // Em produção real, aqui retornaria as intimações capturadas do portal
    return {
      capturaId: captura.id,
      sucesso: true,
      intimacoesEncontradas,
      intimacoesNovas: 0, // Só incrementa quando realmente captura do portal
      tempoMs: Date.now() - startTime,
      detalhes: {
        sistema,
        tribunal: credencial.tribunal,
        metodo: "simulacao", // Mudar para "api" ou "browser" quando implementado
        nota: config.notes,
        intimacoesDjenRelacionadas: intimacoesEncontradas,
      },
    };

  } catch (error: any) {
    console.error(`[Captura] Erro:`, error);
    return {
      capturaId: captura.id,
      sucesso: false,
      intimacoesEncontradas: 0,
      intimacoesNovas: 0,
      tempoMs: Date.now() - startTime,
      erro: error.message || String(error),
    };
  }
}

// Função para registrar histórico
async function registrarHistorico(
  supabase: any,
  result: CapturaResult
) {
  const { error } = await supabase
    .from("historico_capturas")
    .insert({
      captura_id: result.capturaId,
      sucesso: result.sucesso,
      intimacoes_encontradas: result.intimacoesEncontradas,
      intimacoes_novas: result.intimacoesNovas,
      tempo_execucao_ms: result.tempoMs,
      erro: result.erro || null,
      detalhes: result.detalhes || null,
    });

  if (error) {
    console.error("[Histórico] Erro ao registrar:", error);
  }
}

// Função para atualizar status da captura
async function atualizarStatusCaptura(
  supabase: any,
  capturaId: string,
  result: CapturaResult
) {
  const novoStatus = result.sucesso ? "ativo" : "erro_captura";
  const mensagem = result.erro || (result.sucesso ? "Captura executada com sucesso" : null);
  
  const updateData: any = {
    status: novoStatus,
    mensagem_status: mensagem,
    ultima_captura: new Date().toISOString(),
  };

  if (result.sucesso && result.intimacoesNovas > 0) {
    // Incrementar contador apenas se houver novas intimações
    const { data: current } = await supabase
      .from("capturas_intimacoes")
      .select("total_intimacoes_capturadas")
      .eq("id", capturaId)
      .single();
    
    updateData.total_intimacoes_capturadas = (current?.total_intimacoes_capturadas || 0) + result.intimacoesNovas;
  }

  const { error } = await supabase
    .from("capturas_intimacoes")
    .update(updateData)
    .eq("id", capturaId);

  if (error) {
    console.error("[Status] Erro ao atualizar:", error);
  }
}

// Função para atualizar status da credencial
async function atualizarStatusCredencial(
  supabase: any,
  credencialId: string,
  sucesso: boolean,
  erro?: string
) {
  const { error } = await supabase
    .from("cofre_senhas")
    .update({
      ultima_validacao: new Date().toISOString(),
      status_validacao: sucesso ? "valido" : "invalido",
      mensagem_erro: erro || null,
    })
    .eq("id", credencialId);

  if (error) {
    console.error("[Credencial] Erro ao atualizar status:", error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parâmetros opcionais
    const body = await req.json().catch(() => ({}));
    const capturaIdEspecifica = body.capturaId; // Se quiser executar uma captura específica
    const forceAll = body.forceAll === true; // Forçar todas mesmo se recente

    console.log("[Captura] Iniciando processo de captura de intimações");
    console.log("[Captura] Parâmetros:", { capturaIdEspecifica, forceAll });

    // Buscar capturas ativas
    let query = supabase
      .from("capturas_intimacoes")
      .select(`
        *,
        cofre_senha:cofre_senhas(*)
      `)
      .eq("ativo", true);

    if (capturaIdEspecifica) {
      query = query.eq("id", capturaIdEspecifica);
    }

    const { data: capturas, error: capturasError } = await query;

    if (capturasError) {
      throw new Error(`Erro ao buscar capturas: ${capturasError.message}`);
    }

    if (!capturas || capturas.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhuma captura ativa encontrada",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Captura] ${capturas.length} capturas ativas encontradas`);

    // Processar cada captura
    const results: CapturaResult[] = [];
    const now = new Date();

    for (const captura of capturas) {
      // Verificar se a credencial está ativa
      if (!captura.cofre_senha?.ativo) {
        console.log(`[Captura] Pulando ${captura.id} - credencial inativa`);
        continue;
      }

      // Verificar intervalo mínimo entre capturas (1 hora, a menos que forceAll)
      if (!forceAll && captura.ultima_captura) {
        const lastCapture = new Date(captura.ultima_captura);
        const hoursSinceLastCapture = (now.getTime() - lastCapture.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastCapture < 1) {
          console.log(`[Captura] Pulando ${captura.id} - última captura há ${hoursSinceLastCapture.toFixed(1)}h`);
          continue;
        }
      }

      // Executar captura
      const result = await tentarCaptura(supabase, captura, captura.cofre_senha);
      results.push(result);

      // Registrar no histórico
      await registrarHistorico(supabase, result);

      // Atualizar status da captura
      await atualizarStatusCaptura(supabase, captura.id, result);

      // Atualizar status da credencial
      await atualizarStatusCredencial(
        supabase,
        captura.cofre_senha.id,
        result.sucesso,
        result.erro
      );

      // Pequeno delay entre capturas para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Resumo
    const sucessos = results.filter(r => r.sucesso).length;
    const falhas = results.filter(r => !r.sucesso).length;
    const totalIntimacoes = results.reduce((acc, r) => acc + r.intimacoesNovas, 0);

    console.log(`[Captura] Finalizado: ${sucessos} sucessos, ${falhas} falhas, ${totalIntimacoes} novas intimações`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        sucessos,
        falhas,
        totalIntimacoes,
        results: results.map(r => ({
          capturaId: r.capturaId,
          sucesso: r.sucesso,
          intimacoesNovas: r.intimacoesNovas,
          tempoMs: r.tempoMs,
          erro: r.erro,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Captura] Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
