import { supabase } from "@/integrations/supabase/client";

/** Etiqueta mantida pelo gatilho de Acompanhamento Especial; a importação nunca a aplica. */
export const ETIQUETA_GERENCIADA = "CAPTURA";

export const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

export const normNome = (s: string | null | undefined) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** "BANCO SANTANDER (BRASIL) S/A (Requerido)" -> "BANCO SANTANDER (BRASIL) S/A" */
export const nomeClienteSemPapel = (s: string | null | undefined): string | null => {
  const t = String(s ?? "").trim();
  if (!t) return null;
  return t.replace(/\s*\([^()]*\)\s*$/, "").trim() || null;
};

export const separarEtiquetas = (s: string | null | undefined): string[] =>
  Array.from(new Set(String(s ?? "").split(/[;,\n]/).map(e => e.trim()).filter(Boolean)));

export interface LinhaCompleta {
  numero: string;
  etiquetas: string[];
  responsavel: string | null;
  cliente: string | null;
  linhaOriginal: number;
  dados: Record<string, any>; // colunas de processos já mapeadas
}

/** Junta linhas repetidas pelo número (só dígitos): soma etiquetas e preenche campos vazios. */
export const juntarRepetidos = (linhas: LinhaCompleta[]): { unicos: LinhaCompleta[]; repetidas: number } => {
  const mapa = new Map<string, LinhaCompleta>();
  for (const l of linhas) {
    const k = soDigitos(l.numero);
    const atual = mapa.get(k);
    if (!atual) { mapa.set(k, { ...l, etiquetas: [...l.etiquetas], dados: { ...l.dados } }); continue; }
    atual.etiquetas = Array.from(new Set([...atual.etiquetas, ...l.etiquetas]));
    atual.responsavel ??= l.responsavel;
    atual.cliente ??= l.cliente;
    for (const [c, v] of Object.entries(l.dados)) {
      if ((atual.dados[c] === null || atual.dados[c] === undefined || atual.dados[c] === "") && v != null && v !== "") atual.dados[c] = v;
    }
  }
  return { unicos: Array.from(mapa.values()), repetidas: linhas.length - mapa.size };
};

export interface ResultadoLinha { numero: string; linhaOriginal: number; status: "importado" | "ja_existia" | "erro"; mensagem?: string }

const LOTE = 500;
const dividir = <T,>(arr: T[], n: number) => { const r: T[][] = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };

