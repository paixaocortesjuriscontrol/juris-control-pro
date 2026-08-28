import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { statusCasaSituacao } from "@/hooks/useSituacoesPainel";

/** Tipos de item que a ação em lote reconhece (mesma classificação do Painel). */
export type LoteTipo = "tarefa" | "prazo" | "audiencia" | "evento" | "parcelamento";

export type LoteFonte = "tarefa" | "evento" | "audiencia";

export interface LoteAtividade {
  id: string;
  titulo: string;
  responsavel_id: string | null;
}

export interface LoteItem {
  key: string;
  fonte: LoteFonte;
  id: string;
  tipo: LoteTipo;
  titulo: string;
  data: string | null;
  status: string | null;
  processo_id: string | null;
  processo_numero: string | null;
  coordenacao_id: string | null;
  responsaveis: string[];
  envolvidos: string[];
  atividades: LoteAtividade[];
}

export interface PessoasEmLoteFiltros {
  inicio: string; // yyyy-MM-dd
  fim: string; // yyyy-MM-dd
  tipos: LoteTipo[]; // vazio = todos
  coordenacaoIds: string[]; // vazio = todas as permitidas
  responsavelIds: string[]; // vazio = qualquer responsável atual
  situacoes: string[]; // valores pipe-joined das opções de situação
  busca: string;
}

export const LOTE_TIPOS: { value: LoteTipo; label: string }[] = [
  { value: "tarefa", label: "Tarefas" },
  { value: "prazo", label: "Prazos" },
  { value: "audiencia", label: "Audiências" },
  { value: "evento", label: "Eventos" },
  { value: "parcelamento", label: "Parcelamentos" },
];

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

function classificarTarefa(row: any): LoteTipo {
  const tipoUpper = String(row.tipo_tarefa ?? "").toUpperCase().trim();
  const tipo = String(row.tipo ?? "").toLowerCase().trim();
  if (tipoUpper.includes("AUDI") || tipo === "audiencia") return "audiencia";
  if (tipo === "prazo" || tipo === "prazo_parcela" || tipoUpper.includes("PRAZO")) return "prazo";
  return "tarefa";
}

async function mapaVinculos(
  tabela: string,
  colunaItem: string,
  colunaUsuario: string,
  ids: string[],
): Promise<Record<string, string[]>> {
  const mapa: Record<string, string[]> = {};
  if (ids.length === 0) return mapa;
  await Promise.all(
    chunk(ids, 200).map(async (parte) => {
      const { data, error } = await (supabase as any)
        .from(tabela)
        .select(`${colunaItem}, ${colunaUsuario}`)
        .in(colunaItem, parte);
      if (error) throw error;
      (data || []).forEach((row: any) => {
        const itemId = row[colunaItem];
        const userId = row[colunaUsuario];
        if (!itemId || !userId) return;
        (mapa[itemId] ||= []).push(userId);
      });
    }),
  );
  return mapa;
}

/**
 * Busca os itens do período (tarefas, prazos, audiências, eventos e
 * parcelamentos) com seus responsáveis, envolvidos e atividades vinculadas,
 * para a ação "Pessoas em lote" do Painel de Controle.
 */
