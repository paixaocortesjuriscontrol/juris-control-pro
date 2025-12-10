import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATAJUD_API_KEY = 'APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

// Mapeamento de tribunais para endpoints da API
const tribunais: Record<string, Record<string, { endpoint: string; nome: string }>> = {
  '8': {
    '02': { endpoint: 'api_publica_tjal', nome: 'TJAL' },
    '03': { endpoint: 'api_publica_tjap', nome: 'TJAP' },
    '04': { endpoint: 'api_publica_tjam', nome: 'TJAM' },
    '05': { endpoint: 'api_publica_tjba', nome: 'TJBA' },
    '06': { endpoint: 'api_publica_tjce', nome: 'TJCE' },
    '07': { endpoint: 'api_publica_tjdft', nome: 'TJDFT' },
    '08': { endpoint: 'api_publica_tjes', nome: 'TJES' },
    '09': { endpoint: 'api_publica_tjgo', nome: 'TJGO' },
    '10': { endpoint: 'api_publica_tjma', nome: 'TJMA' },
    '11': { endpoint: 'api_publica_tjmt', nome: 'TJMT' },
    '12': { endpoint: 'api_publica_tjms', nome: 'TJMS' },
    '13': { endpoint: 'api_publica_tjmg', nome: 'TJMG' },
    '14': { endpoint: 'api_publica_tjpa', nome: 'TJPA' },
    '15': { endpoint: 'api_publica_tjpb', nome: 'TJPB' },
    '16': { endpoint: 'api_publica_tjpr', nome: 'TJPR' },
    '17': { endpoint: 'api_publica_tjpe', nome: 'TJPE' },
    '18': { endpoint: 'api_publica_tjpi', nome: 'TJPI' },
    '19': { endpoint: 'api_publica_tjrj', nome: 'TJRJ' },
    '20': { endpoint: 'api_publica_tjrn', nome: 'TJRN' },
    '21': { endpoint: 'api_publica_tjrs', nome: 'TJRS' },
    '22': { endpoint: 'api_publica_tjro', nome: 'TJRO' },
    '23': { endpoint: 'api_publica_tjrr', nome: 'TJRR' },
    '24': { endpoint: 'api_publica_tjsc', nome: 'TJSC' },
    '25': { endpoint: 'api_publica_tjse', nome: 'TJSE' },
    '26': { endpoint: 'api_publica_tjsp', nome: 'TJSP' },
    '27': { endpoint: 'api_publica_tjto', nome: 'TJTO' },
  },
  '5': {
    '01': { endpoint: 'api_publica_trt1', nome: 'TRT1' },
    '02': { endpoint: 'api_publica_trt2', nome: 'TRT2' },
    '03': { endpoint: 'api_publica_trt3', nome: 'TRT3' },
    '04': { endpoint: 'api_publica_trt4', nome: 'TRT4' },
    '05': { endpoint: 'api_publica_trt5', nome: 'TRT5' },
    '06': { endpoint: 'api_publica_trt6', nome: 'TRT6' },
    '07': { endpoint: 'api_publica_trt7', nome: 'TRT7' },
    '08': { endpoint: 'api_publica_trt8', nome: 'TRT8' },
    '09': { endpoint: 'api_publica_trt9', nome: 'TRT9' },
    '10': { endpoint: 'api_publica_trt10', nome: 'TRT10' },
    '11': { endpoint: 'api_publica_trt11', nome: 'TRT11' },
    '12': { endpoint: 'api_publica_trt12', nome: 'TRT12' },
    '13': { endpoint: 'api_publica_trt13', nome: 'TRT13' },
    '14': { endpoint: 'api_publica_trt14', nome: 'TRT14' },
    '15': { endpoint: 'api_publica_trt15', nome: 'TRT15' },
    '16': { endpoint: 'api_publica_trt16', nome: 'TRT16' },
    '17': { endpoint: 'api_publica_trt17', nome: 'TRT17' },
    '18': { endpoint: 'api_publica_trt18', nome: 'TRT18' },
    '19': { endpoint: 'api_publica_trt19', nome: 'TRT19' },
    '20': { endpoint: 'api_publica_trt20', nome: 'TRT20' },
    '21': { endpoint: 'api_publica_trt21', nome: 'TRT21' },
    '22': { endpoint: 'api_publica_trt22', nome: 'TRT22' },
    '23': { endpoint: 'api_publica_trt23', nome: 'TRT23' },
    '24': { endpoint: 'api_publica_trt24', nome: 'TRT24' },
  },
  '4': {
    '01': { endpoint: 'api_publica_trf1', nome: 'TRF1' },
    '02': { endpoint: 'api_publica_trf2', nome: 'TRF2' },
    '03': { endpoint: 'api_publica_trf3', nome: 'TRF3' },
    '04': { endpoint: 'api_publica_trf4', nome: 'TRF4' },
    '05': { endpoint: 'api_publica_trf5', nome: 'TRF5' },
    '06': { endpoint: 'api_publica_trf6', nome: 'TRF6' },
  },
};

