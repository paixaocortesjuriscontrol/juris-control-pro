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
  const multi = t.match(/^(.+?)\s*\((?:requerid|requerent|terceir|exequent|executad|autor|r[eé]u|reclamad|reclamant|apelant|apelad|interessad|embargant|embargad|agravant|agravad)[^()]*\)\s*,/i);
  if (multi) return multi[1].trim();
  return t.replace(/\s*\([^()]*\)\s*$/, "").trim() || null;
};

export const separarEtiquetas = (s: string | null | undefined): string[] =>
  Array.from(new Set(String(s ?? "").split(/[;,\n]/).map(e => e.trim()).filter(Boolean)));

/** CAPTURA na planilha liga o acompanhamento; o gatilho do banco mantém a etiqueta. */
export const temEtiquetaCaptura = (etiquetas: string[]): boolean =>
  etiquetas.some(e => normNome(e) === ETIQUETA_GERENCIADA);

/** CAPTURA é mantida pelo gatilho; tentar inseri-la manualmente gera duplicidade. */
export const etiquetasParaVincular = (etiquetas: string[]): string[] =>
  etiquetas.filter(e => normNome(e) !== ETIQUETA_GERENCIADA);

export const tipoClientePorNome = (nome: string): "pessoa_fisica" | "pessoa_juridica" =>
  /\b(S\s*(?:\/|\.)\s*A\.?|LTDA|EIRELI|BANCO|SOCIEDADE|INSTITUI[CÇ][ÃA]O|CORRETORA|TECNOLOGIA|COM[ÉE]RCIO|ENTRETENIMENTO|MARKETING|TRANSPORTES|COMPANHIA)/i.test(nome)
    ? "pessoa_juridica" : "pessoa_fisica";

export interface ResultadoCliente {
  nome: string;
  processos: number;
  tipo: "pessoa_fisica" | "pessoa_juridica";
  status: "cadastrado" | "ja_existia" | "erro";
  mensagem?: string;
}

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

export interface ResultadoLinha { numero: string; linhaOriginal: number; status: "importado" | "ja_existia" | "vinculado_outra" | "erro"; mensagem?: string; coordenacaoOutra?: string; camposPreenchidos?: string[] }

const vazio = (v: any) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Só os campos que estão vazios no cadastro atual e têm valor na planilha. */
export const camposParaPreencher = (atual: Record<string, any>, novos: Record<string, any>): Record<string, any> => {
  const r: Record<string, any> = {};
  for (const [c, v] of Object.entries(novos)) if (!vazio(v) && vazio(atual[c])) r[c] = v;
  return r;
};

/** Traduz mensagens técnicas do banco para português simples. */
export const traduzirErro = (e: { code?: string; message?: string } | null | undefined): string => {
  const m = e?.message ?? "";
  if (e?.code === "23505" || /duplicate key/i.test(m)) return "Número já cadastrado no sistema.";
  if (e?.code === "42501" || /row-level security|permission/i.test(m)) return "Sem permissão para gravar este processo.";
  if (/invalid input syntax|22P02/i.test(m)) return "Algum campo da planilha tem formato inválido.";
  if (/timeout|fetch/i.test(m)) return "Falha de conexão durante a gravação; tente importar novamente.";
  return m ? `Não foi possível gravar: ${m}` : "Erro desconhecido.";
};

/** Vínculos que faltam: só pares (processo, etiqueta) ainda não gravados. */
export const vinculosFaltantes = (
  processoId: string, etiquetaIds: string[], jaTem: Set<string>,
): string[] => Array.from(new Set(etiquetaIds)).filter(e => !jaTem.has(`${processoId}|${e}`));

const ROTULOS: Record<string, string> = { cliente_id: "Cliente", advogado_responsavel_id: "Responsável", polo_ativo: "Polo ativo", polo_passivo: "Polo passivo", comarca: "Comarca", uf: "UF", tribunal: "Tribunal", vara: "Órgão julgador", valor_causa: "Valor da causa", pasta_cliente: "Pasta do cliente", sistema: "Sistema", justica: "Justiça", instancia: "Instância", assunto: "Assunto", descricao: "Descrição", titulo: "Título", area: "Área", tipo_processo: "Tipo de processo", processos_relacionados: "Processos relacionados", responsaveis_projuris: "Responsável (planilha)", situacao_original: "Situação", acompanhamento_especial: "Acompanhamento especial" };
export const rotuloCampo = (c: string) => ROTULOS[c] ?? c.replace(/_/g, " ");

