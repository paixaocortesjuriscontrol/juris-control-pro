/**
 * Extratores de campos a partir do bloco BRUTO da Judit (`_judit_raw`).
 *
 * Contexto: payloads antigos gravados em `judit_logs` / `consultas_judit` vinham
 * da função `buscar-judit` (recorte TST) e NÃO trazem campos como valor da causa,
 * comarca, vara, UF, instância, assunto ou os andamentos — mas esses dados estão
 * dentro de `_judit_raw` (`cache_lookup` e `crawler.page_data[].response_data`).
 *
 * Estas funções não fazem nenhuma chamada de rede: só releem o que já foi pago.
 */

export interface JuditStepNormalizado {
  data: string;
  descricao: string;
  codigo: string | number | null;
  instancia: string | null;
  tribunal: string | null;
  raw: any;
}

export interface JuditParteNormalizada {
  nome: string;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  lado_efetivo: string | null;
  is_advogado: boolean;
  advogado_de: string | null;
  oab: string | null;
  raw: any;
}

const isoToInput = (iso: any): string | null => {
  if (!iso) return null;
  const s = String(iso).substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Todas as "response_data" disponíveis no payload (cache + crawler + topo). */
function coletarInstancias(payload: any): any[] {
  const out: any[] = [];
  const push = (rd: any) => {
    if (rd && typeof rd === "object" && !out.includes(rd)) out.push(rd);
  };
  const raw = payload?._judit_raw || payload?.judit_raw || null;
  push(raw?.cache_lookup);
  for (const it of raw?.crawler?.page_data || []) push(it?.response_data);
  // Alguns payloads guardam o response_data direto no topo
  push(payload?.response_data);
  if (Array.isArray(payload?.page_data)) {
    for (const it of payload.page_data) push(it?.response_data);
  }
  return out;
}

/** Instância mais completa (mais andamentos). */
function melhorInstancia(payload: any): any | null {
  const rds = coletarInstancias(payload);
  if (!rds.length) return null;
  return rds
    .slice()
    .sort((a, b) => (b?.steps?.length || 0) - (a?.steps?.length || 0))[0];
}

function justicaPorTribunal(t?: string | null): string | null {
  const s = String(t || "").toUpperCase();
  if (!s) return null;
  if (s === "TST" || /^TRT\d*$/.test(s)) return "Trabalhista";
  if (s === "STJ" || s === "STF") return "Superior";
  if (/^TRF\d*$/.test(s)) return "Federal";
  if (/^TJ[A-Z]{2}$/.test(s)) return "Estadual";
  return null;
}

function areaPorJustica(j: string | null): string | null {
  if (!j) return null;
  if (j === "Trabalhista") return "Trabalhista";
  if (j === "Federal") return "Cível Federal";
  if (j === "Estadual") return "Cível";
  return null;
}

function esferaPorTribunal(t?: string | null): string | null {
  const s = String(t || "").toUpperCase();
  if (!s) return null;
  if (s === "TST" || /^TRT\d*$/.test(s) || s === "STJ" || s === "STF" || /^TRF\d*$/.test(s)) return "Federal";
  if (/^TJ[A-Z]{2}$/.test(s)) return "Estadual";
  return null;
}

function instanciaPorTribunal(t?: string | null, orgao?: string | null): string | null {
  const s = String(t || "").toUpperCase();
  if (s === "TST" || s === "STJ" || s === "STF") return "Superior";
  if (/^TRT\d*$/.test(s) || /^TRF\d*$/.test(s)) return "2ª Instância";
  const o = String(orgao || "").toLowerCase();
  if (/vara|juizado|comarca/.test(o)) return "1ª Instância";
  if (/c[âa]mara|turma|se[çc][ãa]o/.test(o)) return "2ª Instância";
  return null;
}

function sistemaDoCrawler(rd: any): string | null {
  const src = String(rd?.crawler?.source_name || "").toUpperCase();
  if (!src) return null;
  if (src.includes("PJE")) return "PJe";
  if (src.includes("PROJUDI")) return "Projudi";
  if (src.includes("ESAJ") || src.includes("E-SAJ")) return "eSAJ";
  if (src.includes("EPROC")) return "eProc";
  return null;
}

function ufDoPayload(rd: any, tribAcr: string | null): string | null {
  const t = String(tribAcr || "").toUpperCase();
  const m = t.match(/^TJ([A-Z]{2})$/);
  if (m) return m[1];
  const st = rd?.courts?.[0]?.state || rd?.state || null;
  return st ? String(st).toUpperCase().slice(0, 2) : null;
}

function nomesAssuntos(rd: any): string | null {
  const subs = Array.isArray(rd?.subjects) ? rd.subjects : [];
  const nomes = subs.map((s: any) => String(s?.name || "").trim()).filter(Boolean);
  return nomes.length ? nomes.join(" / ") : null;
}

function situacaoPadronizada(rd: any): string | null {
  const s = String(rd?.status || rd?.phase || "").toUpperCase();
  if (!s) return null;
  if (s.includes("ATIVO") || s === "ATIVA") return "ativo";
  if (s.includes("ARQUIVAD") || s.includes("FINALIZAD")) return "arquivado_definitivamente";
  if (s.includes("SUSPENS")) return "suspenso";
  if (s.includes("BAIXAD")) return "encerrado";
  return null;
}

/**
 * Deriva os campos do formulário a partir do bloco bruto da Judit.
 * Retorna apenas chaves com valor (nunca vazio/null).
 */
export function extrairCamposDoJuditRaw(payload: any): Record<string, any> {
  const rd = melhorInstancia(payload);
  if (!rd) return {};

  const tribAcr: string | null = rd?.tribunal_acronym || null;
  const courts = Array.isArray(rd?.courts) ? rd.courts : [];
  const c0 = courts[0] || {};
  const orgao = c0?.name ? String(c0.name).trim() : null;
  const comarca = c0?.city || c0?.district || c0?.county || null;
  const vara = orgao && /\bvara\b|\bju[ií]zo\b|\bjuizado\b/i.test(orgao) ? orgao : null;
  const classe = Array.isArray(rd?.classifications) && rd.classifications[0]?.name
    ? String(rd.classifications[0].name)
    : null;
  const assunto = nomesAssuntos(rd);
  const justica = justicaPorTribunal(tribAcr);
  const valorCausa = rd?.amount != null ? Number(rd.amount) : (rd?.value != null ? Number(rd.value) : null);

  const out: Record<string, any> = {
    valor_causa: valorCausa != null && !Number.isNaN(valorCausa) ? valorCausa : null,
    orgao_julgador: orgao,
    comarca: comarca ? String(comarca) : null,
    vara,
    uf: ufDoPayload(rd, tribAcr),
    tribunal: tribAcr,
    justica,
    area: areaPorJustica(justica),
    esfera: esferaPorTribunal(tribAcr),
    instancia: instanciaPorTribunal(tribAcr, orgao),
    sistema: sistemaDoCrawler(rd),
    classe,
    natureza: classe,
    assunto,
    materia: assunto,
    status: situacaoPadronizada(rd),
    data_distribuicao: isoToInput(rd?.distribution_date),
  };

  // Pedidos: aproxima pelos assuntos secundários (subjects)
  const subs = Array.isArray(rd?.subjects) ? rd.subjects : [];
  if (subs.length > 1) {
    out.pedidos = subs.map((s: any) => String(s?.name || "").trim()).filter(Boolean).join("; ");
  }
  if (rd?.secrecy_level != null) out.segredo_justica = Number(rd.secrecy_level) > 0;

  // Terceiros: partes que não são do polo ativo/passivo nem advogados
  const terceiros = extrairPartesDoJuditRaw(payload)
    .filter((p) => !p.is_advogado && p.lado_efetivo !== "ACTIVE" && p.lado_efetivo !== "PASSIVE")
    .map((p) => p.nome);
  if (terceiros.length) out.terceiro_envolvido = [...new Set(terceiros)].join(" / ");

  // Datas derivadas dos andamentos
  const steps = extrairStepsDoJuditRaw(payload);
  const ordenadosAsc = steps.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  const acharData = (re: RegExp) =>
    ordenadosAsc.find((s) => re.test(s.descricao.toLowerCase()))?.data || null;
  out.data_citacao = acharData(/cita[çc][ãa]o/);
  out.data_recebimento = acharData(/recebid|autuaç|autuad|registrad/);
  if (steps.length) {
    const ultimo = steps[0]?.descricao || "";
    out.fase = ultimo.length > 120 ? `${ultimo.slice(0, 117)}...` : ultimo || null;
  }

  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v === null || v === undefined || String(v).trim() === "") delete out[k];
  }
  return out;
}

