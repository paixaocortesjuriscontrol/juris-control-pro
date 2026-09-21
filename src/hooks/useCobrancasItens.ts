import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getItemRawId } from "@/hooks/useItensComAtividades";

export type EscopoCobranca = "minhas" | "equipe";

export const COBRANCAS_QUERY_KEY = "itens-com-cobrancas";

const ESCOPO_STORAGE_KEY = "painel-cobranca-escopo";

export function getEscopoCobrancaPreferido(): EscopoCobranca {
  try {
    return (localStorage.getItem(ESCOPO_STORAGE_KEY) as EscopoCobranca) || "minhas";
  } catch {
    return "minhas";
  }
}

export function setEscopoCobrancaPreferido(escopo: EscopoCobranca) {
  try {
    localStorage.setItem(ESCOPO_STORAGE_KEY, escopo);
  } catch {
    /* ignora */
  }
}

export type InfoCobranca = {
  /** ISO da cobrança mais recente. */
  ultima: string;
  /** Símbolo da cobrança mais recente. */
  simbolo: string;
  /** Cobrada hoje (fuso do navegador, que no escritório é BRT). */
  hoje: boolean;
  /** Quantidade de cobranças registradas. */
  total: number;
  /** Nomes de quem cobrou (para a dica de tela). */
  autores: string[];
  /** Existe cobrança MINHA de hoje (usada pelo botão de liga/desliga). */
  minhaHoje: boolean;
};

/** Identificador base do item, igual ao usado nos comentários. */
export function chaveCobrancaItem(item: { id: string } | null | undefined): string {
  const id = String(item?.id ?? "");
  return getItemRawId(id);
}

function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hojeLocal(): string {
  return diaLocal(new Date().toISOString());
}

/**
 * Cobranças ("já entrei nesse caso e cobrei") dos itens exibidos.
 * Retorna um Map indexado pelo id base do item.
 */
export function useCobrancasItens(
  items: { id: string }[] | undefined,
  escopo: EscopoCobranca = "minhas",
) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const ids = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach((i) => {
      if (!i?.id) return;
      const raw = chaveCobrancaItem(i);
      if (raw) set.add(raw);
    });
    return Array.from(set);
  }, [items]);

  return useQuery({
    queryKey: [COBRANCAS_QUERY_KEY, ids, escopo, userId],
    // No escopo "minhas" só consultamos depois de saber quem é o usuário,
    // senão viriam as cobranças de todos.
    enabled: ids.length > 0 && (escopo === "equipe" || !!userId),
    staleTime: 20 * 1000,
    queryFn: async () => {
      const result = new Map<string, InfoCobranca>();
      if (escopo === "minhas" && !userId) return result;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));

      const linhas: any[] = [];
      await Promise.all(
        chunks.map(async (chunk) => {
          let q = (supabase as any)
            .from("item_cobrancas")
            .select("item_id, usuario_id, simbolo, created_at")
            .in("item_id", chunk);
          if (escopo === "minhas" && userId) q = q.eq("usuario_id", userId);
          const { data, error } = await q;
          if (error) throw error;
          linhas.push(...(data || []));
        }),
      );

      // Nomes de quem cobrou (somente no escopo de equipe).
      const nomes = new Map<string, string>();
      if (escopo === "equipe") {
        const autorIds = [...new Set(linhas.map((l) => l.usuario_id).filter(Boolean))];
        if (autorIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from("profiles_basic")
            .select("id, nome")
            .in("id", autorIds);
          (profiles || []).forEach((p: any) => nomes.set(p.id, p.nome));
        }
      }

      const hoje = hojeLocal();
      linhas.forEach((l) => {
        if (!l.item_id || !l.created_at) return;
        const iso = new Date(l.created_at).toISOString();
        const ehHoje = diaLocal(iso) === hoje;
        const atual = result.get(l.item_id);
        const autor = nomes.get(l.usuario_id) || null;
        if (!atual) {
          result.set(l.item_id, {
            ultima: iso,
            simbolo: l.simbolo || "C",
            hoje: ehHoje,
            total: 1,
            autores: autor ? [autor] : [],
            minhaHoje: ehHoje && !!userId && l.usuario_id === userId,
          });
          return;
        }
        atual.total += 1;
        if (ehHoje) atual.hoje = true;
        if (ehHoje && !!userId && l.usuario_id === userId) atual.minhaHoje = true;
        if (autor && !atual.autores.includes(autor)) atual.autores.push(autor);
        if (iso > atual.ultima) {
          atual.ultima = iso;
          atual.simbolo = l.simbolo || atual.simbolo;
        }
      });

      return result;
    },
  });
}

export function infoCobrancaItem(
  mapa: Map<string, InfoCobranca> | undefined,
  item: { id: string } | null | undefined,
): InfoCobranca | null {
  if (!mapa || !item?.id) return null;
  return mapa.get(chaveCobrancaItem(item)) ?? null;
}

/** Dica de tela com data/hora (BRT) e autores da cobrança. */
export function tituloCobranca(info: InfoCobranca): string {
  const data = new Date(info.ultima).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const quem = info.autores.length > 0 ? ` por ${info.autores.join(", ")}` : "";
  const extra = info.total > 1 ? ` (${info.total} cobranças)` : "";
  return `Cobrado em ${data}${quem}${extra}`;
}

/** Registra/remove a cobrança do dia de um item. */
export function useRegistrarCobranca() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: [COBRANCAS_QUERY_KEY], refetchType: "all" });
  };

  const registrar = useMutation({
    mutationFn: async ({
      itemId,
      tipoItem,
      simbolo,
      comentarioId,
    }: {
      itemId: string;
      tipoItem: string;
      simbolo: string;
      comentarioId?: string | null;
    }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await (supabase as any).from("item_cobrancas").insert({
        tipo_item: tipoItem,
        item_id: getItemRawId(itemId),
        usuario_id: user.id,
        simbolo: simbolo || "C",
        comentario_id: comentarioId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const desfazerHoje = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const { error } = await (supabase as any)
        .from("item_cobrancas")
        .delete()
        .eq("item_id", getItemRawId(itemId))
        .eq("usuario_id", user.id)
        .gte("created_at", inicio.toISOString());
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return { registrar, desfazerHoje };
}

/** Tipo do item para gravar na cobrança. */
export function tipoItemCobranca(item: any): string {
  const id = String(item?.id ?? "");
  if (id.startsWith("audiencia-det-")) return "audiencia";
  if (item?.origem === "evento") return "evento";
  return item?.tipo === "prazo" ? "prazo" : "tarefa";
}