export function usePessoasEmLoteItens(
  filtros: PessoasEmLoteFiltros,
  coordenacoesPermitidas: string[],
  isAdmin: boolean,
  enabled: boolean,
) {
  const chaveFiltros = JSON.stringify({ filtros, coordenacoesPermitidas, isAdmin });

  return useQuery({
    queryKey: ["pessoas-em-lote-itens", chaveFiltros],
    enabled: enabled && !!filtros.inicio && !!filtros.fim,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<LoteItem[]> => {
      const { inicio, fim, tipos } = filtros;
      const inicioTs = `${inicio}T00:00:00`;
      const fimTs = `${fim}T23:59:59`;

      // Escopo de coordenação: seleção explícita ou, para não-admin, as suas.
      const escopo = filtros.coordenacaoIds.length
        ? filtros.coordenacaoIds
        : isAdmin
          ? null
          : coordenacoesPermitidas;

      if (escopo && escopo.length === 0) return [];

      const querTipo = (t: LoteTipo) => tipos.length === 0 || tipos.includes(t);
      const querTarefas = querTipo("tarefa") || querTipo("prazo") || querTipo("audiencia");
      const querEventos = querTipo("evento") || querTipo("parcelamento");
      const querAudiencias = querTipo("audiencia");

      const [tarefasRes, eventosRes, audienciasRes] = await Promise.all([
        (async () => {
          if (!querTarefas) return [] as any[];
          let q = (supabase as any)
            .from("tarefas")
            .select(
              "id, titulo, tipo, tipo_tarefa, status, data_vencimento, processo_id, coordenacao_id, responsavel_id",
            )
            .gte("data_vencimento", inicio)
            .lte("data_vencimento", fim)
            .order("data_vencimento", { ascending: true })
            .limit(5000);
          if (escopo) q = q.in("coordenacao_id", escopo);
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        })(),
        (async () => {
          if (!querEventos) return [] as any[];
          let q = (supabase as any)
            .from("eventos_agenda")
            .select("id, titulo, tipo, status, data_inicio, processo_id, coordenacao_id")
            .gte("data_inicio", inicioTs)
            .lte("data_inicio", fimTs)
            .order("data_inicio", { ascending: true })
            .limit(5000);
          if (escopo) q = q.in("coordenacao_id", escopo);
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        })(),
        (async () => {
          if (!querAudiencias) return [] as any[];
          let q = (supabase as any)
            .from("audiencias_detectadas")
            .select(
              "id, titulo, tipo_audiencia, status, data_audiencia, processo_id, processo_numero, coordenacao_id",
            )
            .gte("data_audiencia", inicio)
            .lte("data_audiencia", fim)
            .order("data_audiencia", { ascending: true })
            .limit(5000);
          if (escopo) q = q.in("coordenacao_id", escopo);
          const { data, error } = await q;
          if (error) throw error;
          return data || [];
        })(),
      ]);

      const tarefaIds = tarefasRes.map((t: any) => t.id);
      const eventoIds = eventosRes.map((e: any) => e.id);
      const audienciaIds = audienciasRes.map((a: any) => a.id);

      const [
        tarefaResp,
        tarefaEnv,
        eventoResp,
        eventoEnv,
        audAdv,
        audEnv,
      ] = await Promise.all([
        mapaVinculos("tarefa_responsaveis", "tarefa_id", "usuario_id", tarefaIds),
        mapaVinculos("tarefa_envolvidos", "tarefa_id", "usuario_id", tarefaIds),
        mapaVinculos("evento_responsaveis", "evento_id", "usuario_id", eventoIds),
        mapaVinculos("evento_envolvidos", "evento_id", "usuario_id", eventoIds),
        mapaVinculos("audiencias_advogados", "audiencia_id", "advogado_id", audienciaIds),
        mapaVinculos("audiencia_envolvidos", "audiencia_id", "usuario_id", audienciaIds),
      ]);

      // Atividades (subatividades) de todos os itens carregados
      const todosIds = [...tarefaIds, ...eventoIds, ...audienciaIds];
      const atividadesPorItem: Record<string, LoteAtividade[]> = {};
      await Promise.all(
        chunk(todosIds, 150).map(async (parte) => {
          if (parte.length === 0) return;
          const { data, error } = await (supabase as any)
            .from("subatividades_item")
            .select("id, titulo, responsavel_id, item_id")
            .in("item_id", parte);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            (atividadesPorItem[row.item_id] ||= []).push({
              id: row.id,
              titulo: row.titulo,
              responsavel_id: row.responsavel_id ?? null,
            });
          });
        }),
      );

      // Números de processo
      const processoIds = Array.from(
        new Set(
          [...tarefasRes, ...eventosRes]
            .map((r: any) => r.processo_id)
            .filter(Boolean) as string[],
        ),
      );
      const numerosProcesso: Record<string, string> = {};
      await Promise.all(
        chunk(processoIds, 200).map(async (parte) => {
          const { data } = await (supabase as any)
            .from("processos")
            .select("id, numero")
            .in("id", parte);
          (data || []).forEach((p: any) => {
            if (p.id) numerosProcesso[p.id] = p.numero;
          });
        }),
      );

      const itens: LoteItem[] = [];

      tarefasRes.forEach((row: any) => {
        const tipo = classificarTarefa(row);
        if (!querTipo(tipo)) return;
        itens.push({
          key: `tarefa:${row.id}`,
          fonte: "tarefa",
          id: row.id,
          tipo,
          titulo: row.titulo || "(sem título)",
          data: row.data_vencimento ?? null,
          status: row.status ?? null,
          processo_id: row.processo_id ?? null,
          processo_numero: row.processo_id ? numerosProcesso[row.processo_id] ?? null : null,
          coordenacao_id: row.coordenacao_id ?? null,
          responsaveis: Array.from(
            new Set([...(tarefaResp[row.id] || []), ...(row.responsavel_id ? [row.responsavel_id] : [])]),
          ),
          envolvidos: Array.from(new Set(tarefaEnv[row.id] || [])),
          atividades: atividadesPorItem[row.id] || [],
        });
      });

      eventosRes.forEach((row: any) => {
        const tipo: LoteTipo =
          String(row.tipo ?? "").toLowerCase() === "parcelamento" ? "parcelamento" : "evento";
        if (!querTipo(tipo)) return;
        itens.push({
          key: `evento:${row.id}`,
          fonte: "evento",
          id: row.id,
          tipo,
          titulo: row.titulo || "(sem título)",
          data: row.data_inicio ?? null,
          status: row.status ?? null,
          processo_id: row.processo_id ?? null,
          processo_numero: row.processo_id ? numerosProcesso[row.processo_id] ?? null : null,
          coordenacao_id: row.coordenacao_id ?? null,
          responsaveis: Array.from(new Set(eventoResp[row.id] || [])),
          envolvidos: Array.from(new Set(eventoEnv[row.id] || [])),
          atividades: atividadesPorItem[row.id] || [],
        });
      });

      audienciasRes.forEach((row: any) => {
        itens.push({
          key: `audiencia:${row.id}`,
          fonte: "audiencia",
          id: row.id,
          tipo: "audiencia",
          titulo: row.titulo || row.tipo_audiencia || "Audiência",
          data: row.data_audiencia ?? null,
          status: row.status ?? null,
          processo_id: row.processo_id ?? null,
          processo_numero: row.processo_numero ?? null,
          coordenacao_id: row.coordenacao_id ?? null,
          responsaveis: Array.from(new Set(audAdv[row.id] || [])),
          envolvidos: Array.from(new Set(audEnv[row.id] || [])),
          atividades: atividadesPorItem[row.id] || [],
        });
      });

      // Filtros locais: responsável atual, situação e busca por título
      const busca = filtros.busca.trim().toLowerCase();
      const filtrados = itens.filter((item) => {
        if (filtros.responsavelIds.length > 0) {
          const pessoas = new Set([...item.responsaveis, ...item.envolvidos]);
          if (!filtros.responsavelIds.some((id) => pessoas.has(id))) return false;
        }
        if (filtros.situacoes.length > 0) {
          if (!filtros.situacoes.some((v) => statusCasaSituacao(item.status, v))) return false;
        }
        if (busca) {
          const alvo = `${item.titulo} ${item.processo_numero ?? ""}`.toLowerCase();
          if (!alvo.includes(busca)) return false;
        }
        return true;
      });

      return filtrados.sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")));
    },
  });
}