export async function importarPlanilhaCompleta(opts: {
  linhas: LinhaCompleta[];
  coordenacaoId: string;
  membroPadraoId?: string | null;
  clientePadraoId?: string | null;
  userId?: string | null;
  onProgress?: (pct: number, texto: string) => void;
  cancelado?: () => boolean;
}) {
  const { coordenacaoId, onProgress } = opts;
  const { unicos, repetidas } = juntarRepetidos(opts.linhas);
  const resultados: ResultadoLinha[] = [];
  const avisos: string[] = [];

  // 1) Processos que já existem nesta coordenação (não são alterados)
  onProgress?.(2, "Conferindo processos já cadastrados na coordenação");
  const existentes = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("processos").select("numero").eq("coordenacao_id", coordenacaoId).range(from, from + 999);
    if (error) throw error;
    (data ?? []).forEach((p: any) => existentes.add(soDigitos(p.numero)));
    if (!data || data.length < 1000) break;
  }

  // 2) Responsáveis pelo nome (membros/perfis)
  const nomesResp = Array.from(new Set(unicos.map(u => u.responsavel).filter(Boolean) as string[]));
  const respMap = new Map<string, string>();
  for (const nome of nomesResp) {
    const { data } = await supabase.from("profiles").select("id, nome").ilike("nome", nome.trim());
    if (data?.length === 1) respMap.set(normNome(nome), data[0].id);
    else avisos.push(data?.length ? `Responsável "${nome}" tem mais de um cadastro; não vinculado.` : `Responsável "${nome}" não encontrado; não vinculado.`);
  }

  // 3) Clientes pelo nome
  const nomesCli = Array.from(new Set(unicos.map(u => u.cliente).filter(Boolean) as string[]));
  const cliMap = new Map<string, string>();
  for (const nome of nomesCli) {
    const { data } = await supabase.from("clientes").select("id, nome").ilike("nome", nome.replace(/[%_]/g, "\\$&"));
    if (data?.length) cliMap.set(normNome(nome), data[0].id);
    else avisos.push(`Cliente "${nome}" não cadastrado; processos ficam sem cliente.`);
  }

  // 4) Etiquetas da coordenação
  const nomesEtq = Array.from(new Set(unicos.flatMap(u => u.etiquetas)));
  const etqMap = new Map<string, string>();
  const { data: etqs } = await supabase.from("etiquetas").select("id, nome").eq("coordenacao_id", coordenacaoId);
  (etqs ?? []).forEach((e: any) => etqMap.set(normNome(e.nome), e.id));
  for (const nome of nomesEtq) {
    if (normNome(nome) === ETIQUETA_GERENCIADA) continue;
    if (etqMap.has(normNome(nome))) continue;
    const { data, error } = await supabase.from("etiquetas")
      .insert({ coordenacao_id: coordenacaoId, nome, modulos: ["processos", "itens", "publicacoes"], ativo: true, created_by: opts.userId ?? null } as any)
      .select("id").single();
    if (error) avisos.push(`Etiqueta "${nome}" não criada: ${error.message}`);
    else etqMap.set(normNome(nome), data.id);
  }
  if (nomesEtq.some(n => normNome(n) === ETIQUETA_GERENCIADA)) {
    avisos.push("Etiqueta CAPTURA não aplicada: ela é colocada automaticamente pelo Acompanhamento Especial.");
  }

  // 5) Inserção em lotes
  const novos = unicos.filter(u => {
    if (existentes.has(soDigitos(u.numero))) {
      resultados.push({ numero: u.numero, linhaOriginal: u.linhaOriginal, status: "ja_existia", mensagem: "Já existia na coordenação; não alterado" });
      return false;
    }
    return true;
  });
  const lotes = dividir(novos, LOTE);
  let feitos = 0;
  for (const lote of lotes) {
    if (opts.cancelado?.()) { avisos.push(`Cancelado após ${feitos} processos.`); break; }
    const rows = lote.map(u => ({
      ...u.dados,
      numero: u.numero.trim(),
      coordenacao_id: coordenacaoId,
      advogado_responsavel_id: (u.responsavel && respMap.get(normNome(u.responsavel))) || opts.membroPadraoId || null,
      cliente_id: (u.cliente && cliMap.get(normNome(u.cliente))) || opts.clientePadraoId || null,
    }));
    let inseridos: { id: string; numero: string }[] = [];
    const { data, error } = await supabase.from("processos").insert(rows as any).select("id, numero");
    if (error) {
      // fallback individual para identificar a linha com problema
      for (let i = 0; i < rows.length; i++) {
        const r = await supabase.from("processos").insert(rows[i] as any).select("id, numero").single();
        if (r.error) resultados.push({ numero: lote[i].numero, linhaOriginal: lote[i].linhaOriginal, status: "erro", mensagem: r.error.message });
        else inseridos.push(r.data as any);
      }
    } else inseridos = (data ?? []) as any;

    const idPorNum = new Map(inseridos.map(p => [soDigitos(p.numero), p.id]));
    const vinculos: any[] = [];
    for (const u of lote) {
      const id = idPorNum.get(soDigitos(u.numero));
      if (!id) continue;
      resultados.push({ numero: u.numero, linhaOriginal: u.linhaOriginal, status: "importado" });
      for (const e of u.etiquetas) {
        const eid = etqMap.get(normNome(e));
        if (eid) vinculos.push({ etiqueta_id: eid, entidade: "processo", entidade_id: id, created_by: opts.userId ?? null });
      }
    }
    for (const v of dividir(vinculos, 1000)) {
      const { error: ev } = await supabase.from("etiquetas_itens").insert(v);
      if (ev) avisos.push(`Falha ao aplicar etiquetas em um lote: ${ev.message}`);
    }
    feitos += lote.length;
    onProgress?.(5 + (feitos / Math.max(novos.length, 1)) * 95, `${feitos} de ${novos.length} processos`);
  }

  return { resultados, avisos, repetidas, totalUnicos: unicos.length };
}
