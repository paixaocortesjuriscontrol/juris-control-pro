import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  buscarPjeComunicaPaginado, 
  type PjeComunicaSearchParams 
} from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

interface MonitoramentoDjen {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  tribunais?: string[];
  coordenacao_id?: string;
  ativo: boolean;
}

interface SincronizacaoProgress {
  current: number;
  total: number;
  currentMonitoramento?: string;
  currentTribunal?: string;
  publicacoesEncontradas: number;
  novasInseridas: number;
}

interface SincronizacaoResult {
  success: boolean;
  monitoramentosProcessados: number;
  publicacoesEncontradas: number;
  novasInseridas: number;
  erros: string[];
}

/**
 * Gera variantes de busca para melhor cobertura.
 * 
 * IMPORTANTE: Para termos com caracteres especiais como "&",
 * gera variantes sem e com espaços para capturar diferentes indexações.
 * Ex: "F & F Distribuidora" → ["F & F Distribuidora", "F F Distribuidora"]
 */
function gerarVariantesBusca(termo: string): string[] {
  const variantes = new Set<string>();
  variantes.add(termo);
  
  // Variante sem acentos
  const semAcento = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (semAcento.toLowerCase() !== termo.toLowerCase()) {
    variantes.add(semAcento);
  }
  
  // Variante com & substituído por espaço (tribunais podem indexar diferente)
  if (termo.includes('&')) {
    const semAmpersand = termo.replace(/\s*&\s*/g, ' ').replace(/\s+/g, ' ').trim();
    variantes.add(semAmpersand);
    
    // Também sem acentos
    const semAmpersandSemAcento = semAmpersand.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (semAmpersandSemAcento !== semAmpersand) {
      variantes.add(semAmpersandSemAcento);
    }
  }
  
  // Prefixo curto (2 primeiras palavras significativas) para termos empresariais
  // Filtrar &, /, etc. para encontrar palavras reais
  const palavras = semAcento.split(/\s+/).filter(p => p.length >= 2 && !/^[&\/\\]+$/.test(p));
  if (palavras.length >= 3) {
    const prefixo = palavras.slice(0, 2).join(' ').toUpperCase();
    if (prefixo.length >= 6) {
      variantes.add(prefixo);
    }
  }
  
  return Array.from(variantes);
}

/** Palavra-chave: usar SOMENTE o termo. Remove prefixos tribunal/Adv (filtros separados). */
function extrairPalavraChavePura(termo: string): string {
  if (!termo?.trim()) return termo;
  let s = termo.trim();
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*Adv\.?\s*/i, '');
  s = s.replace(/^(?:TJ[A-Z0-9]+|TRT\d+|TRF\d+|STJ|STF|TST)\s*-\s*/i, '');
  s = s.replace(/^Adv\.?\s*/i, '');
  return s.trim() || termo;
}

