import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { buscarPjeComunicaPaginado } from "@/utils/pjeComunicaClient";

// ============================================================================
// VERSÃO SIMPLIFICADA - Loop sequencial por monitoramento
// Restaurado do modelo original para resolver problemas de progresso
// ============================================================================

interface MonitoramentoDjen {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  coordenacao_id?: string;
  ativo: boolean;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
}

interface PublicacaoResultado {
  id: string;
  processo_numero: string | null;
  conteudo: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  fonte: string | null;
  hash_conteudo: string;
}

export interface ProgressoExecucao {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  publicacoesDescartadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro' | 'cancelado';
  mensagem: string;
  tempoInicio?: number;
  tempoDecorrido: number;
  termoAtual?: string;
  executionId?: string;
  // Checkpoint para retomada
  checkpoint?: {
    indice: number;
    data: string;
    novasAcumuladas: number;
    duplicadasAcumuladas: number;
    descartadasAcumuladas: number;
  };
}

// ============================================================================
// CONFIGURAÇÃO OTIMIZADA v1.0.5 - Performance restaurada
// ============================================================================
const CONFIG = {
  concurrent_limit: 2,
  delay_between_batches: 0,        // ELIMINADO - sem delay entre monitoramentos
  delay_between_tribunals: 100,    // Reduzido de 250ms para 100ms
  delay_between_variants: 50,      // Reduzido de 150ms para 50ms
  delay_on_rate_limit: 5000,       // Reduzido de 10s para 5s (já tem retry interno)
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// IDs sintéticos de tribunais
const TODOS_IDS_CIVEIS = [
  'TJAC', 'TJAL', 'TJAM', 'TJAP', 'TJBA', 'TJCE', 'TJDFT', 'TJES', 'TJGO',
  'TJMA', 'TJMG', 'TJMS', 'TJMT', 'TJPA', 'TJPB', 'TJPE', 'TJPI', 'TJPR',
  'TJRJ', 'TJRN', 'TJRO', 'TJRR', 'TJRS', 'TJSC', 'TJSE', 'TJSP', 'TJTO',
];

const TODOS_IDS_TRABALHISTAS = [
  'TST', 'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8',
  'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16',
  'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24',
];

function expandirTribunais(tribunais: string[] | undefined): string[] | undefined {
  if (!tribunais || tribunais.length === 0) return undefined;
  
  const expandidos = new Set<string>();
  
  for (const t of tribunais) {
    if (t === 'TODOS_CIVEIS') {
      TODOS_IDS_CIVEIS.forEach(id => expandidos.add(id));
    } else if (t === 'TODOS_TRT') {
      TODOS_IDS_TRABALHISTAS.forEach(id => expandidos.add(id));
    } else {
      expandidos.add(t.toUpperCase());
    }
  }
  
  if (expandidos.size > 0) {
    return Array.from(expandidos);
  }
  
  return undefined;
}

function calcularProximoDiaUtil(dataBase: Date): Date {
  const resultado = new Date(dataBase);
  
  const estaNoRecesso = (d: Date): boolean => {
    const mes = d.getMonth();
    const dia = d.getDate();
    return (mes === 11 && dia >= 20) || (mes === 0 && dia <= 6);
  };
  
  const proximoDiaUtil = (d: Date): void => {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    if (estaNoRecesso(d)) {
      if (d.getMonth() === 11) {
        d.setFullYear(d.getFullYear() + 1);
      }
      d.setMonth(0);
      d.setDate(7);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
  };
  
  proximoDiaUtil(resultado);
  return resultado;
}

function extrairDataYMD(dataStr: string | null | undefined): string | null {
  if (!dataStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
  const match = dataStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  const d = new Date(dataStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// Chaves para localStorage
const STORAGE_KEY = 'djen-direta-progresso';

const salvarEstado = (progresso: ProgressoExecucao) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...progresso,
      savedAt: Date.now(),
    }));
  } catch (e) {
    console.warn('Erro ao salvar estado DJEN:', e);
  }
};