export interface AplicarPessoasParams {
  itens: LoteItem[];
  atividadesIds: string[];
  responsaveis: string[];
  envolvidos: string[];
  usuarioAtualId?: string | null;
  onProgress?: (feitos: number, total: number) => void;
}

export interface AplicarPessoasResultado {
  itensAlterados: number;
  atividadesAlteradas: number;
  erros: string[];
}

const CONFLITOS: Record<LoteFonte, { resp: [string, string, string]; env: [string, string, string] }> = {
  tarefa: {
    resp: ["tarefa_responsaveis", "tarefa_id", "usuario_id"],
    env: ["tarefa_envolvidos", "tarefa_id", "usuario_id"],
  },
  evento: {
    resp: ["evento_responsaveis", "evento_id", "usuario_id"],
    env: ["evento_envolvidos", "evento_id", "usuario_id"],
  },
  audiencia: {
    resp: ["audiencias_advogados", "audiencia_id", "advogado_id"],
    env: ["audiencia_envolvidos", "audiencia_id", "usuario_id"],
  },
};

/**
 * Aplica os acréscimos. Operação SOMENTE ADITIVA: nenhum vínculo existente é
 * removido. Duplicados são ignorados pelas constraints únicas das tabelas.
 */
export async function aplicarPessoasEmLote({
  itens,
  atividadesIds,
  responsaveis,
  envolvidos,
  usuarioAtualId,
  onProgress,
}: AplicarPessoasParams): Promise<AplicarPessoasResultado> {
  const erros: string[] = [];
  const auditoria: any[] = [];
  let itensAlterados = 0;
  let atividadesAlteradas = 0;

  const atividadesSelecionadas = new Set(atividadesIds);
  const total = itens.length;
  let feitos = 0;

  // Itens cujas atividades exigem acréscimo de envolvidos no item pai
  const paisPorAtividade = new Map<string, LoteItem>();
  itens.forEach((item) => {
    item.atividades.forEach((at) => {
      if (atividadesSelecionadas.has(at.id)) paisPorAtividade.set(at.id, item);
    });
  });

  for (const lote of chunk(itens, 20)) {
    await Promise.all(
      lote.map(async (item) => {
        try {
          const cfg = CONFLITOS[item.fonte];

          const novosResp = responsaveis.filter((id) => !item.responsaveis.includes(id));
          const novosEnv = envolvidos.filter((id) => !item.envolvidos.includes(id));

          if (novosResp.length > 0) {
            const [tabela, colItem, colUser] = cfg.resp;
            const { error } = await (supabase as any).from(tabela).upsert(
              novosResp.map((usuarioId) => ({ [colItem]: item.id, [colUser]: usuarioId })),
              { onConflict: `${colItem},${colUser}`, ignoreDuplicates: true },
            );
            if (error) throw error;
          }

          if (novosEnv.length > 0) {
            const [tabela, colItem, colUser] = cfg.env;
            const { error } = await (supabase as any).from(tabela).upsert(
              novosEnv.map((usuarioId) => ({ [colItem]: item.id, [colUser]: usuarioId })),
              { onConflict: `${colItem},${colUser}`, ignoreDuplicates: true },
            );
            if (error) throw error;
          }

          // Tarefas/prazos guardam também um responsável principal: preenche
          // apenas quando está vazio (nunca substitui).
          if (item.fonte === "tarefa" && responsaveis.length > 0 && item.responsaveis.length === 0) {
            await (supabase as any)
              .from("tarefas")
              .update({ responsavel_id: responsaveis[0], updated_at: new Date().toISOString() })
              .eq("id", item.id)
              .is("responsavel_id", null);
          }

          if (novosResp.length > 0 || novosEnv.length > 0) {
            itensAlterados += 1;
            auditoria.push({
              usuario_id: usuarioAtualId ?? null,
              acao: "atualizar",
              sucesso: true,
              origem: "pessoas-em-lote",
              tipo_item: item.tipo,
              tarefa_id: item.fonte === "tarefa" ? item.id : null,
              processo_id: item.processo_id,
              coordenacao_id: item.coordenacao_id,
              campos_alterados: {
                responsaveis_adicionados: novosResp,
                envolvidos_adicionados: novosEnv,
              },
              dados_entrada: { item_id: item.id, fonte: item.fonte, titulo: item.titulo },
            });
          }
        } catch (e: any) {
          erros.push(`${item.titulo}: ${e?.message || "erro desconhecido"}`);
        } finally {
          feitos += 1;
          onProgress?.(feitos, total);
        }
      }),
    );
  }

  // Atividades: preenche responsável só quando vazio; se já houver responsável,
  // ele é preservado e as pessoas entram como envolvidos do item pai.
  const primeiraPessoa = responsaveis[0] ?? envolvidos[0] ?? null;
  const pessoasParaPai = Array.from(new Set([...responsaveis, ...envolvidos]));

  for (const [atividadeId, pai] of paisPorAtividade.entries()) {
    const atividade = pai.atividades.find((a) => a.id === atividadeId);
    if (!atividade) continue;
    try {
      if (!atividade.responsavel_id && primeiraPessoa) {
        const { error } = await (supabase as any)
          .from("subatividades_item")
          .update({ responsavel_id: primeiraPessoa, updated_at: new Date().toISOString() })
          .eq("id", atividadeId)
          .is("responsavel_id", null);
        if (error) throw error;
        atividadesAlteradas += 1;
      } else if (pessoasParaPai.length > 0) {
        const [tabela, colItem, colUser] = CONFLITOS[pai.fonte].env;
        const faltantes = pessoasParaPai.filter((id) => !pai.envolvidos.includes(id));
        if (faltantes.length > 0) {
          const { error } = await (supabase as any).from(tabela).upsert(
            faltantes.map((usuarioId) => ({ [colItem]: pai.id, [colUser]: usuarioId })),
            { onConflict: `${colItem},${colUser}`, ignoreDuplicates: true },
          );
          if (error) throw error;
        }
        atividadesAlteradas += 1;
      }
    } catch (e: any) {
      erros.push(`Atividade "${atividade.titulo}": ${e?.message || "erro desconhecido"}`);
    }
  }

  // Auditoria (best-effort: falha aqui não invalida a operação)
  for (const parte of chunk(auditoria, 100)) {
    try {
      await (supabase as any).from("auditoria_tarefas").insert(parte);
    } catch (e) {
      console.warn("Falha ao registrar auditoria de pessoas em lote", e);
    }
  }

  return { itensAlterados, atividadesAlteradas, erros };
}

/** Rótulo curto para o tipo do item. */
export function labelTipoLote(tipo: LoteTipo): string {
  return LOTE_TIPOS.find((t) => t.value === tipo)?.label.replace(/s$/, "") ?? tipo;
}

/** Helper de memo para lista de chaves selecionadas. */
export function useTotalSelecionado(itens: LoteItem[], selecionados: Set<string>) {
  return useMemo(() => itens.filter((i) => selecionados.has(i.key)).length, [itens, selecionados]);
}