// Buscar processos por termo na API do DataJud
async function searchProcessos(endpoint: string, searchTerm: string, tipo: string): Promise<any[]> {
  const url = `https://api-publica.datajud.cnj.jus.br/${endpoint}/_search`;
  
  // Construir query baseada no tipo
  let query: any;
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 30); // Últimos 30 dias
  
  if (tipo === 'cpf_cnpj') {
    // Buscar por CPF/CNPJ nas partes
    query = {
      size: 50,
      query: {
        bool: {
          must: [
            {
              nested: {
                path: "dadosBasicos.polo",
                query: {
                  nested: {
                    path: "dadosBasicos.polo.parte",
                    query: {
                      bool: {
                        should: [
                          { match: { "dadosBasicos.polo.parte.pessoa.cpf": searchTerm.replace(/\D/g, '') } },
                          { match: { "dadosBasicos.polo.parte.pessoa.cnpj": searchTerm.replace(/\D/g, '') } },
                          { match: { "dadosBasicos.polo.parte.pessoa.numeroDocumentoPrincipal": searchTerm.replace(/\D/g, '') } }
                        ]
                      }
                    }
                  }
                }
              }
            }
          ],
          filter: [
            { range: { "dadosBasicos.dataAjuizamento": { gte: dataInicio.toISOString().split('T')[0] } } }
          ]
        }
      }
    };
  } else if (tipo === 'oab') {
    // Buscar por OAB nos advogados
    const oabParts = searchTerm.match(/(\d+)/);
    const oabNumero = oabParts ? oabParts[1] : searchTerm;
    
    query = {
      size: 50,
      query: {
        bool: {
          must: [
            {
              nested: {
                path: "dadosBasicos.polo",
                query: {
                  nested: {
                    path: "dadosBasicos.polo.parte",
                    query: {
                      nested: {
                        path: "dadosBasicos.polo.parte.advogado",
                        query: {
                          match: { "dadosBasicos.polo.parte.advogado.inscricao": oabNumero }
                        }
                      }
                    }
                  }
                }
              }
            }
          ],
          filter: [
            { range: { "dadosBasicos.dataAjuizamento": { gte: dataInicio.toISOString().split('T')[0] } } }
          ]
        }
      }
    };
  } else {
    // Buscar por nome ou termo-chave
    query = {
      size: 50,
      query: {
        bool: {
          must: [
            {
              nested: {
                path: "dadosBasicos.polo",
                query: {
                  nested: {
                    path: "dadosBasicos.polo.parte",
                    query: {
                      match: { "dadosBasicos.polo.parte.pessoa.nome": searchTerm }
                    }
                  }
                }
              }
            }
          ],
          filter: [
            { range: { "dadosBasicos.dataAjuizamento": { gte: dataInicio.toISOString().split('T')[0] } } }
          ]
        }
      }
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': DATAJUD_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.log(`Erro na busca ${endpoint}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.hits?.hits || [];
  } catch (error) {
    console.error(`Erro ao buscar em ${endpoint}:`, error);
    return [];
  }
}