const carregarEstado = (): ProgressoExecucao | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    // Expirar após 12 horas
    if (Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
};

const defaultProgresso = (): ProgressoExecucao => ({
  monitoramentoAtual: 0,
  totalMonitoramentos: 0,
  publicacoesNovas: 0,
  publicacoesDuplicadas: 0,
  publicacoesDescartadas: 0,
  status: 'idle',
  mensagem: '',
  tempoDecorrido: 0,
  termoAtual: undefined,
  checkpoint: undefined,
});

/**
 * Hook simplificado para busca DJEN - Loop sequencial por monitoramento
 */
export function useBuscaDjenDireta() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [progresso, setProgresso] = useState<ProgressoExecucao>(() => {
    const saved = carregarEstado();
    if (saved && (saved.status === 'concluido' || saved.status === 'cancelado')) {
      return saved;
    }
    return defaultProgresso();
  });
  
  const [executando, setExecutando] = useState(false);
  
  const cancelarRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const dataOverrideRef = useRef<string | null>(null);

  // Validar estado local ao montar
  useEffect(() => {
    let isMounted = true;

    const validarEstadoLocal = async () => {
      const saved = carregarEstado();
      if (!saved || saved.status !== 'executando') return;

      try {
        const { data } = await supabase
          .from('execucoes_agendadas')
          .select('id, status, finalizado_em')
          .eq('tipo', 'djen')
          .eq('status', 'executando')
          .is('finalizado_em', null)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (!data) {
          console.warn('[DJEN] Estado local "executando" sem execução ativa no banco.');
          setProgresso(prev => ({
            ...prev,
            status: 'idle',
            tempoInicio: undefined,
          }));
        }
      } catch (e) {
        console.warn('[DJEN] Falha ao validar estado:', e);
      }
    };

    validarEstadoLocal();

    return () => {
      isMounted = false;
    };
  }, []);

  // Timer para tempo decorrido
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!executando || !progresso.tempoInicio || progresso.status !== 'executando') {
      return;
    }

    timerRef.current = setInterval(() => {
      setProgresso((prev) => {
        if (!prev.tempoInicio || prev.status !== 'executando') return prev;
        const tempo = Math.floor((Date.now() - prev.tempoInicio) / 1000);
        const updated = { ...prev, tempoDecorrido: tempo };
        salvarEstado(updated);
        return updated;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [executando, progresso.tempoInicio, progresso.status]);

  // Persistir progresso
  useEffect(() => {
    salvarEstado(progresso);
  }, [progresso]);

  // Gerar hash para deduplicação
  const gerarHash = (conteudo: string, dataDisponibilizacao: string): string => {
    const dataKey = (dataDisponibilizacao || '').slice(0, 10);
    const normalized = (dataKey + '|' + conteudo).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 500);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Verificar duplicatas
  const verificarDuplicatasBatch = async (
    hashes: string[], 
    monitoramentoId: string
  ): Promise<Set<string>> => {
    if (hashes.length === 0) return new Set();
    
    const { data } = await supabase
      .from('publicacoes_djen')
      .select('hash_conteudo')
      .eq('monitoramento_id', monitoramentoId)
      .in('hash_conteudo', hashes);
    
    return new Set((data || []).map(d => d.hash_conteudo));
  };

  // Validar conteúdo contém termo
  const conteudoContemTermo = (conteudo: string, termo: string, tipo: string, oab?: string): boolean => {
    if (!conteudo) return false;
    
    const normalizar = (t: string) => t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[&\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    
    const conteudoNorm = normalizar(conteudo);
    
    // Para advogado: validar OAB + Nome
    if (tipo === 'advogado') {
      if (oab) {
        const oabDigits = String(oab).replace(/\D/g, '');
        const oabPattern = new RegExp(oabDigits.split('').join('[.\\s]?'), 'i');
        if (!oabPattern.test(conteudo)) {
          return false;
        }
      }
      
      if (termo) {
        const termoNorm = normalizar(termo);
        const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
        
        if (palavrasTermo.length > 0) {
          const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
          const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
          
          if (palavrasEncontradas.length < minPalavras) {
            return false;
          }
        }
      }
      
      return true;
    }

    // Para outros tipos
    if (!termo) return false;
    
    const termoNorm = normalizar(termo);
    
    if (conteudoNorm.includes(termoNorm)) return true;
    
    const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
    if (palavrasTermo.length === 0) return true;
    
    const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
    const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
    
    return palavrasEncontradas.length >= minPalavras;
  };

  // Registrar execução no banco
  const registrarExecucao = async (status: 'executando' | 'concluido' | 'cancelado' | 'erro', detalhes?: Record<string, any>): Promise<string | null> => {
    try {
      const executionId = executionIdRef.current;
      
      if (status === 'executando' && !executionId) {
        const { data, error } = await supabase
          .from('execucoes_agendadas')
          .insert({
            tipo: 'djen',
            status: 'executando',
            iniciado_em: new Date().toISOString(),
            detalhes: detalhes || {},
          })
          .select('id')
          .single();
        
        if (error) {
          console.error('Erro ao registrar execução:', error);
          return null;
        }
        
        executionIdRef.current = data.id;
        return data.id;
      } else if (executionId) {
        const updateData: Record<string, any> = {
          status,
          detalhes: detalhes || {},
        };
        
        if (status !== 'executando') {
          updateData.finalizado_em = new Date().toISOString();
        }
        
        await supabase
          .from('execucoes_agendadas')
          .update(updateData)
          .eq('id', executionId);
        
        return executionId;
      }
      
      return null;
    } catch (e) {
      console.error('Erro ao registrar execução:', e);
      return null;
    }
  };

  // Gerar variantes de termo (com e sem acento)
  const gerarVariantes = (termo: string): string[] => {
    const semAcento = termo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const variantes = [termo];
    if (semAcento !== termo) {
      variantes.push(semAcento);
    }
    return variantes;
  };

  // Buscar publicações para um monitoramento
  const buscarMonitoramento = async (monitoramento: MonitoramentoDjen): Promise<PublicacaoResultado[]> => {
    if (cancelarRef.current) return [];

    let dataFimYmd: string;
    let dataInicioYmd: string;
    
    if (dataOverrideRef.current) {
      dataFimYmd = dataOverrideRef.current;
      dataInicioYmd = dataOverrideRef.current;
    } else {
      const now = new Date();
      const todayBrasilia = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const startBrasilia = new Date(todayBrasilia);
      startBrasilia.setDate(startBrasilia.getDate() - 2);

      dataFimYmd = todayBrasilia.toISOString().split('T')[0];
      dataInicioYmd = startBrasilia.toISOString().split('T')[0];
    }

    const tipoMapeado = monitoramento.tipo === 'parte' ? 'palavra-chave' : monitoramento.tipo;

    const params: any = {
      tipo: tipoMapeado,
      dataInicio: dataInicioYmd,
      dataFim: dataFimYmd,
      pageSize: 50,
    };

    let palavrasChaveVariantes: string[] = [];
    let ufsParaBuscar: string[] = [];

    if (tipoMapeado === 'advogado' && monitoramento.oab) {
      const oabDigits = String(monitoramento.oab).replace(/\D/g, '');
      const ufValue = String(monitoramento.uf || '').trim().toUpperCase();

      params.oab = oabDigits;

      if (!ufValue || ufValue === 'TODAS') {
        params.uf = undefined;
        ufsParaBuscar = [];
      } else if (ufValue.includes(',')) {
        ufsParaBuscar = ufValue.split(',')
          .map(u => u.trim().toUpperCase())
          .filter(u => u.length === 2);
        
        if (ufsParaBuscar.length > 0) {
          params.uf = ufsParaBuscar[0];
        }
      } else if (ufValue.length === 2) {
        params.uf = ufValue;
        ufsParaBuscar = [ufValue];
      } else {
        params.uf = undefined;
        ufsParaBuscar = [];
      }
    } else if (tipoMapeado === 'palavra-chave' || monitoramento.tipo === 'parte') {
      palavrasChaveVariantes = gerarVariantes(monitoramento.termo_busca);
    } else if (tipoMapeado === 'processo') {
      params.numeroProcesso = monitoramento.termo_busca.replace(/\D/g, '');
    }

    if (palavrasChaveVariantes.length === 0 && !params.oab && !params.numeroProcesso) {
      palavrasChaveVariantes = [monitoramento.termo_busca];
    }

    try {
      if (cancelarRef.current) return [];

      const tribunaisRaw = Array.isArray(monitoramento.tribunais) && monitoramento.tribunais.length > 0
        ? monitoramento.tribunais
        : undefined;
      const tribunaisExpandidos = expandirTribunais(tribunaisRaw);
      const tribunais = tribunaisExpandidos && tribunaisExpandidos.length > 0
        ? tribunaisExpandidos
        : [undefined];

      const variantesParaBuscarRaw = palavrasChaveVariantes.length > 0
        ? palavrasChaveVariantes
        : (params.palavraChave ? [params.palavraChave] : [null as unknown as string]);

      const variantesParaBuscar = params.oab
        ? (variantesParaBuscarRaw.length > 0 ? variantesParaBuscarRaw : [null as unknown as string])
        : variantesParaBuscarRaw
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter((v) => v.length > 0);

      const variantesLoop = variantesParaBuscar.length > 0 ? variantesParaBuscar : [null as unknown as string];

      const seen = new Set<string>();
      const acumulado: any[] = [];

      const createLinkedController = () => {
        const controller = new AbortController();
        const globalSignal = abortControllerRef.current?.signal;
        if (globalSignal) {
          if (globalSignal.aborted) controller.abort();
          else globalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        return controller;
      };

      // ==================================================================
      // LOOP OTIMIZADO v1.0.5 - 2 níveis apenas (tribunal → variante)
      // Sem timeout artificial, sem loop extra de UF
      // ==================================================================
      const ufParaBusca = ufsParaBuscar.length > 0 ? ufsParaBuscar[0] : params.uf;
      
      for (const trib of tribunais) {
        if (cancelarRef.current) break;

        for (const variante of variantesLoop) {
          if (cancelarRef.current) break;

          const reqController = createLinkedController();

          try {
            const resp = await buscarPjeComunicaPaginado(
              {
                tipo: params.tipo,
                oab: params.oab,
                uf: ufParaBusca,
                palavraChave: variante || undefined,
                numeroProcesso: params.numeroProcesso,
                siglaTribunal: trib,
                dataInicio: params.dataInicio,
                dataFim: params.dataFim,
                page: 0,
                pageSize: params.pageSize ?? 10,
              },
              {
                signal: reqController.signal,
                maxPages: 10,
                delayMs: 150,  // Otimizado para 150ms
              }
            );

            for (const item of resp.items) {
              const id = String(item?.id ?? "");
              const key = id || JSON.stringify(item).slice(0, 400);
              if (!seen.has(key)) {
                seen.add(key);
                acumulado.push(item);
              }
            }
          } catch (browserErr: any) {
            if (browserErr?.name === 'AbortError') {
              if (cancelarRef.current) break;
            }
            // Logar erro mas continuar para próximo tribunal
            console.warn(`[DJEN] Erro ${trib ?? 'TODOS'}: ${browserErr?.message}`);
          }

          await delay(CONFIG.delay_between_variants);
        }
        await delay(CONFIG.delay_between_tribunals);
      }

      if (cancelarRef.current) return [];

      return acumulado.map((pub: any) => {
        const rawDataDisp = pub.dataDisponibilizacao || pub.dataDJe || pub.dtDisponibilizacao || null;
        const rawDataPub = pub.dataPublicacao || pub.dataJornal || pub.dtPublicacao || null;
        
        let dataDisponibilizacao = extrairDataYMD(rawDataDisp);
        let dataPublicacao: string | null = null;
        
        if (dataDisponibilizacao) {
          const dispDate = new Date(dataDisponibilizacao + 'T12:00:00');
          dispDate.setDate(dispDate.getDate() + 1);
          const proximoDiaUtil = calcularProximoDiaUtil(dispDate);
          dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
        } else if (rawDataPub) {
          dataPublicacao = extrairDataYMD(rawDataPub);
          if (dataPublicacao) {
            const pubDate = new Date(dataPublicacao + 'T12:00:00');
            pubDate.setDate(pubDate.getDate() - 1);
            dataDisponibilizacao = pubDate.toISOString().split('T')[0];
          }
        }
        
        if (!dataDisponibilizacao && !dataPublicacao) {
          const hoje = new Date();
          dataDisponibilizacao = hoje.toISOString().split('T')[0];
          hoje.setDate(hoje.getDate() + 1);
          const proximoDiaUtil = calcularProximoDiaUtil(hoje);
          dataPublicacao = proximoDiaUtil.toISOString().split('T')[0];
        }
        
        return {
          id: pub.id || crypto.randomUUID(),
          processo_numero: pub.numeroProcesso || pub.processo || null,
          conteudo: pub.conteudo || pub.teor || pub.texto || null,
          data_disponibilizacao: dataDisponibilizacao,
          data_publicacao: dataPublicacao,
          fonte: pub.tribunal || pub.orgao || pub.siglaTribunal || 'DJEN',
          hash_conteudo: '',
        };
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || cancelarRef.current) return [];
      console.warn(`[DJEN] Erro na busca (${monitoramento.termo_busca}):`, err?.message || err);
      return [];
    }
  };

  // Processar um monitoramento individual
  const processarMonitoramento = async (
    mon: MonitoramentoDjen
  ): Promise<{ novas: number; duplicadas: number; descartadas: number }> => {
    const publicacoes = await buscarMonitoramento(mon);
    
    if (publicacoes.length === 0) {
      return { novas: 0, duplicadas: 0, descartadas: 0 };
    }

    const ymdToIso = (ymd?: string | null) => (ymd ? `${ymd}T12:00:00.000Z` : null);

    let publicacoesIgnoradas = 0;
    const descartadasParaPersistir: Array<{ pub: PublicacaoResultado; motivo: string }> = [];

    const pubsFiltradas = publicacoes.filter(pub => {
      if (!pub.conteudo) return true;
      
      // Verificar exclusões
      const conteudoUpper = pub.conteudo.toUpperCase();
      const termoExclusao = mon.exclusoes?.find((t) => conteudoUpper.includes(String(t).toUpperCase()));
      if (termoExclusao) {
        descartadasParaPersistir.push({ pub, motivo: `Termo de exclusão: ${termoExclusao}` });
        return false;
      }
      
      // Validar termo completo presente
      if (!conteudoContemTermo(pub.conteudo, mon.termo_busca, mon.tipo, mon.oab)) {
        publicacoesIgnoradas++;
        descartadasParaPersistir.push({ pub, motivo: 'Termo não encontrado integralmente' });
        return false;
      }
      
      return true;
    });
    
    if (publicacoesIgnoradas > 0) {
      console.log(`[DJEN] "${mon.termo_busca}": ${publicacoesIgnoradas} publicações ignoradas`);
    }

    // Persistir descartadas
    if (descartadasParaPersistir.length > 0) {
      const payloadDescartadas = descartadasParaPersistir
        .filter((d) => !!d.pub.conteudo)
        .map((d) => {
          const dataRef = d.pub.data_disponibilizacao || d.pub.data_publicacao || new Date().toISOString().slice(0, 10);
          const hash = gerarHash(d.pub.conteudo || '', dataRef);
          return {
            monitoramento_id: mon.id,
            hash_conteudo: hash,
            processo_numero: d.pub.processo_numero,
            conteudo: d.pub.conteudo,
            fonte: d.pub.fonte,
            tribunal: d.pub.fonte,
            data_disponibilizacao: ymdToIso(d.pub.data_disponibilizacao),
            data_publicacao: ymdToIso(d.pub.data_publicacao),
            motivo_descarte: d.motivo,
            lida: false,
          };
        });

      if (payloadDescartadas.length > 0) {
        await supabase
          .from('publicacoes_djen_descartadas')
          .upsert(payloadDescartadas, {
            onConflict: 'monitoramento_id,hash_conteudo',
            ignoreDuplicates: true,
          });
      }
    }

    // Calcular hashes
    const pubsComHash = pubsFiltradas.map(pub => ({
      ...pub,
      hash_conteudo: gerarHash(
        pub.conteudo || '',
        pub.data_disponibilizacao || pub.data_publicacao || new Date().toISOString().split('T')[0]
      ),
    }));

    // Deduplicar dentro do lote
    const uniqueMap = new Map<string, typeof pubsComHash[number]>();
    let duplicadasInternas = 0;
    for (const p of pubsComHash) {
      if (uniqueMap.has(p.hash_conteudo)) {
        duplicadasInternas += 1;
        continue;
      }
      uniqueMap.set(p.hash_conteudo, p);
    }
    const pubsUnicas = Array.from(uniqueMap.values());

    // Verificar duplicatas no banco
    const hashes = pubsUnicas.map(p => p.hash_conteudo);
    const existentes = await verificarDuplicatasBatch(hashes, mon.id);

    const novas = pubsUnicas.filter(p => !existentes.has(p.hash_conteudo));
    const duplicadasBanco = pubsUnicas.length - novas.length;
    const duplicadas = duplicadasInternas + duplicadasBanco;

    // Inserir novas publicações
    if (novas.length > 0) {
      const payload = novas.map(pub => ({
        monitoramento_id: mon.id,
        hash_conteudo: pub.hash_conteudo,
        processo_numero: pub.processo_numero,
        conteudo: pub.conteudo,
        data_disponibilizacao: pub.data_disponibilizacao,
        data_publicacao: pub.data_publicacao,
        fonte: pub.fonte,
        lida: false,
      }));

      const { error: upsertError } = await supabase
        .from('publicacoes_djen')
        .upsert(payload, {
          onConflict: 'monitoramento_id,hash_conteudo',
          ignoreDuplicates: true,
        });

      if (upsertError) {
        console.error('Erro ao inserir publicações:', upsertError);
        return { novas: 0, duplicadas, descartadas: descartadasParaPersistir.length };
      }
    }

    return { novas: novas.length, duplicadas, descartadas: descartadasParaPersistir.length };
  };

  // ============================================================================
  // EXECUÇÃO PRINCIPAL - Loop sequencial simples
  // ============================================================================
  const executarMonitoramento = useCallback(async (
    monitoramentosIds?: string[], 
    retomar: boolean = false,
    dataOverride?: string
  ) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    // Carregar checkpoint se retomar = true
    const savedState = retomar ? carregarEstado() : null;
    const checkpoint = savedState?.checkpoint;
    const hoje = new Date().toISOString().split('T')[0];
    
    // Verificar se checkpoint é do mesmo dia
    const checkpointValido = checkpoint && checkpoint.data === hoje && checkpoint.indice > 0;

    const tempoInicio = Date.now();
    setExecutando(true);
    cancelarRef.current = false;
    abortControllerRef.current = new AbortController();
    executionIdRef.current = null;
    dataOverrideRef.current = dataOverride || null;

    // Limpar metadata de execução anterior (ou iniciar retomada)
    try {
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: {
            status: 'executando',
            cancel_requested: false,
            cancelado: false,
            current: checkpointValido ? checkpoint.indice : 0,
            total: 0,
            percentage: 0,
            retomando: checkpointValido,
          } 
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch (e) {
      console.warn('[DJEN] Erro ao limpar metadata:', e);
    }
    
    // Buscar monitoramentos ativos ANTES de inicializar progresso para ter o total
    let query = supabase
      .from('monitoramentos_djen')
      .select('*')
      .eq('ativo', true);

    if (monitoramentosIds?.length) {
      query = query.in('id', monitoramentosIds);
    }

    const { data: monitoramentosRaw, error: monError } = await query;

    if (monError || !monitoramentosRaw?.length) {
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: 'Nenhum monitoramento ativo encontrado',
      }));
      await registrarExecucao('erro', { mensagem: 'Nenhum monitoramento ativo' });
      setExecutando(false);
      return;
    }

    const monitoramentos = monitoramentosRaw as unknown as MonitoramentoDjen[];
    const total = monitoramentos.length;
    
    // Índice inicial (do checkpoint ou 0)
    const indiceInicial = checkpointValido ? Math.min(checkpoint.indice, total - 1) : 0;

    // Inicializar progresso COM o total já conhecido
    setProgresso({
      monitoramentoAtual: checkpointValido ? checkpoint.indice : 0,
      totalMonitoramentos: total,
      publicacoesNovas: checkpointValido ? checkpoint.novasAcumuladas : 0,
      publicacoesDuplicadas: checkpointValido ? checkpoint.duplicadasAcumuladas : 0,
      publicacoesDescartadas: checkpointValido ? checkpoint.descartadasAcumuladas : 0,
      status: 'executando',
      mensagem: checkpointValido 
        ? `Retomando do monitoramento ${indiceInicial + 1}/${total}...`
        : `Processando ${total} monitoramentos...`,
      tempoInicio,
      tempoDecorrido: 0,
      termoAtual: undefined,
      checkpoint: undefined,
    });

    // Registrar execução
    const executionId = await registrarExecucao('executando', { retomada: retomar });

    try {
      // Acumuladores (do checkpoint ou 0)
      let totalNovas = checkpointValido ? checkpoint.novasAcumuladas : 0;
      let totalDuplicadas = checkpointValido ? checkpoint.duplicadasAcumuladas : 0;
      let totalDescartadas = checkpointValido ? checkpoint.descartadasAcumuladas : 0;

      // ================================================================
      // LOOP SEQUENCIAL SIMPLES - Um monitoramento por vez
      // Pula monitoramentos já processados se retomando
      // ================================================================
      // ================================================================
      // LOOP PRINCIPAL OTIMIZADO v1.0.5
      // - Sem verificação de cancelamento no banco (apenas local)
      // - Atualização de metadata a cada 10 itens (não a cada 1)
      // - SEM delay entre monitoramentos
      // ================================================================
      for (let i = indiceInicial; i < total; i++) {
        // Verificar cancelamento APENAS local (rápido!)
        if (cancelarRef.current) break;

        const mon = monitoramentos[i];

        // Atualizar progresso ANTES de processar
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: i + 1,
          termoAtual: mon.termo_busca,
          mensagem: `(${i + 1}/${total}) ${mon.termo_busca}`,
        }));

        // Processar monitoramento
        const result = await processarMonitoramento(mon);
        
        // Acumular estatísticas
        totalNovas += result.novas;
        totalDuplicadas += result.duplicadas;
        totalDescartadas += result.descartadas;

        // Atualizar progresso DEPOIS de processar (com checkpoint para retomada)
        const checkpointAtual = {
          indice: i + 1,
          data: hoje,
          novasAcumuladas: totalNovas,
          duplicadasAcumuladas: totalDuplicadas,
          descartadasAcumuladas: totalDescartadas,
        };
        
        setProgresso(prev => ({
          ...prev,
          publicacoesNovas: totalNovas,
          publicacoesDuplicadas: totalDuplicadas,
          publicacoesDescartadas: totalDescartadas,
          checkpoint: checkpointAtual,
        }));

        // Atualizar metadata no banco apenas a cada 10 itens (reduz overhead)
        if ((i + 1) % 10 === 0 || i === total - 1) {
          const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);
          try {
            await supabase
              .from('configuracoes_monitoramento')
              .update({ 
                metadata: {
                  status: 'executando',
                  total,
                  current: i + 1,
                  percentage: Math.round(((i + 1) / total) * 100),
                  duracao_s,
                  novas: totalNovas,
                  duplicadas: totalDuplicadas,
                  descartadas: totalDescartadas,
                } 
              })
              .eq('tipo', 'djen')
              .is('coordenacao_id', null);
          } catch (e) {
            // Ignorar erro de atualização
          }

          // Atualizar execução no banco
          await registrarExecucao('executando', {
            processados: i + 1,
            total,
            novas: totalNovas,
            duplicadas: totalDuplicadas,
          });
        }

        // SEM delay entre monitoramentos - velocidade máxima!
      }

      // ================================================================
      // FINALIZAÇÃO
      // ================================================================
      const duracao_s = Math.floor((Date.now() - tempoInicio) / 1000);

      if (cancelarRef.current) {
        setProgresso(prev => ({
          ...prev,
          status: 'cancelado',
          mensagem: `Cancelado. ${totalNovas} novas encontradas.`,
          tempoDecorrido: duracao_s,
        }));
        
        await registrarExecucao('cancelado', {
          novas: totalNovas,
          duplicadas: totalDuplicadas,
          descartadas: totalDescartadas,
          duracao_s,
        });

        await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            metadata: {
              status: 'cancelado',
              cancelado: true,
              total,
              current: progresso.monitoramentoAtual,
              percentage: Math.round((progresso.monitoramentoAtual / total) * 100),
              duracao_s,
              novas: totalNovas,
            } 
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);
      } else {
        setProgresso(prev => ({
          ...prev,
          monitoramentoAtual: total,
          status: 'concluido',
          mensagem: `Concluído! ${totalNovas} novas, ${totalDuplicadas} duplicadas, ${totalDescartadas} descartadas`,
          tempoDecorrido: duracao_s,
          termoAtual: undefined,
        }));

        await registrarExecucao('concluido', {
          novas: totalNovas,
          duplicadas: totalDuplicadas,
          descartadas: totalDescartadas,
          duracao_s,
        });

        await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            metadata: {
              status: 'concluido',
              total,
              current: total,
              percentage: 100,
              duracao_s,
              novas: totalNovas,
              duplicadas: totalDuplicadas,
              descartadas: totalDescartadas,
              last_run: new Date().toISOString(),
            } 
          })
          .eq('tipo', 'djen')
          .is('coordenacao_id', null);

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
        queryClient.invalidateQueries({ queryKey: ['djen-stats'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes-counts'] });

        if (totalNovas > 0) {
          toast.success(`DJEN: ${totalNovas} novas publicações encontradas!`);
        }
      }
    } catch (error: any) {
      console.error('[DJEN] Erro na execução:', error);
      
      setProgresso(prev => ({
        ...prev,
        status: 'erro',
        mensagem: `Erro: ${error?.message || 'Falha na execução'}`,
      }));

      await registrarExecucao('erro', {
        mensagem: error?.message || 'Erro desconhecido',
      });

      toast.error('Erro ao executar monitoramento DJEN');
    } finally {
      setExecutando(false);
      abortControllerRef.current = null;
      dataOverrideRef.current = null;
    }
  }, [user?.id, queryClient]);

  // Função para cancelar
  const cancelar = useCallback(async () => {
    cancelarRef.current = true;
    abortControllerRef.current?.abort();
    
    // Sinalizar cancelamento no banco
    try {
      await supabase
        .from('configuracoes_monitoramento')
        .update({ 
          metadata: {
            cancel_requested: true,
          } 
        })
        .eq('tipo', 'djen')
        .is('coordenacao_id', null);
    } catch (e) {
      console.warn('[DJEN] Erro ao sinalizar cancelamento:', e);
    }
    
    setProgresso(prev => ({
      ...prev,
      mensagem: 'Cancelando...',
    }));
  }, []);

  // Função para limpar estado
  const limparEstado = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProgresso(defaultProgresso());
  }, []);

  return {
    executarMonitoramento,
    cancelar,
    limparEstado,
    progresso,
    isExecutando: executando,
  };
}
