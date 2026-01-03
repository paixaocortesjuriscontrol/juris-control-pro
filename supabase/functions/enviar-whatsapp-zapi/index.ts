import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnviarMensagemRequest {
  telefones: string[];
  mensagem: string;
  evento_id?: string;
  tipo?: 'evento' | 'lembrete' | 'cancelamento';
}

// Formatar telefone para o padrão da Z-API (somente números com código do país)
function formatarTelefone(telefone: string): string | null {
  if (!telefone) return null;
  
  // Remove tudo que não é número
  let numeros = telefone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (numeros.startsWith('0')) {
    numeros = numeros.substring(1);
  }
  
  // Se não tiver código do país, adiciona 55 (Brasil)
  if (numeros.length === 10 || numeros.length === 11) {
    numeros = '55' + numeros;
  }
  
  // Validar comprimento (12 para fixo BR ou 13 para celular BR)
  if (numeros.length < 12 || numeros.length > 13) {
    console.log(`Telefone inválido após formatação: ${telefone} -> ${numeros}`);
    return null;
  }
  
  return numeros;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      console.error('Credenciais da Z-API não configuradas (INSTANCE_ID, TOKEN ou CLIENT_TOKEN)');
      return new Response(
        JSON.stringify({ error: 'Credenciais da Z-API não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { telefones, mensagem, evento_id, tipo = 'evento' }: EnviarMensagemRequest = await req.json();

    if (!telefones || telefones.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum telefone fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mensagem) {
      return new Response(
        JSON.stringify({ error: 'Mensagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enviando mensagem para ${telefones.length} telefones via Z-API`);
    console.log(`Tipo: ${tipo}, Evento ID: ${evento_id || 'N/A'}`);

    const resultados: { telefone: string; sucesso: boolean; erro?: string }[] = [];

    for (const telefone of telefones) {
      const telefoneFormatado = formatarTelefone(telefone);
      
      if (!telefoneFormatado) {
        resultados.push({
          telefone,
          sucesso: false,
          erro: 'Telefone inválido'
        });
        continue;
      }

      try {
        const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        
        console.log(`Enviando para: ${telefoneFormatado}`);
        
        const response = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': ZAPI_CLIENT_TOKEN,
          },
          body: JSON.stringify({
            phone: telefoneFormatado,
            message: mensagem,
          }),
        });

        const responseData = await response.json();
        console.log(`Resposta Z-API para ${telefoneFormatado}:`, responseData);

        if (response.ok && !responseData.error) {
          resultados.push({
            telefone: telefoneFormatado,
            sucesso: true
          });
        } else {
          resultados.push({
            telefone: telefoneFormatado,
            sucesso: false,
            erro: responseData.error || responseData.message || 'Erro desconhecido'
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`Erro ao enviar para ${telefoneFormatado}:`, error);
        resultados.push({
          telefone: telefoneFormatado,
          sucesso: false,
          erro: errorMessage
        });
      }
    }

    const enviados = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(`Resultado: ${enviados} enviados, ${falhas} falhas`);

    return new Response(
      JSON.stringify({
        sucesso: enviados > 0,
        enviados,
        falhas,
        resultados
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na função enviar-whatsapp-zapi:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