const ceder = () => new Promise(r => setTimeout(r, 0));

const LOTE = 500;
const dividir = <T,>(arr: T[], n: number) => { const r: T[][] = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };

export async function importarPlanilhaCompleta(opts: {
  linhas: LinhaCompleta[];
  coordenacaoId: string;
  membroPadraoId?: string | null;
  clientePadraoId?: string | null;
  userId?: string | null;
  onProgress?: (pct: number, texto: string, stats?: { novos: number; corrigidos: number; erros: number }) => void;
  cancelado?: () => boolean;
}) {
  const { coordenacaoId, onProgress } = opts;
  const { unicos, repetidas } = juntarRepetidos(opts.linhas);
  const resultados: ResultadoLinha[] = [];
  const avisos: string[] = [];

  // 1) Processos desta coordenação: reimportar não duplica e só preenche dados vazios.
  onProgress?.(2, "Conferindo processos já cadastrados na coordenação");
  const existentes = new Map<string, { id: string; acomp: boolean; clienteId: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("processos").select("id, numero, acompanhamento_especial, cliente_id").eq("coordenacao_id", coordenacaoId).order("id").range(from, from + 999);
    if (error) throw error;
    (data ?? []).forEach((p: any) => existentes.set(soDigitos(p.numero), { id: p.id, acomp: !!p.acompanhamento_especial, clienteId: p.cliente_id ?? null }));
    if (!data || data.length < 1000) break;
  }

  if (opts.cancelado?.()) return { resultados, falhasEtiqueta: [], clientesNaoEncontrados: [], clientesDetalhes: [], clientesCriados: 0, avisos: ["Cancelado antes de gravar."], repetidas, totalUnicos: unicos.length, corrigidos: 0, etiquetasAcrescentadas: 0, errosEtiqueta: 0, cancelado: true };
  onProgress?.(3, "Conferindo responsáveis, clientes e etiquetas");
  // 2) Responsáveis pelo nome (membros/perfis)
  const nomesResp = Array.from(new Set(unicos.map(u => u.responsavel).filter(Boolean) as string[]));
  const respMap = new Map<string, string>();
  for (const nome of nomesResp) {
    const { data } = await supabase.from("profiles").select("id, nome").ilike("nome", nome.trim());
    if (data?.length === 1) respMap.set(normNome(nome), data[0].id);
    else avisos.push(data?.length ? `Responsável "${nome}" tem mais de um cadastro; não vinculado.` : `Responsável "${nome}" não encontrado; não vinculado.`);
  }

  // 3) Clientes: reutiliza o cadastro ou cria, sempre vinculando à coordenação escolhida.
  const nomesCli = Array.from(new Set(unicos.map(u => u.cliente).filter(Boolean) as string[]));
  const cliMap = new Map<string, string>();
  const clientesNaoEncontrados = new Map<string, number>();
  const clientesDetalhes: ResultadoCliente[] = [];
  let clientesCriados = 0;
  for (const nome of nomesCli) {
    if (opts.cancelado?.()) break;
    const processos = unicos.filter(u => u.cliente === nome).length;
    const tipo = tipoClientePorNome(nome);
    let clienteId: string | null = null;
    let status: ResultadoCliente["status"] = "ja_existia";
    const { data, error: erroBusca } = await supabase.from("clientes").select("id, nome").ilike("nome", nome.replace(/[%_]/g, "\\$&"));
    if (erroBusca) {
      clientesNaoEncontrados.set(nome, processos);
      clientesDetalhes.push({ nome, processos, tipo, status: "erro", mensagem: traduzirErro(erroBusca) });
      continue;
    }
    if (data?.length) {
      clienteId = data[0].id;
      if (data.length > 1) avisos.push(`Cliente "${nome}" tem mais de um cadastro; o primeiro foi usado.`);
    } else {
      const { data: criado, error: erroCriacao } = await supabase.from("clientes")
        .insert({ nome, tipo, created_by: opts.userId ?? null } as any).select("id").single();
      if (erroCriacao || !criado) {
        clientesNaoEncontrados.set(nome, processos);
        clientesDetalhes.push({ nome, processos, tipo, status: "erro", mensagem: traduzirErro(erroCriacao) });
        continue;
      }
      clienteId = criado.id;
      status = "cadastrado";
      clientesCriados++;
    }
    cliMap.set(normNome(nome), clienteId);
    const { error: erroVinculo } = await supabase.from("clientes_coordenacoes")
      .upsert({ cliente_id: clienteId, coordenacao_id: coordenacaoId, created_by: opts.userId ?? null } as any,
        { onConflict: "cliente_id,coordenacao_id", ignoreDuplicates: true });
    if (erroVinculo) {
      clientesNaoEncontrados.set(nome, processos);
      clientesDetalhes.push({ nome, processos, tipo, status: "erro", mensagem: `${status === "cadastrado" ? "Cliente cadastrado" : "Cliente já existia"}, mas não foi possível vincular à coordenação: ${traduzirErro(erroVinculo)}` });
    } else {
      clientesDetalhes.push({ nome, processos, tipo, status, mensagem: status === "cadastrado" ? "Cadastrado e vinculado à coordenação" : "Já existia; coordenação vinculada" });
    }
  }
  if (opts.cancelado?.()) return { resultados, falhasEtiqueta: [], clientesNaoEncontrados: Array.from(clientesNaoEncontrados.entries()).map(([nome, processos]) => ({ nome, processos })), clientesDetalhes, clientesCriados, avisos: [...avisos, "Cancelado durante o cadastro dos clientes."], repetidas, totalUnicos: unicos.length, corrigidos: 0, etiquetasAcrescentadas: 0, errosEtiqueta: 0, cancelado: true };

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
    avisos.push("CAPTURA ativou o Acompanhamento Especial; a etiqueta será mantida automaticamente pelo sistema.");
  }

  // Grava vínculos em lotes pequenos; se um lote falhar, tenta um a um.
  let errosEtiqueta = 0;
  const falhasEtiqueta: { numero: string; etiqueta: string; motivo: string }[] = [];
  const nomeEtqPorId = () => new Map(Array.from(etqMap.entries()).map(([n, id]) => [id, n]));
  const numPorId = new Map<string, string>();
  const gravarVinculos = async (vinculos: any[], numero?: string) => {
    for (const v of dividir(vinculos, 300)) {
      const { error } = await supabase.from("etiquetas_itens").insert(v);
      if (!error) continue;
      for (const item of v) {
        if (opts.cancelado?.()) return;
        const r = await supabase.from("etiquetas_itens").insert(item);
        if (r.error) { errosEtiqueta++; falhasEtiqueta.push({ numero: numero ?? numPorId.get(item.entidade_id) ?? item.entidade_id, etiqueta: nomeEtqPorId().get(item.etiqueta_id) ?? item.etiqueta_id, motivo: traduzirErro(r.error) }); }
      }
    }
  };
  const idsEtq = (u: LinhaCompleta) => etiquetasParaVincular(u.etiquetas).map(e => etqMap.get(normNome(e))).filter(Boolean) as string[];

  // 5) Já existentes: não duplica; completa etiquetas e liga acompanhamento
  const jaExist = unicos.filter(u => existentes.has(soDigitos(u.numero)));
  let corrigidos = 0, etiquetasAcrescentadas = 0;
  let feitosEx = 0;
  for (const lote of dividir(jaExist, 200)) {
    if (opts.cancelado?.()) { avisos.push(`Cancelado durante a correção dos existentes (${feitosEx} de ${jaExist.length}).`); break; }
    const ids = lote.map(u => existentes.get(soDigitos(u.numero))!.id);
    const jaTem = new Set<string>();
    const { data: vs } = await supabase.from("etiquetas_itens").select("entidade_id, etiqueta_id").eq("entidade", "processo").in("entidade_id", ids);
    (vs ?? []).forEach((v: any) => jaTem.add(`${v.entidade_id}|${v.etiqueta_id}`));
    const vinculos: any[] = [];
    const ligar: string[] = [];
    const clientesParaPreencher = new Map<string, string[]>();
    for (const u of lote) {
      const ex = existentes.get(soDigitos(u.numero))!;
      numPorId.set(ex.id, u.numero);
      const falt = vinculosFaltantes(ex.id, idsEtq(u), jaTem);
      falt.forEach(e => vinculos.push({ etiqueta_id: e, entidade: "processo", entidade_id: ex.id, created_by: opts.userId ?? null }));
      const precisaAcomp = temEtiquetaCaptura(u.etiquetas) && !ex.acomp;
      if (precisaAcomp) ligar.push(ex.id);
      const clienteId = (u.cliente && cliMap.get(normNome(u.cliente))) || opts.clientePadraoId || null;
      const precisaCliente = !ex.clienteId && !!clienteId;
      if (precisaCliente && clienteId) clientesParaPreencher.set(clienteId, [...(clientesParaPreencher.get(clienteId) ?? []), ex.id]);
      if (falt.length || precisaAcomp || precisaCliente) corrigidos++;
      etiquetasAcrescentadas += falt.length;
      const correcoes = [falt.length ? `${falt.length} etiqueta(s) acrescentada(s)` : "", precisaAcomp ? "acompanhamento ligado" : "", precisaCliente ? "cliente preenchido" : ""].filter(Boolean);
      resultados.push({ numero: u.numero, linhaOriginal: u.linhaOriginal, status: "ja_existia",
        mensagem: correcoes.length ? `Já existia; ${correcoes.join(", ")}` : "Já existia; nada a corrigir" });
    }
    await gravarVinculos(vinculos);
    for (const ch of dividir(ligar, 100)) {
      const { error } = await supabase.from("processos").update({ acompanhamento_especial: true } as any).in("id", ch);
      if (error) avisos.push(`Falha ao ligar acompanhamento: ${error.message}`);
    }
    for (const [clienteId, ids] of clientesParaPreencher) {
      for (const ch of dividir(ids, 200)) {
        const { error } = await supabase.from("processos").update({ cliente_id: clienteId } as any).in("id", ch).is("cliente_id", null);
        if (error) avisos.push(`Falha ao preencher cliente em processos existentes: ${error.message}`);
      }
    }
    feitosEx += lote.length;
    onProgress?.(5 + (feitosEx / Math.max(unicos.length, 1)) * 95, `Corrigindo existentes: ${feitosEx} de ${jaExist.length}`, { novos: 0, corrigidos, erros: 0 });
    await ceder();
  }

  // Processo já cadastrado em outra coordenação: vincula esta como responsável e só preenche vazios.
  const nomesCoord = new Map<string, string>();
  const nomeCoord = async (id: string) => {
    if (!nomesCoord.has(id)) {
      const { data } = await supabase.from("coordenacoes").select("nome").eq("id", id).maybeSingle();
      nomesCoord.set(id, (data as any)?.nome ?? "outra coordenação");
    }
    return nomesCoord.get(id)!;
  };
  const vincularOutra = async (u: LinhaCompleta, row: Record<string, any>): Promise<ResultadoLinha | null> => {
    const { data: achados } = await supabase.rpc("find_processo_by_digits" as any, { _numero: u.numero } as any);
    const p = (achados as any[])?.[0];
    if (!p?.id) return null;
    const coordNome = p.coordenacao_id ? await nomeCoord(p.coordenacao_id) : "sem coordenação";
    const base = { numero: u.numero, linhaOriginal: u.linhaOriginal, coordenacaoOutra: coordNome };
    const { error: eV } = await supabase.from("processos_coordenacoes_responsaveis")
      .upsert({ processo_id: p.id, coordenacao_id: coordenacaoId, principal: false, created_by: opts.userId ?? null } as any, { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true });
    if (eV) {
      const { data: ja } = await supabase.from("processos_coordenacoes_responsaveis").select("id").eq("processo_id", p.id).eq("coordenacao_id", coordenacaoId).maybeSingle();
      if (!ja) {
        const ins = await supabase.from("processos_coordenacoes_responsaveis").insert({ processo_id: p.id, coordenacao_id: coordenacaoId, principal: false, created_by: opts.userId ?? null } as any);
        if (ins.error) return { ...base, status: "erro", mensagem: `Existe na ${coordNome}; não foi possível vincular: ${traduzirErro(ins.error)}` };
      }
    }
    const candidatos: Record<string, any> = { ...row };
    delete candidatos.numero; delete candidatos.coordenacao_id;
    if (!candidatos.acompanhamento_especial) delete candidatos.acompanhamento_especial;
    const cols = Object.keys(candidatos);
    let preenchidos: string[] = [];
    if (cols.length) {
      const { data: atual } = await supabase.from("processos").select(cols.join(",")).eq("id", p.id).maybeSingle();
      if (atual) {
        const upd = camposParaPreencher(atual as any, candidatos);
        if (Object.keys(upd).length) {
          const { data: ok } = await supabase.from("processos").update(upd as any).eq("id", p.id).select("id");
          if (ok?.length) preenchidos = Object.keys(upd);
        }
      }
    }
    const jaTem = new Set<string>();
    const { data: vs } = await supabase.from("etiquetas_itens").select("entidade_id, etiqueta_id").eq("entidade", "processo").eq("entidade_id", p.id);
    (vs ?? []).forEach((v: any) => jaTem.add(`${v.entidade_id}|${v.etiqueta_id}`));
    const falt = vinculosFaltantes(p.id, idsEtq(u), jaTem);
    await gravarVinculos(falt.map(e => ({ etiqueta_id: e, entidade: "processo", entidade_id: p.id, created_by: opts.userId ?? null })), u.numero);
    return { ...base, status: "vinculado_outra", camposPreenchidos: preenchidos,
      mensagem: `Já existia na ${coordNome}; coordenação vinculada como responsável` + (preenchidos.length ? `; campos preenchidos: ${preenchidos.map(rotuloCampo).join(", ")}` : "; nenhum campo vazio a preencher") + (falt.length ? `; ${falt.length} etiqueta(s) aplicada(s)` : "") };
  };

  // 6) Novos: inserção em lotes
  const novos = unicos.filter(u => !existentes.has(soDigitos(u.numero)));
  const lotes = dividir(novos, LOTE);
  let feitos = 0;
  for (const lote of lotes) {
    if (opts.cancelado?.()) { avisos.push(`Cancelado após ${feitos} processos novos.`); break; }
    const rows = lote.map(u => ({
      ...u.dados,
      numero: u.numero.trim(),
      coordenacao_id: coordenacaoId,
      advogado_responsavel_id: (u.responsavel && respMap.get(normNome(u.responsavel))) || opts.membroPadraoId || null,
      cliente_id: (u.cliente && cliMap.get(normNome(u.cliente))) || opts.clientePadraoId || null,
      acompanhamento_especial: temEtiquetaCaptura(u.etiquetas),
    }));
    let inseridos: { id: string; numero: string }[] = [];
    const { data, error } = await supabase.from("processos").insert(rows as any).select("id, numero");
    if (error) {
      for (let i = 0; i < rows.length; i++) {
        if (opts.cancelado?.()) break;
        const r = await supabase.from("processos").insert(rows[i] as any).select("id, numero").single();
        if (r.error) {
          const dup = r.error.code === "23505" || /duplicate key/i.test(r.error.message);
          const v = dup ? await vincularOutra(lote[i], rows[i]) : null;
          if (v) resultados.push(v);
          else resultados.push({ numero: lote[i].numero, linhaOriginal: lote[i].linhaOriginal, status: "erro", mensagem: traduzirErro(r.error) });
        }
        else inseridos.push(r.data as any);
      }
    } else inseridos = (data ?? []) as any;

    const idPorNum = new Map(inseridos.map(p => [soDigitos(p.numero), p.id]));
    const vinculos: any[] = [];
    for (const u of lote) {
      const id = idPorNum.get(soDigitos(u.numero));
      if (!id) continue;
      existentes.set(soDigitos(u.numero), { id, acomp: temEtiquetaCaptura(u.etiquetas), clienteId: (u.cliente && cliMap.get(normNome(u.cliente))) || opts.clientePadraoId || null });
      numPorId.set(id, u.numero);
      resultados.push({ numero: u.numero, linhaOriginal: u.linhaOriginal, status: "importado" });
      for (const eid of new Set(idsEtq(u))) vinculos.push({ etiqueta_id: eid, entidade: "processo", entidade_id: id, created_by: opts.userId ?? null });
    }
    await gravarVinculos(vinculos);
    feitos += lote.length;
    onProgress?.(5 + ((feitosEx + feitos) / Math.max(unicos.length, 1)) * 95, `Gravando novos: ${feitos} de ${novos.length}`, { novos: resultados.filter(r => r.status === "importado").length, corrigidos, erros: resultados.filter(r => r.status === "erro").length });
    await ceder();
  }
  if (errosEtiqueta) avisos.push(`${errosEtiqueta} etiqueta(s) não puderam ser aplicadas.`);
  if (clientesCriados) avisos.push(`${clientesCriados} cliente(s) cadastrado(s) e vinculado(s) à coordenação.`);
  if (clientesNaoEncontrados.size) avisos.push(`${clientesNaoEncontrados.size} cliente(s) com pendência; veja a aba Clientes.`);

  return { resultados, avisos, falhasEtiqueta, clientesDetalhes, clientesCriados,
    clientesNaoEncontrados: Array.from(clientesNaoEncontrados.entries()).map(([nome, processos]) => ({ nome, processos })).sort((a, b) => b.processos - a.processos), repetidas, totalUnicos: unicos.length, corrigidos, etiquetasAcrescentadas, errosEtiqueta, cancelado: !!opts.cancelado?.() };
}
