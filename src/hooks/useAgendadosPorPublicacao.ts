import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ItemAgendado {
  id: string;
  origem: "tarefa" | "audiencia";
  tipo: string;
  titulo: string;
  data?: string | null;
  status?: string | null;
}

interface PubRef {
  id: string;
  dedup_key?: string | null;
  id_djen?: string | null;
  hash_conteudo?: string | null;
  processo_numero?: string | null;
  data_publicacao?: string | null;
}

/**
 * Retorna, por publicação (id de publicacoes_djen_processos), todos os itens
 * (prazos/tarefas/audiências) que foram agendados a partir dela.
 */
export function useAgendadosPorPublicacao(pubs: PubRef[]) {
  const pubIds = pubs.map((p) => p.id).sort();
  const dedupKeys = pubs.map((p) => p.dedup_key).filter(Boolean) as string[];
  const idsDjen = pubs.map((p) => p.id_djen).filter(Boolean) as string[];
  const hashes = pubs.map((p) => p.hash_conteudo).filter(Boolean) as string[];
  const processosDigits = Array.from(
    new Set(pubs.map((p) => (p.processo_numero || "").replace(/\D/g, "")).filter(Boolean)),
  );

  return useQuery({
    queryKey: ["agendados-por-publicacao", pubIds, hashes.length, processosDigits],
    enabled: pubIds.length > 0,
    queryFn: async () => {
      const mapa = new Map<string, ItemAgendado[]>();
      const add = (pubId: string, item: ItemAgendado) => {
        const arr = mapa.get(pubId) ?? [];
        if (!arr.some((i) => i.id === item.id && i.origem === item.origem)) arr.push(item);
        mapa.set(pubId, arr);
      };

      // 1) Publicações "globais" equivalentes (publicacoes_djen) por dedup_key / id_djen /
      //    hash_conteudo, com fallback por número do processo + data de publicação.
      const djenToPub = new Map<string, string[]>();
      const dataDia = (v?: string | null) => (v ? String(v).slice(0, 10) : "");
      if (dedupKeys.length > 0 || idsDjen.length > 0 || hashes.length > 0 || processosDigits.length > 0) {
        const filtros: string[] = [];
        if (dedupKeys.length) filtros.push(`dedup_key.in.(${dedupKeys.map((k) => `"${k}"`).join(",")})`);
        if (idsDjen.length) filtros.push(`id_djen.in.(${idsDjen.map((k) => `"${k}"`).join(",")})`);
        if (hashes.length) filtros.push(`hash_conteudo.in.(${hashes.map((k) => `"${k}"`).join(",")})`);
        if (processosDigits.length)
          filtros.push(`dedup_processo_digits.in.(${processosDigits.map((k) => `"${k}"`).join(",")})`);
        const { data: globais } = await (supabase as any)
          .from("publicacoes_djen")
          .select("id, dedup_key, id_djen, hash_conteudo, dedup_processo_digits, processo_numero, data_publicacao")
          .or(filtros.join(","));
        for (const g of globais ?? []) {
          const gDigits = g.dedup_processo_digits || (g.processo_numero || "").replace(/\D/g, "");
          const relacionadas = pubs
            .filter((p) => {
              if (p.dedup_key && p.dedup_key === g.dedup_key) return true;
              if (p.id_djen && p.id_djen === g.id_djen) return true;
              if (p.hash_conteudo && p.hash_conteudo === g.hash_conteudo) return true;
              const pDigits = (p.processo_numero || "").replace(/\D/g, "");
              if (
                pDigits &&
                gDigits &&
                pDigits === gDigits &&
                dataDia(p.data_publicacao) &&
                dataDia(p.data_publicacao) === dataDia(g.data_publicacao)
              )
                return true;
              return false;
            })
            .map((p) => p.id);
          if (relacionadas.length) djenToPub.set(g.id, relacionadas);
        }
      }
      const djenIds = [...djenToPub.keys()];

      // 1b) Publicações descartadas equivalentes (audiências podem estar vinculadas a elas)
      const descartadaToPub = new Map<string, string[]>();
      if (dedupKeys.length > 0 || idsDjen.length > 0 || processosDigits.length > 0) {
        const filtros: string[] = [];
        if (dedupKeys.length) filtros.push(`dedup_key.in.(${dedupKeys.map((k) => `"${k}"`).join(",")})`);
        if (idsDjen.length) filtros.push(`id_djen.in.(${idsDjen.map((k) => `"${k}"`).join(",")})`);
        if (processosDigits.length)
          filtros.push(`dedup_processo_digits.in.(${processosDigits.map((k) => `"${k}"`).join(",")})`);
        const { data: descartadas } = await (supabase as any)
          .from("publicacoes_djen_descartadas")
          .select("id, dedup_key, id_djen, dedup_processo_digits, processo_numero, data_publicacao")
          .or(filtros.join(","));
        for (const g of descartadas ?? []) {
          const gDigits = g.dedup_processo_digits || (g.processo_numero || "").replace(/\D/g, "");
          const relacionadas = pubs
            .filter((p) => {
              if (p.dedup_key && p.dedup_key === g.dedup_key) return true;
              if (p.id_djen && p.id_djen === g.id_djen) return true;
              const pDigits = (p.processo_numero || "").replace(/\D/g, "");
              return !!(
                pDigits &&
                gDigits &&
                pDigits === gDigits &&
                dataDia(p.data_publicacao) &&
                dataDia(p.data_publicacao) === dataDia(g.data_publicacao)
              );
            })
            .map((p) => p.id);
          if (relacionadas.length) descartadaToPub.set(g.id, relacionadas);
        }
      }
      const descartadaIds = [...descartadaToPub.keys()];

      // 2) Vínculos tarefa <-> publicação
      const tarefaToPubs = new Map<string, Set<string>>();
      const linkTarefa = (tarefaId: string, pubIdsAlvo: string[]) => {
        const s = tarefaToPubs.get(tarefaId) ?? new Set<string>();
        pubIdsAlvo.forEach((p) => s.add(p));
        tarefaToPubs.set(tarefaId, s);
      };

      const [{ data: tpp }, { data: tp }] = await Promise.all([
        (supabase as any)
          .from("tarefas_publicacoes_processos")
          .select("tarefa_id, publicacao_processo_id")
          .in("publicacao_processo_id", pubIds),
        djenIds.length
          ? (supabase as any).from("tarefas_publicacoes").select("tarefa_id, publicacao_id").in("publicacao_id", djenIds)
          : Promise.resolve({ data: [] }),
      ]);
      for (const r of tpp ?? []) linkTarefa(r.tarefa_id, [r.publicacao_processo_id]);
      for (const r of tp ?? []) linkTarefa(r.tarefa_id, djenToPub.get(r.publicacao_id) ?? []);

      // 3) Vínculos audiência <-> publicação
      const audToPubs = new Map<string, Set<string>>();
      const linkAud = (audId: string, alvo: string[]) => {
        const s = audToPubs.get(audId) ?? new Set<string>();
        alvo.forEach((p) => s.add(p));
        audToPubs.set(audId, s);
      };
      const [{ data: app }, { data: ap }, { data: ad }] = await Promise.all([
        (supabase as any)
          .from("audiencias_publicacoes_processos")
          .select("audiencia_id, publicacao_processo_id")
          .in("publicacao_processo_id", pubIds),
        djenIds.length
          ? (supabase as any)
              .from("audiencias_publicacoes")
              .select("audiencia_id, publicacao_id")
              .in("publicacao_id", djenIds)
          : Promise.resolve({ data: [] }),
        descartadaIds.length
          ? (supabase as any)
              .from("audiencias_publicacoes_descartadas")
              .select("audiencia_id, publicacao_descartada_id")
              .in("publicacao_descartada_id", descartadaIds)
          : Promise.resolve({ data: [] }),
      ]);
      for (const r of app ?? []) linkAud(r.audiencia_id, [r.publicacao_processo_id]);
      for (const r of ap ?? []) linkAud(r.audiencia_id, djenToPub.get(r.publicacao_id) ?? []);
      for (const r of ad ?? []) linkAud(r.audiencia_id, descartadaToPub.get(r.publicacao_descartada_id) ?? []);

      // 3b) Audiências que guardam a publicação diretamente (audiencias_detectadas.publicacao_id)
      if (djenIds.length) {
        const { data: audDiretas } = await (supabase as any)
          .from("audiencias_detectadas")
          .select("id, publicacao_id")
          .in("publicacao_id", djenIds);
        for (const r of audDiretas ?? []) linkAud(r.id, djenToPub.get(r.publicacao_id) ?? []);
      }

      // 4) Buscar dados dos itens
      const tarefaIds = [...tarefaToPubs.keys()];
      if (tarefaIds.length) {
        const { data: tarefas } = await supabase
          .from("tarefas")
          .select("id, titulo, tipo, status, data_fatal, data_vencimento")
          .in("id", tarefaIds);
        for (const t of (tarefas ?? []) as any[]) {
          const alvo = tarefaToPubs.get(t.id);
          alvo?.forEach((pubId) =>
            add(pubId, {
              id: t.id,
              origem: "tarefa",
              tipo: t.tipo || "tarefa",
              titulo: t.titulo || "(sem título)",
              data: t.data_vencimento || t.data_fatal,
              status: t.status,
            })
          );
        }
      }

      const audIds = [...audToPubs.keys()];
      if (audIds.length) {
        const { data: auds } = await supabase
          .from("audiencias_detectadas")
          .select("id, processo_numero, cliente, tipo_audiencia, data_audiencia, hora_brasilia, status")
          .in("id", audIds);
        for (const a of (auds ?? []) as any[]) {
          const alvo = audToPubs.get(a.id);
          alvo?.forEach((pubId) =>
            add(pubId, {
              id: a.id,
              origem: "audiencia",
              tipo: "audiencia",
              titulo: `Audiência ${a.tipo_audiencia ?? ""} ${a.cliente ?? a.processo_numero ?? ""}`.trim(),
              data: a.data_audiencia,
              status: a.status,
            })
          );
        }
      }

      return Object.fromEntries(mapa) as Record<string, ItemAgendado[]>;
    },
  });
}
