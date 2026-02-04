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

// IMPORTANTE: Validar que o TERMO COMPLETO está presente na publicação
// A API do PJE Comunica faz busca por substring, então pode retornar resultados parciais
// VALIDAÇÃO ESTRITA: 100% das palavras devem estar presentes
function conteudoContemTermo(conteudo: string, termo: string, tipo: string): boolean {
  if (!conteudo || !termo) return false;
  
  // Para advogado, a validação é diferente (OAB)
  if (tipo === 'advogado') return true;
  
  // Normalizar ambos para comparação
  const normalizar = (t: string) => t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    // Remove pontuação geral para permitir match por palavra (ex: "LTDA." -> "LTDA")
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const conteudoNorm = normalizar(conteudo);
  const termoNorm = normalizar(termo);
  
  // Verificar se o termo completo está presente (match exato)
  if (conteudoNorm.includes(termoNorm)) return true;
  
  // VALIDAÇÃO ESTRITA: 100% das palavras significativas devem estar presentes
  // Isso evita capturas parciais como "Distribuidora" quando o termo é 
  // "F & F Distribuidora de Produtos Farmacêuticos LTDA"
  const tokens = termoNorm.split(/\s+/).filter(Boolean);
  // IMPORTANTE: verificar no termo ORIGINAL (não normalizado) se tinha "&"
  const termoOriginalTemAmpersand = /&/.test(termo);
  const allowSingleLetters = termoOriginalTemAmpersand && tokens.filter(t => t.length === 1).length >= 2;
  const palavrasTermo = tokens.filter(p => p.length >= 2 || (allowSingleLetters && p.length === 1));
  if (palavrasTermo.length === 0) return true;
  
  // VALIDAÇÃO ESTRITA: 100% das palavras devem estar presentes
  // Usar includes ao invés de regex para ser menos restritivo e mais rápido
  return palavrasTermo.every(p => conteudoNorm.includes(p));
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
          // Gerar variantes de busca
          const variantes = gerarVariantesBusca(mon.termo_busca);
          
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
            return conteudoContemTermo(conteudo, mon.termo_busca, mon.tipo);
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
