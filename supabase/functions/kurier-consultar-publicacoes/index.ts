import { createHash } from "node:crypto";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierAuthHeaders,
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";
import {
  condicaoConcomitanteAtendida,
  extrairPalavraChavePura,
  normalizar,
  shouldExclude,
  type Monitoramento,
} from "../_kurier-shared/djenMatch.ts";

// Consome publicações pendentes de UMA credencial Kurier em lotes de 50.
// Persiste em kurier_publicacoes_raw (idempotente por id_kurier) e em
// publicacoes_djen (origem='kurier'). Confirma o lote para tirar da fila.
//
// Body: { credencial_id: uuid, max_lotes?: number (default 1) }

interface KurierPub {
  id?: string | number;
  Id?: string | number;
  idPublicacao?: string | number;
  numero_processo?: string;
  NumeroProcesso?: string;
  conteudo?: string;
  Conteudo?: string;
  data_disponibilizacao?: string;
  DataDisponibilizacao?: string;
  data_publicacao?: string;
  DataPublicacao?: string;
  tribunal?: string;
  Tribunal?: string;
  diario?: string;
  Diario?: string;
  termo?: string;
  Termo?: string;
  [k: string]: any;
}

function pickId(p: KurierPub): string | null {
  const raw =
    p.id ?? p.Id ??
    (p as any).idPublicacao ?? (p as any).IdPublicacao ??
    (p as any).IDPublicacao ?? (p as any).id_publicacao ?? (p as any).ID_PUBLICACAO ??
    (p as any).codigoPublicacao ?? (p as any).CodigoPublicacao ??
    (p as any).codPublicacao ?? (p as any).CodPublicacao ??
    (p as any).cdPublicacao ?? (p as any).CdPublicacao ??
    (p as any).codigo ?? (p as any).Codigo ??
    (p as any).idDocumento ?? (p as any).IdDocumento ??
    (p as any).cdDocumento ?? (p as any).CdDocumento ??
    (p as any).codigoDocumento ?? (p as any).CodigoDocumento ??
    (p as any).numeroDocumento ?? (p as any).NumeroDocumento ??
    (p as any).protocolo ?? (p as any).Protocolo ??
    (p as any).hash ?? (p as any).Hash ??
    (p as any).guid ?? (p as any).Guid;
  if (raw === undefined || raw === null || raw === "") return null;
  return String(raw);
}

function pickStr(p: KurierPub, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = (p as any)[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function normalizedKey(k: string): string {
  return String(k || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function pickDeep(p: unknown, keys: string[], maxDepth = 4): string | null {
  const targets = new Set(keys.map(normalizedKey));
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number): string | null => {
    if (!value || typeof value !== "object" || depth > maxDepth || seen.has(value)) return null;
    seen.add(value);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (targets.has(normalizedKey(k)) && v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          const found = walk(item, depth + 1);
          if (found) return found;
        }
      } else {
        const found = walk(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(p, 0);
}

function collectSearchableText(value: unknown, maxDepth = 5): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (v === null || v === undefined || depth > maxDepth) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      const s = String(v).trim();
      if (s) parts.push(s);
      return;
    }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) for (const item of v) walk(item, depth + 1);
    else for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      parts.push(k);
      walk(item, depth + 1);
    }
  };
  walk(value, 0);
  return parts.join("\n");
}

