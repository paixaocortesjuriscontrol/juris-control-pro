import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Última mudança de situação de um item de agenda (tarefa, prazo, evento,
 * audiência ou parcelamento) e o último comentário registrado nele.
 * A fonte da mudança é a auditoria de itens (`auditoria_tarefas`), que guarda
 * o campo alterado, o valor anterior, o novo valor, quem alterou e quando.
 */
export interface HistoricoSituacaoItem {
  situacaoDe?: string | null;
  situacaoPara?: string | null;
  quando?: string | null;
  autorNome?: string | null;
  comentario?: {
    conteudo: string;
    autorNome?: string | null;
    quando?: string | null;
  } | null;
}

const CAMPOS_SITUACAO = new Set(["status", "situacao", "situação"]);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useHistoricoSituacaoItens(idsBrutos: (string | null | undefined)[]) {
  const ids = Array.from(new Set((idsBrutos || []).filter(Boolean).map(String))).sort();

  return useQuery({
    queryKey: ["historico-situacao-itens", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, HistoricoSituacaoItem>> => {
      const mapa: Record<string, HistoricoSituacaoItem> = {};
      const usuarios = new Set<string>();

      // 1) Última alteração de situação por item
      for (const lote of chunk(ids, 100)) {
        const { data, error } = await supabase
          .from("auditoria_tarefas")
          .select("tarefa_id, created_at, usuario_id, campos_alterados")
          .in("tarefa_id", lote)
          .order("created_at", { ascending: false })
          .limit(2000);
        if (error) throw error;
        for (const row of (data as any[]) || []) {
          const id = String(row.tarefa_id);
          if (mapa[id]?.quando) continue; // já temos a mais recente
          const campos = Array.isArray(row.campos_alterados) ? row.campos_alterados : [];
          const alt = campos.find((c: any) =>
            CAMPOS_SITUACAO.has(String(c?.campo || "").toLowerCase()),
          );
          if (!alt) continue;
          mapa[id] = {
            ...(mapa[id] || {}),
            situacaoDe: alt.de ?? null,
            situacaoPara: alt.para ?? null,
            quando: row.created_at,
          };
          if (row.usuario_id) usuarios.add(String(row.usuario_id));
          (mapa[id] as any)._usuarioId = row.usuario_id ?? null;
        }
      }

      // 2) Último comentário por item (tarefas/prazos, eventos e audiências)
      for (const lote of chunk(ids, 100)) {
        const [ct, ce, ca] = await Promise.all([
          supabase
            .from("comentarios_tarefas")
            .select("tarefa_id, conteudo, autor_id, created_at")
            .in("tarefa_id", lote)
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase
            .from("comentarios_eventos")
            .select("evento_id, conteudo, autor_id, created_at")
            .in("evento_id", lote)
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase
            .from("comentarios_audiencias")
            .select("audiencia_id, conteudo, autor_id, created_at")
            .in("audiencia_id", lote)
            .order("created_at", { ascending: false })
            .limit(1000),
        ]);
        const linhas = [
          ...(((ct.data as any[]) || []).map((r) => ({ id: r.tarefa_id, ...r }))),
          ...(((ce.data as any[]) || []).map((r) => ({ id: r.evento_id, ...r }))),
          ...(((ca.data as any[]) || []).map((r) => ({ id: r.audiencia_id, ...r }))),
        ];
        for (const l of linhas) {
          const id = String(l.id);
          if (!l.conteudo) continue;
          if (mapa[id]?.comentario) continue;
          mapa[id] = { ...(mapa[id] || {}), comentario: { conteudo: l.conteudo, quando: l.created_at } };
          if (l.autor_id) usuarios.add(String(l.autor_id));
          (mapa[id] as any)._comentarioAutorId = l.autor_id ?? null;
        }
      }

      // 3) Nomes das pessoas
      if (usuarios.size > 0) {
        const nomes: Record<string, string> = {};
        for (const lote of chunk([...usuarios], 200)) {
          const { data } = await supabase.from("profiles").select("id, nome").in("id", lote);
          ((data as any[]) || []).forEach((p) => {
            nomes[String(p.id)] = p.nome;
          });
        }
        Object.values(mapa).forEach((entry: any) => {
          if (entry._usuarioId) entry.autorNome = nomes[String(entry._usuarioId)] ?? null;
          if (entry.comentario && entry._comentarioAutorId) {
            entry.comentario.autorNome = nomes[String(entry._comentarioAutorId)] ?? null;
          }
        });
      }

      return mapa;
    },
  });
}