/**
 * Partes + advogados de TODAS as instâncias do payload, incluindo os patronos
 * aninhados em `parties[].lawyers` (que a Judit devolve por parte).
 */
export function extrairPartesDoJuditRaw(payload: any): JuditParteNormalizada[] {
  const out: JuditParteNormalizada[] = [];
  const seen = new Set<string>();
  const advVistos = new Set<string>();
  const chave = (nome: string, doc: string | null, adv: boolean, de: string | null) =>
    `${String(doc || "").replace(/\D/g, "") || nome.toUpperCase()}|${adv ? "A" : "P"}|${String(de || "").toUpperCase()}`;

  const push = (p: Partial<JuditParteNormalizada> & { nome?: any }) => {
    const nome = String(p?.nome || "").trim();
    if (!nome) return;
    const adv = !!p.is_advogado;
    const docNorm = String(p.documento || "").replace(/\D/g, "") || nome.toUpperCase();
    // Advogado sem vínculo é descartado quando a mesma pessoa já entrou vinculada a uma parte
    if (adv && !p.advogado_de && advVistos.has(docNorm)) return;
    const k = chave(nome, (p.documento as any) ?? null, adv, (p.advogado_de as any) ?? null);
    if (seen.has(k)) return;
    seen.add(k);
    if (adv && p.advogado_de) advVistos.add(docNorm);
    const lado = String(p.lado_efetivo || p.polo || "").toUpperCase();
    out.push({
      nome,
      documento: (p.documento as any) ?? null,
      tipo_pessoa: (p.tipo_pessoa as any) ?? (adv ? "ADVOGADO" : null),
      polo: (p.polo as any) ?? null,
      lado_efetivo: lado === "ACTIVE" || lado === "PASSIVE" ? lado : null,
      is_advogado: adv,
      advogado_de: (p.advogado_de as any) ?? null,
      oab: (p.oab as any) ?? null,
      raw: p.raw ?? p,
    });
  };

  // 1) Já normalizado pela edge function
  for (const p of Array.isArray(payload?.parties_detail) ? payload.parties_detail : []) push(p);

  // 2) Bloco bruto (todas as instâncias)
  for (const rd of coletarInstancias(payload)) {
    for (const p of Array.isArray(rd?.parties) ? rd.parties : []) {
      const tipo = String(p?.person_type || "").toUpperCase();
      push({
        nome: p?.name,
        documento: p?.main_document || null,
        tipo_pessoa: p?.person_type || null,
        polo: p?.side || null,
        lado_efetivo: p?.side || null,
        is_advogado: tipo === "ADVOGADO",
        oab: p?.lawyer_documents || p?.oab || null,
        raw: p,
      });
      for (const l of Array.isArray(p?.lawyers) ? p.lawyers : []) {
        push({
          nome: l?.name,
          documento: l?.main_document || null,
          tipo_pessoa: "ADVOGADO",
          polo: p?.side || null,
          lado_efetivo: p?.side || null,
          is_advogado: true,
          advogado_de: String(p?.name || "").trim() || null,
          oab: l?.oab || l?.lawyer_documents || null,
          raw: l,
        });
      }
    }
  }

  return out.sort((a, b) => {
    if (a.is_advogado !== b.is_advogado) return a.is_advogado ? 1 : -1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/**
 * Andamentos normalizados do payload — aceita tanto o retorno novo
 * (`movimentacoes[]` da função busca-judit-processos-e-casos) quanto o bloco
 * bruto de payloads antigos.
 */
export function extrairStepsDoJuditRaw(payload: any): JuditStepNormalizado[] {
  const out: JuditStepNormalizado[] = [];
  const seen = new Set<string>();

  const push = (data: string | null, descricaoRaw: any, codigo: any, rd: any, s: any) => {
    const descricao = (typeof descricaoRaw === "string" ? descricaoRaw : JSON.stringify(descricaoRaw ?? "")).trim();
    if (!data || !descricao) return;
    const key = `${data}|${descricao}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      data,
      descricao,
      codigo: codigo ?? null,
      instancia: rd?.instance != null ? String(rd.instance) : null,
      tribunal: rd?.tribunal_acronym || null,
      raw: s,
    });
  };

  // 1) Formato novo já normalizado
  const jaNormalizados = Array.isArray(payload?.movimentacoes) ? payload.movimentacoes : [];
  for (const m of jaNormalizados) {
    push(isoToInput(m?.data), m?.descricao, m?.codigo, m, m?.raw ?? m);
  }

  // 2) Steps brutos de todas as instâncias
  for (const rd of coletarInstancias(payload)) {
    const steps = Array.isArray(rd?.steps) ? rd.steps : [];
    for (const s of steps) {
      push(
        isoToInput(s?.step_date || s?.date || s?.movement_date),
        s?.content ?? s?.title ?? s?.description ?? "",
        s?.step_code ?? s?.code ?? s?.movement_code ?? null,
        rd,
        s,
      );
    }
  }

  out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return out;
}