// IMPORTANTE: FRASE EXATA na ordem - "Super Quadra" só casa se o texto tiver exatamente "Super Quadra".
function conteudoContemTermo(conteudo: string, termo: string, tipo: string, oab?: string): boolean {
  if (!conteudo) return false;

  const termoPuro = extrairPalavraChavePura(termo || "");

  const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contemFraseExata = (txt: string, fraseNorm: string) => {
    if (!fraseNorm) return true;
    return new RegExp(`(?:^|\\s)${escapeRegex(fraseNorm)}(?:\\s|$)`).test(txt);
  };

  const normalizar = (t: string) => t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&\/\\\\]/g, " ")
    .replace(/[^0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const conteudoNorm = normalizar(conteudo);

  if (tipo === "advogado") {
    // OAB (se houver) deve aparecer no TEXTO
    if (oab) {
      const oabDigits = String(oab).replace(/\D/g, "");
      if (oabDigits.length >= 3) {
        const oabPattern = new RegExp(oabDigits.split("").join("[.\\s-]?"), "i");
        if (!oabPattern.test(conteudo)) return false;
      }
    }

    // Nome (se houver) deve aparecer no TEXTO (frase exata)
    const nomeNorm = normalizar(termoPuro);
    if (nomeNorm && !contemFraseExata(conteudoNorm, nomeNorm)) return false;

    // Se não tem nome nem OAB, não aprova
    if (!nomeNorm && !oab) return false;

    return true;
  }

  // Demais tipos: frase exata (100%)
  if (!termoPuro) return true;
  const termoNorm = normalizar(termoPuro);
  return contemFraseExata(conteudoNorm, termoNorm);
}

// Gera hash global para deduplicação (igual ao backend)
function generateGlobalHash(conteudo: string, dataDisponibilizacao: string): string {
  const normalized = (conteudo || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 300);
  
  const dataKey = (dataDisponibilizacao || '').slice(0, 10);
  return `${dataKey}|${normalized}`;
}

// Gera hash de conteúdo simples (para a coluna hash_conteudo)
function generateContentHash(conteudo: string, data: string): string {
  const str = (conteudo || '').slice(0, 500) + (data || '');
  // Simple hash - poderia usar crypto mas isso funciona para dedup básico
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function useSincronizarDjenBrowser() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SincronizacaoProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancelar = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);

  const sincronizar = useCallback(async (
    monitoramentoIds?: string[],
    options?: { dataInicio?: string; dataFim?: string }
  ): Promise<SincronizacaoResult> => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsSyncing(true);
    
    const result: SincronizacaoResult = {
      success: true,
      monitoramentosProcessados: 0,
      publicacoesEncontradas: 0,
      novasInseridas: 0,
      erros: [],
    };

    try {
      // Buscar monitoramentos ativos
      let query = supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('ativo', true);
      
      if (monitoramentoIds && monitoramentoIds.length > 0) {
        query = query.in('id', monitoramentoIds);
      }
      
      const { data: monitoramentos, error } = await query;
      
      if (error) throw error;
      if (!monitoramentos || monitoramentos.length === 0) {
        toast.info("Nenhum monitoramento ativo encontrado");
        return result;
      }

      const totalMonitoramentos = monitoramentos.length;
      
      setProgress({
        current: 0,
        total: totalMonitoramentos,
        publicacoesEncontradas: 0,
        novasInseridas: 0,
      });

      // Processar cada monitoramento
      for (let i = 0; i < monitoramentos.length; i++) {
        if (controller.signal.aborted) break;
        
        const mon = monitoramentos[i] as unknown as MonitoramentoDjen;
        
        setProgress(prev => ({
          ...prev!,
          current: i + 1,
          currentMonitoramento: mon.termo_busca,
        }));

        try {
          // Gerar variantes de busca (só palavra-chave pura; tribunal vem de mon.tribunais)
          const termoPuro = extrairPalavraChavePura(mon.termo_busca);
          const variantes = gerarVariantesBusca(termoPuro);
          
          // Tribunais a processar
          const tribunais = mon.tribunais && mon.tribunais.length > 0 
            ? mon.tribunais 
            : [undefined]; // undefined = todos os tribunais
          
          const todasPublicacoes: any[] = [];
          const idsVistos = new Set<string>();
          
          // Para cada tribunal
          for (const tribunal of tribunais) {
            if (controller.signal.aborted) break;
            
            setProgress(prev => ({
              ...prev!,
              currentTribunal: tribunal || 'Todos',
            }));
            
            // Para cada variante de busca
            for (const variante of variantes) {
              if (controller.signal.aborted) break;
              
              try {
                const params: PjeComunicaSearchParams = {
                  tipo: mon.tipo === 'advogado' ? 'advogado' : 'palavra-chave',
                  palavraChave: mon.tipo !== 'advogado' ? variante : undefined,
                  oab: mon.tipo === 'advogado' ? mon.oab : undefined,
                  uf: mon.tipo === 'advogado' ? mon.uf : undefined,
                  siglaTribunal: tribunal,
                  dataInicio: options?.dataInicio,
                  dataFim: options?.dataFim,
                };

                const resp = await buscarPjeComunicaPaginado(params, {
                  signal: controller.signal,
                  maxPages: 10,
                  delayMs: 200,
                });

                // Deduplicar por ID
                for (const item of resp.items) {
                  const id = item.id || JSON.stringify(item).slice(0, 200);
                  if (!idsVistos.has(id)) {
                    idsVistos.add(id);
                    todasPublicacoes.push(item);
                  }
                }
              } catch (e: any) {
                if (e.name === 'AbortError') break;
                console.warn(`[Sync] Erro na variante "${variante}" tribunal ${tribunal}:`, e);
              }
              
              // Pequeno delay entre variantes
              await new Promise(r => setTimeout(r, 100));
            }
            
            // Delay entre tribunais
            await new Promise(r => setTimeout(r, 150));
          }
          
          result.publicacoesEncontradas += todasPublicacoes.length;
          
          setProgress(prev => ({
            ...prev!,
            publicacoesEncontradas: prev!.publicacoesEncontradas + todasPublicacoes.length,
          }));

          // Filtrar publicações que realmente contêm o termo completo
          // A API do PJE Comunica pode retornar resultados parciais (substring)
          const publicacoesFiltradas = todasPublicacoes.filter(pub => {
            const conteudo = pub.texto || pub.teor || '';
            return conteudoContemTermo(conteudo, mon.termo_busca, mon.tipo, mon.oab);
          });

          // Inserir publicações no banco (com deduplicação)
          if (publicacoesFiltradas.length > 0) {
            const novas = await inserirPublicacoes(publicacoesFiltradas, mon);
            result.novasInseridas += novas;
            
            setProgress(prev => ({
              ...prev!,
              novasInseridas: prev!.novasInseridas + novas,
            }));
          }
          
          result.monitoramentosProcessados++;
          
        } catch (e: any) {
          if (e.name === 'AbortError') break;
          console.error(`[Sync] Erro no monitoramento ${mon.id}:`, e);
          result.erros.push(`${mon.termo_busca}: ${e.message}`);
        }
      }
      
      if (controller.signal.aborted) {
        toast.info("Sincronização cancelada");
        result.success = false;
      } else if (result.novasInseridas > 0) {
        toast.success(`Sincronização concluída: ${result.novasInseridas} novas publicações`);
      } else {
        toast.info(`Sincronização concluída: nenhuma publicação nova encontrada`);
      }
      
    } catch (e: any) {
      console.error('[Sync] Erro geral:', e);
      result.success = false;
      result.erros.push(e.message);
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setIsSyncing(false);
      setProgress(null);
      setAbortController(null);
    }
    
    return result;
  }, []);

  return {
    sincronizar,
    cancelar,
    isSyncing,
    progress,
  };
}

