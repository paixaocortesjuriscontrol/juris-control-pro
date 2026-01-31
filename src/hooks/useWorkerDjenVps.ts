/**
 * Hook para worker VPS de busca DJEN
 * 100% independente do useBuscaDjenDireta.ts
 * Cada VPS processa uma coordenação específica usando seu próprio IP
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buscarPjeComunicaPaginado, type PjeComunicaSearchParams } from "@/utils/pjeComunicaClient";
import { toast } from "sonner";

interface MonitoramentoDjen {
  id: string;
  tipo: string;
  termo_busca: string;
  oab?: string;
  uf?: string;
  tribunais?: string[];
  exclusoes?: string[];
  ativo: boolean;
}

interface WorkerProgress {
  monitoramentoAtual: number;
  totalMonitoramentos: number;
  publicacoesNovas: number;
  publicacoesDuplicadas: number;
  status: 'idle' | 'executando' | 'concluido' | 'erro' | 'pausado';
  mensagem: string;
  tempoInicio?: number;
  tempoDecorrido: number;
}

interface UseWorkerDjenVpsOptions {
  coordenacaoId: string;
  autoStart?: boolean;
}

// Gera hash para deduplicação
function generateContentHash(conteudo: string, data: string): string {
  const str = (conteudo || '').slice(0, 500) + (data || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Gera variantes de busca para melhor cobertura
function gerarVariantesBusca(termo: string): string[] {
  const variantes = new Set<string>();
  variantes.add(termo);
  
  const semAcento = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (semAcento.toLowerCase() !== termo.toLowerCase()) {
    variantes.add(semAcento);
  }
  
  return Array.from(variantes);
}

// Validar termo completo no conteúdo
function conteudoContemTermo(conteudo: string, termo: string, tipo: string): boolean {
  if (!conteudo || !termo) return false;
  if (tipo === 'advogado') return true;
  
  const normalizar = (t: string) => t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  
  const conteudoNorm = normalizar(conteudo);
  const termoNorm = normalizar(termo);
  
  if (conteudoNorm.includes(termoNorm)) return true;
  
  const palavrasTermo = termoNorm.split(/\s+/).filter(p => p.length >= 2);
  if (palavrasTermo.length === 0) return true;
  
  const minPalavras = Math.ceil(palavrasTermo.length * 0.8);
  const palavrasEncontradas = palavrasTermo.filter(p => conteudoNorm.includes(p));
  
  return palavrasEncontradas.length >= minPalavras;
}

// Verificar exclusões
function deveExcluirPorTermo(conteudo: string, exclusoes: string[]): boolean {
  if (!exclusoes || exclusoes.length === 0) return false;
  const conteudoUpper = (conteudo || '').toUpperCase();
  return exclusoes.some(exc => conteudoUpper.includes(exc.toUpperCase()));
}

export function useWorkerDjenVps({ coordenacaoId, autoStart = false }: UseWorkerDjenVpsOptions) {
  const [progress, setProgress] = useState<WorkerProgress>({
    monitoramentoAtual: 0,
    totalMonitoramentos: 0,
    publicacoesNovas: 0,
    publicacoesDuplicadas: 0,
    status: 'idle',
    mensagem: '',
    tempoDecorrido: 0,
  });
  
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Detectar IP público
  const detectarIp = useCallback(async () => {
    try {
      const resp = await fetch('https://api.ipify.org?format=json');
      const data = await resp.json();
      setIpAddress(data.ip);
      return data.ip;
    } catch {
      return null;
    }
  }, []);

  // Registrar/atualizar worker no banco
  const registrarWorker = useCallback(async (ip: string | null) => {
    try {
      // Verificar se já existe worker para esta coordenação/sessão
      const { data: existing } = await supabase
        .from('workers_djen_vps')
        .select('id')
        .eq('coordenacao_id', coordenacaoId)
        .eq('sessao_id', sessionIdRef.current)
        .maybeSingle();

      if (existing) {
        setWorkerId(existing.id);
        return existing.id;
      }

      // Criar novo worker
      const { data, error } = await supabase
        .from('workers_djen_vps')
        .insert({
          coordenacao_id: coordenacaoId,
          ip_address: ip,
          status: 'online',
          sessao_id: sessionIdRef.current,
          ultimo_heartbeat: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      setWorkerId(data.id);
      return data.id;
    } catch (err) {
      console.error('[VPS Worker] Erro ao registrar:', err);
      return null;
    }
  }, [coordenacaoId]);

  // Atualizar heartbeat e progresso
  const atualizarHeartbeat = useCallback(async (p: Partial<WorkerProgress>) => {
    if (!workerId) return;
    
    try {
      await supabase
        .from('workers_djen_vps')
        .update({
          ultimo_heartbeat: new Date().toISOString(),
          status: p.status || progress.status,
          progresso: p,
          publicacoes_encontradas: p.publicacoesNovas ?? progress.publicacoesNovas,
          publicacoes_novas: p.publicacoesNovas ?? progress.publicacoesNovas,
          ultimo_erro: p.status === 'erro' ? p.mensagem : null,
        })
        .eq('id', workerId);
    } catch (err) {
      console.error('[VPS Worker] Erro no heartbeat:', err);
    }
  }, [workerId, progress]);

  // Iniciar heartbeat periódico
  const iniciarHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    
    heartbeatRef.current = setInterval(() => {
      atualizarHeartbeat(progress);
    }, 30000); // 30 segundos
  }, [atualizarHeartbeat, progress]);

  // Parar heartbeat
  const pararHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Processar uma publicação
  const processarPublicacao = useCallback(async (
    pub: any,
    monitoramento: MonitoramentoDjen
  ): Promise<{ nova: boolean; duplicada: boolean }> => {
    const conteudo = pub.texto || pub.teor || '';
    const dataDisp = pub.dataDisponibilizacao || pub.dataPublicacao || '';
    const hashConteudo = generateContentHash(conteudo, dataDisp);
    
    // Verificar duplicata
    const { data: existing } = await supabase
      .from('publicacoes_djen')
      .select('id')
      .eq('hash_conteudo', hashConteudo)
      .eq('monitoramento_id', monitoramento.id)
      .maybeSingle();
    
    if (existing) {
      return { nova: false, duplicada: true };
    }
    
    // Inserir nova publicação
    const { error } = await supabase
      .from('publicacoes_djen')
      .insert({
        monitoramento_id: monitoramento.id,
        hash_conteudo: hashConteudo,
        conteudo: conteudo.slice(0, 50000),
        processo_numero: pub.numeroProcesso || null,
        data_publicacao: pub.dataPublicacao || null,
        data_disponibilizacao: pub.dataDisponibilizacao || null,
        tribunal: pub.siglaTribunal || null,
        lida: false,
      });
    
    if (error && !error.message?.includes('duplicate')) {
      console.warn('[VPS Worker] Erro ao inserir:', error);
      return { nova: false, duplicada: false };
    }
    
    return { nova: !error, duplicada: !!error };
  }, []);

  // Executar busca para um monitoramento
  const executarMonitoramento = useCallback(async (
    mon: MonitoramentoDjen,
    signal: AbortSignal
  ): Promise<{ novas: number; duplicadas: number }> => {
    let novas = 0;
    let duplicadas = 0;
    
    const variantes = gerarVariantesBusca(mon.termo_busca);
    const tribunais = mon.tribunais && mon.tribunais.length > 0 ? mon.tribunais : [undefined];
    
    for (const tribunal of tribunais) {
      if (signal.aborted) break;
      
      for (const variante of variantes) {
        if (signal.aborted) break;
        
        try {
          const params: PjeComunicaSearchParams = {
            tipo: mon.tipo === 'advogado' ? 'advogado' : 'palavra-chave',
            palavraChave: mon.tipo !== 'advogado' ? variante : undefined,
            oab: mon.tipo === 'advogado' ? mon.oab : undefined,
            uf: mon.tipo === 'advogado' ? mon.uf : undefined,
            siglaTribunal: tribunal,
          };

          const resp = await buscarPjeComunicaPaginado(params, {
            signal,
            maxPages: 10,
            delayMs: 250,
          });

          for (const item of resp.items) {
            if (signal.aborted) break;
            
            const conteudo = item.texto || item.teor || '';
            
            // Validar termo completo
            if (!conteudoContemTermo(conteudo, mon.termo_busca, mon.tipo)) {
              continue;
            }
            
            // Verificar exclusões
            if (deveExcluirPorTermo(conteudo, mon.exclusoes || [])) {
              continue;
            }
            
            const result = await processarPublicacao(item, mon);
            if (result.nova) novas++;
            if (result.duplicada) duplicadas++;
          }
        } catch (e: any) {
          if (e.name === 'AbortError') break;
          console.warn(`[VPS Worker] Erro na variante "${variante}":`, e);
        }
        
        // Delay entre variantes
        await new Promise(r => setTimeout(r, 150));
      }
      
      // Delay entre tribunais
      await new Promise(r => setTimeout(r, 200));
    }
    
    return { novas, duplicadas };
  }, [processarPublicacao]);

  // Executar busca completa
  const executar = useCallback(async () => {
    if (progress.status === 'executando') {
      toast.warning('Já existe uma execução em andamento');
      return;
    }
    
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    
    const ip = await detectarIp();
    await registrarWorker(ip);
    iniciarHeartbeat();
    
    const tempoInicio = Date.now();
    
    setProgress(p => ({
      ...p,
      status: 'executando',
      tempoInicio,
      mensagem: 'Carregando monitoramentos...',
    }));
    
    try {
      // Buscar monitoramentos desta coordenação
      const { data: monitoramentos, error } = await supabase
        .from('monitoramentos_djen')
        .select('*')
        .eq('coordenacao_id', coordenacaoId)
        .eq('ativo', true);
      
      if (error) throw error;
      if (!monitoramentos || monitoramentos.length === 0) {
        setProgress(p => ({
          ...p,
          status: 'concluido',
          mensagem: 'Nenhum monitoramento ativo encontrado',
        }));
        return;
      }
      
      const total = monitoramentos.length;
      let novasTotal = 0;
      let duplicadasTotal = 0;
      
      setProgress(p => ({
        ...p,
        totalMonitoramentos: total,
        mensagem: `Iniciando busca de ${total} monitoramentos...`,
      }));
      
      for (let i = 0; i < monitoramentos.length; i++) {
        if (signal.aborted) break;
        
        const mon = monitoramentos[i] as unknown as MonitoramentoDjen;
        
        setProgress(p => ({
          ...p,
          monitoramentoAtual: i + 1,
          mensagem: `Processando: ${mon.termo_busca}`,
          tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000),
        }));
        
        const result = await executarMonitoramento(mon, signal);
        novasTotal += result.novas;
        duplicadasTotal += result.duplicadas;
        
        setProgress(p => ({
          ...p,
          publicacoesNovas: novasTotal,
          publicacoesDuplicadas: duplicadasTotal,
          tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000),
        }));
        
        // Delay entre monitoramentos
        await new Promise(r => setTimeout(r, 1500));
      }
      
      const finalStatus = signal.aborted ? 'pausado' : 'concluido';
      const finalProgress = {
        status: finalStatus as WorkerProgress['status'],
        mensagem: signal.aborted 
          ? 'Execução pausada pelo usuário'
          : `Concluído: ${novasTotal} novas, ${duplicadasTotal} duplicadas`,
        tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000),
        publicacoesNovas: novasTotal,
        publicacoesDuplicadas: duplicadasTotal,
      };
      
      setProgress(p => ({ ...p, ...finalProgress }));
      await atualizarHeartbeat(finalProgress);
      
      if (!signal.aborted) {
        toast.success(`VPS Worker: ${novasTotal} publicações novas encontradas`);
      }
      
    } catch (err: any) {
      console.error('[VPS Worker] Erro:', err);
      const errorProgress = {
        status: 'erro' as const,
        mensagem: err.message || 'Erro desconhecido',
        tempoDecorrido: Math.floor((Date.now() - tempoInicio) / 1000),
      };
      setProgress(p => ({ ...p, ...errorProgress }));
      await atualizarHeartbeat(errorProgress);
      toast.error(`Erro no VPS Worker: ${err.message}`);
    } finally {
      pararHeartbeat();
    }
  }, [
    coordenacaoId,
    progress.status,
    detectarIp,
    registrarWorker,
    iniciarHeartbeat,
    pararHeartbeat,
    executarMonitoramento,
    atualizarHeartbeat,
  ]);

  // Cancelar execução
  const cancelar = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    pararHeartbeat();
    
    setProgress(p => ({
      ...p,
      status: 'pausado',
      mensagem: 'Execução cancelada',
    }));
    
    if (workerId) {
      await supabase
        .from('workers_djen_vps')
        .update({ status: 'pausado' })
        .eq('id', workerId);
    }
  }, [workerId, pararHeartbeat]);

  // Auto-start se configurado
  useEffect(() => {
    if (autoStart && coordenacaoId) {
      executar();
    }
    
    return () => {
      pararHeartbeat();
    };
  }, [autoStart, coordenacaoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marcar worker offline ao sair
  useEffect(() => {
    return () => {
      if (workerId) {
        supabase
          .from('workers_djen_vps')
          .update({ status: 'offline' })
          .eq('id', workerId)
          .then(() => {});
      }
    };
  }, [workerId]);

  return {
    progress,
    workerId,
    ipAddress,
    executar,
    cancelar,
    isRunning: progress.status === 'executando',
  };
}