// Extrair partes do processo
function extrairPartes(polos: any[]): { poloAtivo: string; poloPassivo: string } {
  let poloAtivo = '';
  let poloPassivo = '';

  for (const polo of polos || []) {
    const partes = polo.parte || [];
    const nomes = partes.map((p: any) => p.pessoa?.nome).filter(Boolean).join(', ');
    
    if (polo.polo === 'AT' || polo.polo === 'ATIVO') {
      poloAtivo = nomes;
    } else if (polo.polo === 'PA' || polo.polo === 'PASSIVO') {
      poloPassivo = nomes;
    }
  }

  return { poloAtivo, poloPassivo };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar monitoramentos ativos
    const { data: monitoramentos, error: monitoramentosError } = await supabase
      .from('monitoramentos_distribuicao')
      .select('*')
      .eq('ativo', true);

    if (monitoramentosError) throw monitoramentosError;

    console.log(`Processando ${monitoramentos?.length || 0} monitoramentos`);

    let totalNovasDistribuicoes = 0;
    const errors: string[] = [];

    for (const monitoramento of monitoramentos || []) {
      console.log(`Monitoramento: ${monitoramento.tipo} - ${monitoramento.termo_busca}`);
      
      try {
        // Determinar quais tribunais consultar
        const endpointsToSearch: { endpoint: string; nome: string }[] = [];
        
        // Todos os tribunais estaduais
        const todosEstadual = [
          { endpoint: 'api_publica_tjsp', nome: 'TJSP' },
          { endpoint: 'api_publica_tjrj', nome: 'TJRJ' },
          { endpoint: 'api_publica_tjmg', nome: 'TJMG' },
          { endpoint: 'api_publica_tjdft', nome: 'TJDFT' },
          { endpoint: 'api_publica_tjgo', nome: 'TJGO' },
          { endpoint: 'api_publica_tjba', nome: 'TJBA' },
          { endpoint: 'api_publica_tjpr', nome: 'TJPR' },
          { endpoint: 'api_publica_tjrs', nome: 'TJRS' },
          { endpoint: 'api_publica_tjsc', nome: 'TJSC' },
          { endpoint: 'api_publica_tjpe', nome: 'TJPE' },
          { endpoint: 'api_publica_tjce', nome: 'TJCE' },
          { endpoint: 'api_publica_tjal', nome: 'TJAL' },
          { endpoint: 'api_publica_tjam', nome: 'TJAM' },
          { endpoint: 'api_publica_tjap', nome: 'TJAP' },
          { endpoint: 'api_publica_tjes', nome: 'TJES' },
          { endpoint: 'api_publica_tjma', nome: 'TJMA' },
          { endpoint: 'api_publica_tjms', nome: 'TJMS' },
          { endpoint: 'api_publica_tjmt', nome: 'TJMT' },
          { endpoint: 'api_publica_tjpa', nome: 'TJPA' },
          { endpoint: 'api_publica_tjpb', nome: 'TJPB' },
          { endpoint: 'api_publica_tjpi', nome: 'TJPI' },
          { endpoint: 'api_publica_tjrn', nome: 'TJRN' },
          { endpoint: 'api_publica_tjro', nome: 'TJRO' },
          { endpoint: 'api_publica_tjrr', nome: 'TJRR' },
          { endpoint: 'api_publica_tjse', nome: 'TJSE' },
          { endpoint: 'api_publica_tjto', nome: 'TJTO' },
        ];

        // Tribunais Regionais Federais
        const todosRegionaisFederais = [
          { endpoint: 'api_publica_trf1', nome: 'TRF1' },
          { endpoint: 'api_publica_trf2', nome: 'TRF2' },
          { endpoint: 'api_publica_trf3', nome: 'TRF3' },
          { endpoint: 'api_publica_trf4', nome: 'TRF4' },
          { endpoint: 'api_publica_trf5', nome: 'TRF5' },
          { endpoint: 'api_publica_trf6', nome: 'TRF6' },
        ];

        // Tribunais Regionais do Trabalho
        const todosRegionaisTrabalho = [
          { endpoint: 'api_publica_trt1', nome: 'TRT1 (RJ)' },
          { endpoint: 'api_publica_trt2', nome: 'TRT2 (SP)' },
          { endpoint: 'api_publica_trt3', nome: 'TRT3 (MG)' },
          { endpoint: 'api_publica_trt4', nome: 'TRT4 (RS)' },
          { endpoint: 'api_publica_trt5', nome: 'TRT5 (BA)' },
          { endpoint: 'api_publica_trt6', nome: 'TRT6 (PE)' },
          { endpoint: 'api_publica_trt7', nome: 'TRT7 (CE)' },
          { endpoint: 'api_publica_trt8', nome: 'TRT8 (PA/AP)' },
          { endpoint: 'api_publica_trt9', nome: 'TRT9 (PR)' },
          { endpoint: 'api_publica_trt10', nome: 'TRT10 (DF/TO)' },
          { endpoint: 'api_publica_trt11', nome: 'TRT11 (AM/RR)' },
          { endpoint: 'api_publica_trt12', nome: 'TRT12 (SC)' },
          { endpoint: 'api_publica_trt13', nome: 'TRT13 (PB)' },
          { endpoint: 'api_publica_trt14', nome: 'TRT14 (RO/AC)' },
          { endpoint: 'api_publica_trt15', nome: 'TRT15 (Campinas)' },
          { endpoint: 'api_publica_trt16', nome: 'TRT16 (MA)' },
          { endpoint: 'api_publica_trt17', nome: 'TRT17 (ES)' },
          { endpoint: 'api_publica_trt18', nome: 'TRT18 (GO)' },
          { endpoint: 'api_publica_trt19', nome: 'TRT19 (AL)' },
          { endpoint: 'api_publica_trt20', nome: 'TRT20 (SE)' },
          { endpoint: 'api_publica_trt21', nome: 'TRT21 (RN)' },
          { endpoint: 'api_publica_trt22', nome: 'TRT22 (PI)' },
          { endpoint: 'api_publica_trt23', nome: 'TRT23 (MT)' },
          { endpoint: 'api_publica_trt24', nome: 'TRT24 (MS)' },
        ];

        // Se tribunais específicos foram selecionados (pode ser múltiplos separados por vírgula)
        if (monitoramento.tribunal) {
          const tribunaisSelecionados = monitoramento.tribunal.split(',').map((t: string) => t.trim().toUpperCase());
          const allTribunais = [...todosEstadual, ...todosRegionaisFederais, ...todosRegionaisTrabalho];
          
          for (const tribunalSelecionado of tribunaisSelecionados) {
            const found = allTribunais.find(t => {
              const nomeNormalizado = t.nome.split(' ')[0].toUpperCase(); // Pega só sigla (ex: TRT1 de "TRT1 (RJ)")
              return nomeNormalizado === tribunalSelecionado || 
                     t.endpoint.toUpperCase().includes(tribunalSelecionado.replace(/\s/g, ''));
            });
            if (found && !endpointsToSearch.find(e => e.endpoint === found.endpoint)) {
              endpointsToSearch.push(found);
            }
          }
        } else if (monitoramento.uf) {
          // Se UF específica, filtrar tribunais estaduais e trabalhistas
          const ufMap: Record<string, { estadual: string; trabalho?: string }> = {
            'SP': { estadual: 'api_publica_tjsp', trabalho: 'api_publica_trt2' },
            'RJ': { estadual: 'api_publica_tjrj', trabalho: 'api_publica_trt1' },
            'MG': { estadual: 'api_publica_tjmg', trabalho: 'api_publica_trt3' },
            'DF': { estadual: 'api_publica_tjdft', trabalho: 'api_publica_trt10' },
            'GO': { estadual: 'api_publica_tjgo', trabalho: 'api_publica_trt18' },
            'BA': { estadual: 'api_publica_tjba', trabalho: 'api_publica_trt5' },
            'PR': { estadual: 'api_publica_tjpr', trabalho: 'api_publica_trt9' },
            'RS': { estadual: 'api_publica_tjrs', trabalho: 'api_publica_trt4' },
            'SC': { estadual: 'api_publica_tjsc', trabalho: 'api_publica_trt12' },
            'PE': { estadual: 'api_publica_tjpe', trabalho: 'api_publica_trt6' },
            'CE': { estadual: 'api_publica_tjce', trabalho: 'api_publica_trt7' },
            'AL': { estadual: 'api_publica_tjal', trabalho: 'api_publica_trt19' },
            'AM': { estadual: 'api_publica_tjam', trabalho: 'api_publica_trt11' },
            'AP': { estadual: 'api_publica_tjap', trabalho: 'api_publica_trt8' },
            'ES': { estadual: 'api_publica_tjes', trabalho: 'api_publica_trt17' },
            'MA': { estadual: 'api_publica_tjma', trabalho: 'api_publica_trt16' },
            'MS': { estadual: 'api_publica_tjms', trabalho: 'api_publica_trt24' },
            'MT': { estadual: 'api_publica_tjmt', trabalho: 'api_publica_trt23' },
            'PA': { estadual: 'api_publica_tjpa', trabalho: 'api_publica_trt8' },
            'PB': { estadual: 'api_publica_tjpb', trabalho: 'api_publica_trt13' },
            'PI': { estadual: 'api_publica_tjpi', trabalho: 'api_publica_trt22' },
            'RN': { estadual: 'api_publica_tjrn', trabalho: 'api_publica_trt21' },
            'RO': { estadual: 'api_publica_tjro', trabalho: 'api_publica_trt14' },
            'RR': { estadual: 'api_publica_tjrr', trabalho: 'api_publica_trt11' },
            'SE': { estadual: 'api_publica_tjse', trabalho: 'api_publica_trt20' },
            'TO': { estadual: 'api_publica_tjto', trabalho: 'api_publica_trt10' },
          };
          const tribunaisUF = ufMap[monitoramento.uf];
          if (tribunaisUF) {
            endpointsToSearch.push({ endpoint: tribunaisUF.estadual, nome: `TJ${monitoramento.uf}` });
            if (tribunaisUF.trabalho) {
              const trt = todosRegionaisTrabalho.find(t => t.endpoint === tribunaisUF.trabalho);
              if (trt) endpointsToSearch.push(trt);
            }
          }
        } else {
          // Sem filtro: buscar em TODOS os tribunais (estaduais, federais e trabalhistas)
          endpointsToSearch.push(...todosEstadual, ...todosRegionaisFederais, ...todosRegionaisTrabalho);
        }

        console.log(`  Buscando em ${endpointsToSearch.length} tribunais`);

        // Buscar em cada tribunal
        for (const tribunal of endpointsToSearch) {
          const resultados = await searchProcessos(
            tribunal.endpoint, 
            monitoramento.termo_busca,
            monitoramento.tipo
          );

          console.log(`  ${tribunal.nome}: ${resultados.length} resultados`);

          for (const hit of resultados) {
            const source = hit._source;
            const dadosBasicos = source?.dadosBasicos || {};
            const numeroProcesso = dadosBasicos.numero || source?.numeroProcesso;

            if (!numeroProcesso) continue;

            // Verificar se já existe
            const { data: existing } = await supabase
              .from('distribuicoes_encontradas')
              .select('id')
              .eq('numero_processo', numeroProcesso)
              .eq('monitoramento_id', monitoramento.id)
              .single();

            if (existing) continue;

            // Verificar se já existe como processo no sistema
            const { data: processoExistente } = await supabase
              .from('processos')
              .select('id')
              .eq('numero', numeroProcesso)
              .single();

            if (processoExistente) continue;

            // Extrair partes
            const { poloAtivo, poloPassivo } = extrairPartes(dadosBasicos.polo);

            // Inserir nova distribuição
            const { error: insertError } = await supabase
              .from('distribuicoes_encontradas')
              .insert({
                monitoramento_id: monitoramento.id,
                numero_processo: numeroProcesso,
                tribunal: tribunal.nome,
                vara: dadosBasicos.orgaoJulgador?.nomeOrgao || null,
                classe: dadosBasicos.classeProcessual?.nome || null,
                assunto: dadosBasicos.assunto?.[0]?.nome || null,
                polo_ativo: poloAtivo || null,
                polo_passivo: poloPassivo || null,
                data_distribuicao: dadosBasicos.dataAjuizamento || null,
                dados_completos: source,
                status: 'pendente',
              });

            if (insertError) {
              console.error('Erro ao inserir distribuição:', insertError);
            } else {
              totalNovasDistribuicoes++;

              // Criar notificação
              await supabase.from('notificacoes').insert({
                usuario_id: monitoramento.criado_por,
                tipo: 'alerta',
                titulo: 'Nova distribuição detectada',
                mensagem: `Processo ${numeroProcesso} encontrado no ${tribunal.nome} - ${monitoramento.termo_busca}`,
                link: '/monitoramento-distribuicao',
              });
            }
          }

          // Pequeno delay entre requisições
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Atualizar última execução
        await supabase
          .from('monitoramentos_distribuicao')
          .update({ ultima_execucao: new Date().toISOString() })
          .eq('id', monitoramento.id);

      } catch (error) {
        console.error(`Erro no monitoramento ${monitoramento.id}:`, error);
        errors.push(`${monitoramento.termo_busca}: ${error}`);
      }
    }

    // Atualizar configuração de monitoramento
    await supabase
      .from('configuracoes_monitoramento')
      .update({ ultima_execucao: new Date().toISOString() })
      .eq('tipo', 'distribuicoes');

    return new Response(
      JSON.stringify({
        success: true,
        monitoramentosProcessados: monitoramentos?.length || 0,
        novasDistribuicoes: totalNovasDistribuicoes,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no monitoramento de distribuições:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