// Função auxiliar para inserir publicações no banco
async function inserirPublicacoes(
  publicacoes: any[], 
  monitoramento: MonitoramentoDjen
): Promise<number> {
  let novas = 0;
  
  for (const pub of publicacoes) {
    try {
      const conteudo = pub.texto || pub.teor || '';
      const dataDisponibilizacao = pub.dataDisponibilizacao || pub.dataPublicacao || '';
      const globalHash = generateGlobalHash(conteudo, dataDisponibilizacao);
      const hashConteudo = generateContentHash(conteudo, dataDisponibilizacao);
      
      // Verificar se já existe pelo hash global
      const { data: existing } = await supabase
        .from('publicacoes_djen_global_hash')
        .select('id')
        .eq('hash_global', globalHash)
        .maybeSingle();
      
      if (existing) continue; // Já existe
      
      // Inserir nova publicação
      const { data: inserted, error } = await supabase
        .from('publicacoes_djen')
        .insert({
          monitoramento_id: monitoramento.id,
          hash_conteudo: hashConteudo,
          conteudo: conteudo.slice(0, 50000), // Limite de tamanho
          processo_numero: pub.numeroProcesso || null,
          data_publicacao: pub.dataPublicacao || null,
          data_disponibilizacao: pub.dataDisponibilizacao || null,
          tribunal: pub.siglaTribunal || null,
          lida: false,
        })
        .select('id')
        .single();
      
      if (!error && inserted) {
        novas++;
        
        // Registrar hash global para evitar duplicatas futuras
        try {
          await supabase
            .from('publicacoes_djen_global_hash')
            .insert({
              hash_global: globalHash,
              primeiro_monitoramento_id: monitoramento.id,
              publicacao_id: inserted.id,
            });
        } catch {
          // Ignorar erros de duplicata
        }
      } else if (error) {
        // Pode ser duplicata por constraint, ignorar
        if (!error.message?.includes('duplicate')) {
          console.warn('[Sync] Erro ao inserir:', error);
        }
      }
    } catch (e) {
      console.warn('[Sync] Erro ao processar publicação:', e);
    }
  }
  
  return novas;
}