function extractProcessoFromText(texto: string): string | null {
  const m = texto.match(/\d{7}[-.\s]?\d{2}[-.\s]?\d{4}[-.\s]?\d[-.\s]?\d{2}[-.\s]?\d{4}/);
  return m ? m[0] : null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const s = value.trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}${br[4] ? `T${br[4]}` : "T12:00:00"}.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function containsPhraseOrAnd(searchNorm: string, termo: string | null | undefined): boolean {
  const raw = String(termo || "").trim();
  if (!raw) return false;
  const parts = raw.split("+").map((p) => normalizar(extrairPalavraChavePura(p.trim()))).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => new RegExp(`(?:^|\\s)${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(searchNorm));
}

function kurierMatchesMonitoramento(searchable: string, monitoramento: Monitoramento): boolean {
  const searchNorm = normalizar(searchable);
  const searchDigits = searchable.replace(/\D/g, "");
  const tipo = monitoramento.tipo;
  const termos = [monitoramento.termo_busca, ...(monitoramento.termos_or || [])].filter(Boolean);

  let ok = false;
  if (tipo === "processo") {
    ok = termos.some((t) => {
      const digits = String(t || "").replace(/\D/g, "");
      return digits ? searchDigits.includes(digits) : containsPhraseOrAnd(searchNorm, t);
    });
  } else if (tipo === "advogado") {
    const oabDigits = String(monitoramento.oab || "").replace(/\D/g, "");
    ok = termos.some((t) => containsPhraseOrAnd(searchNorm, t)) || (!!oabDigits && searchDigits.includes(oabDigits));
  } else {
    // Kurier não traz o mesmo bloco estruturado do DJEN; para parte/palavra-chave,
    // validamos no payload inteiro recebido da Kurier.
    ok = termos.some((t) => containsPhraseOrAnd(searchNorm, t));
  }

  if (!ok) return false;
  return condicaoConcomitanteAtendida(searchable, monitoramento.condicao_concomitante);
}

function extractPublicacoes(payload: any): KurierPub[] {
  if (Array.isArray(payload)) return payload;
  const keys = ["publicacoes", "Publicacoes", "PUBLICACOES", "items", "Itens", "data", "Data", "dados", "Dados", "resultado", "Resultado", "results"];
  for (const k of keys) if (Array.isArray(payload?.[k])) return payload[k];
  for (const v of Object.values(payload || {})) if (Array.isArray(v)) return v as KurierPub[];
  return [];
}

function normalizeProcesso(n: string | null): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  return digits.length >= 15 ? digits : n;
}

const LOTE_SIZE = 50;
const DELAY_MS = 150;
const MAX_LOTES_PER_CALL = 1;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador");
    if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const credencial_id: string | undefined = body.credencial_id;
    // Edge Functions têm orçamento curto de CPU/tempo; cada chamada processa só 1 lote
    // e o frontend faz novas chamadas pequenas até esvaziar a fila da credencial.
    const max_lotes: number = Math.min(MAX_LOTES_PER_CALL, Math.max(1, Number(body.max_lotes ?? 1)));
    const monitoramento_ids: string[] | undefined = Array.isArray(body.monitoramento_ids)
      ? body.monitoramento_ids.filter((x: any) => typeof x === "string" && x)
      : undefined;
    const coordenacao_id: string | undefined = typeof body.coordenacao_id === "string" && body.coordenacao_id
      ? body.coordenacao_id : undefined;
    const data_inicio: string | undefined = typeof body.data_inicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.data_inicio)
      ? body.data_inicio : undefined;
    const data_fim: string | undefined = typeof body.data_fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.data_fim)
      ? body.data_fim : undefined;
    if (!credencial_id) return jsonResponse({ error: "credencial_id obrigatório" }, 400);

    const { data: cred, error: credErr } = await admin
      .from("kurier_credenciais")
      .select("id, login, senha_encrypted, ativo")
      .eq("id", credencial_id)
      .maybeSingle();
    if (credErr || !cred) return jsonResponse({ error: "Credencial não encontrada" }, 404);
    if (!cred.senha_encrypted) return jsonResponse({ error: "Credencial sem senha" }, 400);

    const senha = await decryptKurier(cred.senha_encrypted);
    const baseUrl = await getKurierBaseUrlFromDb(admin);

    // Carrega monitoramentos ativos para aplicar os termos do DJEN nas publicações
    // recebidas via Kurier. Sem monitoramento que case, a publicação é descartada
    // (consumida na fila, mas não persistida em publicacoes_djen).
    let monitQuery = admin
      .from("monitoramentos_djen")
      .select("id, tipo, termo_busca, oab, uf, exclusoes, condicao_concomitante, termos_or, descricao, buscar_parte, coordenacao_id, criado_por")
      .eq("ativo", true);
    if (monitoramento_ids?.length) monitQuery = monitQuery.in("id", monitoramento_ids);
    if (coordenacao_id) monitQuery = monitQuery.eq("coordenacao_id", coordenacao_id);
    const { data: monitsRaw } = await monitQuery;
    const monitoramentos: (Monitoramento & { coordenacao_id?: string | null })[] = (monitsRaw ?? []) as any;
    console.log(`[kurier] monitoramentos carregados: ${monitoramentos.length}`);

    // Pré-indexa monitoramentos por palavra-chave pura normalizada para
    // evitar varrer 271 monitoramentos por publicação (CPU exceeded).
    const monitsByTermo = new Map<string, (Monitoramento & { coordenacao_id?: string | null })[]>();
    for (const m of monitoramentos) {
      const termos = [m.termo_busca, ...(m.termos_or || [])].filter(Boolean) as string[];
      for (const t of termos) {
        const key = normalizar(extrairPalavraChavePura(String(t).trim())).split(/\s+/)[0];
        if (!key) continue;
        const arr = monitsByTermo.get(key) || [];
        arr.push(m);
        monitsByTermo.set(key, arr);
      }
    }

    // Registra execução
    const { data: execIns } = await admin
      .from("kurier_execucoes")
      .insert({
        credencial_id: cred.id,
        login_usado: cred.login,
        lote: "consulta",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    const execId = execIns?.id;

    let totalRecebidas = 0;
    let totalNovas = 0;
    let totalDuplicadas = 0;
    let totalConfirmadas = 0;
    let totalDescartadas = 0;
    let ultimoErro: string | null = null;
    let lotesProcessados = 0;

    for (let lote = 0; lote < max_lotes; lote++) {
      const qp: Record<string, string> = {};
      if (data_inicio) {
        qp.dataInicio = data_inicio;
        qp.dataDisponibilizacaoInicio = data_inicio;
      }
      if (data_fim) {
        qp.dataFim = data_fim;
        qp.dataDisponibilizacaoFim = data_fim;
      }
      const url = buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarPublicacoes", qp);

      let resp: Response;
      let texto = "";
      try {
        resp = await fetch(url, { method: "GET", headers: buildKurierAuthHeaders(cred.login, senha) });
        texto = await resp.text();
      } catch (e) {
        ultimoErro = `Falha rede lote ${lote}: ${String(e)}`;
        break;
      }
      if (resp.status < 200 || resp.status >= 300) {
        ultimoErro = resp.status === 401
          ? "HTTP 401 — login ou senha recusados pela Kurier"
          : `HTTP ${resp.status} lote ${lote}: ${texto.trim() ? texto.slice(0, 200) : "resposta sem mensagem"}`;
        break;
      }

      let pubs: KurierPub[] = [];
      try {
        const j = JSON.parse(texto);
        pubs = extractPublicacoes(j);
      } catch (e) {
        ultimoErro = `JSON inválido lote ${lote}: ${texto.slice(0, 200)}`;
        break;
      }

      if (!pubs.length) break; // Sem mais publicações pendentes

      // Log do shape da primeira publicação do primeiro lote para diagnóstico
      if (lote === 0 && pubs[0]) {
        try {
          console.log(`[kurier] payload keys lote0:`, Object.keys(pubs[0]).join(","));
          console.log(`[kurier] payload sample lote0:`, JSON.stringify(pubs[0]).slice(0, 1500));
        } catch {}
      }

      lotesProcessados++;
      totalRecebidas += pubs.length;
      const idsConfirmar: string[] = [];

      const rawRows: any[] = [];

      for (const p of pubs) {
        // Kurier sempre traz o conteúdo completo em `Texto`; evita walk recursivo
        // pesado em CPU. Inclui também TermoPesquisa/Processo para matching.
        const searchable = [
          (p as any).Texto ?? (p as any).texto ?? "",
          (p as any).TermoPesquisa ?? "",
          (p as any).Processo ?? "",
        ].filter(Boolean).join("\n");
        const idK = pickId(p) ?? pickDeep(p, [
          "id", "idPublicacao", "IDPublicacao", "codigoPublicacao", "codPublicacao", "cdPublicacao",
          "codigo", "idDocumento", "cdDocumento", "codigoDocumento", "numeroDocumento", "protocolo", "guid", "hash",
        ]);
        // Mesmo sem id reconhecido, persiste o payload para inspecionar depois.
        // Usa fallback hash para evitar perder o payload e poder reprocessar.
        const idKEff = idK ?? `unknown_${sha256(JSON.stringify(p)).slice(0, 24)}`;

        const numero = normalizeProcesso(pickStr(p,
          "numero_processo", "NumeroProcesso", "processo", "Processo",
          "numProcesso", "NumProcesso", "nrProcesso", "NrProcesso",
          "numeroProcesso", "processoNumero", "ProcessoNumero",
          "numeroProcessoFormatado", "NumeroProcessoFormatado",
          "processoCNJ", "ProcessoCNJ") ?? pickDeep(p, [
            "numero_processo", "NumeroProcesso", "processo", "Processo",
            "numProcesso", "nrProcesso", "numeroProcesso", "processoNumero",
            "numeroProcessoFormatado", "processoCNJ", "cnj",
          ]) ?? extractProcessoFromText(searchable));
        const conteudo = pickStr(p,
          "conteudo", "Conteudo", "texto", "Texto",
          "mensagem", "Mensagem", "descricao", "Descricao",
          "textoPublicacao", "TextoPublicacao", "corpo", "Corpo",
          "publicacao", "Publicacao", "movimento", "Movimento",
          "andamento", "Andamento", "intimacao", "Intimacao") ?? searchable;
        const dataDisp = pickStr(p,
          "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao",
          "dtDisponibilizacao", "DtDisponibilizacao",
          "dataDisponibilidade", "DataDisponibilidade") ?? pickDeep(p, [
            "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao",
            "dtDisponibilizacao", "dataDisponibilidade", "disponibilizacao",
          ]);
        const dataPub = pickStr(p,
          "data_publicacao", "DataPublicacao", "dataPublicacao",
          "dtPublicacao", "DtPublicacao",
          "dataMovimento", "DataMovimento", "dtMovimento", "DtMovimento") ?? pickDeep(p, [
            "data_publicacao", "DataPublicacao", "dataPublicacao", "dtPublicacao",
            "dataMovimento", "dtMovimento", "publicacao", "data",
          ]);
        const tribunal = pickStr(p,
          "tribunal", "Tribunal", "siglaTribunal", "SiglaTribunal",
          "orgao", "Orgao", "orgaoJulgador", "OrgaoJulgador") ?? pickDeep(p, [
            "tribunal", "siglaTribunal", "orgao", "orgaoJulgador", "diario",
          ]);

        let publicacaoDjenId: string | null = null;
        let motivoDescarte: string | null = null;
        if (!idK) motivoDescarte = "id_nao_reconhecido";

        if (numero && conteudo) {
          // 1) Matching: Kurier já filtrou pelo TermoPesquisa. Reduz drasticamente
          // o universo de monitoramentos avaliados usando o índice por palavra-chave.
          const termoKurier = String((p as any).TermoPesquisa || "").trim();
          const termoKey = normalizar(extrairPalavraChavePura(termoKurier)).split(/\s+/)[0];
          const candidatos = (termoKey && monitsByTermo.get(termoKey)) || monitoramentos;
          let matched: (Monitoramento & { coordenacao_id?: string | null }) | null = null;
          let motivoExcl: string | null = null;
          for (const m of candidatos) {
            try {
              if (!kurierMatchesMonitoramento(searchable || conteudo, m as Monitoramento)) continue;
              const motivo = shouldExclude(searchable || conteudo, m.exclusoes || [], null, null);
              if (motivo) { motivoExcl = motivo; continue; }
              matched = m;
              break;
            } catch (e) {
              console.warn(`[kurier] erro matching monit ${m.id}:`, String(e));
            }
          }

          if (!matched) {
            totalDescartadas++;
            motivoDescarte = motivoDescarte ?? (motivoExcl ? `excluido_por_termo:${motivoExcl}` : "sem_match_monitoramento");
          } else {
            const hashConteudo = sha256(`${numero}|${dataDisp ?? dataPub ?? ""}|${conteudo}`);
            const digits = numero.replace(/\D/g, "");

            // 2) Dedup: tenta inserir direto; a constraint monitoramento_id+hash_conteudo
            // transforma repetição em 23505 sem SELECT por publicação.
            const payload: any = {
              monitoramento_id: matched.id,
              coordenacao_id: matched.coordenacao_id ?? null,
              processo_numero: numero,
              conteudo,
              fonte: "kurier",
              hash_conteudo: hashConteudo,
              dedup_processo_digits: digits || null,
              dedup_data_ref: (toIsoDate(dataDisp ?? dataPub) ?? "").slice(0, 10) || null,
              tribunal,
              data_disponibilizacao: toIsoDate(dataDisp) ?? null,
              data_publicacao: toIsoDate(dataPub) ?? null,
              tipo_publicacao: "intimacao",
            };

            const { data: insPub, error: pubErr } = await admin
              .from("publicacoes_djen")
              .insert(payload)
              .select("id")
              .maybeSingle();

            if (pubErr) {
              if ((pubErr as any).code === "23505") {
                totalDuplicadas++;
                motivoDescarte = "duplicada_hash";
              } else {
                console.warn("[kurier] erro insert publicacoes_djen:", pubErr.message);
                totalDuplicadas++;
                motivoDescarte = `erro_insert:${pubErr.message.slice(0, 60)}`;
              }
            } else if (insPub) {
              publicacaoDjenId = insPub.id;
              totalNovas++;
            }
          }
        } else {
          totalDescartadas++;
          if (!conteudo) motivoDescarte = motivoDescarte ?? "sem_conteudo";
          else if (!numero) motivoDescarte = motivoDescarte ?? "sem_processo";
        }

        rawRows.push({
          id_kurier: idKEff,
          credencial_id: cred.id,
          login_usado: cred.login,
          payload: p as any,
          publicacao_djen_id: publicacaoDjenId,
          motivo_descarte: motivoDescarte,
          recebida_em: new Date().toISOString(),
        });

        if (idK) idsConfirmar.push(idK);
      }

      if (rawRows.length) {
        const { error: rawErr } = await admin
          .from("kurier_publicacoes_raw")
          .upsert(rawRows, { onConflict: "id_kurier", ignoreDuplicates: true });
        if (rawErr) console.warn("[kurier] erro upsert raw:", rawErr.message);
      }

      // Confirma o lote
      if (idsConfirmar.length) {
        try {
          const confirmUrl = buildKurierUrl(baseUrl, "/api/KJuridico/ConfirmarPublicacoes", {
          });
          const cResp = await fetch(confirmUrl, {
            method: "POST",
            headers: buildKurierAuthHeaders(cred.login, senha, { "Content-Type": "application/json" }),
            body: JSON.stringify(idsConfirmar.map((id) => ({ id }))),
          });
          if (cResp.ok) {
            totalConfirmadas += idsConfirmar.length;
            await admin
              .from("kurier_publicacoes_raw")
              .update({ confirmada: true, confirmada_em: new Date().toISOString() })
              .in("id_kurier", idsConfirmar);
          } else {
            ultimoErro = `Falha confirmacao HTTP ${cResp.status}`;
          }
        } catch (e) {
          ultimoErro = `Falha confirmacao: ${String(e)}`;
        }
      }

      if (pubs.length < LOTE_SIZE) break; // último lote
      await delay(DELAY_MS);
    }

    await admin
      .from("kurier_credenciais")
      .update({
        ultimo_uso: new Date().toISOString(),
        ultimo_status: ultimoErro
          ? `Erro: ${ultimoErro.slice(0, 120)}`
          : `OK (${totalNovas} novas, ${totalDuplicadas} dup, ${totalConfirmadas} confirm)`,
      })
      .eq("id", cred.id);

    if (execId) {
      await admin
        .from("kurier_execucoes")
        .update({
          total_recebidas: totalRecebidas,
          total_novas: totalNovas,
          total_duplicadas: totalDuplicadas,
          total_descartadas: totalDescartadas,
          total_confirmadas: totalConfirmadas,
          erro: ultimoErro,
          metadata: { lotes_processados: lotesProcessados },
          finalizado_em: new Date().toISOString(),
        })
        .eq("id", execId);
    }

    return jsonResponse({
      ok: !ultimoErro,
      credencial_id: cred.id,
      login: cred.login,
      lotes_processados: lotesProcessados,
      total_recebidas: totalRecebidas,
      total_novas: totalNovas,
      total_duplicadas: totalDuplicadas,
      total_descartadas: totalDescartadas,
      total_confirmadas: totalConfirmadas,
      erro: ultimoErro,
    });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});